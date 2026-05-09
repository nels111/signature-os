import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export interface MailboxConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  tls: boolean;
}

export interface ParsedEmail {
  messageId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  date: Date;
  folder: string;
}

const IONOS_IMAP = {
  host: 'imap.ionos.co.uk',
  port: 993,
  tls: true,
};

export function getImapConfig(email: string, password: string): MailboxConfig {
  return {
    ...IONOS_IMAP,
    user: email,
    pass: password,
  };
}

export async function fetchEmails(
  config: MailboxConfig,
  folder: string = 'INBOX',
  since?: Date,
  limit: number = 50
): Promise<ParsedEmail[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });

  const emails: ParsedEmail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);

    try {
      // Default to last 30 days if no since date, avoids scanning entire mailbox
      const defaultSince = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const messages = client.fetch(
        { since: defaultSince },
        {
          envelope: true,
          source: true,
          uid: true,
        }
      );

      let count = 0;
      for await (const msg of messages) {
        if (count >= limit) break;

        try {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);

          emails.push({
            messageId: parsed.messageId || msg.uid.toString(),
            from: parsed.from?.text || '',
            to: parsed.to
              ? (Array.isArray(parsed.to) ? parsed.to.map(t => t.text) : [parsed.to.text])
              : [],
            cc: parsed.cc
              ? (Array.isArray(parsed.cc) ? parsed.cc.map(c => c.text) : [parsed.cc.text])
              : [],
            subject: parsed.subject || '(No Subject)',
            bodyText: parsed.text || null,
            bodyHtml: parsed.html || null,
            date: parsed.date || new Date(),
            folder,
          });
          count++;
        } catch {
          // Skip unparseable messages
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  // Sort newest first
  return emails.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function fetchFolders(config: MailboxConfig): Promise<string[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });

  try {
    await client.connect();
    const folders = await client.list();
    return folders.map(f => f.path);
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function markAsRead(
  config: MailboxConfig,
  folder: string,
  uid: number
): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
