
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, userId, userData } = await req.json();

    console.log('Edge function called with:', { action, userId, userData });

    switch (action) {
      case 'list': {
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error) throw error;
        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update': {
        const updates: any = {
          email: userData.email,
          user_metadata: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role,
            departments: userData.departments,
          }
        };

        if (userData.password) {
          updates.password = userData.password;
        }

        const { data, error } = await supabase.auth.admin.updateUserById(
          userId,
          updates
        );

        if (error) throw error;

        return new Response(JSON.stringify({ user: data.user }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Error in manage-users function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
