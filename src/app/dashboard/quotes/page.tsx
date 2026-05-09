"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { QuoteForm } from "./QuoteForm";

interface Quote {
  id: string;
  status: string;
  weeklyHours: string;
  sellRate: string;
  monthlyTotal: string;
  annualTotal: string;
  margin: string;
  isPilot: boolean;
  createdAt: string;
  deal: { id: string; name: string } | null;
  account: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  creator: { id: string; name: string } | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#e2e8f0", text: "#475569" },
  sent: { bg: "#dbeafe", text: "#1d4ed8" },
  accepted: { bg: "#dcfce7", text: "#16a34a" },
  rejected: { bg: "#fee2e2", text: "#dc2626" },
  expired: { bg: "#fef3c7", text: "#d97706" },
};

function formatCurrency(val: string | number): string {
  return `£${parseFloat(String(val)).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchQuotes = useCallback(async () => {
    const params = new URLSearchParams({ page: page.toString(), limit: "20" });
    if (filter) params.set("status", filter);
    const res = await fetch(`/api/quotes?${params}`);
    const data = await res.json();
    return { quotes: data.quotes || [], pages: data.pagination?.pages || 1 };
  }, [page, filter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchQuotes().then((result) => {
      if (!cancelled) {
        setQuotes(result.quotes);
        setTotalPages(result.pages);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [fetchQuotes]);

  const handleCreated = () => {
    setShowCreate(false);
    setPage(1);
    fetchQuotes().then((result) => {
      setQuotes(result.quotes);
      setTotalPages(result.pages);
    });
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchQuotes().then((result) => {
      setQuotes(result.quotes);
      setTotalPages(result.pages);
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "#1a1a1a" }}>Quotes</h1>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-sm border rounded-md"
            style={{ borderColor: "#e2e8f0" }}
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-1.5 text-sm text-white rounded-md"
            style={{ backgroundColor: "#2c5f2d" }}
          >
            + New Quote
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No quotes yet</div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "#e2e8f0" }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#64748b" }}>Deal / Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#64748b" }}>Hrs/wk</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#64748b" }}>Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#64748b" }}>Monthly</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#64748b" }}>Annual</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#64748b" }}>Margin</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#64748b" }}>Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#64748b" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const marginNum = parseFloat(q.margin);
                const sc = STATUS_COLORS[q.status] || STATUS_COLORS.draft;
                return (
                  <tr key={q.id} className="border-b hover:bg-gray-50" style={{ borderColor: "#e2e8f0" }}>
                    <td className="px-4 py-3 text-sm">
                      <div style={{ color: "#1a1a1a" }}>{q.deal?.name || q.account?.name || "Unlinked"}</div>
                      {q.contact && (
                        <div className="text-xs" style={{ color: "#64748b" }}>
                          {q.contact.firstName} {q.contact.lastName}
                        </div>
                      )}
                      {q.isPilot && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fef3c7", color: "#d97706" }}>
                          PILOT
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#1a1a1a" }}>{q.weeklyHours}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#1a1a1a" }}>
                      {formatCurrency(q.sellRate)}/hr
                    </td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1a1a1a" }}>
                      {formatCurrency(q.monthlyTotal)}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#64748b" }}>
                      {formatCurrency(q.annualTotal)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: marginNum >= 30 ? "#16a34a" : marginNum >= 25 ? "#d97706" : "#dc2626" }}>
                      {marginNum.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: sc.bg, color: sc.text }}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {q.status === "draft" && (
                        <button
                          onClick={() => handleStatusChange(q.id, "sent")}
                          className="text-xs px-2 py-1 rounded text-white"
                          style={{ backgroundColor: "#2c5f2d" }}
                        >
                          Mark Sent
                        </button>
                      )}
                      {q.status === "sent" && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleStatusChange(q.id, "accepted")}
                            className="text-xs px-2 py-1 rounded text-white bg-green-600"
                          >
                            Won
                          </button>
                          <button
                            onClick={() => handleStatusChange(q.id, "rejected")}
                            className="text-xs px-2 py-1 rounded text-white bg-red-500"
                          >
                            Lost
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "#e2e8f0" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-xs border rounded disabled:opacity-50" style={{ borderColor: "#e2e8f0" }}>
                Prev
              </button>
              <span className="text-xs" style={{ color: "#64748b" }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 text-xs border rounded disabled:opacity-50" style={{ borderColor: "#e2e8f0" }}>
                Next
              </button>
            </div>
          )}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Quote">
        <QuoteForm onSubmit={handleCreated} onCancel={() => setShowCreate(false)} />
      </Modal>
    </div>
  );
}
