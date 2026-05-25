'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Phone,
  Mail,
  CheckSquare,
  AlertCircle,
  ArrowRight,
  PhoneCall,
  UserPlus,
  Clock,
} from 'lucide-react';
import { ClockWidget } from '@/components/dashboard/ClockWidget';

interface VaDashboardData {
  queueCount: number;
  callsToday: number;
  emailsToday: number;
  openTasks: number;
  overdueTasks: number;
  myLeads: number;
  recentCalls: { id: string; description: string; createdAt: string; companyName: string; metadata: Record<string, string> | null }[];
}

const OUTCOME_COLORS: Record<string, string> = {
  answered: '#22c55e',
  no_answer: '#6b7280',
  voicemail: '#8b5cf6',
  callback_needed: '#f59e0b',
  not_interested: '#ef4444',
  gatekeeper: '#3b82f6',
};

export function VaDashboard({ userName }: { userName: string }) {
  const [data, setData] = useState<VaDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/va')
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const firstName = userName ? userName.split(' ')[0] : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}{firstName ? `, ${firstName}` : ','}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link
          href="/dashboard/cold-calling"
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'var(--brand-blue)' }}
        >
          <Phone size={16} />
          Start Calling
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Clock in/out */}
      <div className="mb-6">
        <ClockWidget />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 mb-6">
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--brand-blue)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Link href="/dashboard/cold-calling" className="block">
              <div
                className="rounded-2xl p-5 transition-all duration-200 cursor-pointer"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-hover)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Call Queue</p>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-blue-subtle)', color: 'var(--brand-blue)' }}>
                    <Phone size={16} />
                  </div>
                </div>
                <p className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{data?.queueCount ?? 0}</p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>leads to call</p>
              </div>
            </Link>

            <div className="rounded-2xl p-5 transition-all duration-200" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Calls Today</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#22c55e18', color: '#22c55e' }}>
                  <PhoneCall size={16} />
                </div>
              </div>
              <p className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{data?.callsToday ?? 0}</p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>logged</p>
            </div>

            <div className="rounded-2xl p-5 transition-all duration-200" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Emails Sent</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#8b5cf618', color: '#8b5cf6' }}>
                  <Mail size={16} />
                </div>
              </div>
              <p className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{data?.emailsToday ?? 0}</p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>follow-ups today</p>
            </div>

            <Link href="/dashboard/tasks" className="block">
              <div
                className="rounded-2xl p-5 transition-all duration-200 cursor-pointer"
                style={{
                  background: (data?.overdueTasks ?? 0) > 0 ? 'rgba(220,38,38,0.03)' : 'var(--surface)',
                  border: (data?.overdueTasks ?? 0) > 0 ? '1px solid rgba(220,38,38,0.15)' : '1px solid var(--border)',
                  boxShadow: 'var(--shadow-card)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-hover)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Open Tasks</p>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: (data?.overdueTasks ?? 0) > 0 ? '#ef444418' : '#f59e0b18', color: (data?.overdueTasks ?? 0) > 0 ? '#ef4444' : '#f59e0b' }}>
                    {(data?.overdueTasks ?? 0) > 0 ? <AlertCircle size={16} /> : <CheckSquare size={16} />}
                  </div>
                </div>
                <p className="text-[28px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{data?.openTasks ?? 0}</p>
                <p className="text-xs mt-2" style={{ color: (data?.overdueTasks ?? 0) > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                  {(data?.overdueTasks ?? 0) > 0 ? `${data?.overdueTasks} overdue` : 'all on track'}
                </p>
              </div>
            </Link>
          </div>

          {/* Recent calls */}
          {(data?.recentCalls?.length ?? 0) > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Clock size={16} style={{ color: 'var(--brand-blue)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Your recent calls</h3>
                </div>
                <Link href="/dashboard/cold-calling" className="text-xs font-medium" style={{ color: 'var(--brand-blue)' }}>
                  View all
                </Link>
              </div>
              {data?.recentCalls?.map((call, i) => {
                const meta = call.metadata as Record<string, string> | null;
                const outcome = meta?.callOutcome || '';
                const color = OUTCOME_COLORS[outcome] || 'var(--text-muted)';
                return (
                  <div
                    key={call.id}
                    className="px-5 py-3.5 flex items-center gap-3"
                    style={{ borderBottom: i < (data?.recentCalls?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{call.companyName}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{call.description}</p>
                    </div>
                    <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {new Date(call.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {(data?.queueCount ?? 0) === 0 && (data?.recentCalls?.length ?? 0) === 0 && (
            <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--brand-blue-subtle)', color: 'var(--brand-blue)' }}>
                <Phone size={24} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Queue is empty</p>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Import leads to get started with cold calling.</p>
              <Link href="/dashboard/leads" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--brand-blue)' }}>
                <UserPlus size={14} />
                Import Leads
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
