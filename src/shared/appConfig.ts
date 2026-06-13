export const DEFAULT_SUPABASE_URL = 'https://psdovhwqcscquajjmxdq.supabase.co';
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable__eWpK5ZR8tTKFkGnAXLMGw_Xjc7xz8W';

// CRM Supabase project — separate from the carousel telemetry project
export const CRM_SUPABASE_URL = 'https://phxyvkzqxivaptfkjddw.supabase.co';
export const CRM_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoeHl2a3pxeGl2YXB0ZmtqZGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Mjg0ODIsImV4cCI6MjA5NjAwNDQ4Mn0.5H9HUfgse9RbORImK9oe7zIj66kyUYqIhvz-lewN570';

export const ADMIN_ROLES = ['master_admin', 'admin'] as const;
export type RoleKey = 'master_admin' | 'admin' | 'manager' | 'member';

export const SETTINGS_KEYS = {
  outputDir: 'OUTPUT_DIR',
  supabaseUrl: 'SUPABASE_URL',
  supabasePublishableKey: 'SUPABASE_PUBLISHABLE_KEY',
  supabaseAnonSession: 'SUPABASE_ANON_SESSION',
  crmSession: 'CRM_SESSION'
} as const;
