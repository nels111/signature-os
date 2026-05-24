"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  bodyText?: string | null;
  date: string;
  isRead: boolean;
  folder: string;
}

export interface EmailThread {
  id: string;
  emails: EmailSummary[];
  subject: string;
  from: string;
  date: string;
  isRead: boolean;
  preview: string;
  count: number;
}

interface DateSection {
  label: string;
  threads: EmailThread[];
}

interface EmailListProps {
  emails: EmailSummary[];
  loading: boolean;
  selectedThreadId: string | null;
  onSelectThread: (threadId: string, emailIds: string[]) => void;
  onMarkRead: (id: string, read: boolean) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  activeFolder: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(Re:|Fwd:|RE:|FW:|Fw:|re:|fwd:)\s*/gi, "")
    .replace(/^(Re:|Fwd:|RE:|FW:|Fw:|re:|fwd:)\s*/gi, "")
    .trim()
    .toLowerCase();
}

function cleanPreview(raw: string): string {
  return raw
    .replace(/\[https?:\/\/[^\]]+\]/g, "")           // strip [https://...] image alt text
    .replace(/https?:\/\/\S+/g, "")                   // strip bare URLs
    .replace(/\[cid:[^\]]+\]/g, "")                   // strip [cid:...] inline image refs
    .replace(/={3,}/g, "")                            // strip horizontal rules
    .replace(/\*{2,}/g, "")                           // strip bold markers
    .replace(/(<\s*){2,}/g, "")                       // strip repeated < < < decorators
    .replace(/^<\s*/gm, "")                           // strip leading < on lines
    .replace(/\s{2,}/g, " ")                          // collapse whitespace
    .replace(/^\s*[\w.]+\s*<[^>]+>\s*/g, "")         // strip leading "Name <email>" from text
    .trim()
    .slice(0, 200);
}

export function groupIntoThreads(emails: EmailSummary[]): EmailThread[] {
  const threadMap = new Map<string, EmailSummary[]>();

  for (const email of emails) {
    const key = normalizeSubject(email.subject || "(no subject)");
    const existing = threadMap.get(key);
    if (existing) {
      existing.push(email);
    } else {
      threadMap.set(key, [email]);
    }
  }

  const threads: EmailThread[] = [];

  for (const group of threadMap.values()) {
    group.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const mostRecent = group[0];
    threads.push({
      id: mostRecent.id,
      emails: group,
      subject: mostRecent.subject || "(No Subject)",
      from: mostRecent.from,
      date: mostRecent.date,
      isRead: group.every((e) => e.isRead),
      preview: cleanPreview(mostRecent.bodyText || ""),
      count: group.length,
    });
  }

  threads.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return threads;
}

function groupThreadsByDate(threads: EmailThread[]): DateSection[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const sections: DateSection[] = [
    { label: "Today", threads: [] },
    { label: "Yesterday", threads: [] },
    { label: "This Week", threads: [] },
    { label: "Earlier", threads: [] },
  ];

  for (const thread of threads) {
    const date = new Date(thread.date);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (dayStart >= todayStart) sections[0].threads.push(thread);
    else if (dayStart >= yesterdayStart) sections[1].threads.push(thread);
    else if (dayStart >= weekStart) sections[2].threads.push(thread);
    else sections[3].threads.push(thread);
  }

  return sections.filter((s) => s.threads.length > 0);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-GB", { weekday: "short" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function extractName(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim().replace(/^"(.*)"$/, "$1");
  return from.split("@")[0];
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 42%)`;
}

function getInitials(from: string): string {
  const name = extractName(from);
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── AI Signal Detection ────────────────────────────────────────────────────────

type EmailSignal = "urgent" | "opportunity" | "positive" | null;

function classifyEmailSignal(subject: string, preview: string): EmailSignal {
  const text = `${subject} ${preview}`.toLowerCase();
  if (/urgent|complaint|not happy|unhappy|disappointed|dissatisfied|issue with|problem with|fault|broken|terrible|awful|cancel|refund|overdue|chase|reminder/i.test(text)) return "urgent";
  if (/quote|enquir|interest|looking for|can you provide|require|pricing|availab|new client|new contract|scope of work|new lead|lead in your area|new job|new project|new enquiry|mybuilder|checkatrade|rated people/i.test(text)) return "opportunity";
  if (/thank|appreciate|great job|excellent|wonderful|perfect|brilliant|love the|very happy|pleased|amazing|5 star|five star|review|feedback/i.test(text)) return "positive";
  return null;
}

const SIGNAL_CONFIG: Record<NonNullable<EmailSignal>, { color: string; label: string }> = {
  urgent: { color: "#FF3B30", label: "Urgent" },
  opportunity: { color: "#FF9500", label: "Lead" },
  positive: { color: "#34C759", label: "Positive" },
};

// ── Skeleton Row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        gap: "12px",
      }}
    >
      <div
        className="skeleton-pulse"
        style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: "var(--border)" }}
      />
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
          <div className="skeleton-pulse" style={{ height: 14, width: "45%", borderRadius: 7, background: "var(--border)" }} />
          <div className="skeleton-pulse" style={{ height: 12, width: "18%", borderRadius: 7, background: "var(--border)" }} />
        </div>
        <div className="skeleton-pulse" style={{ height: 13, width: "75%", borderRadius: 7, background: "var(--border)", marginBottom: 6 }} />
        <div className="skeleton-pulse" style={{ height: 12, width: "90%", borderRadius: 7, background: "var(--border)" }} />
      </div>
    </div>
  );
}

// ── SwipeableRow ──────────────────────────────────────────────────────────────

interface SwipeableRowProps {
  children: React.ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  swipeLeftLabel?: string;
  swipeLeftColor?: string;
  swipeLeftIsArchive?: boolean;
}

const RIGHT_THRESHOLD = 58;
const LEFT_THRESHOLD = -78;

function SwipeableRow({ children, onSwipeRight, onSwipeLeft, swipeLeftLabel = "Delete", swipeLeftColor = "var(--status-danger)", swipeLeftIsArchive = false }: SwipeableRowProps) {
  const [tx, setTx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [thresholdSide, setThresholdSide] = useState<"left" | "right" | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const lastMoveX = useRef(0);
  const lastMoveTime = useRef(0);
  const velocity = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const currentTx = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    lastMoveX.current = e.touches[0].clientX;
    lastMoveTime.current = e.timeStamp;
    velocity.current = 0;
    isHorizontal.current = null;
    setAnimating(false);
    setThresholdSide(null);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (isHorizontal.current === null) {
      if (Math.abs(dx) > Math.abs(dy) + 5) isHorizontal.current = true;
      else if (Math.abs(dy) > Math.abs(dx) + 5) { isHorizontal.current = false; return; }
      else return;
    }

    if (!isHorizontal.current) return;
    e.preventDefault();

    // EMA velocity tracking (px/ms)
    const dt = e.timeStamp - lastMoveTime.current;
    if (dt > 0) {
      const rawV = (e.touches[0].clientX - lastMoveX.current) / dt;
      velocity.current = velocity.current * 0.6 + rawV * 0.4;
    }
    lastMoveX.current = e.touches[0].clientX;
    lastMoveTime.current = e.timeStamp;

    // Rubber-band: full speed to threshold, 0.3x past it
    let clamped: number;
    if (dx > RIGHT_THRESHOLD) {
      clamped = RIGHT_THRESHOLD + (dx - RIGHT_THRESHOLD) * 0.3;
    } else if (dx < LEFT_THRESHOLD) {
      clamped = LEFT_THRESHOLD + (dx - LEFT_THRESHOLD) * 0.3;
    } else {
      clamped = dx;
    }
    clamped = Math.max(-150, Math.min(95, clamped));
    currentTx.current = clamped;
    setTx(clamped);

    // Threshold crossing: haptic + icon scale
    const newSide = clamped >= RIGHT_THRESHOLD ? "right" : clamped <= LEFT_THRESHOLD ? "left" : null;
    setThresholdSide((prev) => {
      if (newSide !== null && newSide !== prev) {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
      }
      return newSide;
    });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isHorizontal.current) return;
    setAnimating(true);
    isHorizontal.current = null;
    setThresholdSide(null);

    const finalTx = currentTx.current;
    const v = velocity.current;

    // Trigger on distance OR velocity flick (short fast swipe)
    const shouldRight = finalTx >= RIGHT_THRESHOLD || (finalTx > 22 && v > 0.65);
    const shouldLeft = finalTx <= LEFT_THRESHOLD || (finalTx < -22 && v < -0.65);

    if (shouldRight) {
      setTx(0);
      setTimeout(() => onSwipeRight?.(), 50);
    } else if (shouldLeft) {
      setTx(-500);
      setTimeout(() => { onSwipeLeft?.(); setTx(0); setAnimating(false); }, 280);
    } else {
      setTx(0);
    }
    currentTx.current = 0;
    velocity.current = 0;
  }, [onSwipeLeft, onSwipeRight]);

  // Progressive opacity: fades in from 0 as user swipes (no hard threshold)
  const rightOpacity = Math.min(Math.max(tx, 0) / 45, 1);
  const leftOpacity = Math.min(Math.max(-tx, 0) / 60, 1);

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {/* Left reveal: mark read (always present, opacity-driven) */}
      <div style={{
        position: "absolute", inset: 0, background: "var(--brand-blue)",
        display: "flex", alignItems: "center", paddingLeft: 20, gap: 8,
        opacity: rightOpacity,
      }}>
        <div style={{
          transform: thresholdSide === "right" ? "scale(1.3)" : "scale(1)",
          transition: "transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <span style={{ color: "white", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>Read</span>
      </div>

      {/* Right reveal: archive or delete */}
      <div style={{
        position: "absolute", inset: 0, background: swipeLeftColor,
        display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 20, gap: 8,
        opacity: leftOpacity,
      }}>
        <span style={{ color: "white", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>{swipeLeftLabel}</span>
        <div style={{
          transform: thresholdSide === "left" ? "scale(1.3)" : "scale(1)",
          transition: "transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          {swipeLeftIsArchive ? (
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          ) : (
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          )}
        </div>
      </div>

      {/* Row content */}
      <div
        style={{
          transform: `translateX(${tx}px)`,
          transition: animating ? "transform 320ms cubic-bezier(0.175, 0.885, 0.32, 1.275)" : "none",
          position: "relative", zIndex: 1, willChange: "transform",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

// ── Thread Row ────────────────────────────────────────────────────────────────

function ThreadRow({
  thread,
  isSelected,
  onSelect,
  onMarkRead,
  onDelete,
  onArchive,
  activeFolder,
}: {
  thread: EmailThread;
  isSelected: boolean;
  onSelect: () => void;
  onMarkRead: (id: string, read: boolean) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  activeFolder: string;
}) {
  const senderName = extractName(thread.from);
  const avatarColor = hashColor(thread.from);
  const initials = getInitials(thread.from);
  const signal = classifyEmailSignal(thread.subject, thread.preview);
  const signalConfig = signal ? SIGNAL_CONFIG[signal] : null;

  const isInbox = activeFolder === "INBOX";
  return (
    <SwipeableRow
      onSwipeRight={() => onMarkRead(thread.id, !thread.isRead)}
      onSwipeLeft={() => isInbox ? onArchive(thread.id) : onDelete(thread.id)}
      swipeLeftLabel={isInbox ? "Archive" : "Delete"}
      swipeLeftColor={isInbox ? "#34C759" : "var(--status-danger)"}
      swipeLeftIsArchive={isInbox}
    >
      <div
        onClick={onSelect}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 14px 12px 12px",
          borderBottom: "1px solid var(--border)",
          cursor: "pointer",
          backgroundColor: isSelected ? "var(--surface-active)" : signalConfig ? `${signalConfig.color}09` : "var(--surface)",
          transition: "background-color 100ms ease",
          userSelect: "none",
          WebkitTapHighlightColor: "transparent",
        }}
        onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = signalConfig ? `${signalConfig.color}14` : "var(--surface-hover)"; }}
        onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = signalConfig ? `${signalConfig.color}09` : "var(--surface)"; }}
      >
        {/* Unread dot column */}
        <div style={{ width: 18, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center", marginRight: 4 }}>
          {!thread.isRead && (
            <span style={{
              width: 9, height: 9, borderRadius: "50%",
              backgroundColor: "var(--brand-blue)",
              display: "block", flexShrink: 0,
            }} />
          )}
        </div>

        {/* Avatar */}
        <div style={{
          width: 46, height: 46, borderRadius: "50%",
          backgroundColor: avatarColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 16, fontWeight: 700, lineHeight: 1,
          letterSpacing: "-0.3px", flexShrink: 0, marginRight: 12,
        }}>
          {initials}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: Sender + time */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{
              flex: 1, minWidth: 0,
              fontSize: 15,
              fontWeight: thread.isRead ? 500 : 700,
              color: "var(--text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              letterSpacing: thread.isRead ? 0 : "-0.1px",
            }}>
              {senderName}
            </span>
            {thread.count > 1 && (
              <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
                {thread.count}
              </span>
            )}
            <span style={{
              fontSize: 12,
              color: thread.isRead ? "var(--text-muted)" : "var(--brand-blue)",
              fontWeight: thread.isRead ? 400 : 600,
              whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {formatDate(thread.date)}
            </span>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>

          {/* Row 2: Subject */}
          <div style={{
            fontSize: 14,
            fontWeight: thread.isRead ? 400 : 600,
            color: thread.isRead ? "var(--text-secondary)" : "var(--text-primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            marginBottom: 3,
          }}>
            {thread.subject}
          </div>

          {/* Row 3: Preview + signal tag */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <span style={{
              fontSize: 13,
              color: "var(--text-muted)",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              lineHeight: 1.4,
              flex: 1, minWidth: 0,
            }}>
              {thread.preview || "\u00a0"}
            </span>
            {signalConfig && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 20,
                backgroundColor: signalConfig.color + "18",
                color: signalConfig.color,
                flexShrink: 0,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}>
                {signalConfig.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </SwipeableRow>
  );
}

// ── Main EmailList ─────────────────────────────────────────────────────────────

export function EmailList({
  emails,
  loading,
  selectedThreadId,
  onSelectThread,
  onMarkRead,
  onDelete,
  onArchive,
  activeFolder,
  page,
  totalPages,
  onPageChange,
}: EmailListProps) {
  const threads = useMemo(() => groupIntoThreads(emails), [emails]);
  const sections = useMemo(() => groupThreadsByDate(threads), [threads]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <style>{`
          @keyframes skeleton-shimmer {
            0% { opacity: 1; }
            50% { opacity: 0.45; }
            100% { opacity: 1; }
          }
          .skeleton-pulse { animation: skeleton-shimmer 1.6s ease-in-out infinite; }
        `}</style>
        {[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: 200, gap: 8,
      }}>
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>No emails found</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0% { opacity: 1; }
          50% { opacity: 0.45; }
          100% { opacity: 1; }
        }
        .skeleton-pulse { animation: skeleton-shimmer 1.6s ease-in-out infinite; }
      `}</style>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {sections.map((section) => (
          <div key={section.label}>
            {/* Section header */}
            <div style={{
              position: "sticky", top: 0, zIndex: 10,
              padding: "6px 16px 5px",
              fontSize: 11, fontWeight: 700,
              color: "var(--text-muted)",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              background: "var(--background)",
              borderBottom: "1px solid var(--border)",
            }}>
              {section.label}
            </div>

            {section.threads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                isSelected={selectedThreadId === thread.id}
                onSelect={() => onSelectThread(thread.id, thread.emails.map((e) => e.id))}
                onMarkRead={onMarkRead}
                onDelete={onDelete}
                onArchive={onArchive}
                activeFolder={activeFolder}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 12, padding: "10px 16px",
          borderTop: "1px solid var(--border)",
          backgroundColor: "var(--surface)", flexShrink: 0,
        }}>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 8,
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.4 : 1,
              color: "var(--text-secondary)",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 8,
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              cursor: page === totalPages ? "not-allowed" : "pointer",
              opacity: page === totalPages ? 0.4 : 1,
              color: "var(--text-secondary)",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
