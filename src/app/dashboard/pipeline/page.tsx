export const runtime = 'nodejs';

export const metadata = { title: 'Pipeline' };

import { PipelinePage } from './PipelinePage';
import { requireRole } from '@/lib/role-gate';

export default async function PipelinePageEntry() {
  await requireRole(['admin', 'sales', 'operations']);
  return <PipelinePage />;
}
