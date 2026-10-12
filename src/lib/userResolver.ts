import { getCurrentUserContext } from './permissions';
import { supabase } from './supabase';
import { dbModule } from '../services/dbModule';

// Internal cache for user_id / username / lowercase identifier -> Display Username
const userDisplayMap: Record<string, string> = {
  '001': 'ADMIN',
  '1': 'ADMIN',
  'admin': 'ADMIN',
  '002': 'Rahul',
  '02': 'Rahul',
  '2': 'Rahul',
  'rahul': 'Rahul',
  '010': 'Checker',
  '10': 'Checker',
  'checker': 'Checker',
};

let isLoaded = false;

/**
 * Loads user records from user_master (Supabase or local dbModule)
 * and builds a resolution map from user_id -> username.
 */
export async function initUserMap(): Promise<Record<string, string>> {
  if (isLoaded) return userDisplayMap;
  try {
    let users: any[] = [];
    if (supabase) {
      const { data } = await supabase.from('user_master').select('*');
      if (data && data.length > 0) users = data;
    }
    if (users.length === 0) {
      users = await dbModule.fetchAll('user_master').catch(() => []);
    }

    if (Array.isArray(users)) {
      users.forEach(u => {
        const uid = String(u.user_id || u.id || '').trim();
        const uname = String(u.username || u.name || u.user_name || '').trim();
        if (uid && uname) {
          userDisplayMap[uid] = uname;
          userDisplayMap[uid.toLowerCase()] = uname;
          userDisplayMap[uname.toLowerCase()] = uname;
        }
      });
    }
    isLoaded = true;
  } catch (err) {
    console.warn("Could not load user map from user_master:", err);
  }
  return userDisplayMap;
}

/**
 * Resolves any user ID or username identifier into a clean, displayable username.
 * Never outputs hardcoded "User 2" or generic placeholders unless fallback is requested.
 */
export function resolveDisplayName(identifier?: string | null, fallback = 'Unknown User'): string {
  if (!identifier) {
    const ctx = getCurrentUserContext();
    const active = ctx.userName || ctx.username || ctx.userId;
    if (active && active.toLowerCase() !== 'user 2' && active.toLowerCase() !== 'user') {
      return active;
    }
    return fallback;
  }

  const clean = String(identifier).trim();
  if (!clean) return fallback;

  // Handle historic "User 2" or "User 002" references
  if (clean.toLowerCase() === 'user 2' || clean.toLowerCase() === 'user 002' || clean.toLowerCase() === 'user2') {
    return userDisplayMap['002'] || 'Rahul';
  }

  if (clean.toLowerCase() === 'user 10' || clean.toLowerCase() === 'user 010' || clean.toLowerCase() === 'user10') {
    return userDisplayMap['010'] || 'Checker';
  }

  // Check exact map match
  if (userDisplayMap[clean]) return userDisplayMap[clean];

  // Lowercase lookup
  const lower = clean.toLowerCase();
  if (userDisplayMap[lower]) return userDisplayMap[lower];

  // Numeric ID lookups without leading zeros
  const numClean = clean.replace(/^0+/, '');
  if (numClean && userDisplayMap[numClean]) return userDisplayMap[numClean];

  // If it's a valid custom username, return it
  if (lower !== 'user' && lower !== 'null' && lower !== 'undefined') {
    return clean;
  }

  // Active context fallback
  const ctx = getCurrentUserContext();
  const active = ctx.userName || ctx.username || ctx.userId;
  if (active && active.toLowerCase() !== 'user 2' && active.toLowerCase() !== 'user') {
    return active;
  }

  return fallback;
}
