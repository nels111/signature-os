export const runtime = 'nodejs';
export const metadata = { title: 'Clients — Signature Cleans OS' };

import { requireRole } from '@/lib/role-gate';
import { ClientsPage } from './ClientsPage';

export default async function ClientsListPage() {
  await requireRole(['admin', 'sales', 'operations']);
  return <ClientsPage />;
}
