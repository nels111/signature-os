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
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));

  const where = {
    ...(clientAccountId ? { clientAccountId } : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      include: {
        clientAccount: { select: { id: true, contactName: true } },
        site: { select: { id: true, name: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.serviceRequest.count({ where }),
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

  if (!body.clientAccountId || !body.serviceType || !body.description) {
    return Response.json(
      { error: 'clientAccountId, serviceType, and description are required' },
      { status: 400 }
    );
  }

  const sr = await prisma.serviceRequest.create({
    data: {
      clientAccountId: body.clientAccountId as string,
      siteId: (body.siteId as string) || null,
      serviceType: body.serviceType as string,
      description: body.description as string,
      preferredDates: (body.preferredDates as never) || [],
    },
    include: {
      clientAccount: { select: { contactName: true } },
      site: { select: { name: true } },
    },
  });

  // Push to admin + sales
  await sendPushToAdminAndSales({
    title: `Service Request: ${sr.serviceType}`,
    body: `${sr.clientAccount.contactName}${sr.site ? ` — ${sr.site.name}` : ''}`,
    url: `/dashboard/clients/${sr.clientAccountId}?tab=requests`,
  });

  return Response.json(sr, { status: 201 });
}
