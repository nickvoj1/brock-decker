import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApolloContact {
  name: string
  title: string
  location: string
  email: string
  company: string
}

interface BullhornTokens {
  accessToken: string
  restUrl: string
  bhRestToken: string
}

async function getBullhornTokens(
  clientId: string,
  clientSecret: string,
  username: string,
  password: string
): Promise<BullhornTokens> {
  // Step 1: Get authorization code via password grant
  // Bullhorn requires a redirect_uri even for password grant flow
  const redirectUri = 'https://flbeeduimzyjecdlonde.supabase.co/functions/v1/bullhorn-oauth-callback'
  
  const authUrl = new URL('https://auth.bullhornstaffing.com/oauth/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('username', username)
  authUrl.searchParams.set('password', password)
  authUrl.searchParams.set('action', 'Login')

  console.log('Attempting Bullhorn auth with URL:', authUrl.toString().replace(password, '***'))

  const authResponse = await fetch(authUrl.toString(), {
    method: 'GET',
    redirect: 'manual',
  })

  console.log('Auth response status:', authResponse.status)
  console.log('Auth response headers:', JSON.stringify(Object.fromEntries(authResponse.headers.entries())))

  // Extract auth code from redirect URL
  const location = authResponse.headers.get('location')
  if (!location) {
    // Try to read the response body for error details
    const body = await authResponse.text()
    console.error('No redirect received. Response body preview:', body.substring(0, 500))
    throw new Error(`Failed to get authorization redirect. Status: ${authResponse.status}. Check Bullhorn credentials in Settings.`)
  }

  const redirectUrl = new URL(location)
  const authCode = redirectUrl.searchParams.get('code')
  const error = redirectUrl.searchParams.get('error')
  
  if (error) {
    const errorDesc = redirectUrl.searchParams.get('error_description') || error
    throw new Error(`Bullhorn auth error: ${errorDesc}`)
  }
  
  if (!authCode) {
    throw new Error('Failed to get authorization code from redirect')
  }

  // Step 2: Exchange auth code for access token
  const tokenUrl = 'https://auth.bullhornstaffing.com/oauth/token'
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams.toString(),
  })

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text()
    throw new Error(`Token exchange failed: ${errorText}`)
  }

  const tokenData = await tokenResponse.json()
  const accessToken = tokenData.access_token

  // Step 3: Get REST session
  const loginUrl = `https://rest.bullhornstaffing.com/rest-services/login?version=*&access_token=${accessToken}`
  const loginResponse = await fetch(loginUrl, { method: 'GET' })

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text()
    throw new Error(`REST login failed: ${errorText}`)
  }

  const loginData = await loginResponse.json()

  return {
    accessToken,
    restUrl: loginData.restUrl,
    bhRestToken: loginData.BhRestToken,
  }
}

async function findOrCreateClientContact(
  restUrl: string,
  bhRestToken: string,
  contact: ApolloContact
): Promise<number> {
  // Search for existing ClientContact by email
  const searchUrl = `${restUrl}search/ClientContact?BhRestToken=${bhRestToken}&query=email:"${contact.email}"&fields=id`
  const searchResponse = await fetch(searchUrl)
  
  if (searchResponse.ok) {
    const searchData = await searchResponse.json()
    if (searchData.data && searchData.data.length > 0) {
      // Update existing contact
      const existingId = searchData.data[0].id
      const updateUrl = `${restUrl}entity/ClientContact/${existingId}?BhRestToken=${bhRestToken}`
      await fetch(updateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: contact.name.split(' ')[0] || contact.name,
          lastName: contact.name.split(' ').slice(1).join(' ') || '',
          occupation: contact.title,
          address: { city: contact.location.split(',')[0]?.trim() || '' },
        }),
      })
      return existingId
    }
  }

  // Create new ClientContact
  const createUrl = `${restUrl}entity/ClientContact?BhRestToken=${bhRestToken}`
  const createResponse = await fetch(createUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: contact.name.split(' ')[0] || contact.name,
      lastName: contact.name.split(' ').slice(1).join(' ') || '',
      email: contact.email,
      occupation: contact.title,
      companyName: contact.company,
      address: { city: contact.location.split(',')[0]?.trim() || '' },
      status: 'Active',
    }),
  })

  if (!createResponse.ok) {
    const errorText = await createResponse.text()
    throw new Error(`Failed to create ClientContact: ${errorText}`)
  }

  const createData = await createResponse.json()
  return createData.changedEntityId
}

async function createDistributionList(
  restUrl: string,
  bhRestToken: string,
  listName: string,
  contactIds: number[]
): Promise<number> {
  // Bullhorn calls distribution lists "Tearsheet"
  const createUrl = `${restUrl}entity/Tearsheet?BhRestToken=${bhRestToken}`
  const createResponse = await fetch(createUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: listName,
      description: `Auto-generated list from contact search`,
      isPrivate: false,
    }),
  })

  if (!createResponse.ok) {
    const errorText = await createResponse.text()
    throw new Error(`Failed to create distribution list: ${errorText}`)
  }

  const createData = await createResponse.json()
  const tearsheetId = createData.changedEntityId

  // Add ClientContacts to the tearsheet
  for (const contactId of contactIds) {
    const addUrl = `${restUrl}entity/Tearsheet/${tearsheetId}/clientContacts/${contactId}?BhRestToken=${bhRestToken}`
    await fetch(addUrl, { method: 'PUT' })
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  return tearsheetId
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { runId } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch the run details
    const { data: run, error: runError } = await supabase
      .from('enrichment_runs')
      .select('*')
      .eq('id', runId)
      .single()

    if (runError || !run) {
      throw new Error('Run not found')
    }

    const contacts = run.enriched_data as ApolloContact[]
    if (!contacts || contacts.length === 0) {
      throw new Error('No contacts to export')
    }

    // Fetch Bullhorn credentials
    const { data: bhSettings } = await supabase
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['bullhorn_client_id', 'bullhorn_client_secret', 'bullhorn_username', 'bullhorn_password'])

    const settings: Record<string, string> = {}
    bhSettings?.forEach(s => {
      settings[s.setting_key] = s.setting_value
    })

    if (!settings.bullhorn_client_id || !settings.bullhorn_client_secret || 
        !settings.bullhorn_username || !settings.bullhorn_password) {
      throw new Error('Bullhorn credentials not fully configured. Please check Settings.')
    }

    // Get Bullhorn access tokens
    console.log('Authenticating with Bullhorn...')
    const tokens = await getBullhornTokens(
      settings.bullhorn_client_id,
      settings.bullhorn_client_secret,
      settings.bullhorn_username,
      settings.bullhorn_password
    )
    console.log('Bullhorn authenticated successfully')

    // Generate list name from run data
    const candidateName = (run.candidates_data as any[])?.[0]?.name || 'Unknown'
    const runDate = new Date(run.created_at)
    const listName = `${runDate.toISOString().slice(0, 10)}_${runDate.toISOString().slice(11, 16).replace(':', '-')}_${candidateName.replace(/[^a-zA-Z0-9]/g, '_')}`

    // Create or update ClientContacts and collect their IDs
    console.log(`Creating/updating ${contacts.length} ClientContacts...`)
    const contactIds: number[] = []
    const errors: string[] = []

    for (const contact of contacts) {
      try {
        const contactId = await findOrCreateClientContact(
          tokens.restUrl,
          tokens.bhRestToken,
          contact
        )
        contactIds.push(contactId)
      } catch (error: any) {
        console.error(`Error creating contact ${contact.email}:`, error.message)
        errors.push(`${contact.email}: ${error.message}`)
      }
      // Small delay between contacts
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (contactIds.length === 0) {
      throw new Error('Failed to create any contacts in Bullhorn')
    }

    // Create distribution list (Tearsheet) with the contacts
    console.log(`Creating distribution list: ${listName}`)
    const tearsheetId = await createDistributionList(
      tokens.restUrl,
      tokens.bhRestToken,
      listName,
      contactIds
    )
    console.log(`Distribution list created with ID: ${tearsheetId}`)

    // Update the run with Bullhorn export info
    await supabase
      .from('enrichment_runs')
      .update({
        bullhorn_list_name: listName,
        bullhorn_list_id: tearsheetId,
        bullhorn_exported_at: new Date().toISOString(),
        bullhorn_errors: errors.length > 0 ? errors : null,
      })
      .eq('id', runId)

    return new Response(
      JSON.stringify({
        success: true,
        listName,
        listId: tearsheetId,
        contactsExported: contactIds.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Bullhorn export error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})