export const runtime = 'nodejs';

export const metadata = { title: 'Leads' };

import { LeadsPage } from './LeadsPage';
import { requireRole } from '@/lib/role-gate';

export default async function LeadsListPage() {
  await requireRole(['admin', 'sales', 'va']);
  return <LeadsPage />;
}
