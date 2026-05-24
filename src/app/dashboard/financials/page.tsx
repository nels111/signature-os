import { Metadata } from 'next'
import FinancialsDashboard from './FinancialsDashboard'

export const metadata: Metadata = {
  title: 'Financials — Signature OS',
}

export default function FinancialsPage() {
  return <FinancialsDashboard />
}
