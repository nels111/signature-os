// Centralized notification deep-link resolver.
// Pure (no server deps) so it can be imported by BOTH the server push sender
// (src/lib/notifications.ts) and the client bell dropdown (TopBar.tsx). This is
// the single source of truth for "clicking a notification goes to the right place".

// entityType -> dashboard detail route segment (all have a /[id] page)
const DETAIL_ROUTES: Record<string, string> = {
  task: 'tasks',
  lead: 'leads',
  deal: 'deals',
  contact: 'contacts',
  quote: 'quotes',
  event: 'calendar',
  audit: 'audits',
  operative: 'operatives',
  client: 'clients',
  contract: 'contracts',
  account: 'accounts',
};

// entityType -> section page (no per-id detail page; land on the relevant list)
const SECTION_ROUTES: Record<string, string> = {
  shift: 'operatives',
  service_request: 'ops',
};

export function notificationUrl(
  entityType?: string | null,
  entityId?: string | null,
): string {
  if (entityType && entityId && DETAIL_ROUTES[entityType]) {
    return `/dashboard/${DETAIL_ROUTES[entityType]}/${entityId}`;
  }
  if (entityType && SECTION_ROUTES[entityType]) {
    return `/dashboard/${SECTION_ROUTES[entityType]}`;
  }
  return '/dashboard';
}
