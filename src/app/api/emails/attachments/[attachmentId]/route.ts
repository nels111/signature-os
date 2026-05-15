import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { contentDisposition } from '@/lib/http-headers';

// GET /api/emails/attachments/:attachmentId - Download an email attachment
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

    // Fetch attachment with parent email for access check
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

    // Security: user can only access their own emails or the shared mailbox
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ionosEmail: true },
    });

    const sharedEmail = 'hello@signature-cleans.co.uk';
    if (att.email_mailbox !== user?.ionosEmail && att.email_mailbox !== sharedEmail) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const inline = request.nextUrl.searchParams.get('inline') === '1';
    const disposition = contentDisposition(att.filename, { inline });

    return new NextResponse(new Uint8Array(att.content), {
      headers: {
        'Content-Type': att.content_type || 'application/octet-stream',
        'Content-Disposition': disposition,
        'Content-Length': att.size.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Attachment download error:', error);
    return NextResponse.json({ error: 'Failed to fetch attachment' }, { status: 500 });
  }
}
