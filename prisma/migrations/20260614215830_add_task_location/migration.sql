-- Add nullable location column to tasks (additive, non-locking).
-- Same place-autocomplete location field as calendar events (JAZ-HANDOFF 5.8).
ALTER TABLE "tasks" ADD COLUMN "location" TEXT;
