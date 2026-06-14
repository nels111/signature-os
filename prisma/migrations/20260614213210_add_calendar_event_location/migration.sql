-- Add nullable location column to calendar_events (additive, non-locking).
-- Used for site-visit addresses + "Open in Maps" links (9 Jun call / JAZ-HANDOFF 5.8).
ALTER TABLE "calendar_events" ADD COLUMN "location" TEXT;
