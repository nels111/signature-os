export const runtime = 'nodejs';
export const metadata = { title: 'New Audit — Signature Cleans OS' };

import { requireRole } from '@/lib/role-gate';
import { NewAuditPage } from './NewAuditPage';

export default async function NewAudit({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin', 'operations']);
  const { id } = await params;
  return <NewAuditPage clientId={id} />;
}
