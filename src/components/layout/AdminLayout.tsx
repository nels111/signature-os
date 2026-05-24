'use client';

import { useRef } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { LayoutProvider, useLayout } from './LayoutContext';

function MobileOverlay() {
  const { sidebarOpen, closeSidebar } = useLayout();
  if (!sidebarOpen) return null;
  return (
    <div
      className="fixed inset-0 z-40 lg:hidden"
      style={{ background: 'color-mix(in srgb, var(--text-primary) 45%, transparent)' }}
      onClick={closeSidebar}
    />
  );
}

// Routes that need full-bleed layout (no padding, overflow hidden, fills height)
// Add any page that manages its own internal scroll container here —
// mixing main's overflow-y-auto with an inner overflow-y-auto causes nested
// scroll hell on iOS
const FULL_BLEED_PATHS = [
  '/dashboard/emails',
  '/dashboard/hub',
  '/dashboard/cold-calling',
];

function LayoutInner({ children, currentPath }: { children: React.ReactNode; currentPath?: string }) {
  const isFullBleed = FULL_BLEED_PATHS.some((p) => currentPath?.startsWith(p));
  const { sidebarOpen, closeSidebar } = useLayout();
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -50) closeSidebar(); // swipe left > 50px = close
    touchStartX.current = null;
  };

  return (
    <div className="app-shell flex" style={{ background: 'var(--background)' }}>

      {/* Desktop sidebar — always visible on lg+ */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile "More" drawer — slides in from left, triggered by BottomNav */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ transition: 'transform 280ms cubic-bezier(0.23,1,0.32,1)', willChange: 'transform' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Sidebar mobile />
      </div>

      <MobileOverlay />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden min-w-0">
        <TopBar />
        {isFullBleed ? (
          <main
            className="flex-1 min-h-0 overflow-hidden flex flex-col"
            style={{ background: 'var(--background)' }}
          >
            <div className="flex-1 min-h-0 overflow-hidden">
              {children}
            </div>
            {/* Spacer so content clears the bottom nav on mobile */}
            <div className="lg:hidden" style={{ height: 'calc(58px + env(safe-area-inset-bottom))', flexShrink: 0 }} />
          </main>
        ) : (
          <main
            className="flex-1 min-h-0 overflow-y-auto"
            style={{ background: 'var(--background)', willChange: 'scroll-position' }}
          >
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
              {children}
            </div>
            {/* Spacer so scrollable content clears the bottom nav on mobile */}
            <div className="lg:hidden" style={{ height: 'calc(58px + env(safe-area-inset-bottom))' }} />
          </main>
        )}
      </div>

      {/* Bottom tab bar — mobile only, replaces hamburger nav */}
      <BottomNav />
    </div>
  );
}

export function AdminLayout({ children, currentPath }: { children: React.ReactNode; currentPath?: string }) {
  return (
    <LayoutProvider>
      <LayoutInner currentPath={currentPath}>{children}</LayoutInner>
    </LayoutProvider>
  );
}
