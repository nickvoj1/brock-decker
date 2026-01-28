import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface BullhornTokens {
  accessToken: string
  restUrl: string
  bhRestToken: string
}

interface TestResult {
  test: string
  success: boolean
  details: string
  rawResponse?: any
}

async function getStoredBullhornTokens(supabase: any): Promise<BullhornTokens | null> {
  const { data: tokens } = await supabase
    .from('bullhorn_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)

  if (!tokens || tokens.length === 0) {
    return null
  }

  const token = tokens[0]
  
  // Check if token is expired
  if (token.expires_at && new Date(token.expires_at) < new Date()) {
    // Try to refresh
    const refreshed = await refreshBullhornTokens(supabase, token.refresh_token)
    if (refreshed) return refreshed
    return null
  }

  return {
    accessToken: token.access_token,
    restUrl: token.rest_url,
    bhRestToken: token.bh_rest_token,
  }
}

async function refreshBullhornTokens(supabase: any, refreshToken: string): Promise<BullhornTokens | null> {
  if (!refreshToken) return null
  
  const { data: settings } = await supabase
    .from('api_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['bullhorn_client_id', 'bullhorn_client_secret'])

  const creds: Record<string, string> = {}
  settings?.forEach((s: any) => {
    creds[s.setting_key] = s.setting_value
  })

  if (!creds.bullhorn_client_id || !creds.bullhorn_client_secret) {
    return null
  }

  const tokenUrl = 'https://auth.bullhornstaffing.com/oauth/token'
  const tokenParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: creds.bullhorn_client_id,
    client_secret: creds.bullhorn_client_secret,
  })

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams.toString(),
  })

  if (!tokenResponse.ok) {
    return null
  }

  const tokenData = await tokenResponse.json()
  const accessToken = tokenData.access_token
  const newRefreshToken = tokenData.refresh_token
  const expiresIn = tokenData.expires_in

  const loginUrl = `https://rest.bullhornstaffing.com/rest-services/login?version=*&access_token=${accessToken}`
  const loginResponse = await fetch(loginUrl, { method: 'GET' })

  if (!loginResponse.ok) {
    return null
  }

  const loginData = await loginResponse.json()
  const restUrl = loginData.restUrl
  const bhRestToken = loginData.BhRestToken

  const expiresAt = expiresIn 
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null

  await supabase.from('bullhorn_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  await supabase.from('bullhorn_tokens').insert({
    access_token: accessToken,
    refresh_token: newRefreshToken,
    rest_url: restUrl,
    bh_rest_token: bhRestToken,
    expires_at: expiresAt,
  })

  return { accessToken, restUrl, bhRestToken }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get Bullhorn tokens
    const tokens = await getStoredBullhornTokens(supabase)
    
    if (!tokens) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bullhorn not connected. Please connect via Settings → Bullhorn → Connect to Bullhorn.',
          accessLevel: 'NOT_CONNECTED',
          tests: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: TestResult[] = []
    let accessLevel = 'NO_ACCESS'

    // Test 1: GET session/settings to check entitlements
    console.log('Test 1: Checking session settings...')
    try {
      const sessionUrl = `${tokens.restUrl}settings/session?BhRestToken=${encodeURIComponent(tokens.bhRestToken)}`
      const sessionRes = await fetch(sessionUrl)
      const sessionText = await sessionRes.text()
      
      if (sessionRes.ok) {
        let sessionData: any = {}
        try {
          sessionData = JSON.parse(sessionText)
        } catch {
          sessionData = { raw: sessionText }
        }
        
        results.push({
          test: 'Session Settings',
          success: true,
          details: `Session active. Corporation: ${sessionData.corporationName || 'Unknown'}`,
          rawResponse: sessionData,
        })
      } else {
        results.push({
          test: 'Session Settings',
          success: false,
          details: `Failed to get session: ${sessionText}`,
          rawResponse: sessionText,
        })
      }
    } catch (err: any) {
      results.push({
        test: 'Session Settings',
        success: false,
        details: `Error: ${err.message}`,
      })
    }

    // Test 2: GET /meta/DistributionList to check if entity is available
    console.log('Test 2: Checking DistributionList meta...')
    try {
      const metaUrl = `${tokens.restUrl}meta/DistributionList?BhRestToken=${encodeURIComponent(tokens.bhRestToken)}`
      const metaRes = await fetch(metaUrl)
      const metaText = await metaRes.text()
      
      if (metaRes.ok) {
        results.push({
          test: 'DistributionList Meta',
          success: true,
          details: 'DistributionList entity is accessible',
          rawResponse: JSON.parse(metaText),
        })
        accessLevel = 'QUERY_ONLY' // At least meta works
      } else {
        const isBlocked = metaText.includes('bhInternalApi') || metaText.includes('featureDisabled')
        results.push({
          test: 'DistributionList Meta',
          success: false,
          details: isBlocked 
            ? 'BLOCKED: DistributionList entity requires bhInternalApi entitlement'
            : `Failed: ${metaText}`,
          rawResponse: metaText,
        })
      }
    } catch (err: any) {
      results.push({
        test: 'DistributionList Meta',
        success: false,
        details: `Error: ${err.message}`,
      })
    }

    // Test 3: GET /entity/DistributionList to query existing lists
    console.log('Test 3: Querying DistributionList...')
    try {
      const queryUrl = `${tokens.restUrl}query/DistributionList?BhRestToken=${encodeURIComponent(tokens.bhRestToken)}&where=id>0&fields=id,name&count=1`
      const queryRes = await fetch(queryUrl)
      const queryText = await queryRes.text()
      
      if (queryRes.ok) {
        const queryData = JSON.parse(queryText)
        results.push({
          test: 'Query DistributionList',
          success: true,
          details: `Query succeeded. Found ${queryData.count || 0} lists.`,
          rawResponse: queryData,
        })
        accessLevel = 'QUERY_ONLY'
      } else {
        const isBlocked = queryText.includes('bhInternalApi') || queryText.includes('featureDisabled')
        results.push({
          test: 'Query DistributionList',
          success: false,
          details: isBlocked 
            ? 'BLOCKED: Query requires bhInternalApi entitlement'
            : `Failed: ${queryText}`,
          rawResponse: queryText,
        })
      }
    } catch (err: any) {
      results.push({
        test: 'Query DistributionList',
        success: false,
        details: `Error: ${err.message}`,
      })
    }

    // Test 4: PUT /entity/DistributionList to test CREATE access
    console.log('Test 4: Testing DistributionList CREATE...')
    let createdListId: number | null = null
    try {
      const createUrl = `${tokens.restUrl}entity/DistributionList?BhRestToken=${encodeURIComponent(tokens.bhRestToken)}`
      const testListName = `_API_TEST_${Date.now()}`
      
      const createRes = await fetch(createUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testListName,
          description: 'API access test - safe to delete',
        }),
      })
      const createText = await createRes.text()
      
      if (createRes.ok) {
        const createData = JSON.parse(createText)
        createdListId = createData.changedEntityId
        results.push({
          test: 'Create DistributionList',
          success: true,
          details: `CREATE succeeded! List ID: ${createdListId}`,
          rawResponse: createData,
        })
        accessLevel = 'FULL_ACCESS'
      } else {
        const isBlocked = createText.includes('bhInternalApi') || createText.includes('featureDisabled') || createText.includes('"errorCode":403')
        results.push({
          test: 'Create DistributionList',
          success: false,
          details: isBlocked 
            ? 'BLOCKED: CREATE requires bhInternalApi / partner entitlements'
            : `Failed: ${createText}`,
          rawResponse: createText,
        })
      }
    } catch (err: any) {
      results.push({
        test: 'Create DistributionList',
        success: false,
        details: `Error: ${err.message}`,
      })
    }

    // Cleanup: Delete the test list if we created one
    if (createdListId) {
      console.log(`Cleaning up test list ${createdListId}...`)
      try {
        const deleteUrl = `${tokens.restUrl}entity/DistributionList/${createdListId}?BhRestToken=${encodeURIComponent(tokens.bhRestToken)}`
        const deleteRes = await fetch(deleteUrl, { method: 'DELETE' })
        const deleteText = await deleteRes.text()
        
        results.push({
          test: 'Delete Test List',
          success: deleteRes.ok,
          details: deleteRes.ok ? `Cleaned up test list ${createdListId}` : `Cleanup failed: ${deleteText}`,
        })
      } catch (err: any) {
        results.push({
          test: 'Delete Test List',
          success: false,
          details: `Cleanup error: ${err.message}`,
        })
      }
    }

    // Determine summary message
    let summary = ''
    let recommendation = ''
    
    switch (accessLevel) {
      case 'FULL_ACCESS':
        summary = '✅ FULL ACCESS: Can create and query Distribution Lists'
        recommendation = 'Your Bullhorn instance supports Distribution Lists via API. Exports will work correctly.'
        break
      case 'QUERY_ONLY':
        summary = '⚠️ QUERY ONLY: Can read lists, but CREATE is blocked'
        recommendation = 'Contact your Bullhorn admin to enable bhInternalApi / partner entitlements for full access.'
        break
      case 'NO_ACCESS':
        summary = '❌ NO ACCESS: Distribution Lists API is blocked'
        recommendation = 'Contact your Bullhorn admin/support to request Distribution Lists API access (partner/internal API entitlements).'
        break
    }

    // Log results to Supabase for audit
    await supabase.from('api_settings').upsert({
      setting_key: 'bullhorn_distlist_access_level',
      setting_value: accessLevel,
      is_configured: accessLevel === 'FULL_ACCESS',
    }, { onConflict: 'setting_key' })

    await supabase.from('api_settings').upsert({
      setting_key: 'bullhorn_distlist_last_test',
      setting_value: new Date().toISOString(),
      is_configured: true,
    }, { onConflict: 'setting_key' })

    console.log(`Bullhorn DistList API test complete. Access level: ${accessLevel}`)

    return new Response(
      JSON.stringify({
        success: true,
        accessLevel,
        summary,
        recommendation,
        tests: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Test error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        accessLevel: 'ERROR',
        tests: [],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
