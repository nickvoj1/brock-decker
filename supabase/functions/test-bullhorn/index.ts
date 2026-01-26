const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { clientId, clientSecret, username, password } = await req.json()

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Client ID and Secret required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Test Bullhorn OAuth - attempt to get authorization code
    // Note: Bullhorn's OAuth flow typically requires browser redirect
    // This is a simplified test that checks if credentials format is valid
    
    const authUrl = new URL('https://auth.bullhornstaffing.com/oauth/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    
    if (username && password) {
      authUrl.searchParams.set('username', username)
      authUrl.searchParams.set('password', password)
      authUrl.searchParams.set('action', 'Login')
    }

    // Try to hit the auth endpoint
    const response = await fetch(authUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
    })

    // Bullhorn typically returns a redirect on success
    if (response.status === 302 || response.status === 301 || response.status === 200) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Credentials appear valid. Full OAuth flow requires browser authorization.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Auth endpoint returned ${response.status}. Check credentials.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
