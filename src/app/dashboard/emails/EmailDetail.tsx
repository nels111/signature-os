"use client";

import { useState, useEffect } from "react";

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
  emailId: string;
  onReply: (data: {
    to: string;
    subject: string;
    inReplyTo: string;
    references: string;
    bodyHtml: string;
  }) => void;
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

export function EmailDetail({ emailId, onReply }: EmailDetailProps) {
  const [email, setEmail] = useState<EmailFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/emails/${emailId}`)
      .then((r) => r.json())
      .then((data) => {
        setEmail(data.email || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [emailId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        Loading...
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        Email not found
      </div>
    );
  }

  const handleReply = () => {
    const fromMatch = email.from.match(/<([^>]+)>/);
    const replyAddr = fromMatch ? fromMatch[1] : email.from;

    onReply({
      to: replyAddr,
      subject: email.subject.startsWith("Re: ") ? email.subject : `Re: ${email.subject}`,
      inReplyTo: email.messageId,
      references: email.messageId,
      bodyHtml: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 8px; margin-left: 8px; color: #666;">
        <p>On ${formatFullDate(email.date)}, ${email.from} wrote:</p>
        ${email.bodyHtml || `<pre>${email.bodyText || ""}</pre>`}
      </div>`,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-2">{email.subject}</h2>
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <div className="text-gray-300">
              <span className="text-gray-500">From:</span> {email.from}
            </div>
            <div className="text-gray-400">
              <span className="text-gray-500">To:</span> {email.to.join(", ")}
            </div>
            {email.cc.length > 0 && (
              <div className="text-gray-400">
                <span className="text-gray-500">CC:</span> {email.cc.join(", ")}
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500">{formatFullDate(email.date)}</div>
        </div>

        {/* CRM links */}
        {(email.linkedLead || email.linkedDeal || email.linkedContact) && (
          <div className="flex gap-2 mt-2">
            {email.linkedContact && (
              <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded text-xs">
                Contact: {email.linkedContact.firstName} {email.linkedContact.lastName}
              </span>
            )}
            {email.linkedLead && (
              <span className="px-2 py-0.5 bg-green-900/50 text-green-300 rounded text-xs">
                Lead: {email.linkedLead.companyName}
              </span>
            )}
            {email.linkedDeal && (
              <span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded text-xs">
                Deal: {email.linkedDeal.name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-6 py-2 border-b border-gray-700 bg-gray-850">
        <button
          onClick={handleReply}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Reply
        </button>
        <button
          onClick={() => {
            // Forward - compose with body pre-filled
            onReply({
              to: "",
              subject: email.subject.startsWith("Fwd: ") ? email.subject : `Fwd: ${email.subject}`,
              inReplyTo: "",
              references: "",
              bodyHtml: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 8px; margin-left: 8px; color: #666;">
                <p>---------- Forwarded message ----------</p>
                <p>From: ${email.from}<br>Date: ${formatFullDate(email.date)}<br>Subject: ${email.subject}<br>To: ${email.to.join(", ")}</p>
                ${email.bodyHtml || `<pre>${email.bodyText || ""}</pre>`}
              </div>`,
            });
          }}
          className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
        >
          Forward
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {email.bodyHtml ? (
          <div
            className="email-body prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
          />
        ) : (
          <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">
            {email.bodyText || "(No content)"}
          </pre>
        )}
      </div>
    </div>
  );
}
