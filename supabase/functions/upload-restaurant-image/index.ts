import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claimsData.claims.sub

    const form = await req.formData()
    const file = form.get('file') as File | null
    const kind = String(form.get('kind') || '')
    if (!file || !['logo', 'banner'].includes(kind)) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (file.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large (max 5MB)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!file.type.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'Only image files allowed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: profile, error: profErr } = await admin
      .from('profiles').select('restaurant_id').eq('user_id', userId).maybeSingle()
    if (profErr || !profile?.restaurant_id) {
      return new Response(JSON.stringify({ error: 'Restaurant not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const rid = profile.restaurant_id

    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = `${rid}/${kind}.${ext}`
    const buf = new Uint8Array(await file.arrayBuffer())

    const logFailure = async (stage: string, message: string) => {
      try {
        await admin.from('audit_logs').insert({
          restaurant_id: rid,
          user_id: userId,
          action: `${kind}_upload.failed`,
          entity_type: 'storage_object',
          metadata: {
            stage,
            error: message,
            storage_bucket: 'menu-images',
            storage_path: path,
            file_name: file.name,
            file_size: file.size,
            content_type: file.type,
          },
        })
      } catch (_) { /* never block the response on audit failure */ }
    }

    const { error: upErr } = await admin.storage.from('menu-images').upload(path, buf, {
      upsert: true, contentType: file.type,
    })
    if (upErr) {
      await logFailure('storage_upload', upErr.message)
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: urlData } = admin.storage.from('menu-images').getPublicUrl(path)
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`

    const update: Record<string, string> = {}
    update[kind === 'logo' ? 'logo_url' : 'banner_url'] = publicUrl
    const { error: updErr } = await admin.from('restaurants').update(update).eq('id', rid)
    if (updErr) {
      await logFailure('restaurants_update', updErr.message)
      return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ url: publicUrl, path }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
