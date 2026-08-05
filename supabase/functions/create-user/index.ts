// supabase/functions/create-user/index.ts
// Deploy with: supabase functions deploy create-user
//
// Creates a login (email + password) for a new team member. Only callable
// by an already-logged-in admin — the function itself checks the caller's
// role via their JWT before doing anything, and uses the SERVICE ROLE KEY
// (set as a Supabase secret, never shipped to the browser) to actually
// create the Auth user, which is otherwise not possible from client code.

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
    if (callerProfile?.role !== 'admin') return json({ error: 'Only admins can create users' }, 403, corsHeaders);

    const { email, password, displayName, role } = await req.json();
    if (!email || !password || !displayName || !role) return json({ error: 'Missing required fields' }, 400, corsHeaders);
    if (!['admin', 'manager', 'user'].includes(role)) return json({ error: 'Invalid role' }, 400, corsHeaders);
    if (String(password).length < 8) return json({ error: 'Password must be at least 8 characters' }, 400, corsHeaders);

    // Admin client — full privileges, only used after the role check above.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
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
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500, corsHeaders);
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
