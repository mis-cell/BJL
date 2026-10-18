import { supabase } from './supabase';
import { normalizeAllowedModules } from './permissions';

export async function verifiedProfile() {
  if (!supabase) throw new Error('Authentication is not configured.');
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Please sign in again.');
  const { data, error: profileError } = await supabase.from('user_master')
    .select('user_id,username,role,level,allowed_modules,status,auth_user_id')
    .eq('auth_user_id', user.id).single();
  if (profileError || !data || data.status?.toLowerCase() !== 'active') {
    throw new Error('Your operator account is unavailable or inactive. Contact your administrator.');
  }
  return { ...data, modules: normalizeAllowedModules(data.allowed_modules) };
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Authentication is not configured.');
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error('Invalid email or password.');
  try { return await verifiedProfile(); }
  catch (error) { await supabase.auth.signOut(); throw error; }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  if (!supabase) throw new Error('Authentication is not configured.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}

export async function verifyPrivilegedPassword(email: string, password: string, allowSuper = false) {
  // Reauthentication must be for the current operator, not any account sharing a password.
  if (!supabase) throw new Error('Authentication is not configured.');
  const { data: { user } } = await supabase.auth.getUser();
  const current = await verifiedProfile();
  if (!user?.email || (email && ![user.email.toLowerCase(), current.username?.toLowerCase()].includes(email.trim().toLowerCase()))) {
    throw new Error('Enter the email of the currently signed-in operator.');
  }
  const profile = await signIn(user.email, password);
  const admin = ['ADMIN', 'ADMINISTRATOR'].includes(profile.role?.toUpperCase()) || profile.level === 'L5';
  if (!admin && !(allowSuper && profile.level === 'L4')) throw new Error('Administrator authorization required.');
  return profile;
}
