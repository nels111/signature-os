'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Site {
  id: string;
  name: string;
  connecteamJobName: string | null;
  cellTier: 'A' | 'B' | 'C';
  billingType: 'hourly' | 'monthly_fixed';
  billingRatePerHour: number | null;
  monthlyBillingValue: number | null;
  labourRatePerHour: number;
  fixedMonthlyCost: number | null;  // Cleanz4U flat-fee contracts
  rateConfirmed: boolean;
  active: boolean;
  notes: string | null;
  // Sheet-derived contracted financials
  weeklyHours: number | null;
  weeklyEarnings: number | null;
}

interface ContractedMargin {
  hours: number;
  revenue: number;
  labourCost: number;
  grossMarginPct: number | null;
}

const WEEKS_PER_MONTH = 4.33;

function contractedMargin(site: Site): ContractedMargin {
  const hours = site.weeklyHours ?? 0;
  // Priority: sheet weeklyEarnings (canonical) > confirmed DB billing override
  let revenue: number;
  if (site.weeklyEarnings) {
    revenue = site.weeklyEarnings;
  } else if (site.billingType === 'monthly_fixed' && site.monthlyBillingValue) {
    revenue = site.monthlyBillingValue / WEEKS_PER_MONTH;
  } else if (site.billingRatePerHour && hours > 0) {
    revenue = site.billingRatePerHour * hours;
  } else {
    revenue = 0;
  }
  // Labour: flat subcontractor fee (e.g. Cleanz4U) takes priority over hours × rate
  const labourCost = site.fixedMonthlyCost && site.fixedMonthlyCost > 0
    ? Number(site.fixedMonthlyCost) / WEEKS_PER_MONTH
    : hours * (site.labourRatePerHour ?? 17);
  const grossMarginPct = revenue > 0 ? ((revenue - labourCost) / revenue) * 100 : null;
  return { hours, revenue, labourCost, grossMarginPct };
}

type SortKey = 'name' | 'cellTier' | 'hours' | 'revenue' | 'labourCost' | 'grossMarginPct';

function SortIcon({ col, sortKey, sortAsc }: { col: SortKey; sortKey: SortKey; sortAsc: boolean }) {
  if (sortKey !== col) return <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>↕</span>;
  return <span style={{ color: 'var(--brand-blue)', marginLeft: 4 }}>{sortAsc ? '↑' : '↓'}</span>;
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

function fmt(n: number): string {
  return '£' + n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtPct(n: number | null): string {
  if (n === null) return '—';
  return n.toFixed(1) + '%';
}

function CellBadge({ tier }: { tier: 'A' | 'B' | 'C' }) {
  const colours: Record<string, string> = {
    A: 'var(--stage-cold-call)',
    B: 'var(--deal-quote-sent)',
    C: 'var(--status-success)',
  };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: colours[tier],
      color: '#fff',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0,
    }}>
      {tier}
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    const body: Record<string, unknown> = {
      billingType,
      labourRatePerHour: Number(labourRate) || 17,
      rateConfirmed: true,
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
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        padding: 28, width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-modal)',
        margin: '0 16px',
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
            }}>
              {t === 'hourly' ? 'Hourly (£/hr)' : 'Monthly fixed'}
            </button>
          ))}
        </div>

        {billingType === 'hourly' ? (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Billing rate (£/hr)
            </label>
            <input
              type="number" min={0} step={0.5} value={billingRate}
              onChange={e => setBillingRate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--surface)',
                color: 'var(--text-primary)', boxSizing: 'border-box',
              }}
            />
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Monthly value (£/month)
            </label>
            <input
              type="number" min={0} step={50} value={monthlyValue}
              onChange={e => setMonthlyValue(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--surface)',
                color: 'var(--text-primary)', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Labour rate (£/hr)
          </label>
          <input
            type="number" min={0} step={0.5} value={labourRate}
            onChange={e => setLabourRate(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--surface)',
              color: 'var(--text-primary)', boxSizing: 'border-box',
            }}
          />
        </div>

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
          }}>
            {saving ? 'Saving…' : 'Confirm rate'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FinancialsDashboard() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('grossMarginPct');
  const [sortAsc, setSortAsc] = useState(true);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [sheetFetchedAt, setSheetFetchedAt] = useState('');

  const loadSites = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/sites');
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setSites(data.sites || []);
    if (data.sheetFetchedAt) setSheetFetchedAt(data.sheetFetchedAt);
    setLoading(false);
  }, []);

  useEffect(() => { loadSites(); }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'grossMarginPct'); }
  }

  // Pre-compute contracted margins for all sites
  const marginBySite = new Map(sites.map(s => [s.id, contractedMargin(s)]));

  const sortedSites = [...sites].sort((a, b) => {
    const ma = marginBySite.get(a.id);
    const mb = marginBySite.get(b.id);
    let av: number | string, bv: number | string;
    switch (sortKey) {
      case 'name': av = a.name; bv = b.name; break;
      case 'cellTier': av = a.cellTier; bv = b.cellTier; break;
      case 'hours': av = ma?.hours ?? 0; bv = mb?.hours ?? 0; break;
      case 'revenue': av = ma?.revenue ?? 0; bv = mb?.revenue ?? 0; break;
      case 'labourCost': av = ma?.labourCost ?? 0; bv = mb?.labourCost ?? 0; break;
      case 'grossMarginPct': av = ma?.grossMarginPct ?? 999; bv = mb?.grossMarginPct ?? 999; break;
      default: av = 0; bv = 0;
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  // Summary totals from contracted data
  const totals = [...marginBySite.values()].reduce(
    (acc, m) => ({ rev: acc.rev + m.revenue, cost: acc.cost + m.labourCost }),
    { rev: 0, cost: 0 }
  );
  const blendedMargin = totals.rev > 0 ? ((totals.rev - totals.cost) / totals.rev) * 100 : null;
  const confirmedCount = sites.filter(s => s.rateConfirmed).length;
  const unconfirmedCount = sites.length - confirmedCount;

  const thStyle = (col: SortKey): React.CSSProperties => ({
    padding: '10px 14px',
    textAlign: col === 'name' ? 'left' : 'right',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-secondary)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    borderBottom: '1.5px solid var(--border)',
  });

  if (loading) {
    return (
      <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        Loading contracts…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
          Contract Financials
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Contracted revenue vs labour cost — from Regular Hours Sheet{sheetFetchedAt && ` · updated ${new Date(sheetFetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Weekly revenue', value: fmt(totals.rev), sub: 'all active sites' },
          { label: 'Weekly labour', value: fmt(totals.cost), sub: 'at £17/hr standard' },
          {
            label: 'Blended margin',
            value: fmtPct(blendedMargin ? Math.round(blendedMargin * 10) / 10 : null),
            sub: 'target 35%+',
            colour: marginColour(blendedMargin),
          },
          {
            label: 'Unconfirmed rates',
            value: `${unconfirmedCount} site${unconfirmedCount !== 1 ? 's' : ''}`,
            sub: `${confirmedCount} confirmed`,
            colour: unconfirmedCount > 0 ? 'var(--status-warning)' : 'var(--status-success)',
          },
        ].map(card => (
          <div key={card.label} className="sig-stat" style={{
            background: '#ffffff',
            boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: card.colour ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {card.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: '#ffffff',
        boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--background)' }}>
              <th style={{ ...thStyle('name'), textAlign: 'left' }} onClick={() => toggleSort('name')}>
                Site <SortIcon col="name" sortKey={sortKey} sortAsc={sortAsc} />
              </th>
              <th style={thStyle('cellTier')} onClick={() => toggleSort('cellTier')}>
                Cell <SortIcon col="cellTier" sortKey={sortKey} sortAsc={sortAsc} />
              </th>
              <th style={thStyle('hours')} onClick={() => toggleSort('hours')}>
                Hrs <SortIcon col="hours" sortKey={sortKey} sortAsc={sortAsc} />
              </th>
              <th style={thStyle('revenue')} onClick={() => toggleSort('revenue')}>
                Revenue <SortIcon col="revenue" sortKey={sortKey} sortAsc={sortAsc} />
              </th>
              <th className="hidden sm:table-cell" style={thStyle('labourCost')} onClick={() => toggleSort('labourCost')}>
                Labour <SortIcon col="labourCost" sortKey={sortKey} sortAsc={sortAsc} />
              </th>
              <th style={thStyle('grossMarginPct')} onClick={() => toggleSort('grossMarginPct')}>
                Margin <SortIcon col="grossMarginPct" sortKey={sortKey} sortAsc={sortAsc} />
              </th>
              <th style={{ ...thStyle('name'), cursor: 'default' }}></th>
            </tr>
          </thead>
          <tbody>
            {sortedSites.map((site, i) => {
              const m = marginBySite.get(site.id);
              return (
                <tr key={site.id} style={{
                  borderBottom: i < sortedSites.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.12s',
                  cursor: 'pointer',
                }}
                  onClick={() => router.push(`/dashboard/contracts/${site.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {site.name}
                    </div>
                    {!site.rateConfirmed && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: 'var(--status-warning)',
                        background: 'var(--status-warning-bg)', padding: '1px 6px',
                        borderRadius: 'var(--radius-full)', letterSpacing: '0.04em',
                      }}>
                        ESTIMATED RATE
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <CellBadge tier={site.cellTier} />
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: 'var(--text-primary)' }}>
                    {m?.hours ? m.hours.toFixed(1) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: 'var(--text-primary)' }}>
                    {m?.revenue ? fmt(m.revenue) : '—'}
                  </td>
                  <td className="hidden sm:table-cell" style={{ padding: '12px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: 'var(--text-secondary)' }}>
                    {m?.labourCost ? fmt(m.labourCost) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    {m?.grossMarginPct !== null && m?.grossMarginPct !== undefined ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        background: marginBg(m.grossMarginPct),
                        color: marginColour(m.grossMarginPct),
                        fontWeight: 700,
                        fontSize: 13,
                        fontVariantNumeric: 'tabular-nums',
                        minWidth: 60,
                        justifyContent: 'center',
                      }}>
                        {fmtPct(m.grossMarginPct)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingSite(site); }}
                      title="Edit billing rate"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '4px 6px',
                        borderRadius: 'var(--radius-sm)', fontSize: 14,
                        transition: 'color 0.12s, background 0.12s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand-blue)';
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-blue-subtle)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                        (e.currentTarget as HTMLButtonElement).style.background = 'none';
                      }}
                    >
                      ✏
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sites.length === 0 && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
            No active contracts. Add a site to get started.
          </div>
        )}
        </div>
      </div>

      <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
        Hours and revenue from Regular Hours Sheet (contracted). Margin = (revenue &#8722; labour) / revenue. Labour at £17/hr standard. Unconfirmed rates use derived sheet rate.
      </p>

      {editingSite && (
        <EditRateModal
          site={editingSite}
          onClose={() => setEditingSite(null)}
          onSaved={() => { setEditingSite(null); loadSites(); }}
        />
      )}
    </div>
  );
}
