export const runtime = 'nodejs';

export const metadata = { title: 'Deals' };

import { DealsPage } from './DealsPage';
import { requireRole } from '@/lib/role-gate';

export default async function DealsListPage() {
  await requireRole(['admin', 'sales']);
  return <DealsPage />;
}
