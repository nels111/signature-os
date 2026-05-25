'use client';

import { useState, useEffect } from 'react';
import { EmailFull, EmailDetailProps } from './emailTypes';
import { extractEmail, formatFullDate, formatRecipients } from './emailHelpers';
import { MessageItem } from './MessageItem';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div style={{ padding: '20px 16px' }}>
      <style>{`
        @keyframes skeleton-shimmer { 0%{opacity:1}50%{opacity:0.4}100%{opacity:1} }
        .sk { animation: skeleton-shimmer 1.6s ease-in-out infinite; background: var(--border); border-radius: 8px; }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div className="sk" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="sk" style={{ height: 16, width: '55%', marginBottom: 8 }} />
          <div className="sk" style={{ height: 13, width: '40%' }} />
        </div>
      </div>
      {[95, 80, 70, 90, 60, 75, 85].map((w, i) => (
        <div key={i} className="sk" style={{ height: 14, width: `${w}%`, marginBottom: 10 }} />
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function EmailDetail({
  emailIds,
  onReply,
  onBack,
  onDelete,
  onArchive,
  onMarkRead,
  activeFolder = 'INBOX',
}: EmailDetailProps) {
  const [emails, setEmails]       = useState<EmailFull[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function fetchThread() {
      setLoading(true);
      try {
        const results = await Promise.all(
          emailIds.map(async (id) => {
            const res = await fetch(`/api/emails/${id}`);
            const data = await res.json();
            return data.email as EmailFull | null;
          })
        );
        if (cancelled) return;
        const validEmails = results.filter((e): e is EmailFull => e !== null);
        validEmails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setEmails(validEmails);
        if (validEmails.length > 0) setExpandedIds(new Set([validEmails[validEmails.length - 1].id]));
        for (const email of validEmails) { if (!email.isRead) onMarkRead(email.id, true); }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchThread();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailIds.join(',')]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const buildReplyBody = (email: EmailFull) =>
    `<br><br><div style="border-left:2px solid #ddd;padding-left:8px;margin-left:8px;color:#666">
      <p>On ${formatFullDate(email.date)}, ${email.from} wrote:</p>
      ${email.bodyHtml || `<pre>${email.bodyText || ''}</pre>`}
    </div>`;

  const handleReply = (email: EmailFull) => onReply({
    to: extractEmail(email.from),
    subject: email.subject.startsWith('Re: ') ? email.subject : `Re: ${email.subject}`,
    inReplyTo: email.messageId, references: email.messageId,
    bodyHtml: buildReplyBody(email),
  });

  const handleReplyAll = (email: EmailFull) => {
    const uniqueRecipients = [...new Set([...email.to, ...email.cc])].filter((a) => !a.includes(email.mailbox));
    onReply({
      to: uniqueRecipients.join(', '),
      subject: email.subject.startsWith('Re: ') ? email.subject : `Re: ${email.subject}`,
      inReplyTo: email.messageId, references: email.messageId,
      bodyHtml: buildReplyBody(email),
    });
  };

  const handleForward = (email: EmailFull) => onReply({
    to: '',
    subject: email.subject.startsWith('Fwd: ') ? email.subject : `Fwd: ${email.subject}`,
    inReplyTo: '', references: '',
    bodyHtml: `<br><br><div style="border-left:2px solid #ddd;padding-left:8px;margin-left:8px;color:#666">
      <p>---------- Forwarded message ----------</p>
      <p>From: ${email.from}<br>Date: ${formatFullDate(email.date)}<br>Subject: ${email.subject}</p>
      ${email.bodyHtml || `<pre>${email.bodyText || ''}</pre>`}
    </div>`,
  });

  const lastEmail = emails.length > 0 ? emails[emails.length - 1] : null;
  const subject = emails[0]?.subject || 'Loading…';
  const linkedContact = emails.find((e) => e.linkedContact)?.linkedContact;
  const linkedLead    = emails.find((e) => e.linkedLead)?.linkedLead;
  const linkedDeal    = emails.find((e) => e.linkedDeal)?.linkedDeal;
  const hasCrm = linkedContact || linkedLead || linkedDeal;

  const folderLabel = { INBOX: 'Inbox', Sent: 'Sent', Drafts: 'Drafts', Archive: 'Archive', Trash: 'Trash' }[activeFolder] ?? 'Back';

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 60, height: 32, borderRadius: 8, background: 'var(--border)' }} />
          <div style={{ flex: 1, height: 16, borderRadius: 8, background: 'var(--border)' }} />
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border)' }} />
        </div>
        <DetailSkeleton />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Email not found
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--surface)' }}>

      {/* ── Header bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px 8px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 8, minHeight: 48 }}>
        {/* Back */}
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--brand-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, flexShrink: 0, fontSize: 16, fontWeight: 400, WebkitTapHighlightColor: 'transparent' }}
        >
          <svg width={10} height={16} viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 1 1 8 9 15" />
          </svg>
          <span style={{ fontSize: 16 }}>{folderLabel}</span>
        </button>

        {/* Subject */}
        <h2 style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
          {subject}
          {emails.length > 1 && (
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0, background: 'var(--border)', borderRadius: 10, padding: '1px 6px', verticalAlign: 'middle' }}>
              {emails.length}
            </span>
          )}
        </h2>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {lastEmail && (
            <button onClick={() => onMarkRead(lastEmail.id, !lastEmail.isRead)} title={lastEmail.isRead ? 'Mark unread' : 'Mark read'} style={iconBtnStyle}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {lastEmail.isRead
                  ? <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>
                  : <><path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z" /><path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" /></>
                }
              </svg>
            </button>
          )}
          {lastEmail && activeFolder !== 'Archive' && (
            <button onClick={() => onArchive(lastEmail.id)} title="Archive" style={{ ...iconBtnStyle, border: '1px solid #BBF7D0', backgroundColor: '#DCFCE7', color: '#16A34A' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            </button>
          )}
          <button onClick={() => lastEmail && onDelete(lastEmail.id)} title="Delete" style={{ ...iconBtnStyle, border: '1px solid #FCCDD5', backgroundColor: '#FDE4E9', color: 'var(--status-danger)' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── CRM context strip ── */}
      {hasCrm && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '8px 14px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-accent)', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Linked</span>
          {linkedContact && <a href={`/dashboard/contacts?id=${linkedContact.id}`} style={{ ...crmPillStyle, backgroundColor: '#E8F0FE', color: '#2056A4' }}>{linkedContact.firstName} {linkedContact.lastName}</a>}
          {linkedLead    && <a href={`/dashboard/leads?id=${linkedLead.id}`}       style={{ ...crmPillStyle, backgroundColor: '#E6F4EA', color: '#137333' }}>{linkedLead.companyName}</a>}
          {linkedDeal    && <a href={`/dashboard/deals?id=${linkedDeal.id}`}       style={{ ...crmPillStyle, backgroundColor: '#F3E8FD', color: '#7627BB' }}>{linkedDeal.name}</a>}
        </div>
      )}

      {/* ── Thread messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {emails.map((email) => (
          <MessageItem
            key={email.id}
            email={email}
            isExpanded={expandedIds.has(email.id)}
            onToggle={() => toggleExpanded(email.id)}
            onReplyClick={() => handleReply(email)}
            onReplyAllClick={() => handleReplyAll(email)}
            onForwardClick={() => handleForward(email)}
          />
        ))}
        <div style={{ height: lastEmail ? 64 : 0 }} className="sm:hidden" />
      </div>

      {/* ── Mobile bottom action bar ── */}
      {lastEmail && (
        <div className="sm:hidden" style={{ position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', padding: '6px 8px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)', flexShrink: 0, backdropFilter: 'blur(12px)', gap: 4 }}>
          {/* Reply — prominent */}
          <button onClick={() => handleReply(lastEmail)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: 10, backgroundColor: 'var(--brand-blue)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
            </svg>
            Reply
          </button>

          {/* Reply All */}
          {(emails[0]?.cc.length > 0 || emails[0]?.to.length > 1) && (
            <button onClick={() => handleReplyAll(lastEmail)} title="Reply All" style={mobileActionStyle}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 17 2 12 7 7" /><polyline points="12 17 7 12 12 7" /><path d="M22 18v-2a4 4 0 0 0-4-4H7" />
              </svg>
            </button>
          )}

          {/* Forward */}
          <button onClick={() => handleForward(lastEmail)} title="Forward" style={mobileActionStyle}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 17 20 12 15 7" /><path d="M4 18v-2a4 4 0 0 1 4-4h12" />
            </svg>
          </button>

          {/* Archive */}
          {activeFolder !== 'Archive' && (
            <button onClick={() => onArchive(lastEmail.id)} title="Archive" style={{ ...mobileActionStyle, border: '1px solid #BBF7D0', backgroundColor: '#DCFCE7', color: '#16A34A' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            </button>
          )}

          {/* Delete */}
          <button onClick={() => onDelete(lastEmail.id)} title="Delete" style={{ ...mobileActionStyle, border: '1px solid #FCCDD5', backgroundColor: '#FDE4E9', color: 'var(--status-danger)' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shared style constants ────────────────────────────────────────────────────

const iconBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--border)', backgroundColor: 'var(--surface)',
  color: 'var(--text-secondary)', cursor: 'pointer',
};

const mobileActionStyle: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--border)', backgroundColor: 'var(--surface)',
  color: 'var(--text-secondary)', cursor: 'pointer',
};

const crmPillStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500,
  padding: '3px 10px', borderRadius: 20,
  textDecoration: 'none',
};

// Re-export formatRecipients for consumers that previously imported from here
export { formatRecipients };
