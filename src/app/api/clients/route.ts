export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/role-gate';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireRole(['admin', 'sales', 'operations']);

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));

  const where = {
    ...(status ? { portalStatus: status as never } : {}),
    ...(search
      ? {
          OR: [
            { contactName: { contains: search, mode: 'insensitive' as const } },
            { contactEmail: { contains: search, mode: 'insensitive' as const } },
            { sites: { some: { name: { contains: search, mode: 'insensitive' as const } } } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.clientAccount.findMany({
      where,
      include: {
        sites: { select: { id: true, name: true, cellTier: true, active: true } },
        tickets: {
          where: { status: { in: ['open', 'in_progress'] } },
          select: { id: true, severity: true },
        },
        serviceRequests: {
          where: { status: { in: ['pending', 'reviewing'] } },
          select: { id: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.clientAccount.count({ where }),
  ]);

  // Attach latest audit score per client
  const siteIds = data.flatMap((c) => c.sites.map((s) => s.id));
  const latestAudits = siteIds.length
    ? await prisma.audit.findMany({
        where: { siteId: { in: siteIds }, status: 'published' },
        orderBy: { auditedAt: 'desc' },
        distinct: ['siteId'],
        select: { siteId: true, overallScore: true, auditedAt: true },
      })
    : [];

  const auditBySite = Object.fromEntries(latestAudits.map((a) => [a.siteId, a]));

  const enriched = data.map((client) => ({
    ...client,
    latestAudit: client.sites.map((s) => auditBySite[s.id]).filter(Boolean)[0] ?? null,
    openTickets: client.tickets.length,
    pendingRequests: client.serviceRequests.length,
  }));

  return Response.json({ data: enriched, total, page, limit });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireRole(['admin', 'sales']);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.contactName || !body.contactEmail) {
    return Response.json({ error: 'contactName and contactEmail are required' }, { status: 400 });
  }

  const client = await prisma.clientAccount.create({
    data: {
      contactName: body.contactName as string,
      contactEmail: body.contactEmail as string,
      dropboxFolderPath: (body.dropboxFolderPath as string) || null,
    },
    include: { sites: true },
  });

  // If a siteId was provided, link it
  if (body.siteId) {
    await prisma.site.update({
      where: { id: body.siteId as string },
      data: { clientAccountId: client.id },
    });
  }

  return Response.json(client, { status: 201 });
}
