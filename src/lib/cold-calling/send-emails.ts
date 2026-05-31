/**
 * Cold calling email dispatcher.
 * Called by the outcome API route after a call is logged.
 * Sends the correct email based on outcome, attaches assets as needed.
 */

import { sendEmail, getSmtpConfig } from '@/lib/smtp';
import {
  buildGatekeeperEmail,
  buildCallbackEmail,
  buildSendInfoEmail,
  buildSiteVisitEmail,
} from './email-templates';

const FROM_NAME = 'Nick Stentiford';
const FROM_EMAIL = 'hello@signature-cleans.co.uk';
const REPLY_TO = 'nick@signature-cleans.co.uk';

function getSmtp() {
  const pass = process.env.HELLO_MAILBOX_PASSWORD;
  if (!pass) throw new Error('HELLO_MAILBOX_PASSWORD not set');
  return getSmtpConfig(FROM_EMAIL, pass);
}

function formatCallbackDateTime(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const date = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
  const hours = d.getHours();
  const mins = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  const h = hours % 12 || 12;
  const time = `${h}:${mins}${ampm}`;
  return { date, time };
}

// ─── Exported send functions ──────────────────────────────────────────────────

export async function sendGatekeeperEmail(opts: {
  to: string;
  firstName: string;
  company: string;
}) {
  const template = buildGatekeeperEmail({ firstName: opts.firstName, company: opts.company });
  await sendEmail(getSmtp(), {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
    to: opts.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
    attachments: template.attachments,
  });
}

export async function sendCallbackEmail(opts: {
  to: string;
  firstName: string;
  callbackAt: string; // ISO datetime
}) {
  const { date, time } = formatCallbackDateTime(opts.callbackAt);
  const template = buildCallbackEmail({ firstName: opts.firstName, callbackDate: date, callbackTime: time });
  await sendEmail(getSmtp(), {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
    to: opts.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
    attachments: template.attachments,
  });
}

export async function sendInfoEmail(opts: {
  to: string;
  firstName: string;
  company: string;
}) {
  const template = buildSendInfoEmail({ firstName: opts.firstName, company: opts.company });
  await sendEmail(getSmtp(), {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
    to: opts.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
    attachments: template.attachments,
  });
}

export async function sendSiteVisitEmail(opts: {
  to: string;
  firstName: string;
  company: string;
  siteVisitAt: string; // ISO datetime
  siteVisitAddress?: string;
}) {
  const { date, time } = formatCallbackDateTime(opts.siteVisitAt);
  const template = buildSiteVisitEmail({
    firstName: opts.firstName,
    company: opts.company,
    visitDate: date,
    visitTime: time,
    visitAddress: opts.siteVisitAddress,
  });
  await sendEmail(getSmtp(), {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    replyTo: REPLY_TO,
    to: opts.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
    attachments: template.attachments,
  });
}
