export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/role-gate';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireRole(['admin', 'sales', 'operations']);

  const { id } = await params;

  const client = await prisma.clientAccount.findUnique({
    where: { id },
    include: {
      sites: {
        include: {
          regularHoursSheetRow: {
            select: { avgWeeklyHours: true, avgWeeklyEarnings: true, avgMonthlyEarnings: true },
          },
        },
      },
      tickets: {
        orderBy: { createdAt: 'desc' },
        include: { assignedTo: { select: { id: true, name: true } } },
      },
      serviceRequests: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!client) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Audits for all sites
  const siteIds = client.sites.map((s) => s.id);
  const audits = siteIds.length
    ? await prisma.audit.findMany({
        where: { siteId: { in: siteIds } },
        orderBy: { auditedAt: 'desc' },
        include: { auditedBy: { select: { id: true, name: true } }, site: { select: { id: true, name: true } } },
        take: 20,
      })
    : [];

  return Response.json({ ...client, audits });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireRole(['admin', 'sales']);

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowedFields = ['contactName', 'contactEmail', 'dropboxFolderPath', 'portalStatus', 'hiddenFolders'];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) data[field] = body[field];
  }

  const client = await prisma.clientAccount.update({
    where: { id },
    data,
    include: { sites: true },
  });

  return Response.json(client);
}
