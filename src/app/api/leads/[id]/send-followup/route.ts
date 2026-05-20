import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail, getSmtpConfig } from '@/lib/smtp';

export const runtime = 'nodejs';

const FROM_EMAIL = process.env.NOTIFICATION_EMAIL || 'hello@signature-cleans.co.uk';
const FROM_NAME = 'Signature Cleans';
const HELLO_PASSWORD = process.env.HELLO_MAILBOX_PASSWORD || '';

// Email copy per outcome
const FOLLOWUP_TEMPLATES: Record<string, { subject: string; text: string; html: string }> = {
  answered: {
    subject: 'Great speaking with you — Signature Cleans',
    text: `Hi {{firstName}},

Thanks for taking the time to speak with me today.

As promised, I wanted to follow up with a bit more about Signature Cleans. We work with commercial businesses across Devon, Cornwall, and Somerset, keeping their premises clean and well-presented — with a focus on reliability and quality.

If you'd like to explore what we could do for {{company}}, I'd be happy to arrange a quick site visit at a time that suits you.

Many Thanks,
Signature Cleans
01392 931035
hello@signature-cleans.co.uk`,
    html: `<p>Hi {{firstName}},</p>
<p>Thanks for taking the time to speak with me today.</p>
<p>As promised, I wanted to follow up with a bit more about Signature Cleans. We work with commercial businesses across Devon, Cornwall, and Somerset, keeping their premises clean and well-presented — with a focus on reliability and quality.</p>
<p>If you'd like to explore what we could do for {{company}}, I'd be happy to arrange a quick site visit at a time that suits you.</p>
<p>Many Thanks,<br>Signature Cleans<br>01392 931035<br>hello@signature-cleans.co.uk</p>`,
  },
  no_answer: {
    subject: 'Following up — Signature Cleans',
    text: `Hi {{firstName}},

I tried to reach you earlier today but wasn't able to get through. I'll try again soon, but feel free to reach us at 01392 931035 or reply to this email if it's easier.

We work with commercial businesses across Devon, Cornwall, and Somerset. If keeping your premises clean and well-managed is something you'd like to explore, we'd love to have a chat.

Many Thanks,
Signature Cleans
01392 931035
hello@signature-cleans.co.uk`,
    html: `<p>Hi {{firstName}},</p>
<p>I tried to reach you earlier today but wasn't able to get through. I'll try again soon, but feel free to reach us at 01392 931035 or reply to this email if it's easier.</p>
<p>We work with commercial businesses across Devon, Cornwall, and Somerset. If keeping your premises clean and well-managed is something you'd like to explore, we'd love to have a chat.</p>
<p>Many Thanks,<br>Signature Cleans<br>01392 931035<br>hello@signature-cleans.co.uk</p>`,
  },
  voicemail: {
    subject: 'Left you a voicemail — Signature Cleans',
    text: `Hi {{firstName}},

I just left you a voicemail — I'm reaching out from Signature Cleans, a commercial cleaning company serving businesses across Devon, Cornwall, and Somerset.

I'll try you again, but if it's easier please give us a call on 01392 931035 or reply here.

Many Thanks,
Signature Cleans
01392 931035
hello@signature-cleans.co.uk`,
    html: `<p>Hi {{firstName}},</p>
<p>I just left you a voicemail — I'm reaching out from Signature Cleans, a commercial cleaning company serving businesses across Devon, Cornwall, and Somerset.</p>
<p>I'll try you again, but if it's easier please give us a call on 01392 931035 or reply here.</p>
<p>Many Thanks,<br>Signature Cleans<br>01392 931035<br>hello@signature-cleans.co.uk</p>`,
  },
  callback_needed: {
    subject: 'Confirming our call — Signature Cleans',
    text: `Hi {{firstName}},

Thanks for speaking with me briefly. I'll call you back at the agreed time as discussed.

In the meantime, if you have any questions or want to learn more about Signature Cleans, feel free to reach us at 01392 931035 or reply to this email.

Many Thanks,
Signature Cleans
01392 931035
hello@signature-cleans.co.uk`,
    html: `<p>Hi {{firstName}},</p>
<p>Thanks for speaking with me briefly. I'll call you back at the agreed time as discussed.</p>
<p>In the meantime, if you have any questions or want to learn more about Signature Cleans, feel free to reach us at 01392 931035 or reply to this email.</p>
<p>Many Thanks,<br>Signature Cleans<br>01392 931035<br>hello@signature-cleans.co.uk</p>`,
  },
  gatekeeper: {
    subject: 'Following up — Signature Cleans',
    text: `Hi {{firstName}},

I was trying to reach the person responsible for facilities or cleaning at {{company}}. I'd love to have a quick conversation to see if Signature Cleans could be a good fit.

We work with commercial businesses across Devon, Cornwall, and Somerset. Could you let me know the best person to speak with, or feel free to pass this along?

Many Thanks,
Signature Cleans
01392 931035
hello@signature-cleans.co.uk`,
    html: `<p>Hi {{firstName}},</p>
<p>I was trying to reach the person responsible for facilities or cleaning at {{company}}. I'd love to have a quick conversation to see if Signature Cleans could be a good fit.</p>
<p>We work with commercial businesses across Devon, Cornwall, and Somerset. Could you let me know the best person to speak with, or feel free to pass this along?</p>
<p>Many Thanks,<br>Signature Cleans<br>01392 931035<br>hello@signature-cleans.co.uk</p>`,
  },
};

function merge(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { outcome, notes } = body;
    if (!outcome) {
      return NextResponse.json({ error: 'outcome is required' }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, companyName: true, contactName: true, email: true },
    });

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (!lead.email) return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 });

    const template = FOLLOWUP_TEMPLATES[outcome] || FOLLOWUP_TEMPLATES.no_answer;
    const firstName = lead.contactName?.trim().split(' ')[0] || 'there';
    const vars = { firstName, company: lead.companyName };

    const config = getSmtpConfig(FROM_EMAIL, HELLO_PASSWORD);

    await sendEmail(config, {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: lead.email,
      subject: merge(template.subject, vars),
      text: merge(template.text, vars),
      html: merge(template.html, vars),
    });

    // Log email activity
    await prisma.activity.create({
      data: {
        activityType: 'email',
        description: `Follow-up email sent after call (outcome: ${outcome})${notes ? ` — ${notes}` : ''}`,
        entityType: 'lead',
        entityId: lead.id,
        userId: session.user.id,
        metadata: { outcome, notes: notes || undefined, sentFrom: FROM_EMAIL, sentTo: lead.email },
      },
    });

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error('Send followup error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
