export const runtime = 'nodejs'

export const metadata = { title: 'Compliance Tracker' }

import { ComplianceTracker } from './ComplianceTracker'
import { requireRole } from '@/lib/role-gate'

export default async function CompliancePage() {
  await requireRole(['admin', 'operations'])
  return <ComplianceTracker />
}
