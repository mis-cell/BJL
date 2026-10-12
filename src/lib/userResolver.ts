import { getCurrentUserContext } from './permissions';
import { supabase } from './supabase';
import { dbModule } from '../services/dbModule';

// Internal cache for user_id / username / lowercase identifier -> Display Username
const userDisplayMap: Record<string, string> = {
  '001': 'ADMIN',
  '1': 'ADMIN',
  'admin': 'ADMIN',
  '002': 'RAHUL',
  '02': 'RAHUL',
  '2': 'RAHUL',
  'rahul': 'RAHUL',
  '006': 'Ashish Kankaria',
  '6': 'Ashish Kankaria',
  '010': 'SHYAMLAHOTI',
  '10': 'SHYAMLAHOTI',
  'shyamlahoti': 'SHYAMLAHOTI',
  'checker': 'SHYAMLAHOTI',
  '011': 'ACCOUNT',
  '11': 'ACCOUNT',
  '012': 'MBAJAJ',
  '12': 'MBAJAJ',
  '013': 'SIMUL',
  '13': 'SIMUL',
  '014': 'ANKANA',
  '14': 'ANKANA',
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
          const numOnly = uid.replace(/^0+/, '');
          if (numOnly) userDisplayMap[numOnly] = uname;
          const pad3 = uid.padStart(3, '0');
          userDisplayMap[pad3] = uname;
        }
      });
      if (userDisplayMap['010']) {
        userDisplayMap['checker'] = userDisplayMap['010'];
        userDisplayMap['user 10'] = userDisplayMap['010'];
        userDisplayMap['user 010'] = userDisplayMap['010'];
      }
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
      return resolveDisplayName(active, fallback);
    }
    return fallback;
  }

  const clean = String(identifier).trim();
  if (!clean) return fallback;

  // Handle historic "User 2" or "User 002" references
  if (clean.toLowerCase() === 'user 2' || clean.toLowerCase() === 'user 002' || clean.toLowerCase() === 'user2') {
    return userDisplayMap['002'] || 'RAHUL';
  }

  if (clean.toLowerCase() === 'user 10' || clean.toLowerCase() === 'user 010' || clean.toLowerCase() === 'user10' || clean.toLowerCase() === 'checker') {
    return userDisplayMap['010'] || 'SHYAMLAHOTI';
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
    return resolveDisplayName(active, fallback);
  }

  return fallback;
}

/**
 * Returns the authenticated user's ID and username with guaranteed resolution
 */
export function getAuthenticatedUser(): { userId: string; username: string } {
  const userCtx = getCurrentUserContext();
  const rawUserId = String(userCtx.userId || '').trim();
  const rawUsername = String(userCtx.userName || userCtx.username || '').trim();

  let resolvedUsername = '';
  if (rawUsername && rawUsername.toLowerCase() !== 'user' && rawUsername.toLowerCase() !== 'user 2' && rawUsername.toLowerCase() !== 'user 10') {
    resolvedUsername = resolveDisplayName(rawUsername);
  } else if (rawUserId) {
    resolvedUsername = resolveDisplayName(rawUserId);
  }

  if (!resolvedUsername || resolvedUsername === 'Unknown User') {
    if (userCtx.userRole === 'ADMIN' || userCtx.userLevel === 'L5') {
      resolvedUsername = 'ADMIN';
    } else {
      resolvedUsername = rawUsername || rawUserId || 'ADMIN';
    }
  }

  return {
    userId: rawUserId || (resolvedUsername === 'SHYAMLAHOTI' ? '010' : resolvedUsername === 'RAHUL' ? '002' : '001'),
    username: resolvedUsername
  };
}
