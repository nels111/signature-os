// Shared types, constants and view modes for the Calendar feature

export interface CalEvent {
  id: string;
  title: string;
  eventType: string;
  calendarType: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  notes: string | null;
  repeat?: { freq: string; endDate?: string | null } | null;
  owner: { id: string; name: string | null } | null;
  invites?: Array<{ invitee: { id: string; name: string | null }; status: string }>;
  externalInvites?: Array<{ id: string; email: string; name: string | null; status: string }>;
}

export interface CalTask {
  id: string;
  subject: string;
  dueDate: string;
  priority: string;
  status: string;
}

export type ViewMode = 'month' | 'week' | 'list';

export const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  meeting:     { label: 'Meeting',     color: '#1a56db', bg: '#1a56db18' },
  site_survey: { label: 'Site Survey', color: '#7c3aed', bg: '#7c3aed18' },
  follow_up:   { label: 'Follow-up',   color: '#f59e0b', bg: '#f59e0b18' },
  calendly:    { label: 'Calendly',    color: '#06b6d4', bg: '#06b6d418' },
  personal:    { label: 'Personal',    color: '#6b7280', bg: '#6b728018' },
};

export const DAYS_SHORT  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAYS_LONG   = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS      = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
