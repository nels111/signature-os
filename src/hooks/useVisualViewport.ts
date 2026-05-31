'use client';

import { useEffect } from 'react';

/**
 * Sets --vvh on :root to window.visualViewport.height (or window.innerHeight
 * as fallback). Use height: calc(var(--vvh) * 1px) instead of 100dvh so the
 * app shell always fits the actual visible area — not a stale browser-reported
 * value that ignores the soft keyboard or URL bar state.
 *
 * Runs once on mount and on every visualViewport resize + scroll event.
 * The scroll event matters because on iOS the viewport offset shifts when the
 * URL bar collapses without firing a resize.
 */
export function useVisualViewport() {
  useEffect(() => {
    function update() {
      const h = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      document.documentElement.style.setProperty('--vvh', String(h));
    }

    update();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    } else {
      window.addEventListener('resize', update);
    }

    return () => {
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      } else {
        window.removeEventListener('resize', update);
      }
    };
  }, []);
}
