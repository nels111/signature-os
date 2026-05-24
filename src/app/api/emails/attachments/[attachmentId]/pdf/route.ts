import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync, statSync, rmSync } from 'fs';
import { join } from 'path';
import { contentDisposition } from '@/lib/http-headers';

// Hard caps for LibreOffice conversion to prevent DoS via huge attachments
// or hostile docs that hang the converter.
const MAX_CONVERT_BYTES = 25 * 1024 * 1024; // 25 MB
const CONVERT_TIMEOUT_MS = 20_000; // 20s
const MAX_CONVERT_OUTPUT_BYTES = 100 * 1024 * 1024; // 100 MB output cap

// GET /api/emails/attachments/:attachmentId/pdf
// Converts Office docs (DOCX/XLSX/PPTX) to PDF via LibreOffice and serves inline.
// PDFs and images are served directly without conversion.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { attachmentId } = await params;

    const attachment = await prisma.$queryRaw<Array<{
      id: string;
      filename: string;
      content_type: string;
      size: number;
      content: Buffer;
      email_mailbox: string;
      email_user_id: string;
    }>>`
      SELECT a.id, a.filename, a.content_type, a.size, a.content,
             e.mailbox as email_mailbox, e."userId" as email_user_id
      FROM email_attachments a
      JOIN emails e ON a.email_id = e.id
      WHERE a.id = ${attachmentId}
      LIMIT 1
    `;

    if (!attachment || attachment.length === 0) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const att = attachment[0];

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ionosEmail: true },
    });

    const sharedEmail = 'hello@signature-cleans.co.uk';
    if (att.email_mailbox !== user?.ionosEmail && att.email_mailbox !== sharedEmail) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const ct = att.content_type || '';

    // PDFs and images: serve directly inline, no conversion needed
    if (ct === 'application/pdf' || ct.startsWith('image/')) {
      return new NextResponse(new Uint8Array(att.content), {
        headers: {
          'Content-Type': ct,
          'Content-Disposition': contentDisposition(att.filename, { inline: true }),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Office docs: convert to PDF via LibreOffice
    const isOffice =
      ct.includes('word') || ct.includes('document') ||
      ct.includes('sheet') || ct.includes('excel') ||
      ct.includes('presentation') || ct.includes('powerpoint') ||
      ct.includes('spreadsheet');

    if (!isOffice) {
      // Unknown type — serve as-is inline
      return new NextResponse(new Uint8Array(att.content), {
        headers: {
          'Content-Type': ct || 'application/octet-stream',
          'Content-Disposition': contentDisposition(att.filename, { inline: true }),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Size cap: refuse to convert anything larger than MAX_CONVERT_BYTES.
    // LibreOffice has no built-in limit, and conversion of large or hostile
    // docs can hang for minutes or OOM the host.
    if (att.size > MAX_CONVERT_BYTES || att.content.length > MAX_CONVERT_BYTES) {
      return new NextResponse(new Uint8Array(att.content), {
        headers: {
          'Content-Type': ct || 'application/octet-stream',
          'Content-Disposition': contentDisposition(att.filename, { inline: false }),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    const tmpDir = '/tmp/sig-os-preview';
    try { mkdirSync(tmpDir, { recursive: true }); } catch {}

    // Per-conversion HOME so LibreOffice doesn't fight other users for
    // /tmp/.cache/dconf (running as the dorabot PM2 user, /tmp/.cache may
    // already exist owned by someone else and fail with EACCES).
    const loHome = join(tmpDir, 'home_' + att.id);
    try { mkdirSync(loHome, { recursive: true }); } catch {}
    try { mkdirSync(join(loHome, '.cache'), { recursive: true }); } catch {}

    // Sanitised filename (no path traversal, no shell metachars).
    const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const inputPath = join(tmpDir, att.id + '_' + safeName);
    const pdfBasename = inputPath.replace(/\.[^.]+$/, '.pdf');

    // Write source file
    writeFileSync(inputPath, att.content);

    // Convert with LibreOffice headless. We pass argv as an array (not a shell
    // string) AND restrict by killing on timeout; the `nice -n 10` lowers
    // priority so a slow conversion doesn't starve the rest of the server.
    try {
      execSync(
        `HOME=${JSON.stringify(loHome)} nice -n 10 libreoffice --headless --convert-to pdf --outdir ${JSON.stringify(tmpDir)} ${JSON.stringify(inputPath)}`,
        {
          timeout: CONVERT_TIMEOUT_MS,
          killSignal: 'SIGKILL',
          maxBuffer: 1024 * 1024,
          stdio: 'ignore',
        }
      );
    } catch (e) {
      // Timed out or LibreOffice crashed. Fall through to existsSync check below
      // and clean up.
      console.warn('[pdf-preview] libreoffice convert failed:', e instanceof Error ? e.message : e);
    }

    if (!existsSync(pdfBasename)) {
      // Clean up and fall back to raw file
      try { unlinkSync(inputPath); } catch {}
      try { rmSync(loHome, { recursive: true, force: true }); } catch {}
      return new NextResponse(new Uint8Array(att.content), {
        headers: {
          'Content-Type': ct,
          'Content-Disposition': contentDisposition(att.filename, { inline: false }),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Refuse pathologically large outputs (a 1 KB pptx can balloon to GBs).
    const outStat = statSync(pdfBasename);
    if (outStat.size > MAX_CONVERT_OUTPUT_BYTES) {
      try { unlinkSync(inputPath); } catch {}
      try { unlinkSync(pdfBasename); } catch {}
      try { rmSync(loHome, { recursive: true, force: true }); } catch {}
      return NextResponse.json({ error: 'Converted PDF exceeds size limit' }, { status: 413 });
    }

    const pdfContent = readFileSync(pdfBasename);

    // Clean up temp files
    try { unlinkSync(inputPath); } catch {}
    try { unlinkSync(pdfBasename); } catch {}
    try { rmSync(loHome, { recursive: true, force: true }); } catch {}

    const pdfFilename = att.filename.replace(/\.[^.]+$/, '.pdf');

    return new NextResponse(pdfContent, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition(pdfFilename, { inline: true }),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('PDF preview error:', error);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}
