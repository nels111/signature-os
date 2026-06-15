'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useUserPrefs } from '@/lib/useUserPrefs';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface OrgSettings {
  defaultLabourRatePerHour: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

const card = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', padding: 24, boxShadow: 'var(--shadow-card)',
  marginBottom: 16,
} as const;
const h2 = { margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' } as const;
const sub = { margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' } as const;
const label = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 } as const;

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const { prefs, update, loaded } = useUserPrefs();
  const push = usePushNotifications();

  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [labourRateInput, setLabourRateInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    if (status === 'loading' || !isAdmin) return;
    fetch('/api/settings').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.settings) {
        setSettings(data.settings);
        setLabourRateInput(String(data.settings.defaultLabourRatePerHour));
      }
    }).catch(() => {});
  }, [status, isAdmin]);

  async function saveLabour() {
    setSaving(true);
    setError('');
    const rate = Number(labourRateInput);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 200) {
      setError('Labour rate must be between £0.01 and £200');
      setSaving(false);
      return;
    }
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultLabourRatePerHour: rate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Save failed');
      } else {
        const data = await res.json();
        setSettings(data.settings);
        setLabourRateInput(String(data.settings.defaultLabourRatePerHour));
        setSavedAt(new Date().toISOString());
      }
    } catch {
      setError('Network error — try again');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading' || !loaded) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ height: 24, width: 180, background: 'var(--border)', borderRadius: 4, marginBottom: 12 }} />
        <div style={{ height: 100, background: 'var(--border)', borderRadius: 'var(--radius-md)' }} />
      </div>
    );
  }

  const dirty = settings && labourRateInput !== String(settings.defaultLabourRatePerHour);
  const u = session?.user;

  const segBtn = (active: boolean) => ({
    flex: 1, padding: '10px 12px', fontSize: 14, fontWeight: 600,
    border: 'none', cursor: 'pointer',
    background: active ? 'var(--brand-blue)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
  } as const);

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Settings</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Your personal preferences{isAdmin ? ' and organisation defaults' : ''}.
        </p>
      </div>

      {/* Profile */}
      <section style={card}>
        <h2 style={h2}>Profile</h2>
        <p style={sub}>Your account details.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: 'var(--brand-blue)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, flexShrink: 0,
          }}>
            {(u?.name?.charAt(0) ?? 'U').toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{u?.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u?.email}</div>
            <span style={{
              display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 999,
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
              background: 'var(--brand-blue-subtle)', color: 'var(--brand-blue)',
            }}>{u?.role as string}</span>
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section style={card}>
        <h2 style={h2}>Preferences</h2>
        <p style={sub}>Personal to you, saved on this device.</p>

        <label style={label}>Calendar opens on</label>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxWidth: 280, marginBottom: 20 }}>
          <button style={segBtn(prefs.defaultCalendarView === 'day')} onClick={() => update({ defaultCalendarView: 'day' })}>Day</button>
          <button style={segBtn(prefs.defaultCalendarView === 'month')} onClick={() => update({ defaultCalendarView: 'month' })}>Month</button>
        </div>

        <label style={label}>Dashboard opens on</label>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxWidth: 420 }}>
          {(['overview', 'sales', 'operations'] as const).map((t) => (
            <button key={t} style={segBtn(prefs.defaultDashboardTab === t)} onClick={() => update({ defaultDashboardTab: t })}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section style={card}>
        <h2 style={h2}>Notifications</h2>
        <p style={sub}>Push alerts to this device for tasks, shifts and updates.</p>
        {push.state === 'unsupported' ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Push isn’t supported on this browser.</p>
        ) : push.state === 'denied' ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Notifications are blocked in your browser settings.</p>
        ) : (
          <button
            onClick={push.state === 'granted' ? push.disable : push.enable}
            disabled={push.state === 'loading'}
            style={{
              padding: '10px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              background: push.state === 'granted' ? 'var(--brand-blue-subtle)' : 'var(--surface)',
              color: push.state === 'granted' ? 'var(--brand-blue)' : 'var(--text-primary)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {push.state === 'granted' ? 'Push notifications on — turn off' : 'Enable push notifications'}
          </button>
        )}
      </section>

      {/* Organisation (admin only) */}
      {isAdmin && (
        <section style={card}>
          <h2 style={h2}>Labour rate (organisation default)</h2>
          <p style={sub}>
            Used for the quote builder, new site defaults, margin calculations and the financials view.
            Sites with a confirmed per-site rate keep their own value.
          </p>
          <label style={label}>£ per hour</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '0 0 180px' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>£</span>
              <input
                type="number" min={0.01} max={200} step={0.25}
                value={labourRateInput} onChange={e => setLabourRateInput(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px 10px 24px', borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--border)', fontSize: 16, fontWeight: 700,
                  background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums',
                }}
              />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/hr</span>
            <button
              onClick={saveLabour} disabled={saving || !dirty}
              style={{
                padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: (saving || !dirty) ? 'var(--text-muted)' : 'var(--brand-blue)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: (saving || !dirty) ? 'default' : 'pointer', opacity: (saving || !dirty) ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : dirty ? 'Save change' : 'Saved'}
            </button>
          </div>
          {error && <p style={{ marginTop: 12, color: 'var(--status-danger)', fontSize: 13 }}>{error}</p>}
          {savedAt && !dirty && !error && (
            <p style={{ marginTop: 12, color: 'var(--status-success)', fontSize: 13 }}>
              ✓ Saved {new Date(savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {settings?.updatedAt && (
            <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
              Last changed {new Date(settings.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {settings.updatedBy ? ` by ${settings.updatedBy}` : ''}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
