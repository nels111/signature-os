import { z } from 'zod';

export const quoteSchema = z.object({
  weeklyHours: z.coerce.number().min(1, 'Weekly hours must be at least 1'),
  sellRate:    z.coerce.number()
    .min(25, 'Rate must be at least £25/hr (floor)')
    .max(200, 'Rate seems too high — double check'),
  isPilot:     z.boolean().default(false),
  dealId:      z.string().optional().default(''),
  accountId:   z.string().optional().default(''),
});

export type QuoteFormData = z.infer<typeof quoteSchema>;
