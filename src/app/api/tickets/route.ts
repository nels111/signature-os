export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/role-gate';
import { sendPushToAdminAndSales } from '@/lib/push';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireRole(['admin', 'sales', 'operations']);

  const url = new URL(request.url);
  const clientAccountId = url.searchParams.get('clientAccountId') || '';
  const status = url.searchParams.get('status') || '';
  const severity = url.searchParams.get('severity') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));

  const where = {
    ...(clientAccountId ? { clientAccountId } : {}),
    ...(status ? { status: status as never } : {}),
    ...(severity ? { severity: severity as never } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.clientTicket.findMany({
      where,
      include: {
        clientAccount: { select: { id: true, contactName: true, contactEmail: true } },
        site: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.clientTicket.count({ where }),
  ]);

  return Response.json({ data, total, page, limit });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireRole(['admin', 'sales', 'operations']);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.clientAccountId || !body.title || !body.description) {
    return Response.json({ error: 'clientAccountId, title, and description are required' }, { status: 400 });
  }

  const ticket = await prisma.clientTicket.create({
    data: {
      clientAccountId: body.clientAccountId as string,
      siteId: (body.siteId as string) || null,
      title: body.title as string,
      description: body.description as string,
      severity: (body.severity as never) || 'medium',
      assignedToId: (body.assignedToId as string) || null,
    },
    include: {
      clientAccount: { select: { contactName: true } },
      site: { select: { name: true } },
    },
  });

  // Push notification to admin + sales (Nelson + Nick)
  await sendPushToAdminAndSales({
    title: `New Ticket: ${ticket.title}`,
    body: `${ticket.clientAccount.contactName}${ticket.site ? ` — ${ticket.site.name}` : ''} · ${ticket.severity}`,
    url: `/dashboard/clients/${ticket.clientAccountId}?tab=tickets`,
  });

  return Response.json(ticket, { status: 201 });
}
