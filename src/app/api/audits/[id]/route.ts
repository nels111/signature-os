export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/role-gate';
import { computeAuditScore, type ScoredCategory } from '@/lib/audit-forms';
import {
  generateAuditPdf,
  uploadAuditPdfToDropbox,
  buildAuditPdfFilename,
  type AuditScoredCategory,
} from '@/lib/audit-pdf';

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

  const data: Record<string, unknown> = {};

  // Re-score if categories are edited
  if (Array.isArray(body.categories)) {
    const categories: ScoredCategory[] = [];
    for (const c of body.categories as Array<Record<string, unknown>>) {
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
    Object.assign(data, { categories, rawScore, maxScore, overallScore });
  }

  // Handle publish action
  const isPublishing = body.status === 'published' && existing.status !== 'published';

  const updatable = [
    'headlineNotes', 'actionItems', 'photos', 'dropboxPdfPath',
    'binsEmptied', 'issuesSpotted', 'needsReview', 'signatureData',
    'formType', 'siteVariant',
  ];
  for (const field of updatable) {
    if (field in body) data[field] = body[field];
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

  // On publish: render an A4 PDF and upload it to the client's Dropbox audit folder.
  // Never let PDF/upload failure block the publish — wrap everything in try/catch.
  if (isPublishing) {
    try {
      const full = await prisma.audit.findUnique({
        where: { id },
        include: {
          auditedBy: { select: { name: true } },
          site: {
            select: {
              name: true,
              dropboxFolderPath: true,
              clientAccount: { select: { contactName: true, dropboxFolderPath: true } },
            },
          },
        },
      });

      const dropboxFolderPath = full?.site.dropboxFolderPath ?? full?.site.clientAccount?.dropboxFolderPath ?? null;

      if (full && dropboxFolderPath) {
        const rawCats = Array.isArray(full.categories) ? full.categories : [];
        const categories: AuditScoredCategory[] = (rawCats as Array<Record<string, unknown>>).map((c) => ({
          key: String(c.key ?? ''),
          label: typeof c.label === 'string' ? c.label : String(c.key ?? ''),
          score: Number(c.score) || 0,
          note: typeof c.note === 'string' && c.note ? c.note : undefined,
        }));
        const photoArr: string[] = Array.isArray(full.photos)
          ? (full.photos as unknown[]).filter((p): p is string => typeof p === 'string')
          : [];

        const pdf = await generateAuditPdf({
          siteName: full.site.name,
          clientName: full.site.clientAccount?.contactName ?? null,
          auditorName: full.auditedBy?.name ?? null,
          auditedAt: full.auditedAt,
          formType: full.formType,
          siteVariant: full.siteVariant,
          categories,
          rawScore: full.rawScore,
          maxScore: full.maxScore,
          overallScore: full.overallScore,
          binsEmptied: full.binsEmptied,
          issuesSpotted: full.issuesSpotted,
          needsReview: full.needsReview,
          headlineNotes: full.headlineNotes,
          photos: photoArr,
          signatureData: full.signatureData,
        });

        const filename = buildAuditPdfFilename({
          formType: full.formType,
          auditorName: full.auditedBy?.name ?? null,
          auditedAt: full.auditedAt,
        });

        const uploadedPath = await uploadAuditPdfToDropbox({
          dropboxFolderPath,
          siteName: full.site.name,
          filename,
          pdf,
        });

        const updated = await prisma.audit.update({
          where: { id },
          data: { dropboxPdfPath: uploadedPath },
          include: {
            auditedBy: { select: { id: true, name: true } },
            site: { select: { id: true, name: true } },
          },
        });
        return Response.json(updated);
      } else if (full && !dropboxFolderPath) {
        console.warn(`[audit-publish] No Dropbox folder for site "${full.site.name}" — skipping PDF upload (audit ${id}).`);
      }
    } catch (err) {
      console.error(`[audit-publish] PDF/Dropbox upload failed for audit ${id}:`, err);
      // Publish still succeeds — fall through and return the published audit.
    }
  }

  return Response.json(audit);
}
