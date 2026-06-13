-- Add real team-member identity to telemetry events.
-- Run this in the Supabase SQL editor after 001_telemetry_events.sql.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS crm_user_id UUID;

CREATE INDEX IF NOT EXISTS events_crm_user_id_idx ON public.events (crm_user_id);
