import { createClient, type Session } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { settingsApi } from './db';
import {
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  DEFAULT_SUPABASE_URL,
  SETTINGS_KEYS
} from '../shared/appConfig';

interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

function getSupabaseConfig(): SupabaseConfig {
  return {
    url: settingsApi.get(SETTINGS_KEYS.supabaseUrl) || DEFAULT_SUPABASE_URL,
    publishableKey:
      settingsApi.get(SETTINGS_KEYS.supabasePublishableKey) || DEFAULT_SUPABASE_PUBLISHABLE_KEY
  };
}

function createSupabaseClient(config = getSupabaseConfig()) {
  return createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    realtime: {
      transport: WebSocket as any
    }
  });
}

function saveSession(session: Session) {
  settingsApi.save(SETTINGS_KEYS.supabaseAnonSession, JSON.stringify(session));
}

function loadStoredSession(): Session | null {
  const raw = settingsApi.get(SETTINGS_KEYS.supabaseAnonSession);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function ensureAnonymousSupabaseSession(): Promise<{
  config: SupabaseConfig;
  session: Session;
}> {
  const config = getSupabaseConfig();
  const client = createSupabaseClient(config);
  const storedSession = loadStoredSession();

  if (storedSession?.access_token && storedSession?.refresh_token) {
    const { data, error } = await client.auth.setSession({
      access_token: storedSession.access_token,
      refresh_token: storedSession.refresh_token
    });

    if (!error && data.session) {
      saveSession(data.session);
      return { config, session: data.session };
    }
  }

  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) {
    throw new Error(
      error?.message ||
        'Supabase anonymous auth failed. Enable anonymous sign-ins in your Supabase project.'
    );
  }

  saveSession(data.session);
  return { config, session: data.session };
}

export async function getSupabaseStatus() {
  const config = getSupabaseConfig();
  const hasCustomUrl = !!settingsApi.get(SETTINGS_KEYS.supabaseUrl);
  const hasCustomKey = !!settingsApi.get(SETTINGS_KEYS.supabasePublishableKey);

  try {
    const { session } = await ensureAnonymousSupabaseSession();
    return {
      configured: !!config.url && !!config.publishableKey,
      authenticated: true,
      isAnonymous: session.user.is_anonymous ?? session.user.app_metadata?.provider === 'anonymous',
      userId: session.user.id,
      projectUrl: config.url,
      usingDefaults: !hasCustomUrl && !hasCustomKey
    };
  } catch (error: any) {
    return {
      configured: !!config.url && !!config.publishableKey,
      authenticated: false,
      isAnonymous: false,
      userId: '',
      projectUrl: config.url,
      usingDefaults: !hasCustomUrl && !hasCustomKey,
      error: error?.message || String(error)
    };
  }
}
