"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EmailList, groupIntoThreads } from "./EmailList";
import type { EmailSummary } from "./EmailList";
import { EmailDetail } from "./EmailDetail";
import { ComposeModal } from "./ComposeModal";
import { CrmPanel } from "./CrmPanel";
import { RefreshCw, Plus, Inbox, Send, FileText, Trash2, Archive } from "lucide-react";

interface Mailbox {
  email: string;
  name: string;
  type: string;
  configured?: boolean;
}

const FOLDERS = [
  { id: "INBOX",   label: "Inbox",   Icon: Inbox },
  { id: "Sent",    label: "Sent",    Icon: Send },
  { id: "Drafts",  label: "Drafts",  Icon: FileText },
  { id: "Archive", label: "Archive", Icon: Archive },
  { id: "Trash",   label: "Trash",   Icon: Trash2 },
] as const;

type FolderId = (typeof FOLDERS)[number]["id"];

export default function EmailsPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeMailbox, setActiveMailbox] = useState<string>("");
  const [activeFolder, setActiveFolder] = useState<FolderId>("INBOX");
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [replyTo, setReplyTo] = useState<{
    to: string;
    subject: string;
    inReplyTo: string;
    references: string;
    bodyHtml: string;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Pull-to-refresh
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 58;
  const silentRefreshRef = useRef(false); // true = background sync, skip loading spinner


  // Fetch mailboxes
  useEffect(() => {
    let cancelled = false;
    fetch("/api/emails/mailboxes")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setMailboxes(data.mailboxes || []);
          if (data.mailboxes?.length > 0) setActiveMailbox(data.mailboxes[0].email);
        }
      })
      .catch(console.error);
    return () => { cancelled = true; };
  }, []);

  // Fetch folder unread counts
  const fetchCounts = useCallback(async () => {
    if (!activeMailbox) return;
    try {
      const params = new URLSearchParams({ mailbox: activeMailbox, counts: "true", dbOnly: "true" });
      const res = await fetch(`/api/emails?${params}`);
      const data = await res.json();
      if (data.counts) setFolderCounts(data.counts);
    } catch {}
  }, [activeMailbox]);

  useEffect(() => { fetchCounts(); }, [fetchCounts, refreshKey]);

  // Fetch emails — only show spinner on navigation changes, not background syncs
  useEffect(() => {
    if (!activeMailbox) return;
    let cancelled = false;
    if (!silentRefreshRef.current) {
      setLoading(true);
    }
    silentRefreshRef.current = false;
    const params = new URLSearchParams({
      mailbox: activeMailbox,
      folder: activeFolder,
      page: page.toString(),
      limit: "50",
      dbOnly: "true",
    });
    if (search) params.set("search", search);

    fetch(`/api/emails?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setEmails(data.emails || []);
          setTotalPages(data.pagination?.pages || 1);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeMailbox, activeFolder, page, search, refreshKey]);

  // Sync from IMAP
  const syncAndRefresh = useCallback(async () => {
    if (!activeMailbox) return;
    setSyncing(true);
    try {
      await fetch("/api/emails/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailbox: activeMailbox }),
      });
    } catch {}
    setSyncing(false);
    silentRefreshRef.current = true; // Don't flash the list on background sync
    setRefreshKey((k) => k + 1);
  }, [activeMailbox]);

  useEffect(() => { if (activeMailbox) syncAndRefresh(); }, [activeMailbox, syncAndRefresh]);

  // Sync every 15s — near-real-time without glitch (silentRefreshRef suppresses the loading flash)
  useEffect(() => {
    if (!activeMailbox) return;
    const interval = setInterval(syncAndRefresh, 15000);
    return () => clearInterval(interval);
  }, [activeMailbox, syncAndRefresh]);

  const handleMarkRead = useCallback(async (id: string, read: boolean) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, isRead: read } : e)));
    fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: read }),
    }).catch(console.error);
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    const unread = emails.filter((e) => !e.isRead);
    setEmails((prev) => prev.map((e) => ({ ...e, isRead: true })));
    await Promise.all(
      unread.map((e) =>
        fetch(`/api/emails/${e.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        })
      )
    );
    setRefreshKey((k) => k + 1);
  }, [emails]);

  const handleBack = useCallback(() => {
    setDetailVisible(false);
    setTimeout(() => { setSelectedThreadId(null); setSelectedEmailIds([]); }, 300);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== id));
    if (selectedEmailIds.includes(id)) handleBack();
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: "Trash" }),
    });
    setRefreshKey((k) => k + 1);
  }, [selectedEmailIds, handleBack]);

  const handleArchive = useCallback(async (id: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== id));
    if (selectedEmailIds.includes(id)) handleBack();
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: "Archive" }),
    });
    setRefreshKey((k) => k + 1);
  }, [selectedEmailIds, handleBack]);

  const handleReply = (data: { to: string; subject: string; inReplyTo: string; references: string; bodyHtml: string }) => {
    setReplyTo(data);
    setShowCompose(true);
  };

  const handleComposeSent = () => {
    setShowCompose(false);
    setReplyTo(null);
    syncAndRefresh();
  };

  const openThread = useCallback((threadId: string, emailIds: string[]) => {
    setSelectedThreadId(threadId);
    setSelectedEmailIds(emailIds);
    emailIds.forEach((eid) => handleMarkRead(eid, true));
    requestAnimationFrame(() => requestAnimationFrame(() => setDetailVisible(true)));
  }, [handleMarkRead]);

  // Keyboard shortcuts (desktop) — declared after all handlers to avoid TDZ errors
  useEffect(() => {
    const currentThreads = groupIntoThreads(emails);
    const currentIdx = selectedThreadId
      ? currentThreads.findIndex((t) => t.id === selectedThreadId)
      : -1;

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (showCompose) {
        if (e.key === "Escape") { setShowCompose(false); setReplyTo(null); }
        return;
      }
      switch (e.key) {
        case "j":
        case "ArrowDown": {
          const next = currentThreads[currentIdx + 1];
          if (next) openThread(next.id, next.emails.map((em) => em.id));
          e.preventDefault();
          break;
        }
        case "k":
        case "ArrowUp": {
          if (currentIdx > 0) {
            const prev = currentThreads[currentIdx - 1];
            openThread(prev.id, prev.emails.map((em) => em.id));
          } else if (currentIdx === 0) {
            handleBack();
          }
          e.preventDefault();
          break;
        }
        case "e":
          if (selectedThreadId) handleArchive(selectedThreadId);
          break;
        case "#":
        case "Delete":
          if (selectedThreadId) handleDelete(selectedThreadId);
          break;
        case "c":
          if (!showCompose) { setReplyTo(null); setShowCompose(true); }
          break;
        case "Escape":
          if (selectedThreadId) handleBack();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [emails, selectedThreadId, showCompose, openThread, handleArchive, handleDelete, handleBack]);

  // Pull-to-refresh handlers
  const handlePullStart = useCallback((e: React.TouchEvent) => {
    if (listRef.current?.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handlePullMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy <= 0) { setIsPulling(false); setPullY(0); return; }
    const damped = dy < PULL_THRESHOLD ? dy : PULL_THRESHOLD + (dy - PULL_THRESHOLD) * 0.25;
    setPullY(Math.min(damped, PULL_THRESHOLD + 16));
  }, [isPulling]);

  const handlePullEnd = useCallback(async () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullY >= PULL_THRESHOLD - 4) {
      setIsRefreshing(true);
      setPullY(0);
      await syncAndRefresh();
      setIsRefreshing(false);
    } else {
      setPullY(0);
    }
  }, [isPulling, pullY, syncAndRefresh]);

  // Use DB-level count for "mark all read" visibility — current page might not have all unread
  const folderUnreadCount = folderCounts[activeFolder] || 0;

  const switchFolder = (folder: FolderId) => {
    setActiveFolder(folder);
    setPage(1);
    setSearch("");
    setDetailVisible(false);
    setSelectedThreadId(null);
    setSelectedEmailIds([]);
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      {/* ── Top toolbar: mailboxes + compose ──────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto" }}>
          {mailboxes.map((mb) => (
            <button
              key={mb.email}
              onClick={() => {
                setActiveMailbox(mb.email);
                setDetailVisible(false);
                setSelectedThreadId(null);
                setSelectedEmailIds([]);
                setPage(1);
              }}
              style={{
                padding: "5px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: "nowrap",
                flexShrink: 0,
                cursor: "pointer",
                border: "none",
                background: activeMailbox === mb.email ? "var(--brand-blue)" : "transparent",
                color: activeMailbox === mb.email ? "#fff" : "var(--text-secondary)",
                transition: "all 120ms ease",
              }}
            >
              {mb.type === "personal" ? mb.name.split(" ")[0] : "Shared"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            onClick={syncAndRefresh}
            disabled={syncing}
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "none", background: "transparent",
              color: "var(--text-secondary)", cursor: syncing ? "not-allowed" : "pointer",
              opacity: syncing ? 0.5 : 1,
            }}
          >
            <RefreshCw size={15} className={syncing || isRefreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => { setReplyTo(null); setShowCompose(true); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              background: "var(--brand-blue)", color: "#fff",
              border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Compose</span>
          </button>
        </div>
      </div>

      {/* ── Folder tabs ────────────────────────────────────────────── */}
      <style>{`
        .folder-tabs::-webkit-scrollbar { display: none; }
      `}</style>
      <div
        className="folder-tabs"
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          overflowX: "auto",
          scrollbarWidth: "none",
          gap: 2,
        }}
      >
        {FOLDERS.map(({ id, label, Icon }) => {
          const count = folderCounts[id] || 0;
          const isActive = activeFolder === id;
          return (
            <button
              key={id}
              onClick={() => switchFolder(id as FolderId)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "8px 10px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--brand-blue)" : "var(--text-secondary)",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid var(--brand-blue)" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                marginBottom: -1,
                transition: "color 120ms ease",
              }}
            >
              <Icon size={13} />
              {label}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: "1px 5px", borderRadius: 10,
                  backgroundColor: isActive ? "var(--brand-blue)" : "var(--border-strong)",
                  color: isActive ? "#fff" : "var(--text-muted)",
                  lineHeight: "16px",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* Mark all read — spacer + button */}
        {folderUnreadCount > 0 && activeFolder === "INBOX" && (
          <button
            onClick={handleMarkAllRead}
            style={{
              marginLeft: "auto",
              fontSize: 12, fontWeight: 500,
              color: "var(--brand-blue)",
              background: "none", border: "none",
              cursor: "pointer", padding: "8px 4px",
              whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* ── Three-panel body ────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>

        {/* List panel */}
        <div
          data-role="email-list"
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            background: "var(--surface)",
          }}
          className="sm:w-[360px]"
        >
          {/* Search */}
          <div style={{ padding: "8px 12px", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 12px", borderRadius: 10,
              background: "var(--background)", border: "1px solid var(--border)",
            }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder={`Search ${activeFolder === "INBOX" ? "inbox" : activeFolder.toLowerCase()}...`}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{
                  flex: 1, background: "transparent",
                  border: "none", outline: "none",
                  fontSize: 14, color: "var(--text-primary)",
                }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Pull-to-refresh indicator */}
          <div style={{
            height: isRefreshing ? "44px" : `${pullY}px`,
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: isPulling ? "none" : "height 200ms ease",
            flexShrink: 0,
          }}>
            {(pullY > 8 || isRefreshing) && (
              <RefreshCw
                size={18}
                style={{
                  color: "var(--brand-blue)",
                  opacity: Math.min(pullY / (PULL_THRESHOLD * 0.6), 1),
                  transform: isRefreshing ? undefined : `rotate(${(pullY / PULL_THRESHOLD) * 240}deg)`,
                  animation: isRefreshing ? "spin 0.8s linear infinite" : undefined,
                }}
              />
            )}
          </div>

          {/* Sync progress bar */}
          <div style={{ padding: "0 16px", flexShrink: 0 }}>
            <div style={{
              height: 2, borderRadius: 2,
              background: "var(--brand-blue)",
              opacity: syncing ? 1 : 0,
              transition: "opacity 300ms ease",
            }} />
          </div>

          {/* Email list */}
          <div
            ref={listRef}
            style={{ flex: 1, overflowY: "auto" }}
            onTouchStart={handlePullStart}
            onTouchMove={handlePullMove}
            onTouchEnd={handlePullEnd}
          >
            <EmailList
              emails={emails}
              loading={loading}
              selectedThreadId={selectedThreadId}
              onSelectThread={openThread}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
              onArchive={handleArchive}
              activeFolder={activeFolder}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>

        {/* Detail panel */}
        <div
          data-role="email-detail"
          style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface)" }}
        >
          {selectedThreadId && selectedEmailIds.length > 0 ? (
            <EmailDetail
              emailIds={selectedEmailIds}
              onReply={handleReply}
              onBack={handleBack}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onMarkRead={handleMarkRead}
              activeFolder={activeFolder}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--background)", color: "var(--text-muted)",
              }}>
                {(() => {
                  const folder = FOLDERS.find((f) => f.id === activeFolder);
                  if (folder) return <folder.Icon size={24} />;
                  return null;
                })()}
              </div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
                {activeFolder === "INBOX" ? "Select an email to read" : `${activeFolder} is empty`}
              </p>
            </div>
          )}
        </div>

        {/* Mobile slide transition */}
        <style>{`
          @media (max-width: 639px) {
            [data-role="email-list"] {
              position: absolute !important;
              inset: 0 !important;
              width: 100% !important;
              transform: ${detailVisible ? "translateX(-100%)" : "translateX(0)"};
              transition: transform 290ms cubic-bezier(0.4, 0, 0.2, 1);
              z-index: 1;
            }
            [data-role="email-detail"] {
              position: absolute !important;
              inset: 0 !important;
              transform: ${detailVisible ? "translateX(0)" : "translateX(100%)"};
              transition: transform 290ms cubic-bezier(0.4, 0, 0.2, 1);
              z-index: 2;
            }
          }
        `}</style>

        {/* CRM panel — desktop xl+ */}
        <div className="hidden xl:flex" style={{ flexShrink: 0 }}>
          <CrmPanel emailIds={selectedEmailIds} />
        </div>
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => { setShowCompose(false); setReplyTo(null); }}
          onSent={handleComposeSent}
          replyTo={replyTo}
          mailbox={activeMailbox}
        />
      )}
    </div>
  );
}
