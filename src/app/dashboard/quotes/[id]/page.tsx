export const runtime = 'nodejs';

import { QuoteDetailClient } from './QuoteDetailClient';

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <QuoteDetailClient id={id} />;
}
