export const runtime = 'nodejs';
export const metadata = { title: 'Audit — Signature Cleans OS' };

import { requireRole } from '@/lib/role-gate';
import { AuditDetailPage } from './AuditDetailPage';

export default async function AuditDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin', 'operations']);
  const { id } = await params;
  return <AuditDetailPage auditId={id} />;
}
