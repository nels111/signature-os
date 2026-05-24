'use client';

import { useRef } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { LayoutProvider, useLayout } from './LayoutContext';

function MobileOverlay() {
  const { sidebarOpen, closeSidebar } = useLayout();
  if (!sidebarOpen) return null;
  return (
    <div
      className="fixed inset-0 z-40 lg:hidden"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={closeSidebar}
    />
  );
}

// Routes that need full-bleed layout (no padding, overflow hidden, fills height)
const FULL_BLEED_PATHS = ['/dashboard/emails', '/dashboard/hub'];

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
    <div className="flex h-screen" style={{ background: 'var(--background)' }}>
      {/* Desktop sidebar - always visible */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar - slide-out drawer with swipe-to-close */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Sidebar mobile />
      </div>

      <MobileOverlay />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar />
        {isFullBleed ? (
          <main className="flex-1 overflow-hidden" style={{ background: 'var(--background)' }}>
            {children}
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto" style={{ background: 'var(--background)' }}>
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
              {children}
            </div>
          </main>
        )}
      </div>
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
