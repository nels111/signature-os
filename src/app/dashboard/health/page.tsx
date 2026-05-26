import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import HealthDashboard from './HealthDashboard'

export const metadata = { title: 'Contract Health | Signature Cleans OS' }

export default async function HealthPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const role = session.user.role as string
  if (role !== 'admin' && role !== 'operations') redirect('/dashboard')

  return <HealthDashboard />
}
