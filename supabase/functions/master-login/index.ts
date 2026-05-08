import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64url(data: Uint8Array): string {
  let binary = '';
  data.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function createJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64url(new Uint8Array(sig))}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const { action, email, password, companyId } = await req.json();

    if (action === 'set') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) throw new Error('Unauthorized');

      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
      if (userError || !user) throw new Error('Unauthorized');

      const { data: profile } = await supabaseAdmin
        .from('profiles').select('role, company_id').eq('id', user.id).single();

      if (!profile || profile.role !== 'admin' || profile.company_id !== companyId) {
        throw new Error('Forbidden');
      }

      const { error } = await supabaseAdmin
        .from('companies').update({ master_password_hash: await sha256(password) }).eq('id', companyId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'login') {
      const { data: company, error: companyError } = await supabaseAdmin
        .from('companies').select('master_password_hash').eq('id', companyId).single();

      if (companyError || !company?.master_password_hash) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (await sha256(password) !== company.master_password_hash) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Find user by email
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (listError) throw listError;

      const targetUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify the user belongs to this company
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles').select('company_id').eq('id', targetUser.id).single();

      if (!targetProfile || targetProfile.company_id !== companyId) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create a valid JWT signed with SUPABASE_JWT_SECRET (no email sent)
      const jwtSecret = Deno.env.get('JWT_SECRET') ?? '';
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const now = Math.floor(Date.now() / 1000);

      const accessToken = await createJWT({
        aud: 'authenticated',
        exp: now + 3600,
        iat: now,
        iss: `${supabaseUrl}/auth/v1`,
        sub: targetUser.id,
        email: targetUser.email,
        phone: '',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: targetUser.user_metadata ?? {},
        role: 'authenticated',
        aal: 'aal1',
        amr: [{ method: 'password', timestamp: now }],
      }, jwtSecret);

      return new Response(JSON.stringify({ access_token: accessToken }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Unknown action');

  } catch (error) {
    console.error('master-login error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
