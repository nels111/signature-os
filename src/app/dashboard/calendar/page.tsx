export const runtime = 'nodejs';

export const metadata = { title: 'Calendar' };

import { CalendarPage } from './CalendarPage';

export default function CalendarPageEntry() {
  return <CalendarPage />;
}
