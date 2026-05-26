'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  UserPlus,
  Zap,
  TrendingUp,
  FileText,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';

interface PipelineStage {
  stage: string;
  count: number;
  value: number;
}

interface QuotesData {
  count: number;
  totalValue: number;
}

interface SalesData {
  totalLeads: number;
  totalDeals: number;
  pipelineValue: PipelineStage[];
  quotesThisMonth: QuotesData;
}

function StatCard({
  label,
  value,
  change,
  positive,
  icon,
  accent,
  href,
}: {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon?: React.ReactNode;
  accent?: string;
  href?: string;
}) {
  const accentColor = accent || 'var(--brand-blue)';
  const inner = (
    <div
      className={`rounded-2xl p-5 sig-stat ${href ? 'sig-stat-link' : ''}`}
      style={{
        background: '#ffffff',
        boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
        cursor: href ? 'pointer' : 'default',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          {label}
        </p>
        {icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${accentColor} 10%, transparent)`, color: accentColor }}>
            {icon}
          </div>
        )}
      </div>
      <p className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </p>
      {change && (
        <div className="flex items-center gap-1 mt-2">
          {positive !== undefined && (
            positive
              ? <TrendingUp size={12} style={{ color: 'var(--status-success)' }} />
              : <TrendingDown size={12} style={{ color: 'var(--status-danger)' }} />
          )}
          <p className="text-xs font-medium" style={{ color: positive !== undefined ? (positive ? 'var(--status-success)' : 'var(--status-danger)') : 'var(--text-muted)' }}>
            {change}
          </p>
        </div>
      )}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

const STAGE_COLOURS: Record<string, string> = {
  'New': '#3b82f6',
  'Contacted': '#8b5cf6',
  'Proposal': '#f59e0b',
  'Negotiation': '#f97316',
  'Won': '#22c55e',
  'Lost': '#ef4444',
};

export function SalesContent() {
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pipelineTotal = data?.pipelineValue?.reduce((sum, s) => sum + s.value, 0) ?? 0;
  const pipelineDeals = data?.pipelineValue?.reduce((sum, s) => sum + s.count, 0) ?? 0;

  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden style={{ position: 'absolute', top: -40, left: -40, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,86,164,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      {/* Back nav */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--brand-blue)]"
          style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          <ArrowLeft size={14} />
          Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#2056a4', margin: '0 0 3px' }}>Sales</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>Pipeline</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--brand-blue)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Active Leads"
              value={String(data?.totalLeads ?? 0)}
              icon={<UserPlus size={16} />}
              href="/dashboard/leads"
            />
            <StatCard
              label="Open Deals"
              value={String(data?.totalDeals ?? 0)}
              icon={<Zap size={16} />}
              href="/dashboard/deals"
            />
            <StatCard
              label="Pipeline Value"
              value={pipelineTotal > 0 ? `£${(pipelineTotal / 1000).toFixed(1)}k` : '£0'}
              change={pipelineDeals > 0 ? `${pipelineDeals} deals in play` : undefined}
              icon={<TrendingUp size={16} />}
              href="/dashboard/pipeline"
            />
            <StatCard
              label="Quotes This Month"
              value={String(data?.quotesThisMonth?.count ?? 0)}
              change={data?.quotesThisMonth?.totalValue ? `£${Number(data.quotesThisMonth.totalValue).toFixed(0)} total` : undefined}
              icon={<FileText size={16} />}
              href="/dashboard/quotes/list"
            />
          </div>

          {/* Pipeline stage breakdown */}
          {(data?.pipelineValue?.length ?? 0) > 0 && (
            <div
              className="rounded-2xl overflow-hidden mb-8"
              style={{ background: '#ffffff', boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)' }}
            >
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Pipeline by Stage</h3>
                <Link href="/dashboard/pipeline" className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--brand-blue)', textDecoration: 'none' }}>
                  Full pipeline <ChevronRight size={12} />
                </Link>
              </div>
              {data?.pipelineValue?.map((stage, i) => {
                const colour = STAGE_COLOURS[stage.stage] ?? 'var(--brand-blue)';
                const barPct = pipelineTotal > 0 ? (stage.value / pipelineTotal) * 100 : 0;
                return (
                  <div
                    key={stage.stage}
                    className="px-5 py-3.5"
                    style={{ borderBottom: i < (data?.pipelineValue?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: colour }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{stage.stage}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `color-mix(in srgb, ${colour} 12%, transparent)`, color: colour }}>
                          {stage.count}
                        </span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        £{stage.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: colour, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'All Leads', href: '/dashboard/leads', icon: <UserPlus size={16} /> },
              { label: 'Open Deals', href: '/dashboard/deals', icon: <Zap size={16} /> },
              { label: 'Pipeline', href: '/dashboard/pipeline', icon: <TrendingUp size={16} /> },
              { label: 'Quotes', href: '/dashboard/quotes/list', icon: <FileText size={16} /> },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="sig-stat sig-stat-link flex items-center justify-between p-4 rounded-xl"
                style={{ background: '#ffffff', boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)', textDecoration: 'none', color: 'var(--text-primary)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-blue-subtle)', color: 'var(--brand-blue)' }}>
                    {link.icon}
                  </div>
                  <span className="text-sm font-medium">{link.label}</span>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
