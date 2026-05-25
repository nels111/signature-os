import { z } from 'zod';

export const taskSchema = z.object({
  subject:     z.string().min(1, 'Subject is required'),
  dueDate:     z.string().optional().default(''),
  priority:    z.enum(['highest', 'high', 'normal', 'low', 'lowest']).default('normal'),
  status:      z.enum(['not_started', 'in_progress', 'completed', 'deferred', 'waiting']).default('not_started'),
  taskType:    z.enum(['business', 'personal', 'mobilisation', 'onboarding', 'audit_action', 'issue_followup']).default('business'),
  description: z.string().optional().default(''),
  ownerId:     z.string().optional().default(''),
});

export type TaskFormData = z.infer<typeof taskSchema>;
