"use client";

import { useState, useEffect, useCallback } from "react";
import { EmailList } from "./EmailList";
import { EmailDetail } from "./EmailDetail";
import { ComposeModal } from "./ComposeModal";

interface Mailbox {
  email: string;
  name: string;
  type: string;
  configured?: boolean;
}

interface EmailSummary {
  id: string;
  messageId: string;
  mailbox: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  isRead: boolean;
  folder: string;
  linkedLeadId: string | null;
  linkedDealId: string | null;
  linkedContactId: string | null;
}

export default function EmailsPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [activeMailbox, setActiveMailbox] = useState<string>("");
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
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

  // Fetch mailboxes
  useEffect(() => {
    fetch("/api/emails/mailboxes")
      .then((r) => r.json())
      .then((data) => {
        setMailboxes(data.mailboxes || []);
        if (data.mailboxes?.length > 0) {
          setActiveMailbox(data.mailboxes[0].email);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch emails from DB only
  const fetchEmailsRef = useCallback(async () => {
    if (!activeMailbox) return;
    const params = new URLSearchParams({
      mailbox: activeMailbox,
      page: page.toString(),
      limit: "50",
      dbOnly: "true",
    });
    if (search) params.set("search", search);

    const res = await fetch(`/api/emails?${params}`);
    const data = await res.json();
    return { emails: data.emails || [], pages: data.pagination?.pages || 1 };
  }, [activeMailbox, page, search]);

  // Sync from IMAP then refresh list
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
    // Refresh from DB
    const result = await fetchEmailsRef();
    if (result) {
      setEmails(result.emails);
      setTotalPages(result.pages);
    }
    setLoading(false);
  }, [activeMailbox, fetchEmailsRef]);

  // Load emails on mount / mailbox or page change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEmailsRef().then((result) => {
      if (!cancelled && result) {
        setEmails(result.emails);
        setTotalPages(result.pages);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [fetchEmailsRef]);

  // Auto-sync on mailbox change
  useEffect(() => {
    if (!activeMailbox) return;
    syncAndRefresh();
  }, [activeMailbox, syncAndRefresh]);

  // Auto-poll every 60 seconds
  useEffect(() => {
    if (!activeMailbox) return;
    const interval = setInterval(syncAndRefresh, 60000);
    return () => clearInterval(interval);
  }, [activeMailbox, syncAndRefresh]);

  const handleSync = () => syncAndRefresh();

  const handleReply = (data: { to: string; subject: string; inReplyTo: string; references: string; bodyHtml: string }) => {
    setReplyTo(data);
    setShowCompose(true);
  };

  const handleComposeSent = () => {
    setShowCompose(false);
    setReplyTo(null);
    syncAndRefresh();
  };

  const unreadCount = emails.filter((e) => !e.isRead).length;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          {/* Mailbox tabs */}
          {mailboxes.map((mb) => (
            <button
              key={mb.email}
              onClick={() => {
                setActiveMailbox(mb.email);
                setSelectedEmailId(null);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeMailbox === mb.email
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {mb.name}
              {mb.type === "shared" && " (Shared)"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {unreadCount > 0 && `${unreadCount} unread`}
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync"}
          </button>
          <button
            onClick={() => {
              setReplyTo(null);
              setShowCompose(true);
            }}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Compose
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-gray-700 bg-gray-850">
        <input
          type="text"
          placeholder="Search emails..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Email list - left panel */}
        <div className="w-[350px] border-r border-gray-700 overflow-y-auto bg-gray-900">
          <EmailList
            emails={emails}
            loading={loading}
            selectedId={selectedEmailId}
            onSelect={(id) => setSelectedEmailId(id)}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>

        {/* Email detail - right panel */}
        <div className="flex-1 overflow-y-auto bg-gray-900">
          {selectedEmailId ? (
            <EmailDetail
              emailId={selectedEmailId}
              onReply={handleReply}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select an email to read
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => {
            setShowCompose(false);
            setReplyTo(null);
          }}
          onSent={handleComposeSent}
          replyTo={replyTo}
          mailbox={activeMailbox}
        />
      )}
    </div>
  );
}
