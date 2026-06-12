export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/role-gate';

// Overview feed for the standalone Audits module landing page.
// Returns every active site with its client + latest PUBLISHED audit,
// plus a recent-activity list of the latest audits across all sites.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireRole(['admin', 'operations']);

  const [sites, recent] = await Promise.all([
    prisma.site.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        cellTier: true,
        clientAccountId: true,
        clientAccount: { select: { id: true, contactName: true } },
        // Latest published audit only — that is the "official" score for the band.
        audits: {
          where: { status: 'published' },
          orderBy: { auditedAt: 'desc' },
          take: 1,
          select: { id: true, overallScore: true, status: true, auditedAt: true, publishedAt: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.audit.findMany({
      orderBy: { auditedAt: 'desc' },
      take: 15,
      select: {
        id: true,
        overallScore: true,
        status: true,
        auditedAt: true,
        formType: true,
        site: { select: { id: true, name: true, clientAccountId: true } },
        auditedBy: { select: { name: true } },
      },
    }),
  ]);

  const siteRows = sites.map((s) => {
    const latest = s.audits[0] ?? null;
    return {
      id: s.id,
      name: s.name,
      cellTier: s.cellTier,
      clientAccountId: s.clientAccountId,
      clientName: s.clientAccount?.contactName ?? null,
      latestAudit: latest
        ? {
            id: latest.id,
            overallScore: latest.overallScore,
            status: latest.status,
            auditedAt: latest.auditedAt,
          }
        : null,
    };
  });

  const recentRows = recent.map((a) => ({
    id: a.id,
    overallScore: a.overallScore,
    status: a.status,
    auditedAt: a.auditedAt,
    formType: a.formType,
    siteId: a.site.id,
    siteName: a.site.name,
    clientAccountId: a.site.clientAccountId,
    auditorName: a.auditedBy?.name ?? null,
  }));

  return Response.json({ sites: siteRows, recent: recentRows });
}
