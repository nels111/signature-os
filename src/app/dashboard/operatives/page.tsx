export const runtime = 'nodejs';

export const metadata = { title: 'Operatives' };

import { OperativesList } from './OperativesList';
import { requireRole } from '@/lib/role-gate';

export default async function OperativesPage() {
  await requireRole(['admin', 'operations']);
  return <OperativesList />;
}
