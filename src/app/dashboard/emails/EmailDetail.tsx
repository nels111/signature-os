"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface EmailAttachmentMeta {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentId?: string | null;
}

interface EmailFull {
  id: string;
  messageId: string;
  mailbox: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  date: string;
  isRead: boolean;
  folder: string;
  linkedLead: { id: string; companyName: string } | null;
  linkedDeal: { id: string; name: string } | null;
  linkedContact: { id: string; firstName: string; lastName: string } | null;
  attachments?: EmailAttachmentMeta[];
}

interface EmailDetailProps {
  emailIds: string[];
  onReply: (data: {
    to: string;
    subject: string;
    inReplyTo: string;
    references: string;
    bodyHtml: string;
  }) => void;
  onBack: () => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onMarkRead: (id: string, read: boolean) => void;
  activeFolder?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractName(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim().replace(/^"(.*)"$/, "$1");
  return from.split("@")[0];
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function getInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 40%)`;
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-GB", { weekday: "short" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatFullDate(dateStr: string): string {
  // Strip timezone suffixes like " | Europe/London" from Connecteam-generated dates
  const cleaned = dateStr.replace(/\s*\|.*$/, "").trim();
  const date = new Date(cleaned);
  if (isNaN(date.getTime())) return dateStr; // fallback: show raw string
  return date.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string): string {
  if (contentType.startsWith("image/")) return "🖼";
  if (contentType === "application/pdf") return "📄";
  if (contentType.includes("word") || contentType.includes("document")) return "📝";
  if (contentType.includes("sheet") || contentType.includes("excel") || contentType.includes("csv")) return "📊";
  if (contentType.includes("zip") || contentType.includes("compressed")) return "🗜";
  return "📎";
}

function openAttachment(id: string, contentType: string) {
  const isOffice =
    contentType.includes("word") || contentType.includes("document") ||
    contentType.includes("sheet") || contentType.includes("excel") ||
    contentType.includes("presentation") || contentType.includes("powerpoint") ||
    contentType.includes("spreadsheet");

  // Office docs: convert to PDF server-side so iOS Quick Look renders natively
  // without routing to Zoho or another external app.
  // PDFs and images: serve inline directly.
  const url = isOffice
    ? `/api/emails/attachments/${id}/pdf`
    : `/api/emails/attachments/${id}?inline=1`;

  window.location.href = url;
}

function formatRecipients(addresses: string[]): string {
  return addresses.map((addr) => {
    const name = extractName(addr);
    const email = extractEmail(addr);
    return name !== email ? `${name} <${email}>` : email;
  }).join(", ");
}

// ── Email Body Iframe ──────────────────────────────────────────────────────────

function EmailBodyIframe({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Measure from the parent. With sandbox="allow-same-origin" (and NO allow-scripts)
  // we can read the iframe DOM safely without ever executing third-party email
  // scripts. This closes the XSS surface that allow-scripts created.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cleanup: (() => void) | undefined;

    const measure = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
      iframe.style.height = (h + 24) + "px";
    };

    const onLoad = () => {
      measure();
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Re-measure when images finish loading (their height isn't known up-front).
      const imgs = Array.from(doc.images || []);
      imgs.forEach((img) => {
        if (!img.complete) {
          img.addEventListener('load', measure);
          img.addEventListener('error', measure);
        }
      });

      // Watch for layout shifts (fonts loading, etc).
      let ro: ResizeObserver | undefined;
      if (typeof ResizeObserver !== 'undefined' && doc.body) {
        ro = new ResizeObserver(measure);
        ro.observe(doc.body);
      }

      cleanup = () => {
        imgs.forEach((img) => {
          img.removeEventListener('load', measure);
          img.removeEventListener('error', measure);
        });
        ro?.disconnect();
      };
    };

    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      cleanup?.();
    };
  }, [html]);

  const srcDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  /* Force everything inside the iframe to fit the screen width */
  html, body {
    margin: 0; padding: 0;
    max-width: 100% !important;
    overflow-x: hidden !important;
    word-break: break-word;
    -webkit-text-size-adjust: 100%;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 15px; color: #1A1A1F; line-height: 1.6;
  }
  /* Clamp all elements: overrides inline width attrs on tables/tds */
  * { box-sizing: border-box !important; max-width: 100% !important; }
  /* Tables: force responsive regardless of inline width attributes */
  table { border-collapse: collapse !important; width: 100% !important; table-layout: auto !important; }
  table[width], td[width], th[width] { width: auto !important; }
  td, th { word-break: break-word; max-width: 0; }
  /* Images */
  img { max-width: 100% !important; height: auto !important; display: block; }
  /* Links */
  a { color: #2056A4; word-break: break-all; }
  p { margin: 0 0 1em; }
  blockquote { margin: 8px 0; padding: 0 0 0 12px; border-left: 3px solid #DADADA; color: #60606A; }
  /* Centre-aligned email containers shouldn't overflow */
  [align="center"] { text-align: center; }
  center { display: block; }
</style>
</head>
<body>${html}</body>
</html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups"
      scrolling="no"
      style={{ width: "100%", border: "none", display: "block", minHeight: "80px", overflow: "hidden" }}
      title="Email content"
    />
  );
}

// ── Skeleton Loading ───────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div style={{ padding: "20px 16px" }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; }
        }
        .sk { animation: skeleton-shimmer 1.6s ease-in-out infinite; background: var(--border); border-radius: 8px; }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div className="sk" style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="sk" style={{ height: 16, width: "55%", marginBottom: 8 }} />
          <div className="sk" style={{ height: 13, width: "40%" }} />
        </div>
      </div>
      {[95, 80, 70, 90, 60, 75, 85].map((w, i) => (
        <div key={i} className="sk" style={{ height: 14, width: `${w}%`, marginBottom: 10 }} />
      ))}
    </div>
  );
}

// ── Message Item ───────────────────────────────────────────────────────────────

function MessageItem({
  email,
  isExpanded,
  onToggle,
  onReplyClick,
  onReplyAllClick,
  onForwardClick,
}: {
  email: EmailFull;
  isExpanded: boolean;
  onToggle: () => void;
  onReplyClick: () => void;
  onReplyAllClick: () => void;
  onForwardClick: () => void;
}) {
  const senderName = extractName(email.from);
  const avatarColor = hashColor(senderName);
  const initials = getInitial(senderName);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Message header — always visible, click to expand/collapse */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "none",
          border: "none",
          cursor: "pointer",
          transition: "background-color 100ms ease",
        }}
        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          backgroundColor: avatarColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 14, fontWeight: 700,
          flexShrink: 0,
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {senderName}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
              {formatShortDate(email.date)}
            </span>
          </div>

          {!isExpanded && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email.bodyText?.substring(0, 100) || "(no preview)"}
            </p>
          )}

          {isExpanded && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              to {formatRecipients(email.to)}
            </p>
          )}
        </div>

        {/* Expand/collapse chevron */}
        <div style={{
          width: 24, height: 24,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 200ms ease",
          color: "var(--text-muted)",
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Expanded body */}
      <div style={{
        display: "grid",
        gridTemplateRows: isExpanded ? "1fr" : "0fr",
        transition: "grid-template-rows 220ms ease",
      }}>
        <div style={{ overflow: "hidden" }}>
          {/* Metadata detail toggle */}
          <div style={{ padding: "0 16px 8px 16px" }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
              style={{
                fontSize: 12, color: "var(--brand-blue)",
                background: "none", border: "none", cursor: "pointer",
                padding: 0, textDecoration: "underline",
              }}
            >
              {showDetails ? "Hide details" : "Details"}
            </button>
            {showDetails && (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                <div><span style={{ color: "var(--text-muted)" }}>From: </span>{email.from}</div>
                <div><span style={{ color: "var(--text-muted)" }}>To: </span>{formatRecipients(email.to)}</div>
                {email.cc.length > 0 && <div><span style={{ color: "var(--text-muted)" }}>CC: </span>{formatRecipients(email.cc)}</div>}
                <div><span style={{ color: "var(--text-muted)" }}>Date: </span>{formatFullDate(email.date)}</div>
              </div>
            )}
          </div>

          {/* Email body */}
          <div style={{ padding: "0 16px 16px" }}>
            {email.bodyHtml ? (
              <EmailBodyIframe html={email.bodyHtml} />
            ) : (
              <pre style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap", fontFamily: "inherit", color: "var(--text-primary)", margin: 0 }}>
                {email.bodyText || "(No content)"}
              </pre>
            )}
          </div>

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div style={{ padding: "0 16px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>
                Attachments
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {email.attachments.map((att) => (
                  <button
                    key={att.id}
                    onClick={() => openAttachment(att.id, att.contentType)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "8px 12px", borderRadius: 10,
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-accent, #EEF4FC)",
                      cursor: "pointer", background: "var(--surface-accent, #EEF4FC)",
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{getFileIcon(att.contentType)}</span>
                    <div style={{ minWidth: 0, textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {att.filename}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        {formatFileSize(att.size)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reply / Reply All / Forward inline (desktop) */}
          <div style={{ display: "flex", gap: 8, padding: "0 16px 16px", flexWrap: "wrap" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onReplyClick(); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 36, padding: "0 16px",
                borderRadius: 8, border: "1px solid var(--border)",
                backgroundColor: "var(--surface)", color: "var(--text-primary)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
              </svg>
              Reply
            </button>
            {email.cc.length > 0 || email.to.length > 1 ? (
              <button
                onClick={(e) => { e.stopPropagation(); onReplyAllClick(); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 36, padding: "0 16px",
                  borderRadius: 8, border: "1px solid var(--border)",
                  backgroundColor: "var(--surface)", color: "var(--text-primary)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="7 17 2 12 7 7" /><polyline points="12 17 7 12 12 7" /><path d="M22 18v-2a4 4 0 0 0-4-4H7" />
                </svg>
                Reply All
              </button>
            ) : null}
            <button
              onClick={(e) => { e.stopPropagation(); onForwardClick(); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 36, padding: "0 16px",
                borderRadius: 8, border: "1px solid var(--border)",
                backgroundColor: "var(--surface)", color: "var(--text-primary)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 17 20 12 15 7" /><path d="M4 18v-2a4 4 0 0 1 4-4h12" />
              </svg>
              Forward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main EmailDetail Component ─────────────────────────────────────────────────

export function EmailDetail({
  emailIds,
  onReply,
  onBack,
  onDelete,
  onArchive,
  onMarkRead,
  activeFolder = "INBOX",
}: EmailDetailProps) {
  const [emails, setEmails] = useState<EmailFull[]>([]);
  const [loading, setLoading] = useState(true);
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

        if (validEmails.length > 0) {
          setExpandedIds(new Set([validEmails[validEmails.length - 1].id]));
        }

        for (const email of validEmails) {
          if (!email.isRead) onMarkRead(email.id, true);
        }
      } catch (err) {
        console.error("Failed to fetch thread:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchThread();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailIds.join(",")]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReply = (email: EmailFull) => {
    onReply({
      to: extractEmail(email.from),
      subject: email.subject.startsWith("Re: ") ? email.subject : `Re: ${email.subject}`,
      inReplyTo: email.messageId,
      references: email.messageId,
      bodyHtml: `<br><br><div style="border-left:2px solid #ddd;padding-left:8px;margin-left:8px;color:#666">
        <p>On ${formatFullDate(email.date)}, ${email.from} wrote:</p>
        ${email.bodyHtml || `<pre>${email.bodyText || ""}</pre>`}
      </div>`,
    });
  };

  const handleReplyAll = (email: EmailFull) => {
    const allRecipients = [...email.to, ...email.cc];
    const uniqueRecipients = [...new Set(allRecipients)].filter(
      (addr) => !addr.includes(email.mailbox)
    );
    onReply({
      to: uniqueRecipients.join(", "),
      subject: email.subject.startsWith("Re: ") ? email.subject : `Re: ${email.subject}`,
      inReplyTo: email.messageId,
      references: email.messageId,
      bodyHtml: `<br><br><div style="border-left:2px solid #ddd;padding-left:8px;margin-left:8px;color:#666">
        <p>On ${formatFullDate(email.date)}, ${email.from} wrote:</p>
        ${email.bodyHtml || `<pre>${email.bodyText || ""}</pre>`}
      </div>`,
    });
  };

  const handleForward = (email: EmailFull) => {
    onReply({
      to: "",
      subject: email.subject.startsWith("Fwd: ") ? email.subject : `Fwd: ${email.subject}`,
      inReplyTo: "",
      references: "",
      bodyHtml: `<br><br><div style="border-left:2px solid #ddd;padding-left:8px;margin-left:8px;color:#666">
        <p>---------- Forwarded message ----------</p>
        <p>From: ${email.from}<br>Date: ${formatFullDate(email.date)}<br>Subject: ${email.subject}</p>
        ${email.bodyHtml || `<pre>${email.bodyText || ""}</pre>`}
      </div>`,
    });
  };

  const lastEmail = emails.length > 0 ? emails[emails.length - 1] : null;
  const subject = emails[0]?.subject || "Loading…";

  // CRM context from any email in thread
  const linkedContact = emails.find((e) => e.linkedContact)?.linkedContact;
  const linkedLead = emails.find((e) => e.linkedLead)?.linkedLead;
  const linkedDeal = emails.find((e) => e.linkedDeal)?.linkedDeal;
  const hasCrm = linkedContact || linkedLead || linkedDeal;

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--surface)" }}>
        {/* Header skeleton */}
        <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--border)", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 60, height: 32, borderRadius: 8, background: "var(--border)" }} />
          <div style={{ flex: 1, height: 16, borderRadius: 8, background: "var(--border)" }} />
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--border)" }} />
        </div>
        <DetailSkeleton />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 14 }}>
        Email not found
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "var(--surface)" }}>

      {/* ── Header bar (combined: back + subject + actions) ──────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 12px 8px 8px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        gap: 8,
        minHeight: 48,
      }}>
        {/* Back */}
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 3,
            color: "var(--brand-blue)", background: "none", border: "none",
            cursor: "pointer", padding: "4px 6px", borderRadius: 6, flexShrink: 0,
            fontSize: 16, fontWeight: 400,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width={10} height={16} viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 1 1 8 9 15" />
          </svg>
          <span style={{ fontSize: 16 }}>
            {activeFolder === "INBOX" ? "Inbox" : activeFolder === "Sent" ? "Sent" : activeFolder === "Drafts" ? "Drafts" : activeFolder === "Archive" ? "Archive" : activeFolder === "Trash" ? "Trash" : "Back"}
          </span>
        </button>

        {/* Subject */}
        <h2 style={{
          flex: 1, minWidth: 0,
          fontSize: 15, fontWeight: 600,
          color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          margin: 0,
        }}>
          {subject}
          {emails.length > 1 && (
            <span style={{
              marginLeft: 6, fontSize: 11, fontWeight: 600,
              color: "var(--text-muted)", flexShrink: 0,
              background: "var(--border)", borderRadius: 10,
              padding: "1px 6px", verticalAlign: "middle",
            }}>
              {emails.length}
            </span>
          )}
        </h2>

        {/* Actions */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {lastEmail && (
            <button
              onClick={() => onMarkRead(lastEmail.id, !lastEmail.isRead)}
              title={lastEmail.isRead ? "Mark unread" : "Mark read"}
              style={{
                width: 32, height: 32, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid var(--border)", backgroundColor: "var(--surface)",
                color: "var(--text-secondary)", cursor: "pointer",
              }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {lastEmail.isRead
                  ? <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>
                  : <><path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z" /><path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" /></>
                }
              </svg>
            </button>
          )}
          {lastEmail && activeFolder !== "Archive" && (
            <button
              onClick={() => onArchive(lastEmail.id)}
              title="Archive"
              style={{
                width: 32, height: 32, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid #BBF7D0", backgroundColor: "#DCFCE7",
                color: "#16A34A", cursor: "pointer",
              }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            </button>
          )}
          <button
            onClick={() => lastEmail && onDelete(lastEmail.id)}
            title="Delete"
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid #FCCDD5", backgroundColor: "#FDE4E9",
              color: "var(--status-danger)", cursor: "pointer",
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── CRM context strip ──────────────────────────────────────── */}
      {hasCrm && (
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6,
          padding: "8px 14px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--surface-accent)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>
            Linked
          </span>
          {linkedContact && (
            <a href={`/dashboard/contacts?id=${linkedContact.id}`} style={{
              fontSize: 12, fontWeight: 500,
              padding: "3px 10px", borderRadius: 20,
              backgroundColor: "#E8F0FE", color: "#2056A4", textDecoration: "none",
            }}>
              {linkedContact.firstName} {linkedContact.lastName}
            </a>
          )}
          {linkedLead && (
            <a href={`/dashboard/leads?id=${linkedLead.id}`} style={{
              fontSize: 12, fontWeight: 500,
              padding: "3px 10px", borderRadius: 20,
              backgroundColor: "#E6F4EA", color: "#137333", textDecoration: "none",
            }}>
              {linkedLead.companyName}
            </a>
          )}
          {linkedDeal && (
            <a href={`/dashboard/deals?id=${linkedDeal.id}`} style={{
              fontSize: 12, fontWeight: 500,
              padding: "3px 10px", borderRadius: 20,
              backgroundColor: "#F3E8FD", color: "#7627BB", textDecoration: "none",
            }}>
              {linkedDeal.name}
            </a>
          )}
        </div>
      )}

      {/* ── Thread messages ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
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

        {/* Bottom padding for mobile action bar */}
        <div style={{ height: lastEmail ? 64 : 0 }} className="sm:hidden" />
      </div>

      {/* ── Mobile bottom action bar ───────────────────────────────── */}
      {lastEmail && (
        <div
          className="sm:hidden"
          style={{
            position: "sticky", bottom: 0,
            display: "flex", alignItems: "center",
            padding: "6px 8px",
            borderTop: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
            flexShrink: 0,
            backdropFilter: "blur(12px)",
            gap: 4,
          }}
        >
          {/* Reply button — prominent */}
          <button
            onClick={() => handleReply(lastEmail)}
            style={{
              flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              height: 44, borderRadius: 10,
              backgroundColor: "var(--brand-blue)", color: "#fff",
              border: "none", cursor: "pointer",
              fontSize: 15, fontWeight: 600,
            }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
            </svg>
            Reply
          </button>

          {/* Reply All (only if there are CC recipients or multiple To) */}
          {(emails[0]?.cc.length > 0 || emails[0]?.to.length > 1) && (
            <button
              onClick={() => handleReplyAll(lastEmail)}
              title="Reply All"
              style={{
                width: 44, height: 44, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid var(--border)", backgroundColor: "var(--surface)",
                color: "var(--text-secondary)", cursor: "pointer",
              }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 17 2 12 7 7" /><polyline points="12 17 7 12 12 7" /><path d="M22 18v-2a4 4 0 0 0-4-4H7" />
              </svg>
            </button>
          )}

          {/* Forward */}
          <button
            onClick={() => handleForward(lastEmail)}
            title="Forward"
            style={{
              width: 44, height: 44, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid var(--border)", backgroundColor: "var(--surface)",
              color: "var(--text-secondary)", cursor: "pointer",
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 17 20 12 15 7" /><path d="M4 18v-2a4 4 0 0 1 4-4h12" />
            </svg>
          </button>

          {/* Archive (not shown from Archive folder) */}
          {activeFolder !== "Archive" && (
            <button
              onClick={() => onArchive(lastEmail.id)}
              title="Archive"
              style={{
                width: 44, height: 44, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid #BBF7D0", backgroundColor: "#DCFCE7",
                color: "#16A34A", cursor: "pointer",
              }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => onDelete(lastEmail.id)}
            title="Delete"
            style={{
              width: 44, height: 44, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid #FCCDD5", backgroundColor: "#FDE4E9",
              color: "var(--status-danger)", cursor: "pointer",
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
