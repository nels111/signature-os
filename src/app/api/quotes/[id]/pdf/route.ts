import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';
import { contentDisposition } from '@/lib/http-headers';

// GET /api/quotes/[id]/pdf - Stream the generated PDF inline.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        pdfPath: true,
        createdBy: true,
        companyName: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!quote.pdfPath || !existsSync(quote.pdfPath)) {
      return NextResponse.json(
        { error: 'PDF not found. Please regenerate the quote.' },
        { status: 404 },
      );
    }

    const pdfBuffer = readFileSync(quote.pdfPath);
    const filename = basename(quote.pdfPath);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition(filename, { inline: true }),
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    console.error('[quotes/pdf] failed', err);
    return NextResponse.json({ error: 'Failed to load PDF' }, { status: 500 });
  }
}
