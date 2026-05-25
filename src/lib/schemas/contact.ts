import { z } from 'zod';

export const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  email:     z.string().email('Invalid email address').or(z.literal('')),
  phone:     z.string(),
  company:   z.string(),
  accountId: z.string(),
  notes:     z.string(),
  source:    z.string(),
});

export type ContactFormData = z.infer<typeof contactSchema>;
