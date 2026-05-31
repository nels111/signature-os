'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface OrgSettings {
  defaultLabourRatePerHour: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [labourRateInput, setLabourRateInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    if (status === 'loading') return;
    fetch('/api/settings').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.settings) {
        setSettings(data.settings);
        setLabourRateInput(String(data.settings.defaultLabourRatePerHour));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [status]);

  async function save() {
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  if (status === 'loading' || loading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ height: 24, width: 180, background: 'var(--border)', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
        <div style={{ height: 100, background: 'var(--border)', borderRadius: 'var(--radius-md)', animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  if (!isAdmin) {
    router.replace('/dashboard');
    return null;
  }

  const dirty = settings && labourRateInput !== String(settings.defaultLabourRatePerHour);

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Settings</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Org-wide defaults. Per-site overrides take priority where set.
        </p>
      </div>

      <section style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: 24, boxShadow: 'var(--shadow-card)',
        marginBottom: 16,
      }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          Labour rate (default)
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
          Used for the quote builder, new site defaults, margin calculations, and the financials health view.
          Sites with a confirmed per-site labour rate keep their own value.
        </p>

        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
          £ per hour
        </label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '0 0 180px' }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, color: 'var(--text-muted)', fontWeight: 600,
            }}>£</span>
            <input
              type="number"
              min={0.01}
              max={200}
              step={0.25}
              value={labourRateInput}
              onChange={e => setLabourRateInput(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px 10px 24px',
                borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)',
                fontSize: 16, fontWeight: 700, background: 'var(--surface)',
                color: 'var(--text-primary)', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums',
              }}
            />
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/hr</span>
          <button
            onClick={save}
            disabled={saving || !dirty}
            style={{
              padding: '10px 20px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: (saving || !dirty) ? 'var(--text-muted)' : 'var(--brand-blue)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: (saving || !dirty) ? 'default' : 'pointer',
              opacity: (saving || !dirty) ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : dirty ? 'Save change' : 'Saved'}
          </button>
        </div>

        {error && (
          <p style={{ marginTop: 12, color: 'var(--status-danger)', fontSize: 13 }}>{error}</p>
        )}

        {savedAt && !dirty && !error && (
          <p style={{ marginTop: 12, color: 'var(--status-success)', fontSize: 13 }}>
            ✓ Saved {new Date(savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {settings?.updatedAt && (
          <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            Last changed {new Date(settings.updatedAt).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
            {settings.updatedBy ? ` by ${settings.updatedBy}` : ''}
          </p>
        )}
      </section>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Changes take effect immediately for new quotes and recalculated margins.
        Existing saved quotes keep the labour rate they were created with.
      </p>
    </div>
  );
}
