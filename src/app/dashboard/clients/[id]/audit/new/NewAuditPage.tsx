'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Send, X, Eraser, Camera } from 'lucide-react';
import {
  getCategoryDefs,
  computeAuditScore,
  type FormType,
  type SiteVariant,
} from '@/lib/audit-forms';

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

// Resize an image file to a max dimension and return a compressed JPEG data URL.
function resizeImage(file: File, maxDim = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no ctx'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--background)',
  color: 'var(--text-primary)',
  outline: 'none',
  resize: 'vertical',
  fontFamily: 'inherit',
};

export function NewAuditPage({ clientId, siteName: siteNameProp }: { clientId?: string; siteName?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteId = searchParams.get('siteId') || '';
  const backHref = clientId ? `/dashboard/clients/${clientId}?tab=audits` : '/dashboard/audits';

  const [formType, setFormType] = useState<FormType>('small');
  const [siteVariant, setSiteVariant] = useState<SiteVariant>('porsche_showroom');
  const [siteName, setSiteName] = useState(siteNameProp || '');

  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [binsEmptied, setBinsEmptied] = useState<boolean | null>(null);
  const [issuesSpotted, setIssuesSpotted] = useState('');
  const [needsReview, setNeedsReview] = useState('');
  const [headlineNotes, setHeadlineNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [auditedAt, setAuditedAt] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'error'>('idle');

  // Default the audit type from the site name (Porsche / Crave → large, else small)
  const applyVariantFromName = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('crave')) { setFormType('large'); setSiteVariant('crave'); }
    else if (lower.includes('porsche') && lower.includes('showroom')) { setFormType('large'); setSiteVariant('porsche_showroom'); }
  };
  useEffect(() => {
    // Standalone (site-based) mode: site name passed in as a prop.
    if (siteNameProp) { applyVariantFromName(siteNameProp); return; }
    // Client-account mode: look the site name up via the client.
    if (!clientId) return;
    fetch(`/api/clients/${clientId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const sites = data?.client?.sites || data?.sites || [];
        const site = sites.find((s: { id: string }) => s.id === siteId) || sites[0];
        const name: string = site?.name || '';
        setSiteName(name);
        applyVariantFromName(name);
      })
      .catch(() => {});
  }, [clientId, siteId, siteNameProp]);

  const categoryDefs = getCategoryDefs(formType, formType === 'large' ? siteVariant : null);

  const scoredCategories = categoryDefs.map((c) => ({
    key: c.key,
    label: c.label,
    score: scores[c.key] ?? 7,
    note: notes[c.key] || undefined,
  }));
  const { overallScore: overall } = computeAuditScore(scoredCategories);
  const band = overallBand(overall);

  // ── Signature pad ───────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasSig = useRef(false);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (c.width / rect.width), y: (e.clientY - rect.top) * (c.height / rect.height) };
  };
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    hasSig.current = true;
  };
  const endDraw = () => { drawing.current = false; };
  const clearSig = () => {
    const c = canvasRef.current;
    if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    hasSig.current = false;
  };

  // ── Photos ──────────────────────────────────────────────────────
  const onPhotos = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).slice(0, 8 - photos.length);
    const resized = await Promise.all(incoming.map((f) => resizeImage(f).catch(() => null)));
    setPhotos((p) => [...p, ...resized.filter((x): x is string => !!x)]);
  }, [photos.length]);

  const handleSave = async (publish = false) => {
    setSaving(true);
    try {
      const signatureData = hasSig.current ? canvasRef.current?.toDataURL('image/png') : undefined;
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          auditedAt: new Date(auditedAt).toISOString(),
          formType,
          siteVariant: formType === 'large' ? siteVariant : null,
          categories: scoredCategories,
          binsEmptied,
          issuesSpotted: issuesSpotted || null,
          needsReview: needsReview || null,
          headlineNotes: headlineNotes || null,
          photos,
          signatureData,
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
      router.push(backHref);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  };

  const segBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: '1px solid', borderColor: active ? 'var(--brand-blue)' : 'var(--border)',
    background: active ? 'var(--brand-blue)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text-secondary)',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="px-6 py-4">
          <button
            onClick={() => router.push(backHref)}
            className="flex items-center gap-1.5 mb-4"
            style={{ color: 'var(--text-muted)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <ArrowLeft size={14} />
            Back to client
          </button>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                New audit{siteName ? ` — ${siteName}` : ''}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="date"
                  value={auditedAt}
                  onChange={(e) => setAuditedAt(e.target.value)}
                  className="px-2 py-1 rounded-lg text-sm"
                  style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', outline: 'none' }}
                />
                <span className="px-3 py-1 rounded-lg text-sm font-bold" style={{ background: band.bg, color: band.color }}>
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
                <Save size={14} /> Save draft
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--status-success)', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                <Send size={14} /> Publish to portal
              </button>
            </div>
          </div>
          {saveStatus === 'error' && (
            <p style={{ fontSize: '13px', color: 'var(--status-danger)', marginTop: '8px' }}>Failed to save — please try again.</p>
          )}
        </div>
      </div>

      <div className="px-6 py-6 max-w-3xl">
        <div className="space-y-4">
          {/* Audit type */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Audit type</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={segBtn(formType === 'small')} onClick={() => setFormType('small')}>Small Site Audit</button>
              <button style={segBtn(formType === 'large')} onClick={() => setFormType('large')}>Large Site Audit</button>
            </div>
            {formType === 'large' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button style={segBtn(siteVariant === 'porsche_showroom')} onClick={() => setSiteVariant('porsche_showroom')}>Porsche showroom</button>
                <button style={segBtn(siteVariant === 'crave')} onClick={() => setSiteVariant('crave')}>Crave</button>
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              {categoryDefs.length} categories · scored out of {categoryDefs.length * 10}, normalised to 100.
            </p>
          </div>

          {/* Category sliders */}
          {categoryDefs.map(({ key, label, description }) => {
            const score = scores[key] ?? 7;
            const sb = scoreBand(score);
            return (
              <div key={key} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</h3>
                    {description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</p>}
                  </div>
                  <span className="px-3 py-1 rounded-lg text-sm font-bold flex-shrink-0 ml-4" style={{ background: sb.bg, color: sb.color }}>
                    {score}/10
                  </span>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                      <button
                        key={v}
                        onClick={() => setScores((s) => ({ ...s, [key]: v }))}
                        className="w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-100"
                        style={{
                          background: score === v ? scoreBand(v).color : v <= score ? `${scoreBand(v).color}22` : 'var(--surface-hover)',
                          color: score === v ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid', borderColor: score === v ? scoreBand(v).color : 'transparent', cursor: 'pointer',
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>Critical</span><span>Excellent</span>
                  </div>
                </div>
                <textarea
                  value={notes[key] || ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
                  placeholder={`Notes for ${label.toLowerCase()} (optional)`}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
            );
          })}

          {/* Bins emptied */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Bins emptied</h3>
            <div style={{ display: 'flex', gap: 8, maxWidth: 240 }}>
              <button style={segBtn(binsEmptied === true)} onClick={() => setBinsEmptied(true)}>Yes</button>
              <button style={segBtn(binsEmptied === false)} onClick={() => setBinsEmptied(false)}>No</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>All bins empty with fresh liners (if applicable).</p>
          </div>

          {/* Photos */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Photos</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 12 }}>Evidence of issues or the cleaning cupboard. Up to 8.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {photos.map((src, i) => (
                <div key={i} style={{ position: 'relative', width: 88, height: 88 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`photo ${i + 1}`} style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                  <button
                    onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: 'var(--status-danger)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              {photos.length < 8 && (
                <label
                  style={{ width: 88, height: 88, borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <Camera size={20} />
                  <span style={{ fontSize: 11 }}>Add</span>
                  <input type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={(e) => onPhotos(e.target.files)} />
                </label>
              )}
            </div>
          </div>

          {/* Issues spotted */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Issues spotted</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 12 }}>Name all issues spotted for review ahead of next audit.</p>
            <textarea value={issuesSpotted} onChange={(e) => setIssuesSpotted(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>

          {/* Needs review / actions */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Needs review / actions by next audit</h3>
            <textarea value={needsReview} onChange={(e) => setNeedsReview(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>

          {/* Headline notes (client portal summary) */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Headline notes</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 12 }}>Summary shown to the client in their portal. Keep it clear and constructive.</p>
            <textarea value={headlineNotes} onChange={(e) => setHeadlineNotes(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>

          {/* Signature */}
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Auditor signature</h3>
              <button onClick={clearSig} className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Eraser size={13} /> Clear
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={600}
              height={160}
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
              style={{ width: '100%', height: 160, background: '#fff', borderRadius: 8, border: '1px solid var(--border)', touchAction: 'none' }}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Sign with finger or mouse.</p>
          </div>

          {/* Overall summary */}
          <div className="rounded-xl p-5" style={{ background: band.bg, border: `1px solid ${band.color}22` }}>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: band.color }}>Overall score</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {overall >= 80 ? 'Healthy — no immediate action required' :
                   overall >= 70 ? 'Action plan required — schedule follow-up' :
                   'Immediate intervention — task will be auto-created'}
                </p>
              </div>
              <span style={{ fontSize: '28px', fontWeight: 800, color: band.color }}>{overall}/100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
