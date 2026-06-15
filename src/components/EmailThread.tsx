'use client';

import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Paperclip } from 'lucide-react';
import { EmailBodyIframe } from '@/app/dashboard/emails/EmailBodyIframe';
import {
  extractName, extractEmail, getInitial, hashColor, formatFullDate,
  formatFileSize, attachmentUrl, isDownloadType,
} from '@/app/dashboard/emails/emailHelpers';

export interface ThreadEmail {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  date: string;
  isRead: boolean;
  openCount: number;
  folder: string;
  attachments: Array<{ id: string; filename: string; contentType: string; size: number }>;
}

function isOutbound(from: string): boolean {
  return /signature-cleans\.co\.uk/i.test(from);
}

export function EmailThread({ emails }: { emails?: ThreadEmail[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!emails || emails.length === 0) {
    return (
      <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Email thread</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No emails linked yet. Emails to or from this address sync in automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Emails</h3>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{emails.length}</span>
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {emails.map((em) => {
          const out = isOutbound(em.from);
          const senderName = extractName(em.from) || extractEmail(em.from);
          const open = openId === em.id;
          return (
            <div key={em.id} style={{ borderColor: 'var(--border)' }}>
              {/* Row header */}
              <button
                onClick={() => setOpenId(open ? null : em.id)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors"
                style={{ background: open ? 'var(--surface-hover)' : 'transparent' }}
              >
                <div
                  className="relative flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                  style={{ background: hashColor(senderName) }}
                >
                  {getInitial(senderName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {out
                      ? <ArrowUpRight size={14} style={{ color: 'var(--brand-blue)', flexShrink: 0 }} />
                      : <ArrowDownLeft size={14} style={{ color: '#16a34a', flexShrink: 0 }} />}
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {senderName}
                    </span>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {em.subject || '(no subject)'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {new Date(em.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {out && em.openCount > 0 && (
                      <span className="text-[10px] font-medium" style={{ color: '#16a34a' }}>Opened</span>
                    )}
                    {em.attachments?.length > 0 && (
                      <Paperclip size={11} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded: real email */}
              {open && (
                <div className="px-4 pb-4" style={{ background: 'var(--surface)' }}>
                  <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                    <div>{formatFullDate(em.date)}</div>
                    <div className="truncate">To: {em.to?.join(', ')}{em.cc?.length ? ` · Cc: ${em.cc.join(', ')}` : ''}</div>
                  </div>
                  <div className="rounded-lg border" style={{ borderColor: 'var(--border)', background: '#fff' }}>
                    {em.bodyHtml
                      ? <EmailBodyIframe html={em.bodyHtml} />
                      : <pre className="text-sm whitespace-pre-wrap p-3" style={{ color: 'var(--text-primary)', fontFamily: 'inherit' }}>{em.bodyText || '(no content)'}</pre>}
                  </div>
                  {em.attachments?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        Attachments ({em.attachments.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {em.attachments.map((a) => (
                          <a
                            key={a.id}
                            href={attachmentUrl(a.id, a.contentType)}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={isDownloadType(a.contentType) ? a.filename : undefined}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border hover:opacity-80"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                          >
                            <Paperclip size={12} style={{ color: 'var(--text-muted)' }} />
                            <span className="truncate max-w-[180px]">{a.filename}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{formatFileSize(a.size)}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
