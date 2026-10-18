import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';

export function createAuthMiddleware(client: any): RequestHandler {
  return async (req, res, next) => {
    const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }
    try {
      const { data: { user }, error } = await client.auth.getUser(token);
      if (error || !user) { res.status(401).json({ error: 'Invalid or expired session' }); return; }
      const { data: profile, error: profileError } = await client.from('user_master')
        .select('user_id,username,role,level,status,allowed_modules')
        .eq('auth_user_id', user.id).single();
      if (profileError) { res.status(503).json({ error: 'Authorization unavailable' }); return; }
      if (!profile || profile.status?.toLowerCase() !== 'active') {
        res.status(403).json({ error: 'Account inactive or unlinked' }); return;
      }
      let modules: string[] = [];
      try {
        const raw = profile.allowed_modules;
        modules = Array.isArray(raw) ? raw : raw?.startsWith('[') ? JSON.parse(raw) : String(raw || '').split(',').map(s => s.trim());
      } catch { /* malformed permissions grant nothing */ }
      const admin = ['ADMIN', 'ADMINISTRATOR'].includes(profile.role?.toUpperCase()) || profile.level === 'L5';
      const route = req.path.replace(/^\/Jute-Purchase-Automation/, '');
      const required = route.startsWith('/api/chat') ? ['ai_assistant']
        : route.includes('payments') ? ['payment']
        : route === '/api/sms-feed' ? ['sms_sauda']
        : route.includes('inspection') ? ['material_inspection','inspection']
        : /test-smtp|check-email-connection/.test(route) ? ['admindesk']
        : /email/.test(route) ? ['sauda', 'final_po'] : ['admindesk'];
      // Unknown API routes default to administrator only.
      const publicToOperator = ['/api/auth/verify', '/api/auth/logout'].includes(route);
      if (!publicToOperator && !admin && !required.some(m => modules.includes(m) || (m !== 'admindesk' && modules.includes('*')))) {
        res.status(403).json({ error: 'Module access denied' }); return;
      }
      (req as any).userSession = { ...profile, authUserId: user.id, modules };
      next();
    } catch { res.status(503).json({ error: 'Authentication unavailable' }); }
  };
}

export function serverSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
