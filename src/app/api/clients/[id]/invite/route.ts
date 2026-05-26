export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail, getSmtpConfig } from '@/lib/smtp';
import { requireRole } from '@/lib/role-gate';
import crypto from 'crypto';

const FROM_EMAIL = 'hello@signature-cleans.co.uk';
const FROM_NAME = 'Signature Cleans';
const HELLO_PASSWORD = process.env.HELLO_MAILBOX_PASSWORD || '';
// Client portal lives at a separate domain — configured via env
const PORTAL_URL = process.env.CLIENT_PORTAL_URL || 'https://portal.signature-cleans.co.uk';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireRole(['admin', 'sales']);

  const { id } = await params;

  const client = await prisma.clientAccount.findUnique({
    where: { id },
    include: { sites: { select: { name: true } } },
  });

  if (!client) {
    return Response.json({ error: 'Client not found' }, { status: 404 });
  }

  if (client.portalStatus === 'suspended') {
    return Response.json({ error: 'Cannot invite a suspended account' }, { status: 400 });
  }

  // Generate a new magic link token (plain text stored + SHA256 hash stored in DB)
  const plainToken = generateToken();
  const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.clientAccount.update({
    where: { id },
    data: {
      magicLinkToken: hashedToken,
      magicLinkExpiresAt: expiresAt,
      portalStatus: 'invited',
      invitedAt: new Date(),
    },
  });

  const portalLink = `${PORTAL_URL}/auth/login?token=${plainToken}`;
  const siteName = client.sites[0]?.name ?? 'your premises';

  // Send invite email via IONOS SMTP
  try {
    await sendEmail(
      getSmtpConfig(FROM_EMAIL, HELLO_PASSWORD),
      {
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: client.contactEmail,
        subject: 'Your Signature Cleans client portal is ready',
        text: `Hi ${client.contactName},

Your Signature Cleans client portal is now ready.

Use the link below to access your portal for ${siteName}. You can view audit reports, cleaning schedules, and raise any issues or service requests directly with us.

Access your portal:
${portalLink}

This link expires in 7 days. If you need a new one, please contact us at hello@signature-cleans.co.uk or call 01392 931035.

Many Thanks,
Signature Cleans
01392 931035
hello@signature-cleans.co.uk`,
        html: `<p>Hi ${client.contactName},</p>
<p>Your Signature Cleans client portal is now ready.</p>
<p>Use the link below to access your portal for <strong>${siteName}</strong>. You can view audit reports, cleaning schedules, and raise any issues or service requests directly with us.</p>
<p><a href="${portalLink}" style="display:inline-block;padding:12px 24px;background:#2056A4;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Access your portal</a></p>
<p style="font-size:13px;color:#666;">This link expires in 7 days. If you need a new one, please contact us at <a href="mailto:hello@signature-cleans.co.uk">hello@signature-cleans.co.uk</a> or call 01392 931035.</p>
<p>Many Thanks,<br>Signature Cleans<br>01392 931035</p>`,
      }
    );
  } catch (err) {
    // Log but don't fail — admin can copy the link manually
    console.error('[invite] email failed:', err);
    return Response.json({
      ok: true,
      warning: 'Invite created but email delivery failed. Copy the link manually.',
      portalLink,
    });
  }

  return Response.json({ ok: true, portalStatus: 'invited' });
}
