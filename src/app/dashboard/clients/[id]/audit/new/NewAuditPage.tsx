'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Send } from 'lucide-react';

const CATEGORIES = [
  {
    key: 'scorePresentation',
    noteKey: 'notePresentation',
    label: 'Presentation & appearance',
    description: 'Uniform, ID, professional conduct visible to client',
  },
  {
    key: 'scoreCleanliness',
    noteKey: 'noteCleanliness',
    label: 'Cleanliness standards',
    description: 'Surfaces, floors, windows, sanitary areas to spec',
  },
  {
    key: 'scoreCompliance',
    noteKey: 'noteCompliance',
    label: 'Health, safety & COSHH',
    description: 'COSHH compliance, PPE, hazard labelling, secure chemicals',
  },
  {
    key: 'scoreEquipment',
    noteKey: 'noteEquipment',
    label: 'Equipment & materials',
    description: 'Condition of equipment, product stock, correct materials used',
  },
  {
    key: 'scoreTeamConduct',
    noteKey: 'noteTeamConduct',
    label: 'Operative conduct',
    description: 'Attitude, communication, punctuality, client interaction',
  },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];
type NoteKey = typeof CATEGORIES[number]['noteKey'];

function scoreBand(score: number): { label: string; color: string; bg: string } {
  if (score >= 8) return { label: 'Excellent', color: 'var(--status-success)', bg: 'var(--status-success-bg)' };
  if (score >= 6) return { label: 'Good', color: 'var(--brand-gold)', bg: 'var(--brand-gold-subtle)' };
  if (score >= 4) return { label: 'Needs improvement', color: 'var(--status-warning)', bg: 'var(--status-warning-bg)' };
  return { label: 'Critical', color: 'var(--status-danger)', bg: 'var(--status-danger-bg)' };
}

function overallBand(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'Healthy', color: 'var(--status-success)', bg: 'var(--status-success-bg)' };
  if (score >= 70) return { label: 'Action plan required', color: 'var(--status-warning)', bg: 'var(--status-warning-bg)' };
  return { label: 'Immediate intervention', color: 'var(--status-danger)', bg: 'var(--status-danger-bg)' };
}

export function NewAuditPage({ clientId }: { clientId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteId = searchParams.get('siteId') || '';

  const [scores, setScores] = useState<Record<CategoryKey, number>>({
    scorePresentation: 7,
    scoreCleanliness: 7,
    scoreCompliance: 7,
    scoreEquipment: 7,
    scoreTeamConduct: 7,
  });
  const [notes, setNotes] = useState<Record<NoteKey, string>>({
    notePresentation: '',
    noteCleanliness: '',
    noteCompliance: '',
    noteEquipment: '',
    noteTeamConduct: '',
  });
  const [headlineNotes, setHeadlineNotes] = useState('');
  const [auditedAt, setAuditedAt] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const overall = Math.round(
    (Object.values(scores).reduce((s, v) => s + v, 0) / 5) * 10
  );
  const band = overallBand(overall);

  const handleSave = async (publish = false) => {
    setSaving(true);
    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          auditedAt: new Date(auditedAt).toISOString(),
          ...scores,
          ...notes,
          headlineNotes,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const audit = await res.json();

      if (publish) {
        await fetch(`/api/audits/${audit.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'published' }),
        });
      }

      router.push(`/dashboard/clients/${clientId}?tab=audits`);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="px-6 py-4">
          <button
            onClick={() => router.push(`/dashboard/clients/${clientId}?tab=audits`)}
            className="flex items-center gap-1.5 mb-4"
            style={{ color: 'var(--text-muted)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <ArrowLeft size={14} />
            Back to client
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                New audit
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="date"
                  value={auditedAt}
                  onChange={(e) => setAuditedAt(e.target.value)}
                  className="px-2 py-1 rounded-lg text-sm"
                  style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', outline: 'none' }}
                />
                {/* Live overall score */}
                <span
                  className="px-3 py-1 rounded-lg text-sm font-bold"
                  style={{ background: band.bg, color: band.color }}
                >
                  {overall}/100 — {band.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                <Save size={14} />
                Save draft
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--status-success)', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                <Send size={14} />
                Publish to portal
              </button>
            </div>
          </div>
          {saveStatus === 'error' && (
            <p style={{ fontSize: '13px', color: 'var(--status-danger)', marginTop: '8px' }}>Failed to save — please try again.</p>
          )}
        </div>
      </div>

      {/* Audit form */}
      <div className="px-6 py-6 max-w-3xl">
        <div className="space-y-4">
          {CATEGORIES.map(({ key, noteKey, label, description }) => {
            const score = scores[key];
            const band = scoreBand(score);
            return (
              <div
                key={key}
                className="rounded-xl p-5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</p>
                  </div>
                  <span
                    className="px-3 py-1 rounded-lg text-sm font-bold flex-shrink-0 ml-4"
                    style={{ background: band.bg, color: band.color }}
                  >
                    {score}/10
                  </span>
                </div>

                {/* Score slider */}
                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                      <button
                        key={v}
                        onClick={() => setScores((s) => ({ ...s, [key]: v }))}
                        className="w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-100"
                        style={{
                          background: score === v
                            ? scoreBand(v).color
                            : v <= score
                              ? `${scoreBand(v).color}22`
                              : 'var(--surface-hover)',
                          color: score === v ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid',
                          borderColor: score === v ? scoreBand(v).color : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>Critical</span>
                    <span>Excellent</span>
                  </div>
                </div>

                {/* Optional notes */}
                <textarea
                  value={notes[noteKey]}
                  onChange={(e) => setNotes((n) => ({ ...n, [noteKey]: e.target.value }))}
                  placeholder={`Notes for ${label.toLowerCase()} (optional)`}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-blue)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
              </div>
            );
          })}

          {/* Headline notes */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Headline notes
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Summary shown to the client in their portal. Keep it clear and constructive.
            </p>
            <textarea
              value={headlineNotes}
              onChange={(e) => setHeadlineNotes(e.target.value)}
              placeholder="e.g. Excellent visit overall. Kitchen deep clean exceeded expectations. Minor note on equipment storage — actioned on the day."
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--text-primary)',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-blue)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>

          {/* Overall summary */}
          <div
            className="rounded-xl p-5"
            style={{
              background: band.bg,
              border: `1px solid ${band.color}22`,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: band.color }}>Overall score</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {overall >= 80 ? 'Healthy — no immediate action required' :
                   overall >= 70 ? 'Action plan required — schedule follow-up' :
                   'Immediate intervention — task will be auto-created'}
                </p>
              </div>
              <span style={{ fontSize: '28px', fontWeight: 800, color: band.color }}>
                {overall}/100
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
