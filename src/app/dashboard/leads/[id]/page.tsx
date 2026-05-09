export const runtime = 'nodejs';

import { LeadDetailClient } from './LeadDetailClient';

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeadDetailClient id={id} />;
}
