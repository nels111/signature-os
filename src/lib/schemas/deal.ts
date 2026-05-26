import { z } from 'zod';

export const dealSchema = z.object({
  name:        z.string().min(1, 'Deal name is required'),
  stage:       z.string().min(1, 'Stage is required'),
  value:       z.string(),
  ownerId:     z.string(),
  contactId:   z.string(),
  accountId:   z.string(),
  notes:       z.string(),
  lossReason:  z.string(),
  sector:      z.string(),
  closingDate: z.string(),
  probability: z.string(),
});

export type DealFormData = z.infer<typeof dealSchema>;
