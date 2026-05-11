"use client";

import { useState, useEffect } from "react";
import DOMPurify from "dompurify";

// ── Types ──────────────────────────────────────────────────────────────────────

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
  onMarkRead: (id: string, read: boolean) => void;
}

// ── Inline SVG Icons ───────────────────────────────────────────────────────────

function IconX({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconReply({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function IconReplyAll({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="7 17 2 12 7 7" />
      <polyline points="12 17 7 12 12 7" />
      <path d="M22 18v-2a4 4 0 0 0-4-4H7" />
    </svg>
  );
}

function IconForward({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
    </svg>
  );
}

function IconTrash({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function IconMail({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconMailOpen({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z" />
      <path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" />
    </svg>
  );
}

function IconChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#E57373", "#F06292", "#BA68C8", "#9575CD",
  "#7986CB", "#64B5F6", "#4FC3F7", "#4DD0E1",
  "#4DB6AC", "#81C784", "#AED581", "#FFD54F",
  "#FFB74D", "#FF8A65", "#A1887F", "#90A4AE",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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
  return name.charAt(0).toUpperCase();
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString("en-GB", { weekday: "short" });
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRecipients(addresses: string[]): string {
  return addresses.map((addr) => {
    const name = extractName(addr);
    const email = extractEmail(addr);
    return name !== email ? `${name} <${email}>` : email;
  }).join(", ");
}

// ── Single Message Component ───────────────────────────────────────────────────

function MessageItem({
  email,
  isExpanded,
  onToggle,
  onReplyClick,
  onForwardClick,
}: {
  email: EmailFull;
  isExpanded: boolean;
  onToggle: () => void;
  onReplyClick: () => void;
  onForwardClick: () => void;
}) {
  const senderName = extractName(email.from);
  const avatarColor = getAvatarColor(senderName);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      {/* Clickable header row */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[var(--background)]"
      >
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold"
          style={{ backgroundColor: avatarColor }}
        >
          {getInitial(senderName)}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <span
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {senderName}
          </span>
          {!isExpanded && email.bodyText && (
            <span
              className="text-sm ml-2 truncate"
              style={{ color: "var(--text-muted)" }}
            >
              — {email.bodyText.substring(0, 80)}
            </span>
          )}
        </div>

        {/* Date + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isExpanded ? formatFullDate(email.date) : formatShortDate(email.date)}
          </span>
          <span
            className="transition-transform duration-200"
            style={{
              color: "var(--text-muted)",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <IconChevronDown size={14} />
          </span>
        </div>
      </button>

      {/* Expandable body – animated with CSS grid */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pl-[60px]">
            {/* Recipient details */}
            <div className="mb-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(!showDetails);
                }}
                className="text-xs underline mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                {showDetails ? "hide details" : "details"}
              </button>
              {showDetails && (
                <div className="text-xs space-y-0.5 mt-1" style={{ color: "var(--text-secondary)" }}>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>From: </span>
                    {email.from}
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>To: </span>
                    {formatRecipients(email.to)}
                  </div>
                  {email.cc.length > 0 && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>CC: </span>
                      {formatRecipients(email.cc)}
                    </div>
                  )}
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Date: </span>
                    {formatFullDate(email.date)}
                  </div>
                </div>
              )}
              {!showDetails && (
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  To: {formatRecipients(email.to)}
                </div>
              )}
            </div>

            {/* CRM links */}
            {(email.linkedLead || email.linkedDeal || email.linkedContact) && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {email.linkedContact && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#E8F0FE", color: "#2056A4" }}>
                    Contact: {email.linkedContact.firstName} {email.linkedContact.lastName}
                  </span>
                )}
                {email.linkedLead && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#E6F4EA", color: "#137333" }}>
                    Lead: {email.linkedLead.companyName}
                  </span>
                )}
                {email.linkedDeal && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#F3E8FD", color: "#7627BB" }}>
                    Deal: {email.linkedDeal.name}
                  </span>
                )}
              </div>
            )}

            {/* Email body */}
            <div className="mb-4">
              {email.bodyHtml ? (
                <div
                  className="email-body prose prose-sm max-w-none text-sm"
                  style={{ color: "var(--text-primary)" }}
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(email.bodyHtml, {
                      ADD_TAGS: ["style"],
                      ADD_ATTR: ["target"],
                    }),
                  }}
                />
              ) : (
                <pre
                  className="text-sm whitespace-pre-wrap font-sans"
                  style={{ color: "var(--text-primary)" }}
                >
                  {email.bodyText || "(No content)"}
                </pre>
              )}
            </div>

            {/* Reply / Forward actions (desktop) */}
            <div className="hidden sm:flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReplyClick();
                }}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border text-xs font-medium transition-colors hover:bg-gray-100"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--surface)",
                  color: "var(--text-primary)",
                }}
              >
                <IconReply size={13} />
                Reply
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onForwardClick();
                }}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border text-xs font-medium transition-colors hover:bg-gray-100"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--surface)",
                  color: "var(--text-primary)",
                }}
              >
                <IconForward size={13} />
                Forward
              </button>
            </div>
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
  onMarkRead,
}: EmailDetailProps) {
  const [emails, setEmails] = useState<EmailFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Fetch all emails in the thread
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
        // Sort by date ascending (oldest first in thread)
        validEmails.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setEmails(validEmails);

        // Expand only the last message by default
        if (validEmails.length > 0) {
          setExpandedIds(new Set([validEmails[validEmails.length - 1].id]));
        }

        // Mark unread emails as read
        for (const email of validEmails) {
          if (!email.isRead) {
            onMarkRead(email.id, true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch thread:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchThread();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailIds.join(",")]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleReply = (email: EmailFull) => {
    const replyAddr = extractEmail(email.from);
    onReply({
      to: replyAddr,
      subject: email.subject.startsWith("Re: ")
        ? email.subject
        : `Re: ${email.subject}`,
      inReplyTo: email.messageId,
      references: email.messageId,
      bodyHtml: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 8px; margin-left: 8px; color: #666;">
        <p>On ${formatFullDate(email.date)}, ${email.from} wrote:</p>
        ${email.bodyHtml || `<pre>${email.bodyText || ""}</pre>`}
      </div>`,
    });
  };

  const handleReplyAll = (email: EmailFull) => {
    const allRecipients = [
      extractEmail(email.from),
      ...email.to.map(extractEmail),
      ...email.cc.map(extractEmail),
    ];
    // Deduplicate
    const unique = [...new Set(allRecipients)];
    onReply({
      to: unique.join(", "),
      subject: email.subject.startsWith("Re: ")
        ? email.subject
        : `Re: ${email.subject}`,
      inReplyTo: email.messageId,
      references: email.messageId,
      bodyHtml: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 8px; margin-left: 8px; color: #666;">
        <p>On ${formatFullDate(email.date)}, ${email.from} wrote:</p>
        ${email.bodyHtml || `<pre>${email.bodyText || ""}</pre>`}
      </div>`,
    });
  };

  const handleForward = (email: EmailFull) => {
    onReply({
      to: "",
      subject: email.subject.startsWith("Fwd: ")
        ? email.subject
        : `Fwd: ${email.subject}`,
      inReplyTo: "",
      references: "",
      bodyHtml: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 8px; margin-left: 8px; color: #666;">
        <p>---------- Forwarded message ----------</p>
        <p>From: ${email.from}<br>Date: ${formatFullDate(email.date)}<br>Subject: ${email.subject}<br>To: ${email.to.join(", ")}</p>
        ${email.bodyHtml || `<pre>${email.bodyText || ""}</pre>`}
      </div>`,
    });
  };

  // Get the last email for toolbar actions
  const lastEmail = emails.length > 0 ? emails[emails.length - 1] : null;
  const subject = emails[0]?.subject || "Loading…";

  // Loading state
  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--text-muted)" }}
      >
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  // Empty state
  if (emails.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--text-muted)" }}
      >
        <span className="text-sm">Email not found</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--surface)" }}>
      {/* ── Top Toolbar (desktop) ─────────────────────────────────── */}
      <div
        className="hidden sm:flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Left: Back button */}
        <button
          onClick={onBack}
          className="flex items-center justify-center w-7 h-7 rounded-lg border transition-colors hover:bg-gray-100"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--surface)",
            color: "var(--text-primary)",
          }}
          title="Close"
        >
          <IconX size={14} />
        </button>

        {/* Right: Reply All + Delete */}
        <div className="flex items-center gap-2">
          {lastEmail && (
            <button
              onClick={() => handleReplyAll(lastEmail)}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border text-xs font-medium transition-colors hover:bg-gray-100"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--text-primary)",
              }}
            >
              <IconReplyAll size={13} />
              Reply All
            </button>
          )}
          <button
            onClick={() => lastEmail && onDelete(lastEmail.id)}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:opacity-80"
            style={{
              borderColor: "#FCCDD5",
              border: "1px solid #FCCDD5",
              backgroundColor: "#FDE4E9",
              color: "var(--status-danger, #FF3B30)",
            }}
            title="Delete"
          >
            <IconTrash size={13} />
          </button>
        </div>
      </div>

      {/* ── Mobile Top Bar ────────────────────────────────────────── */}
      <div
        className="flex sm:hidden items-center px-3 py-2 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          onClick={onBack}
          className="flex items-center justify-center w-7 h-7 rounded-lg"
          style={{ color: "var(--text-primary)" }}
        >
          <IconX size={16} />
        </button>
        <h2
          className="flex-1 text-sm font-medium truncate ml-2"
          style={{ color: "var(--text-primary)" }}
        >
          {subject}
        </h2>
      </div>

      {/* ── Subject Header ────────────────────────────────────────── */}
      <div
        className="hidden sm:block px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <h1
          className="text-base font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {subject}
          {emails.length > 1 && (
            <span className="ml-2 text-sm font-normal" style={{ color: "var(--text-muted)" }}>
              [{emails.length}]
            </span>
          )}
        </h1>
      </div>

      {/* ── Thread Messages ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {emails.map((email) => (
          <MessageItem
            key={email.id}
            email={email}
            isExpanded={expandedIds.has(email.id)}
            onToggle={() => toggleExpanded(email.id)}
            onReplyClick={() => handleReply(email)}
            onForwardClick={() => handleForward(email)}
          />
        ))}
      </div>

      {/* ── Mobile Bottom Action Bar ──────────────────────────────── */}
      {lastEmail && (
        <div
          className="flex sm:hidden items-center justify-around px-2 py-2 border-t flex-shrink-0"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--surface)",
          }}
        >
          <button
            onClick={() => handleReply(lastEmail)}
            className="flex flex-col items-center gap-0.5 px-3 py-1"
            style={{ color: "var(--text-secondary)" }}
          >
            <IconReply size={18} />
            <span className="text-[10px]">Reply</span>
          </button>
          <button
            onClick={() => handleForward(lastEmail)}
            className="flex flex-col items-center gap-0.5 px-3 py-1"
            style={{ color: "var(--text-secondary)" }}
          >
            <IconForward size={18} />
            <span className="text-[10px]">Forward</span>
          </button>
          <button
            onClick={() => onDelete(lastEmail.id)}
            className="flex flex-col items-center gap-0.5 px-3 py-1"
            style={{ color: "var(--status-danger, #FF3B30)" }}
          >
            <IconTrash size={18} />
            <span className="text-[10px]">Delete</span>
          </button>
          <button
            onClick={() => onMarkRead(lastEmail.id, !lastEmail.isRead)}
            className="flex flex-col items-center gap-0.5 px-3 py-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {lastEmail.isRead ? <IconMail size={18} /> : <IconMailOpen size={18} />}
            <span className="text-[10px]">{lastEmail.isRead ? "Unread" : "Read"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
