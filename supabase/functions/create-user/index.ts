// supabase/functions/create-user/index.ts
// Deploy with: supabase functions deploy create-user
// (or paste this file's content into the function's Code tab in the
// Supabase dashboard and re-deploy, if you don't have the CLI working.)
//
// Handles account management actions that require the SERVICE ROLE KEY
// (never exposed to the browser): creating a login, resetting someone's
// password, and deleting an account. Every action first verifies the
// CALLER is an admin via their own JWT before touching anything.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401, corsHeaders);

    // Client bound to the CALLER's JWT — used only to verify who's asking.
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401, corsHeaders);

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();
    if (callerProfile?.role !== 'admin') return json({ error: 'Only admins can manage accounts' }, 403, corsHeaders);

    const body = await req.json();
    const action = body.action ?? 'create'; // default keeps old callers working
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (action === 'create') {
      const { email, password, displayName, role } = body;
      if (!email || !password || !displayName || !role) return json({ error: 'Missing required fields' }, 400, corsHeaders);
      if (!['admin', 'manager', 'user'].includes(role)) return json({ error: 'Invalid role' }, 400, corsHeaders);
      if (String(password).length < 8) return json({ error: 'Password must be at least 8 characters' }, 400, corsHeaders);

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !created.user) return json({ error: createError?.message ?? 'Failed to create user' }, 400, corsHeaders);

      const { error: profileError } = await adminClient.from('profiles').insert({
        id: created.user.id,
        email,
        display_name: displayName,
        role,
      });
      if (profileError) {
        await adminClient.auth.admin.deleteUser(created.user.id); // roll back the orphaned auth user
        return json({ error: profileError.message }, 400, corsHeaders);
      }
      return json({ ok: true, userId: created.user.id }, 200, corsHeaders);
    }

    if (action === 'resetPassword') {
      const { userId, newPassword } = body;
      if (!userId || !newPassword) return json({ error: 'Missing userId or newPassword' }, 400, corsHeaders);
      if (String(newPassword).length < 8) return json({ error: 'Password must be at least 8 characters' }, 400, corsHeaders);

      const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) return json({ error: error.message }, 400, corsHeaders);
      return json({ ok: true }, 200, corsHeaders);
    }

    if (action === 'delete') {
      const { userId } = body;
      if (!userId) return json({ error: 'Missing userId' }, 400, corsHeaders);
      if (userId === userData.user.id) return json({ error: 'You cannot delete your own account' }, 400, corsHeaders);

      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (authDeleteError) return json({ error: authDeleteError.message }, 400, corsHeaders);
      await adminClient.from('profiles').delete().eq('id', userId); // best-effort cleanup
      return json({ ok: true }, 200, corsHeaders);
    }

    return json({ error: `Unknown action: ${action}` }, 400, corsHeaders);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500, corsHeaders);
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
