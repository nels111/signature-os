import { Metadata } from 'next'
import FinancialsDashboard from './FinancialsDashboard'
import { requireRole } from '@/lib/role-gate'

export const metadata: Metadata = {
  title: 'Financials — Signature OS',
}

export default async function FinancialsPage() {
  await requireRole(['admin'])
  return <FinancialsDashboard />
}
