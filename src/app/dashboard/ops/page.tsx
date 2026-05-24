import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { OpsContent } from './OpsContent';

export default async function OpsPage() {
  const session = await auth();
  if (!session) redirect('/login');
  const role = session.user.role;
  if (role !== 'admin' && role !== 'operations') redirect('/dashboard');
  return <OpsContent />;
}
