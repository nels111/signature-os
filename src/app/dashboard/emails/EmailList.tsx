"use client";

interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  date: string;
  isRead: boolean;
  folder: string;
}

interface EmailListProps {
  emails: EmailSummary[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
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

export function EmailList({
  emails,
  loading,
  selectedId,
  onSelect,
  page,
  totalPages,
  onPageChange,
}: EmailListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        Loading emails...
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        No emails found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {emails.map((email) => (
          <button
            key={email.id}
            onClick={() => onSelect(email.id)}
            className={`w-full text-left px-3 py-2.5 border-b border-gray-800 transition-colors ${
              selectedId === email.id
                ? "bg-gray-700"
                : email.isRead
                  ? "hover:bg-gray-800"
                  : "bg-gray-850 hover:bg-gray-800"
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span
                className={`text-sm truncate ${
                  email.isRead ? "text-gray-400" : "text-white font-semibold"
                }`}
              >
                {extractName(email.from)}
              </span>
              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                {formatDate(email.date)}
              </span>
            </div>
            <div
              className={`text-sm truncate ${
                email.isRead ? "text-gray-500" : "text-gray-300"
              }`}
            >
              {email.subject || "(No Subject)"}
            </div>
          </button>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-700 bg-gray-800">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-xs text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
