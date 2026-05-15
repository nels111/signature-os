'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Activity {
  id: string;
  activityType: string;
  description: string;
  metadata: Record<string, unknown> | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  user: { id: string; name: string | null } | null;
}

interface ActivityTimelineProps {
  entityType: 'lead' | 'deal' | 'contact' | 'account' | 'quote';
  entityId: string;
}

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  note: { label: 'Note', color: '#6b7280', icon: '✎' },
  call: { label: 'Call', color: '#0ea5e9', icon: '☎' },
  email: { label: 'Email', color: '#2056A4', icon: '✉' },
  meeting: { label: 'Meeting', color: '#8b5cf6', icon: '◫' },
  status_change: { label: 'Status', color: '#f59e0b', icon: '↻' },
  task_completed: { label: 'Task', color: '#6B8E23', icon: '✓' },
  lead_created: { label: 'Lead', color: '#6B8E23', icon: '+' },
  deal_created: { label: 'Deal', color: '#6B8E23', icon: '+' },
  quote_sent: { label: 'Quote', color: '#2056A4', icon: '→' },
  cadence_started: { label: 'Cadence', color: '#0ea5e9', icon: '∾' },
};

function metaFor(type: string) {
  return TYPE_META[type] || { label: type, color: '#6b7280', icon: '•' };
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (Number.isNaN(diffSec)) return '';
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function absoluteTime(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate().toString().padStart(2, '0');
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
}

const PAGE_SIZE = 20;
const MAX_NOTE = 5000;

export function ActivityTimeline({ entityType, entityId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mountRef = useRef(true);
  useEffect(() => {
    mountRef.current = true;
    return () => {
      mountRef.current = false;
    };
  }, []);

  const fetchPage = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          entityType,
          entityId,
          page: targetPage.toString(),
          limit: PAGE_SIZE.toString(),
        });
        const res = await fetch(`/api/activities?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load activities (${res.status})`);
        }
        const json = await res.json();
        if (!mountRef.current) return;
        const next: Activity[] = json.activities || [];
        setTotal(json.total || 0);
        setActivities((prev) => (append ? [...prev, ...next] : next));
        setPage(targetPage);
      } catch (e: unknown) {
        if (!mountRef.current) return;
        setError(e instanceof Error ? e.message : 'Failed to load activities');
      } finally {
        if (!mountRef.current) return;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [entityType, entityId],
  );

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  const handleAddNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed) {
      setSubmitError('Note cannot be empty');
      return;
    }
    if (trimmed.length > MAX_NOTE) {
      setSubmitError(`Note must be under ${MAX_NOTE} characters`);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType: 'note',
          description: trimmed,
          entityType,
          entityId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to save note (${res.status})`);
      }
      if (!mountRef.current) return;
      setNoteText('');
      await fetchPage(1, false);
    } catch (e: unknown) {
      if (!mountRef.current) return;
      setSubmitError(e instanceof Error ? e.message : 'Failed to save note');
    } finally {
      if (!mountRef.current) return;
      setSubmitting(false);
    }
  };

  const hasMore = activities.length < total;
  const remaining = MAX_NOTE - noteText.length;

  return (
    <div className="space-y-4">
      {/* Add note */}
      <div
        className="p-4 rounded-lg"
        style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <label
          className="block text-xs font-semibold uppercase mb-2"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
        >
          Add Note
        </label>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Log a call, meeting outcome, or any context..."
          rows={3}
          maxLength={MAX_NOTE}
          className="w-full px-3 py-2 text-sm border rounded-lg focus-brand resize-y"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-primary)',
          }}
        />
        <div className="flex items-center justify-between mt-2">
          <span
            className="text-xs"
            style={{ color: remaining < 100 ? 'var(--status-danger)' : 'var(--text-muted)' }}
          >
            {remaining < 500 ? `${remaining} chars left` : ''}
          </span>
          <div className="flex items-center gap-3">
            {submitError && (
              <span className="text-xs" style={{ color: 'var(--status-danger)' }}>
                {submitError}
              </span>
            )}
            <button
              onClick={handleAddNote}
              disabled={submitting || !noteText.trim()}
              className="px-4 py-1.5 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--brand-blue)' }}
            >
              {submitting ? 'Saving...' : 'Add Note'}
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading activity...
        </div>
      ) : error ? (
        <div
          className="p-4 rounded-lg text-sm"
          style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
        >
          {error}
          <button
            onClick={() => fetchPage(1, false)}
            className="ml-3 underline"
          >
            Retry
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div
          className="py-12 text-center text-sm rounded-lg"
          style={{
            color: 'var(--text-muted)',
            border: '1px dashed var(--border)',
          }}
        >
          No activity yet. Add a note above or trigger an event (stage change, quote sent, etc.) to start the timeline.
        </div>
      ) : (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div
            className="absolute left-2 top-2 bottom-2 w-px"
            style={{ background: 'var(--border)' }}
          />
          <ul className="space-y-4">
            {activities.map((a) => {
              const meta = metaFor(a.activityType);
              return (
                <li key={a.id} className="relative">
                  {/* Dot */}
                  <span
                    className="absolute -left-[18px] top-1 flex items-center justify-center rounded-full text-white text-[10px] font-bold"
                    style={{
                      width: '20px',
                      height: '20px',
                      background: meta.color,
                    }}
                    aria-hidden
                  >
                    {meta.icon}
                  </span>
                  <div
                    className="rounded-lg p-3"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
                            style={{
                              background: `${meta.color}15`,
                              color: meta.color,
                              letterSpacing: '0.04em',
                            }}
                          >
                            {meta.label}
                          </span>
                          {a.user?.name && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              by {a.user.name}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-sm whitespace-pre-wrap break-words"
                          style={{ color: 'var(--text-primary)', lineHeight: '1.45' }}
                        >
                          {a.description}
                        </p>
                      </div>
                      <span
                        className="text-xs whitespace-nowrap flex-shrink-0"
                        style={{ color: 'var(--text-muted)' }}
                        title={absoluteTime(a.createdAt)}
                      >
                        {relativeTime(a.createdAt)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={() => fetchPage(page + 1, true)}
                disabled={loadingMore}
                className="px-4 py-1.5 text-sm rounded-lg border hover:bg-opacity-50 disabled:opacity-40"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                }}
              >
                {loadingMore ? 'Loading...' : `Load more (${total - activities.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
