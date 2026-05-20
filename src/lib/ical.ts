/**
 * RFC 5545 iCalendar utility.
 * Generates VCALENDAR/VEVENT content for meeting invites and RSVP handling.
 */

function foldLine(line: string): string {
  // RFC 5545: lines longer than 75 octets should be folded
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join('\r\n');
}

function icalDate(d: Date): string {
  // Format: 20240315T090000Z
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export interface ICalAttendee {
  email: string;
  name?: string;
  partstat?: 'NEEDS-ACTION' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
}

export interface ICalEventOptions {
  uid: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay?: boolean;
  notes?: string | null;
  organiserName: string;
  organiserEmail: string;
  attendees: ICalAttendee[];
  method?: 'REQUEST' | 'CANCEL';
  sequence?: number;
}

export function generateICalInvite(opts: ICalEventOptions): string {
  const method = opts.method ?? 'REQUEST';
  const sequence = opts.sequence ?? 0;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Signature Cleans OS//EN',
    `METHOD:${method}`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    foldLine(`UID:${opts.uid}@signature-cleans.co.uk`),
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${icalDate(new Date())}`,
  ];

  if (opts.allDay) {
    const startStr = opts.startDate.toISOString().slice(0, 10).replace(/-/g, '');
    const endStr = opts.endDate.toISOString().slice(0, 10).replace(/-/g, '');
    lines.push(`DTSTART;VALUE=DATE:${startStr}`);
    lines.push(`DTEND;VALUE=DATE:${endStr}`);
  } else {
    lines.push(`DTSTART:${icalDate(opts.startDate)}`);
    lines.push(`DTEND:${icalDate(opts.endDate)}`);
  }

  lines.push(foldLine(`SUMMARY:${escapeText(opts.title)}`));

  if (opts.notes) {
    lines.push(foldLine(`DESCRIPTION:${escapeText(opts.notes)}`));
    lines.push(foldLine(`LOCATION:${escapeText(opts.notes.split('\n')[0])}`));
  }

  lines.push(
    foldLine(`ORGANIZER;CN="${escapeText(opts.organiserName)}":MAILTO:${opts.organiserEmail}`)
  );

  for (const att of opts.attendees) {
    const partstat = att.partstat ?? 'NEEDS-ACTION';
    const cn = att.name ? `;CN="${escapeText(att.name)}"` : '';
    lines.push(
      foldLine(
        `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=${partstat};RSVP=TRUE${cn}:MAILTO:${att.email}`
      )
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Parse a METHOD:REPLY iCal string.
 * Returns { uid, attendeeEmail, partstat } or null if unparseable.
 */
export interface ICalReply {
  uid: string;
  attendeeEmail: string;
  partstat: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'NEEDS-ACTION';
}

export function parseICalReply(icsContent: string): ICalReply | null {
  const lines = icsContent.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r?\n/);

  const method = lines.find(l => l.startsWith('METHOD:'))?.split(':')[1]?.trim().toUpperCase();
  if (method !== 'REPLY') return null;

  const uidLine = lines.find(l => l.startsWith('UID:'));
  if (!uidLine) return null;
  const rawUid = uidLine.replace('UID:', '').trim();
  // Strip @signature-cleans.co.uk suffix if present
  const uid = rawUid.replace(/@signature-cleans\.co\.uk$/, '');

  const attendeeLine = lines.find(l => l.startsWith('ATTENDEE'));
  if (!attendeeLine) return null;

  const emailMatch = attendeeLine.match(/MAILTO:(.+)$/i);
  if (!emailMatch) return null;
  const attendeeEmail = emailMatch[1].trim().toLowerCase();

  const partstatMatch = attendeeLine.match(/PARTSTAT=([^;:]+)/i);
  const rawPartstat = partstatMatch?.[1]?.toUpperCase() ?? 'NEEDS-ACTION';
  const partstat = (['ACCEPTED', 'DECLINED', 'TENTATIVE', 'NEEDS-ACTION'].includes(rawPartstat)
    ? rawPartstat
    : 'NEEDS-ACTION') as ICalReply['partstat'];

  return { uid, attendeeEmail, partstat };
}
