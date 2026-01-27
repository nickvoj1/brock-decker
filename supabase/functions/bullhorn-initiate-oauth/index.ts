import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch Bullhorn client_id from api_settings
    const { data: settings } = await supabase
      .from('api_settings')
      .select('setting_key, setting_value')
      .eq('setting_key', 'bullhorn_client_id')
      .single()

    if (!settings?.setting_value) {
      return new Response(
        JSON.stringify({ error: 'Bullhorn Client ID not configured. Please save it in Settings first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const clientId = settings.setting_value
    const redirectUri = `${supabaseUrl}/functions/v1/bullhorn-oauth-callback`

    // Build the Bullhorn authorization URL
    const authUrl = new URL('https://auth.bullhornstaffing.com/oauth/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)

    console.log('Generated OAuth URL:', authUrl.toString())

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error initiating OAuth:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
