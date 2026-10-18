// Validate both identity and current operator status; the public anon key is not identity.
export async function authorized(req: Request, modules: string[]): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = req.headers.get('authorization');
  if (!url || !key || !authorization?.startsWith('Bearer ')) return false;
  try {
    const headers = { apikey: key, Authorization: authorization };
    const response = await fetch(`${url}/auth/v1/user`, { headers });
    if (!response.ok) return false;
    const user = await response.json();
    const profiles = await fetch(`${url}/rest/v1/user_master?auth_user_id=eq.${encodeURIComponent(user.id)}&select=role,level,status,allowed_modules`, { headers });
    if (!profiles.ok) return false;
    const [profile] = await profiles.json();
    if (profile?.status?.toLowerCase() !== 'active') return false;
    if (['ADMIN','ADMINISTRATOR'].includes(profile.role?.toUpperCase()) || profile.level === 'L5') return true;
    const raw = profile.allowed_modules;
    const allowed = Array.isArray(raw) ? raw : raw?.startsWith('[') ? JSON.parse(raw) : String(raw || '').split(',').map(s => s.trim());
    return allowed.includes('*') || modules.some(m => allowed.includes(m));
  } catch { return false; }
}
