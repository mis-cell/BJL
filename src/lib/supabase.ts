import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key, {
  auth: { storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    storageKey: 'bjl_auth_v2', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
export function getSupabase() {
  if (!supabase) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  return supabase;
}
