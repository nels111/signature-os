import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardContent } from './DashboardContent';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return <DashboardContent role={session.user.role} userName={session.user.name} />;
}
