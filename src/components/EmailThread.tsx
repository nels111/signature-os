'use client';

// Per-entity email thread (Zoho-style). Renders emails synced + linked to a
// lead or contact: SENT/IN direction, open-tracking, attachments, expandable
// bodies. Shared by lead and contact detail views.

export interface ThreadEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  bodyText: string | null;
  date: string;
  isRead: boolean;
  openCount: number;
  folder: string;
  attachments: Array<{ id: string; filename: string }>;
}

export function EmailThread({ emails }: { emails?: ThreadEmail[] }) {
  return (
    <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        Email thread ({emails?.length || 0})
      </h3>
      {emails && emails.length > 0 ? (
        <div className="space-y-2">
          {emails.map((em) => {
            const outbound = /signature-cleans\.co\.uk/i.test(em.from);
            return (
              <details key={em.id} className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                <summary className="cursor-pointer list-none px-3 py-2.5 flex items-start gap-3">
                  <span
                    className="mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={outbound
                      ? { background: 'var(--brand-blue-subtle)', color: 'var(--brand-blue)' }
                      : { background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
                  >
                    {outbound ? 'SENT' : 'IN'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {em.subject || '(no subject)'}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {outbound ? `To: ${em.to?.join(', ')}` : `From: ${em.from}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(em.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {outbound && em.openCount > 0 && (
                        <span className="text-[10px] font-medium" style={{ color: 'var(--status-success)' }}>Opened</span>
                      )}
                      {em.attachments?.length > 0 && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>📎 {em.attachments.length}</span>
                      )}
                    </div>
                  </div>
                </summary>
                <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-sm whitespace-pre-wrap mt-2" style={{ color: 'var(--text-primary)' }}>
                    {em.bodyText || '(no text content)'}
                  </p>
                  {em.attachments?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {em.attachments.map((a) => (
                        <span key={a.id} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
                          📎 {a.filename}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No emails linked yet. Emails to or from this address sync in automatically.
        </p>
      )}
    </div>
  );
}
