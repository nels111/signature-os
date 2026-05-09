export const runtime = 'nodejs';

import { DealDetailClient } from './DealDetailClient';

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DealDetailClient id={id} />;
}
