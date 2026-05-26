import { z } from 'zod';

export const leadSchema = z.object({
  companyName:    z.string().min(1, 'Company name is required'),
  contactName:    z.string(),
  email:          z.string().email('Invalid email address').or(z.literal('')),
  phone:          z.string(),
  source:         z.string(),
  stage:          z.string().min(1, 'Stage is required'),
  meetingOutcome: z.string(),
  ownerId:        z.string(),
  contactId:      z.string(),
  accountId:      z.string(),
  notes:          z.string(),
  sector:         z.string(),
});

export type LeadFormData = z.infer<typeof leadSchema>;
