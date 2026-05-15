"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Send, X, Loader2, Paperclip } from "lucide-react";
import DOMPurify from "dompurify";

interface ComposeModalProps {
  onClose: () => void;
  onSent: () => void;
  replyTo: {
    to: string;
    subject: string;
    inReplyTo: string;
    references: string;
    bodyHtml: string;
  } | null;
  mailbox: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ComposeModal({ onClose, onSent, replyTo, mailbox }: ComposeModalProps) {
  const [to, setTo] = useState(replyTo?.to || "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(replyTo?.subject || "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSend = async () => {
    if (!to || !subject) return;
    setSending(true);

    try {
      let htmlBody = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">${escapeHtml(body).replace(/\n/g, "<br>")}</div>`;

      if (replyTo?.bodyHtml) {
        htmlBody += replyTo.bodyHtml;
      }

      // Encode attachments as base64
      const encodedAttachments = await Promise.all(
        attachments.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          return {
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            content: btoa(binary),
          };
        })
      );

      const res = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.split(",").map((t) => t.trim()),
          cc: cc ? cc.split(",").map((c) => c.trim()) : undefined,
          subject,
          text: body,
          html: htmlBody,
          mailbox,
          inReplyTo: replyTo?.inReplyTo,
          references: replyTo?.references,
          attachments: encodedAttachments.length > 0 ? encodedAttachments : undefined,
        }),
      });

      if (res.ok) {
        onSent();
      } else {
        const data = await res.json();
        alert(`Failed to send: ${data.error}`);
      }
    } catch (err) {
      console.error("Send error:", err);
      alert("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      {/* Container to align close button and card */}
      <div className="flex w-full max-w-[750px] flex-col items-start gap-2 px-4">
        {/* Close button - above the card, left-aligned */}
        <button
          onClick={onClose}
          className="flex items-center gap-1 rounded-lg px-2 py-1"
          style={{ background: "var(--background, #f5f5f7)" }}
        >
          <X size={14} style={{ color: "var(--text-muted, #aeaeb2)" }} />
          <span className="text-sm" style={{ color: "var(--text-muted, #aeaeb2)" }}>
            esc
          </span>
        </button>

        {/* Composer card */}
        <div
          className="flex w-full flex-col overflow-hidden rounded-2xl shadow-sm"
          style={{
            maxHeight: "500px",
            background: "var(--background, #f5f5f7)",
            border: "1px solid var(--border, #e5e5ea)",
          }}
        >
          {/* Fields section */}
          <div style={{ borderBottom: "1px solid var(--border, #e5e5ea)" }}>
            {/* To row */}
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{ borderBottom: "1px solid var(--border, #e5e5ea)" }}
            >
              <label
                className="text-sm font-medium"
                style={{ color: "var(--text-muted, #aeaeb2)" }}
              >
                To:
              </label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--text-primary, #1d1d1f)" }}
              />
              <div className="flex items-center gap-1">
                {!showCc && (
                  <button
                    onClick={() => setShowCc(true)}
                    className="text-sm hover:opacity-70"
                    style={{ color: "var(--text-muted, #aeaeb2)" }}
                  >
                    CC
                  </button>
                )}
              </div>
            </div>

            {/* CC row (conditional) */}
            {showCc && (
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ borderBottom: "1px solid var(--border, #e5e5ea)" }}
              >
                <label
                  className="text-sm font-medium"
                  style={{ color: "var(--text-muted, #aeaeb2)" }}
                >
                  CC:
                </label>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com"
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-primary, #1d1d1f)" }}
                />
              </div>
            )}

            {/* Subject row */}
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{ borderBottom: "1px solid var(--border, #e5e5ea)" }}
            >
              <label
                className="text-sm font-medium"
                style={{ color: "var(--text-muted, #aeaeb2)" }}
              >
                Subject:
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--text-primary, #1d1d1f)" }}
              />
            </div>

            {/* Sending as */}
            <div className="px-3 py-1.5">
              <span className="text-xs" style={{ color: "var(--text-secondary, #6e6e73)" }}>
                Sending as: {mailbox}
              </span>
            </div>
          </div>

          {/* Body textarea */}
          <div className="flex-1">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email..."
              className="w-full resize-none px-3 py-3 text-sm outline-none"
              style={{
                minHeight: "200px",
                background: "var(--surface, #ffffff)",
                color: "var(--text-primary, #1d1d1f)",
              }}
            />
          </div>

          {/* Reply quote (conditional) */}
          {replyTo?.bodyHtml && (
            <div
              className="max-h-24 overflow-y-auto px-3 py-2"
              style={{ borderTop: "1px solid var(--border, #e5e5ea)" }}
            >
              <div
                className="text-xs"
                style={{ color: "var(--text-secondary, #6e6e73)" }}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(replyTo.bodyHtml),
                }}
              />
            </div>
          )}

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div
              className="flex flex-wrap gap-2 px-3 py-2"
              style={{ borderTop: "1px solid var(--border, #e5e5ea)" }}
            >
              {attachments.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                  style={{ background: "var(--surface-accent, #EEF4FC)", fontSize: 12 }}
                >
                  <Paperclip size={11} style={{ color: "var(--brand-blue, #2056A4)" }} />
                  <span style={{ color: "var(--text-primary)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.name}
                  </span>
                  <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                    {formatSize(file.size)}
                  </span>
                  <button
                    onClick={() => removeAttachment(i)}
                    style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom toolbar */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderTop: "1px solid var(--border, #e5e5ea)" }}
          >
            {/* Left: Discard + attach */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="text-sm hover:opacity-70"
                style={{ color: "var(--text-muted, #aeaeb2)" }}
              >
                Discard
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                className="flex items-center gap-1 text-sm hover:opacity-70"
                style={{ color: "var(--text-muted, #aeaeb2)" }}
              >
                <Paperclip size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
            </div>

            {/* Right: Send */}
            <button
              onClick={handleSend}
              disabled={sending || !to || !subject}
              className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm text-white disabled:opacity-50"
              style={{ background: "var(--brand-blue, #2056A4)" }}
            >
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
