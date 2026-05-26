export function extractName(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim().replace(/^"(.*)"$/, '$1');
  return from.split('@')[0];
}

export function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

export function getInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 40%)`;
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-GB', { weekday: 'short' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatFullDate(dateStr: string): string {
  // Strip timezone suffixes like " | Europe/London" from Connecteam-generated dates
  const cleaned = dateStr.replace(/\s*\|.*$/, '').trim();
  const date = new Date(cleaned);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(contentType: string): string {
  if (contentType.startsWith('image/')) return '🖼';
  if (contentType === 'application/pdf') return '📄';
  if (contentType.includes('word') || contentType.includes('document')) return '📝';
  if (contentType.includes('sheet') || contentType.includes('excel') || contentType.includes('csv')) return '📊';
  if (contentType.includes('zip') || contentType.includes('compressed')) return '🗜';
  return '📎';
}

export function isOfficeDoc(contentType: string): boolean {
  return (
    contentType.includes('word') ||
    contentType.includes('spreadsheet') ||
    contentType.includes('excel') ||
    contentType.includes('powerpoint') ||
    contentType.includes('presentation') ||
    contentType.includes('officedocument')
  );
}

export function isDownloadType(contentType: string): boolean {
  return (
    contentType.includes('zip') ||
    contentType.includes('compressed') ||
    contentType.includes('octet-stream')
  );
}

export function attachmentUrl(id: string, contentType: string): string {
  if (isOfficeDoc(contentType)) return `/api/emails/attachments/${id}/pdf`;
  return `/api/emails/attachments/${id}?inline=1`;
}

export function formatRecipients(addresses: string[]): string {
  return addresses.map((addr) => {
    const name = extractName(addr);
    const email = extractEmail(addr);
    return name !== email ? `${name} <${email}>` : email;
  }).join(', ');
}
