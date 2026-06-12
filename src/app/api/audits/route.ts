export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/role-gate';
import {
  computeAuditScore,
  isValidFormType,
  isValidVariant,
  type ScoredCategory,
} from '@/lib/audit-forms';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireRole(['admin', 'sales', 'operations']);

  const url = new URL(request.url);
  const siteId = url.searchParams.get('siteId') || '';
  const status = url.searchParams.get('status') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));

  const where = {
    ...(siteId ? { siteId } : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.audit.findMany({
      where,
      include: {
        auditedBy: { select: { id: true, name: true } },
        site: { select: { id: true, name: true, cellTier: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { auditedAt: 'desc' },
    }),
    prisma.audit.count({ where }),
  ]);

  return Response.json({ data, total, page, limit });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireRole(['admin', 'operations']);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.siteId) {
    return Response.json({ error: 'siteId is required' }, { status: 400 });
  }

  const formType = isValidFormType(body.formType) ? body.formType : 'large';
  const siteVariant = isValidVariant(body.siteVariant) ? body.siteVariant : null;

  // Validate + normalise flexible category scores (each 0-10)
  const rawCats = Array.isArray(body.categories) ? body.categories : [];
  if (rawCats.length === 0) {
    return Response.json({ error: 'At least one scored category is required' }, { status: 400 });
  }
  const categories: ScoredCategory[] = [];
  for (const c of rawCats as Array<Record<string, unknown>>) {
    const score = Number(c.score);
    if (!c.key || typeof c.key !== 'string') {
      return Response.json({ error: 'Each category needs a key' }, { status: 400 });
    }
    if (isNaN(score) || score < 0 || score > 10) {
      return Response.json({ error: `Category ${c.key} score must be 0-10` }, { status: 400 });
    }
    categories.push({
      key: c.key,
      label: typeof c.label === 'string' ? c.label : c.key,
      score,
      note: typeof c.note === 'string' && c.note ? c.note : undefined,
    });
  }

  const { rawScore, maxScore, overallScore } = computeAuditScore(categories);

  const photos = Array.isArray(body.photos) ? body.photos : [];

  const audit = await prisma.audit.create({
    data: {
      siteId: body.siteId as string,
      auditedById: session.user.id,
      auditedAt: body.auditedAt ? new Date(body.auditedAt as string) : new Date(),
      formType,
      siteVariant,
      categories: categories as never,
      rawScore,
      maxScore,
      overallScore,
      binsEmptied: typeof body.binsEmptied === 'boolean' ? body.binsEmptied : null,
      issuesSpotted: (body.issuesSpotted as string) || null,
      needsReview: (body.needsReview as string) || null,
      signatureData: (body.signatureData as string) || null,
      headlineNotes: (body.headlineNotes as string) || null,
      photos: photos as never,
      status: 'draft',
    },
    include: {
      auditedBy: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
    },
  });

  // Auto-create action task if score < 70 (below intervention threshold)
  if (overallScore < 70) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (overallScore < 60 ? 1 : 3)); // 1 day for <60, 3 for 70-79
    await prisma.task.create({
      data: {
        subject: `Audit action required: ${audit.site.name} — score ${overallScore}/100`,
        description: `Audit from ${audit.auditedAt.toDateString()} scored ${overallScore}/100, below the intervention threshold. Review findings and resolve open issues.`,
        taskType: 'audit_action',
        status: 'not_started',
        priority: overallScore < 60 ? 'highest' : 'high',
        ownerId: session.user.id,
        dueDate,
      },
    });
  }

  return Response.json(audit, { status: 201 });
}
