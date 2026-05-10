import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface SendEmailOptions {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
}

const IONOS_SMTP = {
  host: 'smtp.ionos.co.uk',
  port: 587,
};

export function getSmtpConfig(email: string, password: string): SmtpConfig {
  return {
    ...IONOS_SMTP,
    user: email,
    pass: password,
  };
}

export async function sendEmail(
  config: SmtpConfig,
  options: SendEmailOptions
): Promise<{ messageId: string }> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false, // STARTTLS
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });

  const result = await transporter.sendMail({
    from: options.from,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    cc: options.cc
      ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc)
      : undefined,
    bcc: options.bcc
      ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc)
      : undefined,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo: options.replyTo,
    inReplyTo: options.inReplyTo,
    references: options.references,
  });

  return { messageId: result.messageId };
}

export async function verifyConnection(config: SmtpConfig): Promise<boolean> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  try {
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}
