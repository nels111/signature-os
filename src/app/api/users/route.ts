export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/authz';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Leadership/operations can see role + email (used by owner pickers,
  // assignment dropdowns). Others get a minimal directory (no role/email).
  const isLeadership = hasRole(session, 'admin', 'sales', 'operations');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      ...(isLeadership ? { email: true, role: true } : {}),
    },
    orderBy: { name: 'asc' },
  });

  return Response.json({ users });
}
