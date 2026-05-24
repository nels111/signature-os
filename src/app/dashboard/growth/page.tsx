import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import GrowthTracker from './GrowthTracker';

export const metadata = {
  title: 'G1 Growth Tracker | Signature Cleans OS',
};

export default async function GrowthPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const role = (session.user as { role?: string }).role;
  if (!['admin', 'operations'].includes(role ?? '')) {
    redirect('/dashboard');
  }

  return <GrowthTracker />;
}
