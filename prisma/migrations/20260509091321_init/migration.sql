-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'sales', 'operations', 'viewer');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('cold_call', 'cold_email', 'referral', 'website', 'mark_walker', 'direct_mail', 'other');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('cold_call', 'cold_email', 'follow_up_sequence', 'meeting_scheduled', 'meeting_attended', 'quote_delivered');

-- CreateEnum
CREATE TYPE "MeetingOutcome" AS ENUM ('good', 'bad', 'not_interested');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('quote_sent', 'follow_up_from_quote', 'closed_won', 'closed_lost');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('highest', 'high', 'normal', 'low', 'lowest');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'deferred', 'waiting');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('business', 'personal', 'mobilisation', 'onboarding', 'audit_action', 'issue_followup');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('meeting', 'site_survey', 'follow_up', 'calendly', 'personal');

-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('personal', 'shared');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "CadenceStatus" AS ENUM ('active', 'paused_replied', 'paused_meeting', 'stopped_active_client', 'completed', 'long_term_nurture');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('task_due', 'task_overdue', 'event_reminder', 'email_received', 'deal_stage_changed', 'lead_assigned', 'invite_received', 'cadence_reply', 'audit_due', 'shift_alert');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('note', 'call', 'email', 'meeting', 'status_change', 'task_completed', 'lead_created', 'deal_created', 'quote_sent', 'cadence_started');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'viewer',
    "ionosEmail" TEXT,
    "ionosPassword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "accountId" TEXT,
    "notes" TEXT,
    "source" "LeadSource",
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" "LeadSource" NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'cold_call',
    "meetingOutcome" "MeetingOutcome",
    "ownerId" TEXT NOT NULL,
    "notes" TEXT,
    "contactId" TEXT,
    "accountId" TEXT,
    "cadenceStatus" "CadenceStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'quote_sent',
    "value" DECIMAL(65,30),
    "weeklyHours" DECIMAL(65,30),
    "ownerId" TEXT NOT NULL,
    "contactId" TEXT,
    "accountId" TEXT,
    "quoteId" TEXT,
    "convertedFromId" TEXT,
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "lossReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'normal',
    "status" "TaskStatus" NOT NULL DEFAULT 'not_started',
    "taskType" "TaskType" NOT NULL DEFAULT 'business',
    "description" TEXT,
    "repeat" JSONB,
    "reminder" JSONB,
    "linkedLeadId" TEXT,
    "linkedDealId" TEXT,
    "linkedContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL DEFAULT 'meeting',
    "calendarType" "CalendarType" NOT NULL DEFAULT 'shared',
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "repeat" JSONB,
    "alerts" JSONB,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_invites" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "calendar_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT[],
    "cc" TEXT[],
    "subject" TEXT NOT NULL,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "folder" TEXT NOT NULL DEFAULT 'INBOX',
    "userId" TEXT NOT NULL,
    "linkedLeadId" TEXT,
    "linkedDealId" TEXT,
    "linkedContactId" TEXT,
    "trackingId" TEXT,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "mergeFields" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "accountId" TEXT,
    "contactId" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
    "weeklyHours" DECIMAL(65,30) NOT NULL,
    "sellRate" DECIMAL(65,30) NOT NULL,
    "labourRate" DECIMAL(65,30) NOT NULL DEFAULT 17,
    "weeksPerMonth" DECIMAL(65,30) NOT NULL DEFAULT 4.33,
    "isPilot" BOOLEAN NOT NULL DEFAULT false,
    "pilotDiscount" DECIMAL(65,30) DEFAULT 25,
    "monthlyTotal" DECIMAL(65,30) NOT NULL,
    "annualTotal" DECIMAL(65,30) NOT NULL,
    "margin" DECIMAL(65,30) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "trackingId" TEXT,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fireflies_transcripts" (
    "id" TEXT NOT NULL,
    "firefliesId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "participants" TEXT[],
    "linkedLeadId" TEXT,
    "linkedDealId" TEXT,
    "linkedContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fireflies_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cadences" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "CadenceStatus" NOT NULL DEFAULT 'active',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "nextSendAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cadences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cadence_steps" (
    "id" TEXT NOT NULL,
    "cadenceId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "templateId" TEXT NOT NULL,
    "delayDays" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),

    CONSTRAINT "cadence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_invites_eventId_inviteeId_key" ON "calendar_invites"("eventId", "inviteeId");

-- CreateIndex
CREATE UNIQUE INDEX "emails_messageId_key" ON "emails"("messageId");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "fireflies_transcripts_firefliesId_key" ON "fireflies_transcripts"("firefliesId");

-- CreateIndex
CREATE INDEX "activities_entityType_entityId_idx" ON "activities"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "cadence_steps_cadenceId_stepNumber_key" ON "cadence_steps"("cadenceId", "stepNumber");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_convertedFromId_fkey" FOREIGN KEY ("convertedFromId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_linkedLeadId_fkey" FOREIGN KEY ("linkedLeadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_linkedDealId_fkey" FOREIGN KEY ("linkedDealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_linkedContactId_fkey" FOREIGN KEY ("linkedContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_invites" ADD CONSTRAINT "calendar_invites_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_invites" ADD CONSTRAINT "calendar_invites_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_linkedLeadId_fkey" FOREIGN KEY ("linkedLeadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_linkedDealId_fkey" FOREIGN KEY ("linkedDealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_linkedContactId_fkey" FOREIGN KEY ("linkedContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fireflies_transcripts" ADD CONSTRAINT "fireflies_transcripts_linkedLeadId_fkey" FOREIGN KEY ("linkedLeadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fireflies_transcripts" ADD CONSTRAINT "fireflies_transcripts_linkedDealId_fkey" FOREIGN KEY ("linkedDealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fireflies_transcripts" ADD CONSTRAINT "fireflies_transcripts_linkedContactId_fkey" FOREIGN KEY ("linkedContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadences" ADD CONSTRAINT "cadences_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadence_steps" ADD CONSTRAINT "cadence_steps_cadenceId_fkey" FOREIGN KEY ("cadenceId") REFERENCES "cadences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadence_steps" ADD CONSTRAINT "cadence_steps_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "email_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
