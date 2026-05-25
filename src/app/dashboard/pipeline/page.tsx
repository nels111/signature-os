export const runtime = 'nodejs';

export const metadata = { title: 'Pipeline' };

import { PipelinePage } from './PipelinePage';

export default function PipelinePageEntry() {
  return <PipelinePage />;
}
