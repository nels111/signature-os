export const runtime = 'nodejs';

import { ContactDetailClient } from './ContactDetailClient';

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ContactDetailClient id={id} />;
}
