-- Add indexes on foreign-key columns and frequently filtered fields.
-- All CREATE INDEX statements use IF NOT EXISTS so this migration is safe
-- to re-apply and won't fail if any of the indexes were created manually.

-- accounts
CREATE INDEX IF NOT EXISTS "accounts_createdBy_idx" ON "accounts" ("createdBy");
CREATE INDEX IF NOT EXISTS "accounts_deletedAt_idx" ON "accounts" ("deletedAt");

-- contacts
CREATE INDEX IF NOT EXISTS "contacts_createdBy_idx" ON "contacts" ("createdBy");
CREATE INDEX IF NOT EXISTS "contacts_accountId_idx" ON "contacts" ("accountId");
CREATE INDEX IF NOT EXISTS "contacts_email_idx" ON "contacts" ("email");
CREATE INDEX IF NOT EXISTS "contacts_deletedAt_idx" ON "contacts" ("deletedAt");

-- leads
CREATE INDEX IF NOT EXISTS "leads_ownerId_idx" ON "leads" ("ownerId");
CREATE INDEX IF NOT EXISTS "leads_contactId_idx" ON "leads" ("contactId");
CREATE INDEX IF NOT EXISTS "leads_accountId_idx" ON "leads" ("accountId");
CREATE INDEX IF NOT EXISTS "leads_stage_idx" ON "leads" ("stage");
CREATE INDEX IF NOT EXISTS "leads_email_idx" ON "leads" ("email");
CREATE INDEX IF NOT EXISTS "leads_deletedAt_idx" ON "leads" ("deletedAt");

-- deals
CREATE INDEX IF NOT EXISTS "deals_ownerId_idx" ON "deals" ("ownerId");
CREATE INDEX IF NOT EXISTS "deals_contactId_idx" ON "deals" ("contactId");
CREATE INDEX IF NOT EXISTS "deals_accountId_idx" ON "deals" ("accountId");
CREATE INDEX IF NOT EXISTS "deals_convertedFromId_idx" ON "deals" ("convertedFromId");
CREATE INDEX IF NOT EXISTS "deals_stage_idx" ON "deals" ("stage");
CREATE INDEX IF NOT EXISTS "deals_deletedAt_idx" ON "deals" ("deletedAt");

-- tasks
CREATE INDEX IF NOT EXISTS "tasks_ownerId_idx" ON "tasks" ("ownerId");
CREATE INDEX IF NOT EXISTS "tasks_linkedLeadId_idx" ON "tasks" ("linkedLeadId");
CREATE INDEX IF NOT EXISTS "tasks_linkedDealId_idx" ON "tasks" ("linkedDealId");
CREATE INDEX IF NOT EXISTS "tasks_linkedContactId_idx" ON "tasks" ("linkedContactId");
CREATE INDEX IF NOT EXISTS "tasks_status_dueDate_idx" ON "tasks" ("status", "dueDate");
CREATE INDEX IF NOT EXISTS "tasks_deletedAt_idx" ON "tasks" ("deletedAt");

-- calendar_events
CREATE INDEX IF NOT EXISTS "calendar_events_ownerId_idx" ON "calendar_events" ("ownerId");
CREATE INDEX IF NOT EXISTS "calendar_events_startDate_idx" ON "calendar_events" ("startDate");
CREATE INDEX IF NOT EXISTS "calendar_events_deletedAt_idx" ON "calendar_events" ("deletedAt");

-- calendar_invites
CREATE INDEX IF NOT EXISTS "calendar_invites_inviteeId_idx" ON "calendar_invites" ("inviteeId");

-- emails
CREATE INDEX IF NOT EXISTS "emails_userId_idx" ON "emails" ("userId");
CREATE INDEX IF NOT EXISTS "emails_linkedLeadId_idx" ON "emails" ("linkedLeadId");
CREATE INDEX IF NOT EXISTS "emails_linkedDealId_idx" ON "emails" ("linkedDealId");
CREATE INDEX IF NOT EXISTS "emails_linkedContactId_idx" ON "emails" ("linkedContactId");
CREATE INDEX IF NOT EXISTS "emails_mailbox_folder_date_idx" ON "emails" ("mailbox", "folder", "date");
CREATE INDEX IF NOT EXISTS "emails_trackingId_idx" ON "emails" ("trackingId");

-- email_templates
CREATE INDEX IF NOT EXISTS "email_templates_createdBy_idx" ON "email_templates" ("createdBy");

-- quotes
CREATE INDEX IF NOT EXISTS "quotes_createdBy_idx" ON "quotes" ("createdBy");
CREATE INDEX IF NOT EXISTS "quotes_dealId_idx" ON "quotes" ("dealId");
CREATE INDEX IF NOT EXISTS "quotes_accountId_idx" ON "quotes" ("accountId");
CREATE INDEX IF NOT EXISTS "quotes_contactId_idx" ON "quotes" ("contactId");
CREATE INDEX IF NOT EXISTS "quotes_status_idx" ON "quotes" ("status");
CREATE INDEX IF NOT EXISTS "quotes_supersededById_idx" ON "quotes" ("supersededById");

-- fireflies_transcripts
CREATE INDEX IF NOT EXISTS "fireflies_transcripts_linkedLeadId_idx" ON "fireflies_transcripts" ("linkedLeadId");
CREATE INDEX IF NOT EXISTS "fireflies_transcripts_linkedDealId_idx" ON "fireflies_transcripts" ("linkedDealId");
CREATE INDEX IF NOT EXISTS "fireflies_transcripts_linkedContactId_idx" ON "fireflies_transcripts" ("linkedContactId");

-- activities
CREATE INDEX IF NOT EXISTS "activities_userId_createdAt_idx" ON "activities" ("userId", "createdAt");

-- cadences
CREATE INDEX IF NOT EXISTS "cadences_leadId_idx" ON "cadences" ("leadId");
CREATE INDEX IF NOT EXISTS "cadences_status_nextSendAt_idx" ON "cadences" ("status", "nextSendAt");

-- cadence_steps
CREATE INDEX IF NOT EXISTS "cadence_steps_templateId_idx" ON "cadence_steps" ("templateId");
