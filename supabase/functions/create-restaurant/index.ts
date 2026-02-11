import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client to get the authenticated user
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Service role client to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { restaurant_name } = await req.json();
    if (!restaurant_name || typeof restaurant_name !== 'string' || restaurant_name.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Restaurant name is required (min 2 chars)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const name = restaurant_name.trim();
    const slug = name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).substring(2, 6);

    // Check if user already has a restaurant
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .single();

    if (existingProfile?.restaurant_id) {
      return new Response(JSON.stringify({ error: 'User already has a restaurant' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create restaurant
    const { data: restaurant, error: restError } = await adminClient
      .from('restaurants')
      .insert({ name, slug })
      .select()
      .single();

    if (restError) {
      console.error('Error creating restaurant:', restError);
      return new Response(JSON.stringify({ error: 'Failed to create restaurant' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update profile with restaurant_id
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ restaurant_id: restaurant.id })
      .eq('user_id', user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    // Create owner role
    const { error: roleError } = await adminClient
      .from('user_roles')
      .insert({ user_id: user.id, restaurant_id: restaurant.id, role: 'owner' });

    if (roleError) {
      console.error('Error creating role:', roleError);
    }

    // Create default settings
    await adminClient.from('settings').insert({ restaurant_id: restaurant.id });

    return new Response(JSON.stringify({ restaurant }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
