import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { ensureAnonymousSupabaseSession } from './supabase';
import { telemetryApi } from './db';

export interface TelemetryEvent {
  event_name: string;
  project_id?: string;
  revision_id?: string;
  mode?: string;
  payload?: Record<string, any>;
}

let flushScheduled = false;

/**
 * Write an event to the local SQLite queue immediately, then
 * attempt an async Supabase flush. Never throws — telemetry
 * must not affect the user-facing flow.
 */
export function logEvent(event: TelemetryEvent): void {
  try {
    telemetryApi.enqueue(event.event_name, {
      project_id: event.project_id ?? null,
      revision_id: event.revision_id ?? null,
      mode: event.mode ?? null,
      ...(event.payload ?? {})
    });
  } catch (err) {
    console.warn('[Telemetry] Local enqueue failed:', err);
    return;
  }

  // Debounce flushes — batch up to 50 events per flush cycle
  if (!flushScheduled) {
    flushScheduled = true;
    setImmediate(() => {
      flushScheduled = false;
      flushToSupabase().catch(() => { /* silent — will retry next event */ });
    });
  }
}

async function flushToSupabase(): Promise<void> {
  const pending = telemetryApi.getPending(50);
  if (pending.length === 0) return;

  const { config, session } = await ensureAnonymousSupabaseSession();

  const client = createClient(config.url, config.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    realtime: { transport: WebSocket as any },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } }
  });

  const rows = pending.map(item => ({
    session_id: session.user.id,
    event_name: item.event_name,
    project_id: item.payload.project_id ?? null,
    revision_id: item.payload.revision_id ?? null,
    mode: item.payload.mode ?? null,
    crm_user_id: item.payload.crm_user_id ?? null,
    payload: item.payload
  }));

  const { error } = await client.from('events').insert(rows);

  if (!error) {
    telemetryApi.markSynced(pending.map(p => p.id));
    telemetryApi.pruneOldSynced();
  } else {
    console.warn('[Telemetry] Supabase flush failed — events remain in local queue:', error.message);
  }
}

/** Call once on app start to drain any un-synced events from a previous session. */
export function flushPendingOnStartup(): void {
  setImmediate(() => {
    flushToSupabase().catch(() => {});
  });
}
