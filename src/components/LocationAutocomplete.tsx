'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

interface Prediction { description: string; placeId: string }

/**
 * Reusable location field with Google Places type-ahead (via /api/places/autocomplete,
 * which keeps the API key server-side). Used on calendar events, tasks, and anywhere a
 * location is captured so the behaviour is identical everywhere.
 */
export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Start typing an address or place…',
  inputStyle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
}) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const justPicked = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced fetch as the user types
  useEffect(() => {
    if (justPicked.current) { justPicked.current = false; return; }
    const q = value.trim();
    if (q.length < 3) { setPredictions([]); setOpen(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (cancelled) return;
        setPredictions(data.predictions || []);
        setOpen((data.predictions || []).length > 0);
      } catch {
        if (!cancelled) { setPredictions([]); setOpen(false); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (p: Prediction) => {
    justPicked.current = true;
    onChange(p.description);
    setPredictions([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { if (predictions.length) setOpen(true); }}
        className="w-full px-3 py-2 border rounded-lg text-sm"
        style={inputStyle}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && predictions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full overflow-auto rounded-lg border shadow-lg"
          style={{
            background: 'var(--surface, #fff)',
            borderColor: 'var(--border, #DADADA)',
            maxHeight: '240px',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 6px 24px rgba(0,0,0,0.12)',
          }}
        >
          {predictions.map((p, i) => (
            <li key={p.placeId || i}>
              <button
                type="button"
                onClick={() => pick(p)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm"
                style={{ color: 'var(--text-primary, #1A1A1F)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover, #F5F5F3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <MapPin size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#2056A4' }} />
                <span>{p.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && value.trim().length >= 3 && !open && (
        <span className="absolute right-3 top-2.5 text-xs" style={{ color: 'var(--text-muted, #9C9CA8)' }}>…</span>
      )}
    </div>
  );
}
