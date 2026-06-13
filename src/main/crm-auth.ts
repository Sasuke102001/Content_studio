import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { safeStorage } from 'electron';
import { settingsApi } from './db';
import { CRM_SUPABASE_URL, CRM_SUPABASE_ANON_KEY, type RoleKey } from '../shared/appConfig';

export interface CrmUser {
  id: string;
  email: string;
  full_name: string;
  role_key: RoleKey;
  access_token: string;
  refresh_token: string;
}

function createCrmClient(accessToken?: string) {
  return createClient(CRM_SUPABASE_URL, CRM_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    realtime: { transport: WebSocket as any },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}
  });
}

async function fetchRoleAndProfile(
  userId: string,
  accessToken: string
): Promise<{ role_key: RoleKey; full_name: string }> {
  const client = createCrmClient(accessToken);

  const [roleRes, profileRes] = await Promise.all([
    client
      .from('user_role_assignments')
      .select('role_key')
      .eq('user_id', userId)
      .eq('scope_type', 'platform')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    client
      .from('app_users')
      .select('id,full_name,email,status')
      .eq('id', userId)
      .limit(1)
      .single()
  ]);

  const role_key = (roleRes.data?.role_key ?? 'member') as RoleKey;
  const full_name = (profileRes.data?.full_name ?? '') as string;
  return { role_key, full_name };
}

export async function signIn(email: string, password: string): Promise<CrmUser> {
  const client = createCrmClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw new Error(error?.message || 'Login failed. Check your email and password.');
  }

  const { role_key, full_name } = await fetchRoleAndProfile(
    data.session.user.id,
    data.session.access_token
  );

  const user: CrmUser = {
    id: data.session.user.id,
    email: data.session.user.email ?? email,
    full_name,
    role_key,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  };

  saveUser(user);
  return user;
}

export async function refreshSession(): Promise<CrmUser | null> {
  const stored = loadUser();
  if (!stored) return null;

  try {
    const client = createCrmClient();
    const { data, error } = await client.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token
    });

    if (error || !data.session) return null;

    const { role_key, full_name } = await fetchRoleAndProfile(
      data.session.user.id,
      data.session.access_token
    );

    const user: CrmUser = {
      ...stored,
      role_key,
      full_name,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    };

    saveUser(user);
    return user;
  } catch {
    return null;
  }
}

export function signOut(): void {
  settingsApi.save('CRM_SESSION', '');
}

export function getStoredUser(): CrmUser | null {
  return loadUser();
}

export async function createSupportTicket(
  user: CrmUser,
  title: string,
  description: string,
  requestType: 'technical_support' | 'platform_feature',
  priority: 'low' | 'medium' | 'high' | 'urgent'
): Promise<void> {
  const res = await fetch(`${CRM_SUPABASE_URL}/rest/v1/work_requests`, {
    method: 'POST',
    headers: {
      apikey: CRM_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${user.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      title,
      description,
      request_type: requestType,
      priority,
      requested_by: user.id,
      status: 'submitted'
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to submit ticket: ${err}`);
  }
}

function saveUser(user: CrmUser): void {
  const json = JSON.stringify(user);
  try {
    if (safeStorage.isEncryptionAvailable()) {
      settingsApi.save('CRM_SESSION', safeStorage.encryptString(json).toString('base64'));
    } else {
      settingsApi.save('CRM_SESSION', json);
    }
  } catch (err) {
    console.error('[CrmAuth] Failed to persist session:', err);
  }
}

function loadUser(): CrmUser | null {
  const raw = settingsApi.get('CRM_SESSION');
  if (!raw) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return JSON.parse(safeStorage.decryptString(Buffer.from(raw, 'base64')));
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
