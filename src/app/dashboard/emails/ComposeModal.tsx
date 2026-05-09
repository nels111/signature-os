"use client";

import { useState } from "react";

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

export function ComposeModal({ onClose, onSent, replyTo, mailbox }: ComposeModalProps) {
  const [to, setTo] = useState(replyTo?.to || "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(replyTo?.subject || "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showCc, setShowCc] = useState(false);

  const handleSend = async () => {
    if (!to || !subject) return;
    setSending(true);

    try {
      // Build HTML body
      let htmlBody = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">${body.replace(/\n/g, "<br>")}</div>`;

      // Append reply quote if replying
      if (replyTo?.bodyHtml) {
        htmlBody += replyTo.bodyHtml;
      }

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
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="w-full max-w-2xl bg-gray-800 rounded-t-lg shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-white">
            {replyTo ? (replyTo.to ? "Reply" : "Forward") : "New Email"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg"
          >
            ×
          </button>
        </div>

        {/* Fields */}
        <div className="px-4 py-2 space-y-2 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-10">To:</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            {!showCc && (
              <button
                onClick={() => setShowCc(true)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                CC
              </button>
            )}
          </div>

          {showCc && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-10">CC:</label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-10">Subj:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="text-xs text-gray-500">
            Sending as: {mailbox}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 py-2 overflow-y-auto">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email..."
            rows={10}
            className="w-full h-full px-2 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* Reply quote preview */}
        {replyTo?.bodyHtml && (
          <div className="px-4 py-2 border-t border-gray-700 max-h-24 overflow-y-auto">
            <div className="text-xs text-gray-500 mb-1">Quoted text:</div>
            <div
              className="text-xs text-gray-400 line-clamp-3"
              dangerouslySetInnerHTML={{ __html: replyTo.bodyHtml }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
          >
            Discard
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !to || !subject}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
