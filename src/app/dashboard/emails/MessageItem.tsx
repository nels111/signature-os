'use client';

import { useState } from 'react';
import { EmailFull } from './emailTypes';
import {
  extractName, getInitial, hashColor,
  formatShortDate, formatFullDate, formatRecipients,
  attachmentUrl, isDownloadType, formatFileSize, getFileIcon,
} from './emailHelpers';
import { EmailBodyIframe } from './EmailBodyIframe';

interface MessageItemProps {
  email: EmailFull;
  isExpanded: boolean;
  onToggle: () => void;
  onReplyClick: () => void;
  onReplyAllClick: () => void;
  onForwardClick: () => void;
}

export function MessageItem({
  email,
  isExpanded,
  onToggle,
  onReplyClick,
  onReplyAllClick,
  onForwardClick,
}: MessageItemProps) {
  const senderName = extractName(email.from);
  const avatarColor = hashColor(senderName);
  const initials = getInitial(senderName);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Message header — always visible, click to expand/collapse */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', textAlign: 'left',
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'none', border: 'none', cursor: 'pointer',
          transition: 'background-color 100ms ease',
        }}
        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
        onMouseOut={(e)  => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          backgroundColor: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {senderName}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {formatShortDate(email.date)}
            </span>
          </div>
          {!isExpanded && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email.bodyText?.substring(0, 100) || '(no preview)'}
            </p>
          )}
          {isExpanded && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              to {formatRecipients(email.to)}
            </p>
          )}
        </div>

        {/* Expand/collapse chevron */}
        <div style={{
          width: 24, height: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 200ms ease',
          color: 'var(--text-muted)',
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Expanded body */}
      <div style={{ display: 'grid', gridTemplateRows: isExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 220ms ease' }}>
        <div style={{ overflow: 'hidden' }}>
          {/* Metadata detail toggle */}
          <div style={{ padding: '0 16px 8px 16px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
              style={{ fontSize: 12, color: 'var(--brand-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              {showDetails ? 'Hide details' : 'Details'}
            </button>
            {showDetails && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <div><span style={{ color: 'var(--text-muted)' }}>From: </span>{email.from}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>To: </span>{formatRecipients(email.to)}</div>
                {email.cc.length > 0 && <div><span style={{ color: 'var(--text-muted)' }}>CC: </span>{formatRecipients(email.cc)}</div>}
                <div><span style={{ color: 'var(--text-muted)' }}>Date: </span>{formatFullDate(email.date)}</div>
              </div>
            )}
          </div>

          {/* Email body */}
          <div style={{ padding: '0 16px 16px' }}>
            {email.bodyHtml ? (
              <EmailBodyIframe html={email.bodyHtml} />
            ) : (
              <pre style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--text-primary)', margin: 0 }}>
                {email.bodyText || '(No content)'}
              </pre>
            )}
          </div>

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div style={{ padding: '0 16px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
                Attachments
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {email.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={attachmentUrl(att.id, att.contentType)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={isDownloadType(att.contentType) ? att.filename : undefined}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--surface-accent, #EEF4FC)',
                      cursor: 'pointer', textDecoration: 'none',
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{getFileIcon(att.contentType)}</span>
                    <div style={{ minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {att.filename}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {formatFileSize(att.size)}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Reply / Reply All / Forward (desktop) */}
          <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px', flexWrap: 'wrap' }}>
            <button onClick={(e) => { e.stopPropagation(); onReplyClick(); }} style={inlineActionStyle}>
              <ReplyIcon /> Reply
            </button>
            {(email.cc.length > 0 || email.to.length > 1) && (
              <button onClick={(e) => { e.stopPropagation(); onReplyAllClick(); }} style={inlineActionStyle}>
                <ReplyAllIcon /> Reply All
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onForwardClick(); }} style={inlineActionStyle}>
              <ForwardIcon /> Forward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared button styles ──────────────────────────────────────────────────────

const inlineActionStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 36, padding: '0 16px',
  borderRadius: 8, border: '1px solid var(--border)',
  backgroundColor: 'var(--surface)', color: 'var(--text-primary)',
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
};

// ── Inline SVG icon components ────────────────────────────────────────────────

function ReplyIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function ReplyAllIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="7 17 2 12 7 7" /><polyline points="12 17 7 12 12 7" /><path d="M22 18v-2a4 4 0 0 0-4-4H7" />
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 17 20 12 15 7" /><path d="M4 18v-2a4 4 0 0 1 4-4h12" />
    </svg>
  );
}
