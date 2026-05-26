export const runtime = 'nodejs';
export const metadata = { title: 'Client — Signature Cleans OS' };

import { requireRole } from '@/lib/role-gate';
import { ClientDetailPage } from './ClientDetailPage';

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin', 'sales', 'operations']);
  const { id } = await params;
  return <ClientDetailPage id={id} />;
}
