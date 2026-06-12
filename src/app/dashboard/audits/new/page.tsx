export const runtime = 'nodejs';
export const metadata = { title: 'New Audit — Signature Cleans OS' };

import { Suspense } from 'react';
import { requireRole } from '@/lib/role-gate';
import { prisma } from '@/lib/db';
import { NewAuditPage } from '../../clients/[id]/audit/new/NewAuditPage';

// Standalone audit-start: works from a siteId alone — no client account required.
export default async function NewAuditStandalone({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  await requireRole(['admin', 'operations']);
  const { siteId } = await searchParams;

  let siteName = '';
  if (siteId) {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } });
    siteName = site?.name ?? '';
  }

  return (
    <Suspense>
      <NewAuditPage siteName={siteName} />
    </Suspense>
  );
}
