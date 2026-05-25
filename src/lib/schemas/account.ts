import { z } from 'zod';

export const accountSchema = z.object({
  name:     z.string().min(1, 'Account name is required'),
  industry: z.string(),
  website:  z.string(),
  phone:    z.string(),
  address:  z.string(),
  notes:    z.string(),
});

export type AccountFormData = z.infer<typeof accountSchema>;
