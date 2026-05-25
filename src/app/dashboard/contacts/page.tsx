export const runtime = 'nodejs';

export const metadata = { title: 'Contacts' };

import { ContactsPage } from './ContactsPage';

export default function ContactsListPage() {
  return <ContactsPage />;
}
