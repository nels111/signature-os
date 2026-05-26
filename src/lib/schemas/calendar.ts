import { z } from 'zod';

export const calendarSchema = z.object({
  title:        z.string().min(1, 'Title is required'),
  eventType:    z.enum(['meeting', 'site_survey', 'follow_up', 'calendly', 'personal']).default('meeting'),
  calendarType: z.enum(['shared', 'personal']).default('shared'),
  allDay:       z.boolean().default(false),
  startTime:    z.string().min(1, 'Start time is required'),
  endTime:      z.string().min(1, 'End time is required'),
  notes:        z.string().optional().default(''),
  repeatFreq:   z.string().optional().default(''),
  repeatEndDate:z.string().optional().default(''),
});

export type CalendarFormData = z.infer<typeof calendarSchema>;
