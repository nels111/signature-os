"use client";

import { useState, useEffect } from "react";

interface QuoteFormProps {
  onSubmit: () => void;
  onCancel: () => void;
}

interface PricingPreview {
  weeklyRevenue: number;
  monthlyTotal: number;
  annualTotal: number;
  margin: number;
  effectiveRate: number;
  rateStatus: "green" | "amber" | "red";
  blocked: boolean;
  blockReason: string;
  labourRate: number;
  pilotDiscount: number;
}

interface DealOption {
  id: string;
  name: string;
}

interface AccountOption {
  id: string;
  name: string;
}

export function QuoteForm({ onSubmit, onCancel }: QuoteFormProps) {
  const [weeklyHours, setWeeklyHours] = useState("10");
  const [sellRate, setSellRate] = useState("27");
  const [isPilot, setIsPilot] = useState(false);
  const [dealId, setDealId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [preview, setPreview] = useState<PricingPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load deals and accounts
  useEffect(() => {
    fetch("/api/deals?limit=100").then(r => r.json()).then(d => setDeals(d.deals || [])).catch(() => {});
    fetch("/api/accounts?limit=100").then(r => r.json()).then(d => setAccounts(d.accounts || [])).catch(() => {});
  }, []);

  // Live pricing preview
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!weeklyHours || !sellRate) return;
      try {
        const res = await fetch("/api/quotes/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weeklyHours, sellRate, isPilot }),
        });
        const data = await res.json();
        setPreview(data);
      } catch {
        // ignore calc errors
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [weeklyHours, sellRate, isPilot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeklyHours, sellRate, isPilot,
          dealId: dealId || undefined,
          accountId: accountId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        setSaving(false);
        return;
      }

      onSubmit();
    } catch {
      setError("Failed to create quote");
    } finally {
      setSaving(false);
    }
  };

  const rateColor = preview?.rateStatus === "green" ? "#16a34a" : preview?.rateStatus === "amber" ? "#d97706" : "#dc2626";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Deal / Account linking */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Link to Deal</label>
          <select value={dealId} onChange={e => setDealId(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg" style={{ borderColor: "var(--border)" }}>
            <option value="">None</option>
            {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Link to Account</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg" style={{ borderColor: "var(--border)" }}>
            <option value="">None</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {/* Pricing inputs */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Weekly Hours</label>
          <input type="number" step="0.5" min="1" value={weeklyHours} onChange={e => setWeeklyHours(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg" style={{ borderColor: "var(--border)" }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Sell Rate (£/hr)
            {preview && (
              <span className="ml-1 font-bold" style={{ color: rateColor }}>
                {preview.rateStatus === "green" ? "✓" : preview.rateStatus === "amber" ? "⚠" : "✗"}
              </span>
            )}
          </label>
          <input type="number" step="0.5" min="20" value={sellRate} onChange={e => setSellRate(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg"
            style={{ borderColor: preview ? rateColor : "var(--border)" }} />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isPilot} onChange={e => setIsPilot(e.target.checked)}
              className="rounded" />
            <span style={{ color: "var(--text-secondary)" }}>Pilot (25% off)</span>
          </label>
        </div>
      </div>

      {/* Live pricing preview */}
      {preview && (
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>PRICING PREVIEW</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span style={{ color: "var(--text-secondary)" }}>Effective Rate: </span>
              <span className="font-medium" style={{ color: rateColor }}>
                £{preview.effectiveRate.toFixed(2)}/hr
              </span>
              {isPilot && <span className="text-xs ml-1" style={{ color: "#d97706" }}>(-{preview.pilotDiscount}%)</span>}
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)" }}>Labour: </span>
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>£{preview.labourRate}/hr</span>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)" }}>Monthly: </span>
              <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                £{preview.monthlyTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)" }}>Annual: </span>
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                £{preview.annualTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)" }}>Margin: </span>
              <span className="font-bold" style={{ color: preview.margin >= 30 ? "#16a34a" : preview.margin >= 25 ? "#d97706" : "#dc2626" }}>
                {preview.margin.toFixed(1)}%
              </span>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)" }}>Weekly Revenue: </span>
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                £{preview.weeklyRevenue.toFixed(2)}
              </span>
            </div>
          </div>

          {preview.blocked && (
            <div className="mt-3 px-3 py-2 rounded text-sm text-white" style={{ backgroundColor: "#dc2626" }}>
              ✗ BLOCKED: {preview.blockReason}
            </div>
          )}
          {!preview.blocked && preview.rateStatus === "amber" && (
            <div className="mt-3 px-3 py-2 rounded text-sm" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
              ⚠ Rate below target (£27/hr). Proceed with caution.
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded text-sm text-white" style={{ backgroundColor: "#dc2626" }}>
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-lg" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          Cancel
        </button>
        <button type="submit" disabled={saving || preview?.blocked}
          className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-blue)" }}>
          {saving ? "Creating..." : "Create Quote"}
        </button>
      </div>
    </form>
  );
}
