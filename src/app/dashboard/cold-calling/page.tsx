'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CallQueue } from '@/components/CallQueue';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Calendar,
  Clock,
  TrendingUp,
  Users,
  RefreshCw,
  ChevronDown,
  MessageSquare,
  Mail,
  BarChart2,
  AlertCircle,
} from 'lucide-react';

// ---------- Types ----------
interface Stats {
  callsToday: number;
  callsWeek: number;
  outcomes: Record<string, number>;
  meetingsBooked: number;
  openCallbacks: number;
}

interface FeedItem {
  id: string;
  activityType: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userId: string;
  userName: string;
  entityId: string | null;
  entityType: string | null;
  leadCompany: string | null;
  leadContact: string | null;
  leadStage: string | null;
}

// ---------- Constants ----------
const OUTCOME_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  answered:        { label: 'Answered',        color: '#22c55e', icon: PhoneCall },
  no_answer:       { label: 'No Answer',        color: '#6b7280', icon: PhoneMissed },
  voicemail:       { label: 'Voicemail',        color: '#8b5cf6', icon: Phone },
  callback_needed: { label: 'Callback Needed',  color: '#f59e0b', icon: Clock },
  not_interested:  { label: 'Not Interested',   color: '#ef4444', icon: PhoneOff },
  gatekeeper:      { label: 'Gatekeeper',       color: '#3b82f6', icon: Users },
  unknown:         { label: 'No Outcome',       color: '#6b7280', icon: Phone },
};

const STAGE_LABELS: Record<string, string> = {
  cold_call:          'Cold Call',
  cold_email:         'Cold Email',
  follow_up_sequence: 'Follow-up',
  meeting_scheduled:  'Meeting Booked',
  meeting_attended:   'Meeting Attended',
  quote_delivered:    'Quote Delivered',
};

// ---------- Helpers ----------
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getActivityIcon(type: string, color: string): React.ReactNode {
  const props = { size: 14, style: { color } };
  switch (type) {
    case 'call': return <Phone {...props} />;
    case 'email': return <Mail {...props} />;
    case 'note': return <MessageSquare {...props} />;
    case 'status_change': return <TrendingUp {...props} />;
    default: return <AlertCircle {...props} />;
  }
}

function getActivityColor(type: string): string {
  switch (type) {
    case 'call': return 'var(--brand-blue)';
    case 'email': return '#8b5cf6';
    case 'note': return '#f59e0b';
    case 'status_change': return '#22c55e';
    default: return 'var(--text-secondary)';
  }
}

function getInitial(name: string | null | undefined): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

// ---------- Sub-components ----------

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  small,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  small?: boolean;
}) {
  return (
    <div
      className="sig-stat flex flex-col gap-1 p-5 rounded-2xl"
      style={{
        background: `radial-gradient(ellipse at 15% 0%, ${color}18 0%, #ffffff 60%)`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 1px ${color}22, 0 2px 8px ${color}12, 0 14px 36px ${color}08`,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}20` }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color }}
        >
          {label}
        </span>
      </div>
      <p
        className={`font-bold ${small ? 'text-2xl' : 'text-3xl'} mt-1`}
        style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
      >
        {value}
      </p>
    </div>
  );
}

function OutcomeBar({ outcomes }: { outcomes: Record<string, number> }) {
  const total = Object.values(outcomes).reduce((a, b) => a + b, 0);
  if (total === 0) return (
    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No calls recorded this week.</p>
  );

  const entries = Object.entries(outcomes).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-2.5">
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px" style={{ background: 'var(--surface-hover)' }}>
        {entries.map(([key, count]) => {
          const cfg = OUTCOME_CONFIG[key] ?? OUTCOME_CONFIG.unknown;
          const pct = (count / total) * 100;
          return (
            <div
              key={key}
              style={{ width: `${pct}%`, background: cfg.color, minWidth: pct > 0 ? 2 : 0 }}
              title={`${cfg.label}: ${count}`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
        {entries.map(([key, count]) => {
          const cfg = OUTCOME_CONFIG[key] ?? OUTCOME_CONFIG.unknown;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
              <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {cfg.label}
              </span>
              <span className="text-xs font-semibold ml-auto" style={{ color: 'var(--text-primary)' }}>
                {count}
                <span className="font-normal ml-1" style={{ color: 'var(--text-secondary)' }}>({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeedItemRow({ item, onLeadClick }: { item: FeedItem; onLeadClick: (id: string) => void }) {
  const iconColor = getActivityColor(item.activityType);
  const iconNode = getActivityIcon(item.activityType, iconColor);
  const outcome = item.metadata && typeof item.metadata === 'object'
    ? (item.metadata as Record<string, unknown>).callOutcome as string | undefined
    : undefined;
  const outcomeCfg = outcome ? (OUTCOME_CONFIG[outcome] ?? OUTCOME_CONFIG.unknown) : null;

  return (
    <div
      className="flex items-start gap-3 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${iconColor}18` }}
      >
        {iconNode}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {item.leadCompany && (
            <button
              onClick={() => item.entityId && onLeadClick(item.entityId)}
              className="text-sm font-semibold hover:underline text-left"
              style={{ color: 'var(--brand-blue)' }}
            >
              {item.leadCompany}
            </button>
          )}
          {item.leadContact && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              · {item.leadContact}
            </span>
          )}
          {outcomeCfg && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: `${outcomeCfg.color}18`, color: outcomeCfg.color }}
            >
              {outcomeCfg.label}
            </span>
          )}
          {item.leadStage && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
              style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
            >
              {STAGE_LABELS[item.leadStage] ?? item.leadStage}
            </span>
          )}
        </div>
        <p className="text-sm mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
          {item.description}
        </p>
        {item.metadata && typeof item.metadata === 'object' &&
          Boolean((item.metadata as Record<string, unknown>).notes) && (
          <p className="text-xs mt-1 italic line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
            &ldquo;{String((item.metadata as Record<string, unknown>).notes)}&rdquo;
          </p>
        )}
      </div>

      {/* Right: user + time */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          style={{ background: 'var(--brand-blue)' }}
          title={item.userName}
        >
          {getInitial(item.userName)}
        </div>
        <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
          {timeAgo(item.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ---------- Main Page ----------

export default function ColdCallingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isVa = session?.user?.role === 'va';

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------- Fetch stats ----------
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/cold-calling/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // silent
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ---------- Fetch feed (initial / refresh) ----------
  // silent=true skips the loading skeleton (used for background auto-refresh)
  const fetchFeed = useCallback(async (silent = false) => {
    if (!silent) setFeedLoading(true);
    try {
      const res = await fetch('/api/cold-calling/feed?limit=30');
      if (res.ok) {
        const data = await res.json();
        setFeed(data.items ?? []);
        setNextCursor(data.nextCursor ?? null);
        setLastRefresh(new Date());
      }
    } catch {
      // silent
    } finally {
      if (!silent) setFeedLoading(false);
    }
  }, []);

  // ---------- Load more ----------
  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/cold-calling/feed?limit=30&cursor=${encodeURIComponent(nextCursor)}`);
      if (res.ok) {
        const data = await res.json();
        setFeed((prev) => [...prev, ...(data.items ?? [])]);
        setNextCursor(data.nextCursor ?? null);
      }
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  };

  // ---------- Refresh everything ----------
  const handleRefresh = () => {
    fetchStats();
    fetchFeed();
  };

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchFeed();
  }, [fetchStats, fetchFeed]);

  // Auto-refresh every 60s — silent so no skeleton flash on background refresh
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchStats();
      fetchFeed(true);
    }, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStats, fetchFeed]);

  // Instant refresh when any call is logged (fired by CallQueue via custom event)
  useEffect(() => {
    const handler = () => {
      fetchStats();
      fetchFeed(true);
    };
    window.addEventListener('sigos:call-logged', handler);
    return () => window.removeEventListener('sigos:call-logged', handler);
  }, [fetchStats, fetchFeed]);

  const handleLeadClick = (leadId: string) => {
    router.push(`/dashboard/leads/${leadId}`);
  };

  // ---------- Render ----------
  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--brand-blue)20' }}
          >
            <Phone size={18} style={{ color: 'var(--brand-blue)' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Cold Calling
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {isVa ? 'Your call activity and callbacks' : 'Team activity and performance'}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-hover)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Stats bar */}
        <section>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Calls Today"
              value={statsLoading ? '—' : stats?.callsToday ?? 0}
              icon={Phone}
              color="#2056A4"
            />
            <StatCard
              label="Calls This Week"
              value={statsLoading ? '—' : stats?.callsWeek ?? 0}
              icon={BarChart2}
              color="#8b5cf6"
            />
            <StatCard
              label="Open Callbacks"
              value={statsLoading ? '—' : stats?.openCallbacks ?? 0}
              icon={Clock}
              color="#f59e0b"
            />
            {!isVa && (
              <StatCard
                label="Meetings Booked"
                value={statsLoading ? '—' : stats?.meetingsBooked ?? 0}
                icon={Calendar}
                color="#22c55e"
              />
            )}
            {isVa && (
              <StatCard
                label="This Week"
                value={statsLoading ? '—' : stats?.callsWeek ?? 0}
                icon={TrendingUp}
                color="#22c55e"
                small
              />
            )}
          </div>
        </section>

        {/* Outcome breakdown */}
        <section
          className="rounded-2xl p-5"
          style={{
            background: 'radial-gradient(ellipse at 100% 0%, rgba(32,86,164,0.07) 0%, #ffffff 55%)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.05), 0 14px 36px rgba(0,0,0,0.04)',
          }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Call Outcomes — This Week
          </h2>
          {statsLoading ? (
            <div className="h-8 rounded animate-pulse" style={{ background: 'var(--surface-hover)' }} />
          ) : (
            <OutcomeBar outcomes={stats?.outcomes ?? {}} />
          )}
        </section>

        {/* Call queue */}
        <section>
          <CallQueue isVa={isVa} />
        </section>

        {/* Activity feed */}
        <section
          className="rounded-2xl"
          style={{
            background: '#ffffff',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.05), 0 14px 36px rgba(0,0,0,0.04)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isVa ? 'Your Activity' : 'All Activity'}
            </h2>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Updated {timeAgo(lastRefresh.toISOString())}
            </span>
          </div>

          <div className="px-4">
            {feedLoading ? (
              <div className="space-y-4 py-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: 'var(--surface-hover)' }} />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 rounded animate-pulse w-1/3" style={{ background: 'var(--surface-hover)' }} />
                      <div className="h-3 rounded animate-pulse w-2/3" style={{ background: 'var(--surface-hover)' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : feed.length === 0 ? (
              <div className="py-12 text-center">
                <Phone size={32} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No activity yet.</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Call activity logged on lead records will appear here.
                </p>
              </div>
            ) : (
              <>
                {feed.map((item) => (
                  <FeedItemRow key={item.id} item={item} onLeadClick={handleLeadClick} />
                ))}
                {nextCursor && (
                  <div className="py-4 text-center">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: 'var(--surface-hover)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {loadingMore ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                      {loadingMore ? 'Loading...' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
