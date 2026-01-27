import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description')

    // Get the frontend URL for redirect
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://id-preview--80452e28-c96a-4eb6-9497-821c41c7d009.lovable.app'

    if (error) {
      console.error('OAuth error:', error, errorDescription)
      return Response.redirect(`${frontendUrl}/settings?bullhorn_error=${encodeURIComponent(errorDescription || error)}`, 302)
    }

    if (!code) {
      console.error('No authorization code received')
      return Response.redirect(`${frontendUrl}/settings?bullhorn_error=${encodeURIComponent('No authorization code received')}`, 302)
    }

    console.log('Received authorization code, exchanging for tokens...')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch Bullhorn credentials from api_settings
    const { data: settings } = await supabase
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['bullhorn_client_id', 'bullhorn_client_secret'])

    const creds: Record<string, string> = {}
    settings?.forEach(s => {
      creds[s.setting_key] = s.setting_value
    })

    if (!creds.bullhorn_client_id || !creds.bullhorn_client_secret) {
      return Response.redirect(`${frontendUrl}/settings?bullhorn_error=${encodeURIComponent('Bullhorn credentials not configured')}`, 302)
    }

    // Exchange authorization code for access token
    const tokenUrl = 'https://auth.bullhornstaffing.com/oauth/token'
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: creds.bullhorn_client_id,
      client_secret: creds.bullhorn_client_secret,
    })

    console.log('Exchanging code for token...')
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return Response.redirect(`${frontendUrl}/settings?bullhorn_error=${encodeURIComponent('Token exchange failed: ' + errorText)}`, 302)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token
    const refreshToken = tokenData.refresh_token
    const expiresIn = tokenData.expires_in // seconds

    console.log('Token obtained, getting REST session...')

    // Get REST session
    const loginUrl = `https://rest.bullhornstaffing.com/rest-services/login?version=*&access_token=${accessToken}`
    const loginResponse = await fetch(loginUrl, { method: 'GET' })

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text()
      console.error('REST login failed:', errorText)
      return Response.redirect(`${frontendUrl}/settings?bullhorn_error=${encodeURIComponent('REST login failed: ' + errorText)}`, 302)
    }

    const loginData = await loginResponse.json()
    const restUrl = loginData.restUrl
    const bhRestToken = loginData.BhRestToken

    console.log('REST session obtained:', restUrl)

    // Calculate expiration time
    const expiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null

    // Delete existing tokens and insert new one
    await supabase.from('bullhorn_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    const { error: insertError } = await supabase.from('bullhorn_tokens').insert({
      access_token: accessToken,
      refresh_token: refreshToken,
      rest_url: restUrl,
      bh_rest_token: bhRestToken,
      expires_at: expiresAt,
    })

    if (insertError) {
      console.error('Failed to save tokens:', insertError)
      return Response.redirect(`${frontendUrl}/settings?bullhorn_error=${encodeURIComponent('Failed to save tokens')}`, 302)
    }

    console.log('Bullhorn tokens saved successfully')
    return Response.redirect(`${frontendUrl}/settings?bullhorn_success=true`, 302)

  } catch (error: any) {
    console.error('OAuth callback error:', error)
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://id-preview--80452e28-c96a-4eb6-9497-821c41c7d009.lovable.app'
    return Response.redirect(`${frontendUrl}/settings?bullhorn_error=${encodeURIComponent(error.message)}`, 302)
  }
})
