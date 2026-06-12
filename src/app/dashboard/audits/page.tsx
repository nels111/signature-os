export const runtime = 'nodejs';
export const metadata = { title: 'Audits — Signature Cleans OS' };

import { requireRole } from '@/lib/role-gate';
import { AuditsPage } from './AuditsPage';

export default async function AuditsListPage() {
  await requireRole(['admin', 'operations']);
  return <AuditsPage />;
}
