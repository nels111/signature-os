import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SalesContent } from './SalesContent';

export const metadata = { title: 'Sales' };

export default async function SalesPage() {
  const session = await auth();
  if (!session) redirect('/login');
  const role = session.user.role;
  if (role !== 'admin' && role !== 'sales') redirect('/dashboard');
  return <SalesContent />;
}
