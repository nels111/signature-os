'use client';

import { usePathname } from 'next/navigation';
import { AdminLayout } from '@/components/layout/AdminLayout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <AdminLayout currentPath={pathname}>{children}</AdminLayout>;
}
