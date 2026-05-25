import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export type Role = 'admin' | 'sales' | 'operations' | 'viewer' | 'va' | 'operative';

/**
 * Server-side role gate for use in async server components and server actions.
 * Call at the top of any page that should be restricted.
 *
 * Usage:
 *   const session = await requireRole(['admin', 'sales']);
 */
export async function requireRole(allowedRoles: Role[]) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!allowedRoles.includes(session.user.role as Role)) redirect('/dashboard');
  return session;
}
