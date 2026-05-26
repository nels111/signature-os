export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/role-gate';

function calcOverallScore(scores: {
  scorePresentation: number;
  scoreCleanliness: number;
  scoreCompliance: number;
  scoreEquipment: number;
  scoreTeamConduct: number;
}): number {
  const avg =
    (scores.scorePresentation +
      scores.scoreCleanliness +
      scores.scoreCompliance +
      scores.scoreEquipment +
      scores.scoreTeamConduct) /
    5;
  return Math.round(avg * 10);
}

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
  const audit = await prisma.audit.findUnique({
    where: { id },
    include: {
      auditedBy: { select: { id: true, name: true } },
      site: { select: { id: true, name: true, cellTier: true } },
    },
  });

  if (!audit) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(audit);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireRole(['admin', 'operations']);

  const { id } = await params;
  const existing = await prisma.audit.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Collect score updates
  const scoreFields = [
    'scorePresentation',
    'scoreCleanliness',
    'scoreCompliance',
    'scoreEquipment',
    'scoreTeamConduct',
  ] as const;

  const scores: Record<string, number> = {};
  let hasScoreChange = false;
  for (const field of scoreFields) {
    if (field in body) {
      const val = Number(body[field]);
      if (isNaN(val) || val < 0 || val > 10) {
        return Response.json({ error: `${field} must be 0-10` }, { status: 400 });
      }
      scores[field] = val;
      hasScoreChange = true;
    } else {
      scores[field] = (existing as unknown as Record<string, number>)[field];
    }
  }

  const overallScore = hasScoreChange
    ? calcOverallScore(scores as Parameters<typeof calcOverallScore>[0])
    : existing.overallScore;

  // Handle publish action
  const isPublishing = body.status === 'published' && existing.status !== 'published';

  const updatable = [
    'notePresentation', 'noteCleanliness', 'noteCompliance', 'noteEquipment', 'noteTeamConduct',
    'headlineNotes', 'actionItems', 'photos', 'dropboxPdfPath',
  ];
  const data: Record<string, unknown> = {};
  for (const field of updatable) {
    if (field in body) data[field] = body[field];
  }
  if (hasScoreChange) {
    Object.assign(data, scores, { overallScore });
  }
  if (isPublishing) {
    data.status = 'published';
    data.publishedAt = new Date();
  } else if (body.status === 'draft') {
    data.status = 'draft';
  }

  const audit = await prisma.audit.update({
    where: { id },
    data,
    include: {
      auditedBy: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
    },
  });

  return Response.json(audit);
}
