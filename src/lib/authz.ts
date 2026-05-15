/**
 * Authorization helpers for API routes.
 *
 * Design intent:
 *  - All authenticated users may CRUD CRM entities (small-team model).
 *  - But the `ownerId` field is privileged: only admins may set or change it.
 *  - Non-admin users always become the owner of records they create, and may
 *    not reassign records to other users.
 *
 * This stops the impersonation/commission-stealing path codex flagged
 * without requiring full role-based ACLs.
 */

import type { Session } from 'next-auth';

export type Role = 'admin' | 'sales' | 'operations' | 'viewer';

export function isAdmin(session: Session | null | undefined): boolean {
  return session?.user?.role === 'admin';
}

/**
 * Resolve the ownerId for a CREATE operation.
 *
 * Admin: may override via request body.
 * Non-admin: always assigned themselves.
 */
export function resolveOwnerIdOnCreate(
  session: Session,
  bodyOwnerId: unknown,
): string {
  const userId = session.user.id;
  if (!userId) throw new Error('resolveOwnerIdOnCreate called without session.user.id');

  if (isAdmin(session) && typeof bodyOwnerId === 'string' && bodyOwnerId.length > 0) {
    return bodyOwnerId;
  }
  return userId;
}

/**
 * For PATCH operations: strip ownerId from update data unless caller is admin.
 * Returns the safe update object.
 */
export function stripOwnerIdIfNotAdmin<T extends Record<string, unknown>>(
  session: Session,
  data: T,
): T {
  if (isAdmin(session)) return data;
  if ('ownerId' in data) {
    const clone = { ...data };
    delete clone.ownerId;
    return clone;
  }
  return data;
}

/**
 * Check whether a session may view/mutate a record by ownership.
 * Admin: always allowed.
 * Non-admin: only when their userId matches recordOwnerId.
 *
 * For routes where the small-team broad-access model still applies
 * (currently: contacts, accounts), do not call this.
 */
export function canAccessRecord(
  session: Session | null | undefined,
  recordOwnerId: string | null | undefined,
): boolean {
  if (!session?.user?.id) return false;
  if (isAdmin(session)) return true;
  if (!recordOwnerId) return false;
  return session.user.id === recordOwnerId;
}
