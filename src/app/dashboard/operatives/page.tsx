export const runtime = 'nodejs';

export const metadata = { title: 'Operatives' };

import { OperativesList } from './OperativesList';

export default function OperativesPage() {
  return <OperativesList />;
}
