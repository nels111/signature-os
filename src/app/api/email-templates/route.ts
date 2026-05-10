import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

// GET /api/email-templates - List templates
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20') || 20, 100);
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.emailTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          subject: true,
          mergeFields: true,
          createdAt: true,
          updatedAt: true,
          creator: { select: { id: true, name: true } },
        },
      }),
      prisma.emailTemplate.count({ where }),
    ]);

    return NextResponse.json({ templates, total, page, limit });
  } catch (error) {
    console.error('Templates list error:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST /api/email-templates - Create template
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { name, subject, bodyHtml, mergeFields } = body;

    if (!name || !subject || !bodyHtml) {
      return NextResponse.json({ error: 'name, subject, and bodyHtml are required' }, { status: 400 });
    }

    if (typeof name !== 'string' || name.length > 200) {
      return NextResponse.json({ error: 'name must be under 200 chars' }, { status: 400 });
    }

    if (typeof subject !== 'string' || subject.length > 500) {
      return NextResponse.json({ error: 'subject must be a string under 500 chars' }, { status: 400 });
    }

    if (typeof bodyHtml !== 'string' || bodyHtml.length > 100_000) {
      return NextResponse.json({ error: 'bodyHtml must be under 100KB' }, { status: 400 });
    }

    if (mergeFields !== undefined && (!Array.isArray(mergeFields) || !mergeFields.every((f: unknown) => typeof f === 'string'))) {
      return NextResponse.json({ error: 'mergeFields must be a string array' }, { status: 400 });
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        bodyHtml,
        mergeFields: mergeFields || [],
        createdBy: session.user.id,
      },
      select: {
        id: true,
        name: true,
        subject: true,
        mergeFields: true,
        createdAt: true,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Template create error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
