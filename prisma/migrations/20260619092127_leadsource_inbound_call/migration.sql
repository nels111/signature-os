-- Add `inbound_call` to the LeadSource enum.
-- Additive enum value: safe, no table/data rewrite. Leads captured by the
-- 24/7 ElevenLabs answering service are tagged with this source.
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'inbound_call';
