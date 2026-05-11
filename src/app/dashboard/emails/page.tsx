"use client";

import { useState, useEffect, useCallback } from "react";
import { EmailList, groupIntoThreads } from "./EmailList";
import type { EmailSummary } from "./EmailList";
import { EmailDetail } from "./EmailDetail";
import { ComposeModal } from "./ComposeModal";
import { Search, RefreshCw, Plus, Mail } from "lucide-react";

interface Mailbox {
  email: string;
  name: string;
  type: string;
  configured?: boolean;
}

export default function EmailsPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeMailbox, setActiveMailbox] = useState<string>("");
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
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

  // Fetch mailboxes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/emails/mailboxes");
        const data = await res.json();
        if (!cancelled) {
          setMailboxes(data.mailboxes || []);
          if (data.mailboxes?.length > 0) {
            setActiveMailbox(data.mailboxes[0].email);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Fetch emails from DB
  useEffect(() => {
    if (!activeMailbox) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      const params = new URLSearchParams({
        mailbox: activeMailbox,
        page: page.toString(),
        limit: "50",
        dbOnly: "true",
      });
      if (search) params.set("search", search);
      try {
        const res = await fetch(`/api/emails?${params}`);
        const data = await res.json();
        if (!cancelled) {
          setEmails(data.emails || []);
          setTotalPages(data.pagination?.pages || 1);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeMailbox, page, search, refreshKey]);

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
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
    setRefreshKey((k) => k + 1);
  }, [activeMailbox]);

  // Auto-sync on mailbox change
  useEffect(() => {
    if (!activeMailbox) return;
    syncAndRefresh();
  }, [activeMailbox, syncAndRefresh]);

  // Auto-poll DB every 5 seconds
  useEffect(() => {
    if (!activeMailbox) return;
    const interval = setInterval(() => setRefreshKey((k) => k + 1), 5000);
    return () => clearInterval(interval);
  }, [activeMailbox]);

  // Background IMAP sync every 30 seconds
  useEffect(() => {
    if (!activeMailbox) return;
    const interval = setInterval(syncAndRefresh, 30000);
    return () => clearInterval(interval);
  }, [activeMailbox, syncAndRefresh]);

  // Mark read/unread
  const handleMarkRead = useCallback(async (id: string, read: boolean) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, isRead: read } : e)));
    try {
      await fetch(`/api/emails/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: read }),
      });
    } catch (err) {
      console.error("Mark read failed:", err);
    }
  }, []);

  // Delete
  const handleDelete = useCallback((id: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== id));
    if (selectedEmailIds.includes(id)) {
      setSelectedThreadId(null);
      setSelectedEmailIds([]);
    }
  }, [selectedEmailIds]);

  const handleReply = (data: { to: string; subject: string; inReplyTo: string; references: string; bodyHtml: string }) => {
    setReplyTo(data);
    setShowCompose(true);
  };

  const handleComposeSent = () => {
    setShowCompose(false);
    setReplyTo(null);
    syncAndRefresh();
  };

  const threads = groupIntoThreads(emails);
  const unreadCount = threads.filter((t) => !t.isRead).length;
  const showingDetail = selectedThreadId !== null;

  return (
    <div
      className="h-[calc(100vh-56px)] flex flex-col overflow-hidden sm:rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 sm:px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {mailboxes.map((mb) => (
            <button
              key={mb.email}
              onClick={() => {
                setActiveMailbox(mb.email);
                setSelectedThreadId(null);
                setSelectedEmailIds([]);
                setPage(1);
              }}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 flex-shrink-0"
              style={{
                background: activeMailbox === mb.email ? "var(--brand-blue)" : "transparent",
                color: activeMailbox === mb.email ? "white" : "var(--text-secondary)",
                border: activeMailbox === mb.email ? "none" : "1px solid var(--border)",
              }}
            >
              {mb.type === "personal" ? mb.name.split(" ")[0] : "Shared"}
              <span className="hidden sm:inline">
                {mb.type === "shared" && " Inbox"}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {unreadCount > 0 && (
            <span
              className="text-[10px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full hidden sm:inline"
              style={{ background: "var(--brand-blue-subtle)", color: "var(--brand-blue)" }}
            >
              {unreadCount} unread
            </span>
          )}
          <button
            onClick={() => syncAndRefresh()}
            disabled={syncing}
            className="p-2 rounded-lg transition-all duration-150 disabled:opacity-50"
            style={{ color: "var(--text-secondary)" }}
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => {
              setReplyTo(null);
              setShowCompose(true);
            }}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white"
            style={{ background: "var(--brand-blue)" }}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Compose</span>
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left panel — Mail list */}
        <div
          className={`${
            showingDetail ? "hidden sm:flex" : "flex"
          } w-full sm:w-[360px] flex-col overflow-hidden flex-shrink-0`}
          style={{
            borderRight: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          {/* Search */}
          <div className="px-3 sm:px-4 py-2 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: "var(--background)", border: "1px solid var(--border)" }}
            >
              <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search emails..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full text-sm focus:outline-none"
                style={{ background: "transparent", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          {/* Loading bar */}
          <div className="px-4">
            <div
              className="h-0.5 w-full rounded-full transition-opacity duration-300"
              style={{
                background: "var(--brand-blue)",
                opacity: syncing ? 1 : 0,
              }}
            />
          </div>

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            <EmailList
              emails={emails}
              loading={loading}
              selectedThreadId={selectedThreadId}
              onSelectThread={(threadId, emailIds) => {
                setSelectedThreadId(threadId);
                setSelectedEmailIds(emailIds);
                // Mark all thread emails as read
                emailIds.forEach((eid) => handleMarkRead(eid, true));
              }}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>

        {/* Right panel — Email detail */}
        <div
          className={`${
            showingDetail ? "flex" : "hidden sm:flex"
          } flex-1 flex-col overflow-hidden`}
          style={{ background: "var(--surface)" }}
        >
          {selectedThreadId && selectedEmailIds.length > 0 ? (
            <EmailDetail
              emailIds={selectedEmailIds}
              onReply={handleReply}
              onBack={() => {
                setSelectedThreadId(null);
                setSelectedEmailIds([]);
              }}
              onDelete={handleDelete}
              onMarkRead={handleMarkRead}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--background)", color: "var(--text-muted)" }}
              >
                <Mail size={24} />
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Select an email to read
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
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
