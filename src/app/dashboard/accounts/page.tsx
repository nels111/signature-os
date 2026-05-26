export const runtime = 'nodejs';

export const metadata = { title: 'Accounts' };

import { AccountsPage } from './AccountsPage';
import { requireRole } from '@/lib/role-gate';

export default async function AccountsListPage() {
  await requireRole(['admin', 'sales', 'operations']);
  return <AccountsPage />;
}
