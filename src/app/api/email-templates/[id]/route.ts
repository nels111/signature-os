import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

// GET /api/email-templates/[id] - Get single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subject: true,
        bodyHtml: true,
        mergeFields: true,
        createdAt: true,
        updatedAt: true,
        creator: { select: { id: true, name: true } },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Template get error:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

// PATCH /api/email-templates/[id] - Update template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { name, subject, bodyHtml, mergeFields } = body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length > 200) return NextResponse.json({ error: 'name must be under 200 chars' }, { status: 400 });
      data.name = name;
    }
    if (subject !== undefined) {
      if (typeof subject !== 'string' || subject.length > 500) return NextResponse.json({ error: 'subject must be under 500 chars' }, { status: 400 });
      data.subject = subject;
    }
    if (bodyHtml !== undefined) {
      if (typeof bodyHtml !== 'string' || bodyHtml.length > 100_000) return NextResponse.json({ error: 'bodyHtml must be under 100KB' }, { status: 400 });
      data.bodyHtml = bodyHtml;
    }
    if (mergeFields !== undefined) {
      if (!Array.isArray(mergeFields) || !mergeFields.every((f: unknown) => typeof f === 'string')) return NextResponse.json({ error: 'mergeFields must be string[]' }, { status: 400 });
      data.mergeFields = mergeFields;
    }

    const updated = await prisma.emailTemplate.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        subject: true,
        mergeFields: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Template update error:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

// DELETE /api/email-templates/[id] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if template is used in any cadence steps
    const usedInSteps = await prisma.cadenceStep.count({
      where: { templateId: id },
    });

    if (usedInSteps > 0) {
      return NextResponse.json({
        error: `Template is used in ${usedInSteps} cadence step(s). Remove from cadences first.`,
      }, { status: 400 });
    }

    await prisma.emailTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Template delete error:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
