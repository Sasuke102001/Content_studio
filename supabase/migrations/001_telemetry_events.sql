-- Telemetry events table
-- Run this once in your Supabase SQL editor.
-- Anonymous users can INSERT their own rows; no one can read or update them.

CREATE TABLE IF NOT EXISTS public.events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL,
  event_name  TEXT        NOT NULL,
  project_id  TEXT,
  revision_id TEXT,
  mode        TEXT,
  payload     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for per-session lookups (analytics queries)
CREATE INDEX IF NOT EXISTS events_session_id_idx ON public.events (session_id);
CREATE INDEX IF NOT EXISTS events_event_name_idx ON public.events (event_name);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON public.events (created_at DESC);

-- Row-level security: anon users can only insert rows where session_id matches their own auth.uid()
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_own_events"
  ON public.events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (session_id = auth.uid());

-- No SELECT / UPDATE / DELETE policies — app never reads back from this table
