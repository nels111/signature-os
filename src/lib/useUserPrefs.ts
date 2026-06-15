'use client';

import { useState, useEffect, useCallback } from 'react';

// Personal, per-device preferences. Stored in localStorage so they need no
// backend/migration. If we later want cross-device prefs, swap the storage
// layer here without touching consumers.
export interface UserPrefs {
  defaultCalendarView: 'day' | 'month';
  defaultDashboardTab: 'overview' | 'sales' | 'operations';
}

export const DEFAULT_PREFS: UserPrefs = {
  defaultCalendarView: 'day',
  defaultDashboardTab: 'overview',
};

const KEY = 'sigos:prefs';

export function readPrefs(): UserPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useUserPrefs() {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrefs(readPrefs());
    setLoaded(true);
  }, []);

  const update = useCallback((patch: Partial<UserPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch { /* storage full / disabled — keep in-memory */ }
      return next;
    });
  }, []);

  return { prefs, update, loaded };
}
