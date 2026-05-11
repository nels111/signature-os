"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Mail, BookOpen, Trash2 } from "lucide-react";

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
  id: string; // most recent email id
  emails: EmailSummary[];
  subject: string;
  from: string;
  date: string;
  isRead: boolean; // true only if ALL are read
  preview: string;
  count: number;
}

interface EmailListProps {
  emails: EmailSummary[];
  loading: boolean;
  selectedThreadId: string | null;
  onSelectThread: (threadId: string, emailIds: string[]) => void;
  onMarkRead: (id: string, read: boolean) => void;
  onDelete: (id: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Normalize subject by stripping Re:/Fwd:/RE:/FW:/Fw: prefixes
 */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(Re:|Fwd:|RE:|FW:|Fw:|re:|fwd:)\s*/gi, "")
    .replace(/^(Re:|Fwd:|RE:|FW:|Fw:|re:|fwd:)\s*/gi, "") // second pass for nested
    .trim()
    .toLowerCase();
}

/**
 * Group flat emails into threads by normalized subject
 */
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
    // Sort by date descending (most recent first)
    group.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const mostRecent = group[0];

    threads.push({
      id: mostRecent.id,
      emails: group,
      subject: mostRecent.subject || "(No Subject)",
      from: mostRecent.from,
      date: mostRecent.date,
      isRead: group.every((e) => e.isRead),
      preview: mostRecent.bodyText?.slice(0, 160) || "",
      count: group.length,
    });
  }

  // Sort threads by most recent date
  threads.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return threads;
}

function formatDate(dateStr: string): string {
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

function extractName(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim();
  return from.split("@")[0];
}

/**
 * Generate a consistent colour from a string (sender name/email)
 */
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

function getInitials(from: string): string {
  const name = extractName(from);
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function EmailList({
  emails,
  loading,
  selectedThreadId,
  onSelectThread,
  onMarkRead,
  onDelete,
  page,
  totalPages,
  onPageChange,
}: EmailListProps) {
  const [hoveredThreadId, setHoveredThreadId] = useState<string | null>(null);

  const threads = useMemo(() => groupIntoThreads(emails), [emails]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "128px",
          color: "var(--text-muted)",
          fontSize: "14px",
        }}
      >
        Loading emails...
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "128px",
          color: "var(--text-muted)",
          fontSize: "14px",
        }}
      >
        No emails found
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Thread list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {threads.map((thread) => {
          const isSelected = selectedThreadId === thread.id;
          const isHovered = hoveredThreadId === thread.id;
          const senderName = extractName(thread.from);
          const avatarColor = hashColor(thread.from);
          const initials = getInitials(thread.from);

          return (
            <div
              key={thread.id}
              onClick={() =>
                onSelectThread(
                  thread.id,
                  thread.emails.map((e) => e.id)
                )
              }
              onMouseEnter={() => setHoveredThreadId(thread.id)}
              onMouseLeave={() => setHoveredThreadId(null)}
              style={{
                position: "relative",
                display: "flex",
                gap: "12px",
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
                backgroundColor: isSelected
                  ? "var(--brand-blue-subtle)"
                  : "var(--surface)",
                opacity: thread.isRead && !isSelected ? 0.6 : 1,
                transition: "background-color 150ms ease",
              }}
              onMouseOver={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = "var(--brand-blue-subtle)";
                }
              }}
              onMouseOut={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = "var(--surface)";
                }
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  backgroundColor: avatarColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                {initials}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* First line: Sender, unread dot, thread count, date */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "2px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: thread.isRead ? 500 : 700,
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "140px",
                    }}
                  >
                    {senderName}
                  </span>

                  {/* Unread dot */}
                  {!thread.isRead && (
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: "var(--brand-blue)",
                        flexShrink: 0,
                      }}
                    />
                  )}

                  {/* Thread count badge */}
                  {thread.count > 1 && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        opacity: 0.7,
                        flexShrink: 0,
                      }}
                    >
                      [{thread.count}]
                    </span>
                  )}

                  {/* Date - pushed to right */}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {formatDate(thread.date)}
                  </span>
                </div>

                {/* Second line: Subject */}
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginBottom: "2px",
                  }}
                >
                  {thread.subject}
                </div>

                {/* Third line: Body preview */}
                {thread.preview && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      lineHeight: "1.4",
                    }}
                  >
                    {thread.preview}
                  </div>
                )}
              </div>

              {/* Hover action pill */}
              {isHovered && (
                <div
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "12px",
                    display: "flex",
                    gap: "4px",
                    padding: "4px",
                    backgroundColor: "var(--surface)",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    zIndex: 10,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Mark read/unread button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkRead(thread.id, !thread.isRead);
                    }}
                    title={thread.isRead ? "Mark unread" : "Mark read"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                      transition: "background-color 150ms ease",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--background)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {thread.isRead ? (
                      <Mail size={15} />
                    ) : (
                      <BookOpen size={15} />
                    )}
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(thread.id);
                    }}
                    title="Delete"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      color: "var(--status-danger)",
                      transition: "background-color 150ms ease",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = "#FDE4E9";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "10px 16px",
            borderTop: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
          }}
        >
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.4 : 1,
              color: "var(--text-secondary)",
            }}
          >
            <ChevronLeft size={16} />
          </button>

          <span
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
            }}
          >
            {page} / {totalPages}
          </span>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
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
