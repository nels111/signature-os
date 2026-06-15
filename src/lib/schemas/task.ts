import { z } from 'zod';

// Single source of truth for task types. MUST stay in sync with the
// Prisma `TaskType` enum (prisma/schema.prisma). Cold-calling auto-creates
// tasks with types like `callback` / `follow_up_call`; if those are missing
// here, editing such a task in TaskForm silently fails validation and never
// saves. Keep this list == the Prisma enum.
export const TASK_TYPES = [
  'business',
  'personal',
  'mobilisation',
  'onboarding',
  'audit_action',
  'issue_followup',
  'callback',
  'follow_up_call',
  'contract_renewal_follow_up',
  'site_visit_confirmation',
] as const;

export const taskSchema = z.object({
  subject:     z.string().min(1, 'Subject is required'),
  dueDate:     z.string().optional().default(''),
  priority:    z.enum(['highest', 'high', 'normal', 'low', 'lowest']).default('normal'),
  status:      z.enum(['not_started', 'in_progress', 'completed', 'deferred', 'waiting']).default('not_started'),
  taskType:    z.enum(TASK_TYPES).default('business'),
  description: z.string().optional().default(''),
  ownerId:     z.string().optional().default(''),
});

export type TaskFormData = z.infer<typeof taskSchema>;
