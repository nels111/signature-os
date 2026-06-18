import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Readiness probe used to verify the app after a candidate swap. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
  return Response.json({ ok: true, ts: new Date().toISOString() });
}
