export const runtime = 'nodejs';

export const metadata = { title: 'Quotes' };

import { QuotesListPage } from './QuotesListPage';

export default function Page() {
  return <QuotesListPage />;
}
