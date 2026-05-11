'use client';

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

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useLayout();

  return (
    <div className="flex h-screen" style={{ background: 'var(--background)' }}>
      {/* Desktop sidebar - always visible */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar - slide-out drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar mobile />
      </div>

      <MobileOverlay />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--background)' }}>
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <LayoutProvider>
      <LayoutInner>{children}</LayoutInner>
    </LayoutProvider>
  );
}
