'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Site {
  id: string;
  name: string;
  connecteamJobName: string | null;
  cellTier: 'A' | 'B' | 'C';
  billingType: 'hourly' | 'monthly_fixed';
  billingRatePerHour: number | null;
  monthlyBillingValue: number | null;
  labourRatePerHour: number;
  fixedMonthlyCost: number | null;
  rateConfirmed: boolean;
  active: boolean;
  notes: string | null;
  weeklyHours: number | null;
  weeklyEarnings: number | null;
}

interface MarginData {
  hours: number | null;            // back-compat alias
  clockedHours: number | null;     // actual clock-in hours (payroll truth)
  scheduledHours: number | null;   // planned shifts (clock-in permission windows)
  revenue: number;
  labourCost: number;
  grossMarginPct: number | null;
  connecteamError: string | null;
  week: { start: string; end: string };
  // Delivery QA (clocked vs sheet expected)
  deliveryFlag: 'over' | 'under' | 'on_track' | null;
  deliveryVariance: number | null;  // clocked minus expected hours
  expectedWeeklyHours: number | null;
  // Revenue / cost provenance
  revenueSource: 'sheet' | 'billing_override' | 'none';
  costModel: 'fixed_monthly' | 'hourly_modelled';
}

const WEEKS_PER_MONTH = 4.33;

function fmt(n: number): string {
  return '£' + n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDec(n: number, dp = 1): string {
  return n.toFixed(dp);
}

function marginColour(pct: number | null): string {
  if (pct === null) return 'var(--text-muted)';
  if (pct >= 35) return 'var(--status-success)';
  if (pct >= 25) return 'var(--status-warning)';
  return 'var(--status-danger)';
}

function marginBg(pct: number | null): string {
  if (pct === null) return 'transparent';
  if (pct >= 35) return 'var(--status-success-bg)';
  if (pct >= 25) return 'var(--status-warning-bg)';
  return 'var(--status-danger-bg)';
}

function CellBadge({ tier }: { tier: 'A' | 'B' | 'C' }) {
  const colours: Record<string, string> = {
    A: 'var(--stage-cold-call)',
    B: 'var(--deal-quote-sent)',
    C: 'var(--status-success)',
  };
  const descriptions: Record<string, string> = {
    A: '1-15 hrs/wk · 4-wk notice · monthly audit',
    B: '16-30 hrs/wk · 4-wk notice · fortnightly audit',
    C: '31+ hrs/wk · 8-wk notice · weekly audit',
  };
  return (
    <span title={descriptions[tier]} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px 3px 6px', borderRadius: 'var(--radius-full)',
      background: colours[tier] + '22', color: colours[tier],
      border: `1.5px solid ${colours[tier]}55`,
      fontSize: 12, fontWeight: 700, cursor: 'help',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: '50%',
        background: colours[tier], color: '#fff', fontSize: 10, fontWeight: 800,
      }}>{tier}</span>
      Cell {tier}
    </span>
  );
}

function EditRateModal({ site, onClose, onSaved }: {
  site: Site;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [billingType, setBillingType] = useState(site.billingType);
  const [billingRate, setBillingRate] = useState(site.billingRatePerHour?.toString() ?? '27');
  const [monthlyValue, setMonthlyValue] = useState(site.monthlyBillingValue?.toString() ?? '');
  const [labourRate, setLabourRate] = useState(site.labourRatePerHour?.toString() ?? '17');
  const [costMode, setCostMode] = useState<'hourly' | 'fixed_monthly'>(
    site.fixedMonthlyCost && site.fixedMonthlyCost > 0 ? 'fixed_monthly' : 'hourly'
  );
  const [fixedMonthlyCost, setFixedMonthlyCost] = useState(site.fixedMonthlyCost?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    const body: Record<string, unknown> = {
      billingType, labourRatePerHour: Number(labourRate) || 17, rateConfirmed: true,
      // null clears the override; numeric sets it
      fixedMonthlyCost: costMode === 'fixed_monthly' ? (Number(fixedMonthlyCost) || null) : null,
    };
    if (billingType === 'hourly') body.billingRatePerHour = Number(billingRate) || 27;
    else body.monthlyBillingValue = Number(monthlyValue) || null;

    const res = await fetch(`/api/sites/${site.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) { onSaved(); onClose(); }
    else setError('Save failed — try again');
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        padding: 28, width: 400, maxWidth: 'calc(100vw - 32px)',
        boxShadow: 'var(--shadow-modal)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          Set billing rate
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)' }}>
          {site.name}
        </p>

        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
          Billing type
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['hourly', 'monthly_fixed'] as const).map(t => (
            <button key={t} onClick={() => setBillingType(t)} style={{
              flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)',
              border: billingType === t ? '2px solid var(--brand-blue)' : '2px solid var(--border)',
              background: billingType === t ? 'var(--surface-accent)' : 'var(--surface)',
              color: billingType === t ? 'var(--brand-blue)' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{t === 'hourly' ? 'Hourly (£/hr)' : 'Monthly fixed'}</button>
          ))}
        </div>

        {billingType === 'hourly' ? (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Billing rate (£/hr)</label>
            <input type="number" min={0} step={0.5} value={billingRate}
              onChange={e => setBillingRate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Monthly value (£/month)</label>
            <input type="number" min={0} step={50} value={monthlyValue}
              onChange={e => setMonthlyValue(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
          </div>
        )}

        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
          Cost model
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {([
            { k: 'hourly', label: 'Hours × labour rate' },
            { k: 'fixed_monthly', label: 'Subcontractor flat fee' },
          ] as const).map(opt => (
            <button key={opt.k} onClick={() => setCostMode(opt.k)} type="button" style={{
              flex: 1, padding: '8px 6px', borderRadius: 'var(--radius-sm)',
              border: costMode === opt.k ? '2px solid var(--brand-blue)' : '2px solid var(--border)',
              background: costMode === opt.k ? 'var(--surface-accent)' : 'var(--surface)',
              color: costMode === opt.k ? 'var(--brand-blue)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', lineHeight: 1.2,
            }}>{opt.label}</button>
          ))}
        </div>

        {costMode === 'hourly' ? (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Labour rate (£/hr)</label>
            <input type="number" min={0} step={0.5} value={labourRate}
              onChange={e => setLabourRate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Flat fee (£/month)</label>
            <input type="number" min={0} step={50} value={fixedMonthlyCost}
              onChange={e => setFixedMonthlyCost(e.target.value)}
              placeholder="e.g. 2400"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              For Cleanz4U / Lisa-style flat invoices. Weekly cost = monthly ÷ 4.33.
            </p>
          </div>
        )}

        {error && <p style={{ color: 'var(--status-danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)',
            border: '1.5px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{
            flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)',
            border: 'none', background: saving ? 'var(--text-muted)' : 'var(--brand-blue)',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
          }}>{saving ? 'Saving…' : 'Confirm rate'}</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, colour, tag }: {
  label: string;
  value: string;
  sub?: string;
  colour?: string;
  tag?: string;
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '16px 18px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {tag && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 'var(--radius-full)', background: 'var(--surface-accent)', color: 'var(--brand-blue)', fontWeight: 700 }}>{tag}</span>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: colour ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function PlaceholderCard({ title, description, phase }: { title: string; description: string; phase: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px dashed var(--border)',
      borderRadius: 'var(--radius-md)', padding: '20px 18px',
      opacity: 0.7,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>{title}</h3>
        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 'var(--radius-full)', background: 'var(--surface-accent)', color: 'var(--brand-blue)', fontWeight: 700 }}>
          {phase}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{description}</p>
    </div>
  );
}

export function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [site, setSite] = useState<Site | null>(null);
  const [sheetFetchedAt, setSheetFetchedAt] = useState<string | null>(null);
  const [margin, setMargin] = useState<MarginData | null>(null);
  const [loadingSite, setLoadingSite] = useState(true);
  const [loadingMargin, setLoadingMargin] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [editingRate, setEditingRate] = useState(false);

  const loadSite = useCallback(async () => {
    if (!id) return;
    setLoadingSite(true);
    const res = await fetch(`/api/sites/${id}`);
    if (res.status === 404) { setNotFound(true); setLoadingSite(false); return; }
    if (!res.ok) { setLoadingSite(false); return; }
    const data = await res.json();
    setSite(data.site);
    setSheetFetchedAt(data.sheetFetchedAt ?? null);
    setLoadingSite(false);
  }, [id]);

  const loadMargin = useCallback(async () => {
    if (!id) return;
    setLoadingMargin(true);
    const res = await fetch(`/api/sites/${id}/margin`);
    if (!res.ok) { setLoadingMargin(false); return; }
    const data = await res.json();
    setMargin({
      hours: data.hours ?? null,
      clockedHours: data.clockedHours ?? null,
      scheduledHours: data.scheduledHours ?? null,
      revenue: data.revenue ?? 0,
      labourCost: data.labourCost ?? 0,
      grossMarginPct: data.grossMarginPct ?? null,
      connecteamError: data.connecteamError ?? null,
      week: data.week,
      deliveryFlag: data.deliveryFlag ?? null,
      deliveryVariance: data.deliveryVariance ?? null,
      expectedWeeklyHours: data.expectedWeeklyHours ?? null,
      revenueSource: data.revenueSource ?? 'none',
      costModel: data.costModel ?? 'hourly_modelled',
    });
    setLoadingMargin(false);
  }, [id]);

  useEffect(() => { loadSite(); }, [loadSite]);
  useEffect(() => { if (!loadingSite && site) loadMargin(); }, [loadingSite, site, loadMargin]);

  if (notFound) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>404</div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Contract not found</p>
        <button onClick={() => router.push('/dashboard/financials')} style={{
          padding: '10px 24px', borderRadius: 'var(--radius-sm)',
          background: 'var(--brand-blue)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600,
        }}>Back to Financials</button>
      </div>
    );
  }

  if (loadingSite || !site) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ height: 28, width: 200, background: 'var(--border)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
        <div style={{ height: 14, width: 300, background: 'var(--border)', borderRadius: 4, marginBottom: 32, animation: 'pulse 1.5s infinite' }} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 80, background: 'var(--border)', borderRadius: 'var(--radius-md)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  // Contracted financials from sheet
  const contractedHours = site.weeklyHours ?? 0;
  let contractedRevenue = 0;
  if (site.billingType === 'monthly_fixed' && site.monthlyBillingValue) {
    contractedRevenue = Number(site.monthlyBillingValue) / WEEKS_PER_MONTH;
  } else if (site.billingRatePerHour && contractedHours > 0) {
    contractedRevenue = Number(site.billingRatePerHour) * contractedHours;
  } else if (site.weeklyEarnings) {
    contractedRevenue = site.weeklyEarnings;
  }
  const usingFixedCost = !!(site.fixedMonthlyCost && site.fixedMonthlyCost > 0);
  const contractedLabour = usingFixedCost
    ? Number(site.fixedMonthlyCost) / WEEKS_PER_MONTH
    : contractedHours * Number(site.labourRatePerHour ?? 17);
  const contractedMarginPct = contractedRevenue > 0 ? ((contractedRevenue - contractedLabour) / contractedRevenue) * 100 : null;

  const monthlyRevenue = contractedRevenue * WEEKS_PER_MONTH;
  const annualRevenue = monthlyRevenue * 12;

  // Live hours — actual clock-ins from CT (QA flag only; margin uses sheet hours)
  const liveHours = margin?.clockedHours ?? margin?.hours ?? null;
  const scheduledLiveHours = margin?.scheduledHours ?? null;
  // Delivery flag + variance come from the API (clocked vs sheet expected, ±15% tolerance)
  const deliveryFlag = margin?.deliveryFlag ?? null;
  const deliveryVariance = margin?.deliveryVariance ?? null;
  const unworkedScheduled = (scheduledLiveHours !== null && liveHours !== null && scheduledLiveHours - liveHours > 0.5)
    ? scheduledLiveHours - liveHours
    : null;

  const weekLabel = margin?.week
    ? `${new Date(margin.week.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(margin.week.end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : 'this week';

  return (
    <div style={{ padding: '24px 24px 48px', maxWidth: 1100 }}>
      {/* Back nav */}
      <button
        onClick={() => router.push('/dashboard/financials')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, padding: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-blue)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        ← Financials
      </button>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
              {site.name}
            </h1>
            <CellBadge tier={site.cellTier} />
            {!site.active && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--status-danger-bg)', color: 'var(--status-danger)', fontWeight: 700 }}>
                INACTIVE
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            {site.billingType === 'monthly_fixed' ? 'Monthly fixed contract' : 'Hourly rate contract'}
            {!site.rateConfirmed && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--status-warning)', background: 'var(--status-warning-bg)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
                ESTIMATED RATE
              </span>
            )}
            {sheetFetchedAt && (
              <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                Sheet updated {new Date(sheetFetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setEditingRate(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
            border: '1.5px solid var(--border)', color: 'var(--text-secondary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-blue)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand-blue)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
          }}
        >
          ✏ Edit rate
        </button>
      </div>

      {/* KPI strip — contracted figures */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Weekly revenue"
          value={contractedRevenue > 0 ? fmt(contractedRevenue) : '—'}
          sub="contracted"
          tag={site.rateConfirmed ? 'CONFIRMED' : 'ESTIMATED'}
          colour={site.rateConfirmed ? undefined : 'var(--status-warning)'}
        />
        <StatCard
          label="Monthly revenue"
          value={monthlyRevenue > 0 ? fmt(monthlyRevenue) : '—'}
          sub={`${WEEKS_PER_MONTH} wks/month`}
        />
        <StatCard
          label="Annual value"
          value={annualRevenue > 0 ? fmt(annualRevenue) : '—'}
          sub="12 months"
        />
        <StatCard
          label="Gross margin"
          value={contractedMarginPct !== null ? fmtDec(contractedMarginPct) + '%' : '—'}
          sub="target 35%+"
          colour={marginColour(contractedMarginPct)}
        />
      </div>

      {/* Two-col layout: Hours + Billing details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

        {/* Hours card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '20px 20px 18px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Hours
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Contracted</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {contractedHours > 0 ? fmtDec(contractedHours) + ' hrs/wk' : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>from Regular Hours Sheet</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Live ({weekLabel})</div>
              {loadingMargin ? (
                <div style={{ height: 28, width: 80, background: 'var(--border)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
              ) : margin?.connecteamError ? (
                <div style={{ fontSize: 13, color: 'var(--status-warning)' }}>Unavailable</div>
              ) : liveHours !== null ? (
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtDec(liveHours)} hrs/wk
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</div>
              )}
              {!loadingMargin && liveHours !== null && !margin?.connecteamError && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>actual clock-ins from Connecteam</div>
              )}
            </div>
          </div>

          {/* Scheduled vs clocked gap (unworked shifts) */}
          {unworkedScheduled !== null && (
            <div style={{
              marginTop: 14, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--status-warning-bg)',
              color: 'var(--status-warning)',
              fontSize: 12, fontWeight: 600,
            }}>
              {fmtDec(scheduledLiveHours!)} hrs scheduled, {fmtDec(unworkedScheduled)} hrs unworked
            </div>
          )}

          {/* Delivery flag from API — clocked vs sheet expected, ±15% tolerance */}
          {deliveryFlag && deliveryFlag !== 'on_track' && deliveryVariance !== null && (
            <div style={{
              marginTop: 8, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              background: deliveryFlag === 'under' ? 'var(--status-danger-bg)' : 'var(--status-warning-bg)',
              color: deliveryFlag === 'under' ? 'var(--status-danger)' : 'var(--status-warning)',
              fontSize: 12, fontWeight: 600,
            }}>
              {deliveryVariance > 0 ? '+' : ''}{fmtDec(deliveryVariance)} hrs vs contracted
              {deliveryFlag === 'under'
                ? ' — under-served, client risk'
                : ' — over-delivering, labour eating margin'}
            </div>
          )}

          {site.connecteamJobName && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              Tracked as: <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{site.connecteamJobName}</span>
            </div>
          )}
          {!site.connecteamJobName && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--status-warning)' }}>
              No Connecteam job name set — live hours tracking unavailable
            </div>
          )}
        </div>

        {/* Billing details card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '20px 20px 18px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Billing
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Billing type" value={site.billingType === 'monthly_fixed' ? 'Monthly fixed' : 'Hourly'} />
            {margin && (
              <Row
                label="Revenue source"
                value={margin.revenueSource === 'sheet' ? 'Regular Hours Sheet' : margin.revenueSource === 'billing_override' ? 'Manual override' : '—'}
              />
            )}
            {site.billingType === 'hourly' && site.billingRatePerHour && (
              <Row label="Sell rate" value={`£${Number(site.billingRatePerHour).toFixed(2)}/hr`} />
            )}
            {site.billingType === 'monthly_fixed' && site.monthlyBillingValue && (
              <Row label="Monthly value" value={fmt(Number(site.monthlyBillingValue))} />
            )}
            {usingFixedCost ? (
              <Row label="Subcontractor fee" value={`${fmt(Number(site.fixedMonthlyCost))} /month`} />
            ) : (
              <Row label="Labour rate" value={`£${Number(site.labourRatePerHour ?? 17).toFixed(2)}/hr`} />
            )}
            {contractedLabour > 0 && (
              <Row label="Weekly labour cost" value={fmt(contractedLabour)} />
            )}
            {contractedMarginPct !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Gross margin</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
                  borderRadius: 'var(--radius-full)', background: marginBg(contractedMarginPct),
                  color: marginColour(contractedMarginPct), fontWeight: 700, fontSize: 13,
                }}>
                  {fmtDec(contractedMarginPct)}%
                </span>
              </div>
            )}
          </div>

          {site.notes && (
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--background)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
              {site.notes}
            </div>
          )}
        </div>
      </div>

      {/* Placeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <PlaceholderCard
          title="Operatives"
          description="Operative assignments, clock-in reliability, and shift history for this contract."
          phase="PHASE 4"
        />
        <PlaceholderCard
          title="Site Pack"
          description="Checklist, escalation chart, and blueprint for this site."
          phase="COMING SOON"
        />
        <PlaceholderCard
          title="Audit History"
          description="Quality audit scores, action plans, and compliance tracking."
          phase="PHASE 3"
        />
      </div>

      {editingRate && site && (
        <EditRateModal
          site={site}
          onClose={() => setEditingRate(false)}
          onSaved={() => { setEditingRate(false); loadSite(); loadMargin(); }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
