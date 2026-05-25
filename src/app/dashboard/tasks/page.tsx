export const runtime = 'nodejs';

export const metadata = { title: 'Tasks' };

import { TasksPage } from './TasksPage';

export default function TasksListPage() {
  return <TasksPage />;
}
