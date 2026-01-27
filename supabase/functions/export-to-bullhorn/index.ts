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

interface SearchPreference {
  industries?: string[]
  roles?: string[]
  location?: string
}

// Skills mapping based on Bullhorn patterns
const INDUSTRY_SKILLS: Record<string, string[]> = {
  'private equity': ['PE'],
  'venture capital': ['VC'],
  'hedge fund': ['HEDGE FUND'],
  'investment bank': ['INVESTMENT BANK'],
  'asset management': ['ASSET MAN'],
  'mergers': ['M&A'],
  'acquisitions': ['M&A'],
  'm&a': ['M&A'],
  'leveraged buyout': ['LBO'],
  'lbo': ['LBO'],
  'debt capital': ['DCM'],
  'secondaries': ['SECN'],
  'tier 1': ['TIER1'],
  'tier1': ['TIER1'],
  'bulge bracket': ['TIER1'],
  'consulting': ['CONSULTING'],
  'management consulting': ['CONSULTING'],
}

const LOCATION_SKILLS: Record<string, string[]> = {
  'london': ['UK', 'LONDON'],
  'united kingdom': ['UK'],
  'uk': ['UK'],
  'frankfurt': ['DACH', 'FRANKFURT', 'GERMANY'],
  'munich': ['DACH', 'GERMANY'],
  'berlin': ['DACH', 'GERMANY'],
  'germany': ['DACH', 'GERMANY'],
  'dach': ['DACH'],
  'zurich': ['SWISS'],
  'geneva': ['SWISS'],
  'switzerland': ['SWISS'],
  'dubai': ['UAE', 'DUBAI', 'MENA'],
  'abu dhabi': ['UAE', 'MENA'],
  'uae': ['UAE', 'MENA'],
  'stockholm': ['NORDICS'],
  'oslo': ['NORDICS'],
  'copenhagen': ['NORDICS'],
  'helsinki': ['NORDICS'],
  'nordics': ['NORDICS'],
  'amsterdam': ['BENELUX'],
  'brussels': ['BENELUX'],
  'benelux': ['BENELUX'],
  'paris': ['FRANCE'],
  'france': ['FRANCE'],
  'milan': ['ITALY'],
  'italy': ['ITALY'],
  'madrid': ['SPAIN'],
  'spain': ['SPAIN'],
  'new york': ['NYC', 'US'],
  'nyc': ['NYC', 'US'],
  'boston': ['US'],
  'chicago': ['US'],
  'san francisco': ['US'],
  'los angeles': ['US'],
  'singapore': ['APAC', 'SINGAPORE'],
  'hong kong': ['APAC', 'HK'],
  'tokyo': ['APAC', 'JAPAN'],
}

const ROLE_SKILLS: Record<string, string[]> = {
  'head': ['HEAD'],
  'director': ['HEAD'],
  'partner': ['HEAD'],
  'managing director': ['HEAD'],
  'md': ['HEAD'],
  'principal': ['HEAD'],
  'buy side': ['BUY SIDE'],
  'buyside': ['BUY SIDE'],
  'growth': ['GROWTH'],
  'fundraising': ['FUNDRAISING'],
  'investor relations': ['INVESTOR RELATIONS'],
  'ir': ['INVESTOR RELATIONS'],
}

function generateSkillsString(
  contact: ApolloContact,
  searchPreferences?: SearchPreference
): string {
  const skills = new Set<string>()

  // Match from search preferences (industries selected during search)
  if (searchPreferences?.industries) {
    for (const industry of searchPreferences.industries) {
      const lowerIndustry = industry.toLowerCase()
      for (const [keyword, skillCodes] of Object.entries(INDUSTRY_SKILLS)) {
        if (lowerIndustry.includes(keyword) || keyword.includes(lowerIndustry)) {
          skillCodes.forEach(s => skills.add(s))
        }
      }
    }
  }

  // Match from company name
  const companyLower = contact.company?.toLowerCase() || ''
  for (const [keyword, skillCodes] of Object.entries(INDUSTRY_SKILLS)) {
    if (companyLower.includes(keyword)) {
      skillCodes.forEach(s => skills.add(s))
    }
  }

  // Match from location
  const locationLower = contact.location?.toLowerCase() || ''
  for (const [keyword, skillCodes] of Object.entries(LOCATION_SKILLS)) {
    if (locationLower.includes(keyword)) {
      skillCodes.forEach(s => skills.add(s))
    }
  }

  // Match from title (role-based skills)
  const titleLower = contact.title?.toLowerCase() || ''
  for (const [keyword, skillCodes] of Object.entries(ROLE_SKILLS)) {
    if (titleLower.includes(keyword)) {
      skillCodes.forEach(s => skills.add(s))
    }
  }

  // Return comma-separated unique skills
  return Array.from(skills).join(', ')
}

async function refreshBullhornTokens(supabase: any, refreshToken: string): Promise<BullhornTokens | null> {
  console.log('Attempting to refresh Bullhorn token...')
  
  // Fetch client credentials from api_settings
  const { data: settings } = await supabase
    .from('api_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['bullhorn_client_id', 'bullhorn_client_secret'])

  const creds: Record<string, string> = {}
  settings?.forEach((s: any) => {
    creds[s.setting_key] = s.setting_value
  })

  if (!creds.bullhorn_client_id || !creds.bullhorn_client_secret) {
    console.error('Bullhorn credentials not configured for refresh')
    return null
  }

  // Exchange refresh token for new access token
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
    const errorText = await tokenResponse.text()
    console.error('Token refresh failed:', errorText)
    return null
  }

  const tokenData = await tokenResponse.json()
  const accessToken = tokenData.access_token
  const newRefreshToken = tokenData.refresh_token
  const expiresIn = tokenData.expires_in

  console.log('Token refreshed, getting new REST session...')

  // Get new REST session
  const loginUrl = `https://rest.bullhornstaffing.com/rest-services/login?version=*&access_token=${accessToken}`
  const loginResponse = await fetch(loginUrl, { method: 'GET' })

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text()
    console.error('REST login failed after refresh:', errorText)
    return null
  }

  const loginData = await loginResponse.json()
  const restUrl = loginData.restUrl
  const bhRestToken = loginData.BhRestToken

  // Calculate expiration time
  const expiresAt = expiresIn 
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null

  // Update tokens in database
  await supabase.from('bullhorn_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  const { error: insertError } = await supabase.from('bullhorn_tokens').insert({
    access_token: accessToken,
    refresh_token: newRefreshToken,
    rest_url: restUrl,
    bh_rest_token: bhRestToken,
    expires_at: expiresAt,
  })

  if (insertError) {
    console.error('Failed to save refreshed tokens:', insertError)
    return null
  }

  console.log('Bullhorn tokens refreshed successfully')
  return { accessToken, restUrl, bhRestToken }
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
    console.log('Token expired, attempting refresh...')
    
    // Try to refresh using the refresh token
    if (token.refresh_token) {
      const refreshed = await refreshBullhornTokens(supabase, token.refresh_token)
      if (refreshed) {
        return refreshed
      }
    }
    
    console.log('Token refresh failed, user needs to reconnect')
    return null
  }

  return {
    accessToken: token.access_token,
    restUrl: token.rest_url,
    bhRestToken: token.bh_rest_token,
  }
}

async function findOrCreateClientCorporation(
  restUrl: string,
  bhRestToken: string,
  companyName: string
): Promise<number> {
  // Search for existing ClientCorporation by name
  const searchUrl = `${restUrl}search/ClientCorporation?BhRestToken=${bhRestToken}&query=name:"${companyName}"&fields=id,name`
  const searchResponse = await fetch(searchUrl)
  
  if (searchResponse.ok) {
    const searchData = await searchResponse.json()
    if (searchData.data && searchData.data.length > 0) {
      console.log(`Found existing ClientCorporation: ${companyName} (ID: ${searchData.data[0].id})`)
      return searchData.data[0].id
    }
  }

  // Create new ClientCorporation
  console.log(`Creating new ClientCorporation: ${companyName}`)
  const createUrl = `${restUrl}entity/ClientCorporation?BhRestToken=${bhRestToken}`
  const createResponse = await fetch(createUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: companyName,
      status: 'Active Client',
    }),
  })

  if (!createResponse.ok) {
    const errorText = await createResponse.text()
    throw new Error(`Failed to create ClientCorporation: ${errorText}`)
  }

  const createData = await createResponse.json()
  console.log(`Created ClientCorporation: ${companyName} (ID: ${createData.changedEntityId})`)
  return createData.changedEntityId
}

async function parseLocation(location: string): Promise<{ city: string; state: string; countryName: string; countryCode: string }> {
  // Parse location string like "Milan, Italy" or "New York, NY, United States"
  const parts = (location || '').split(',').map(p => p.trim()).filter(Boolean)
  
  // Country code mapping for Bullhorn
  const countryMap: Record<string, string> = {
    'italy': 'IT', 'italia': 'IT',
    'united kingdom': 'GB', 'uk': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB',
    'germany': 'DE', 'deutschland': 'DE',
    'france': 'FR',
    'spain': 'ES', 'españa': 'ES',
    'netherlands': 'NL', 'holland': 'NL',
    'belgium': 'BE',
    'switzerland': 'CH',
    'austria': 'AT',
    'sweden': 'SE',
    'norway': 'NO',
    'denmark': 'DK',
    'finland': 'FI',
    'ireland': 'IE',
    'portugal': 'PT',
    'poland': 'PL',
    'czech republic': 'CZ', 'czechia': 'CZ',
    'greece': 'GR',
    'united states': 'US', 'usa': 'US', 'u.s.': 'US', 'u.s.a.': 'US',
    'canada': 'CA',
    'australia': 'AU',
    'singapore': 'SG',
    'hong kong': 'HK',
    'japan': 'JP',
    'china': 'CN',
    'india': 'IN',
    'uae': 'AE', 'united arab emirates': 'AE', 'dubai': 'AE',
    'saudi arabia': 'SA',
    'brazil': 'BR',
    'mexico': 'MX',
    'luxembourg': 'LU',
  }

  let city = ''
  let state = ''
  let countryName = ''
  let countryCode = ''

  if (parts.length === 1) {
    // Could be just a country or just a city
    const lower = parts[0].toLowerCase()
    if (countryMap[lower]) {
      countryName = parts[0]
      countryCode = countryMap[lower]
    } else {
      city = parts[0]
    }
  } else if (parts.length === 2) {
    // City, Country format
    city = parts[0]
    const lower = parts[1].toLowerCase()
    countryName = parts[1]
    countryCode = countryMap[lower] || ''
  } else if (parts.length >= 3) {
    // City, State, Country format
    city = parts[0]
    state = parts[1]
    const lower = parts[parts.length - 1].toLowerCase()
    countryName = parts[parts.length - 1]
    countryCode = countryMap[lower] || ''
  }

  return { city, state, countryName, countryCode }
}

// Bullhorn uses a numeric countryID on the address object.
// We resolve this at runtime to avoid hardcoding tenant-specific IDs.
const countryIdCache: Record<string, number> = {}

function normalizeCountryName(countryName: string, countryCode: string): string {
  const name = (countryName || '').trim()
  const code = (countryCode || '').trim().toUpperCase()
  if (!name && !code) return ''

  // Normalize common abbreviations/aliases to Bullhorn country names.
  const byCode: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    AE: 'United Arab Emirates',
  }
  if (byCode[code]) return byCode[code]

  const lower = name.toLowerCase()
  const byName: Record<string, string> = {
    uk: 'United Kingdom',
    'u.k.': 'United Kingdom',
    usa: 'United States',
    'u.s.': 'United States',
    'u.s.a.': 'United States',
    uae: 'United Arab Emirates',
  }
  if (byName[lower]) return byName[lower]

  // Keep as-is (already human-readable from the Apollo location string)
  return name
}

function escapeBullhornQueryValue(value: string): string {
  // Bullhorn query strings are wrapped in quotes; escape any embedded quotes.
  return (value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function getBullhornCountryId(
  restUrl: string,
  bhRestToken: string,
  countryName: string,
  countryCode: string
): Promise<number | null> {
  const normalizedName = normalizeCountryName(countryName, countryCode)
  const cacheKey = (countryCode || normalizedName).toLowerCase()
  if (!cacheKey) return null
  if (countryIdCache[cacheKey]) return countryIdCache[cacheKey]

  // Prefer searching by country name (most reliable across tenants)
  const query = `name:"${escapeBullhornQueryValue(normalizedName)}"`
  const searchUrl = `${restUrl}search/Country?BhRestToken=${encodeURIComponent(bhRestToken)}&query=${encodeURIComponent(query)}&fields=${encodeURIComponent('id,name')}&count=1`
  const res = await fetch(searchUrl)

  if (!res.ok) {
    await res.text()
    return null
  }

  const data = await res.json()
  const id = data?.data?.[0]?.id
  if (typeof id === 'number') {
    countryIdCache[cacheKey] = id
    return id
  }

  return null
}

async function findOrCreateClientContact(
  restUrl: string,
  bhRestToken: string,
  contact: ApolloContact,
  clientCorporationId: number,
  skillsString: string
): Promise<number> {
  // Parse name - handle various formats
  const nameParts = (contact.name || 'Unknown').trim().split(/\s+/)
  const firstName = nameParts[0] || 'Unknown'
  const lastName = nameParts.slice(1).join(' ') || '-' // Bullhorn requires lastName

  // Explicitly set full name (some list views rely on this field)
  const fullName = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim()

  // Parse location for city, state, and country
  const { city, state, countryName, countryCode } = await parseLocation(contact.location || '')
  const countryID = await getBullhornCountryId(restUrl, bhRestToken, countryName, countryCode)

  // Truncate occupation to 100 chars (Bullhorn limit)
  const occupation = (contact.title || '').substring(0, 100)

  console.log(`Processing contact: ${firstName} ${lastName} (${contact.email}) - Location: ${city}, ${countryName} (${countryCode})`)

  // Build address object
  const address: Record<string, any> = {}
  if (city) address.city = city
  if (state) address.state = state
  if (countryID) address.countryID = countryID

  // Search for existing ClientContact by email
  const searchUrl = `${restUrl}search/ClientContact?BhRestToken=${bhRestToken}&query=email:"${contact.email}"&fields=id,firstName,lastName`
  const searchResponse = await fetch(searchUrl)
  
  if (searchResponse.ok) {
    const searchData = await searchResponse.json()
    if (searchData.data && searchData.data.length > 0) {
      // Update existing contact
      const existingId = searchData.data[0].id
      console.log(`Updating existing contact ID ${existingId}: ${firstName} ${lastName}`)
      
      const updateUrl = `${restUrl}entity/ClientContact/${existingId}?BhRestToken=${bhRestToken}`
      const updatePayload = {
        name: fullName,
        firstName,
        lastName,
        occupation,
        address,
        clientCorporation: { id: clientCorporationId },
        customText1: skillsString, // Skills field
      }
      
      const updateResponse = await fetch(updateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        console.error(`Failed to update contact ${existingId}: ${errorText}`)
      } else {
        console.log(`Updated contact ${existingId} with skills: ${skillsString}`)
      }
      
      return existingId
    }
  }

  // Create new ClientContact with required clientCorporation reference
  console.log(`Creating new contact: ${firstName} ${lastName}`)
  
  const createUrl = `${restUrl}entity/ClientContact?BhRestToken=${bhRestToken}`
  const createPayload = {
    name: fullName,
    firstName,
    lastName,
    email: contact.email,
    occupation,
    address,
    status: 'Active',
    clientCorporation: { id: clientCorporationId },
    customText1: skillsString, // Skills field
  }
  
  console.log(`Create payload: ${JSON.stringify(createPayload)}`)
  
  const createResponse = await fetch(createUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createPayload),
  })

  if (!createResponse.ok) {
    const errorText = await createResponse.text()
    throw new Error(`Failed to create ClientContact: ${errorText}`)
  }

  const createData = await createResponse.json()
  console.log(`Created contact ID ${createData.changedEntityId}: ${firstName} ${lastName}`)
  return createData.changedEntityId
}

async function createDistributionList(
  restUrl: string,
  bhRestToken: string,
  listName: string,
  contactIds: number[]
): Promise<number> {
  // Bullhorn calls distribution lists "Tearsheet"
  console.log(`Creating Tearsheet: ${listName} with ${contactIds.length} contacts`)
  
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
  console.log(`Tearsheet created with ID: ${tearsheetId}`)

  // Add ClientContacts to the tearsheet using association endpoint
  console.log(`Adding ${contactIds.length} contacts to tearsheet...`)
  let successCount = 0
  
  for (const contactId of contactIds) {
    // Use the association endpoint format
    const addUrl = `${restUrl}entity/Tearsheet/${tearsheetId}/clientContacts/${contactId}?BhRestToken=${bhRestToken}`
    
    try {
      const addResponse = await fetch(addUrl, { method: 'PUT' })
      
      if (addResponse.ok) {
        successCount++
      } else {
        const errorText = await addResponse.text()
        console.error(`Failed to add contact ${contactId} to tearsheet: ${errorText}`)
      }
    } catch (err: any) {
      console.error(`Error adding contact ${contactId}: ${err.message}`)
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  console.log(`Successfully added ${successCount}/${contactIds.length} contacts to tearsheet ${tearsheetId}`)
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

    // Extract search preferences for skills mapping
    const searchPreferences = run.preferences_data as SearchPreference | undefined

    // Get stored Bullhorn tokens (from OAuth flow)
    console.log('Fetching stored Bullhorn tokens...')
    const tokens = await getStoredBullhornTokens(supabase)
    
    if (!tokens) {
      throw new Error('Bullhorn not connected. Please connect via Settings → Bullhorn → Connect to Bullhorn.')
    }
    console.log('Bullhorn tokens retrieved successfully')

    // Generate list name from run data
    const candidateName = (run.candidates_data as any[])?.[0]?.name || 'Unknown'
    const runDate = new Date(run.created_at)
    const listName = `${runDate.toISOString().slice(0, 10)}_${runDate.toISOString().slice(11, 16).replace(':', '-')}_${candidateName.replace(/[^a-zA-Z0-9]/g, '_')}`

    // Create or update ClientContacts and collect their IDs
    console.log(`Creating/updating ${contacts.length} ClientContacts...`)
    const contactIds: number[] = []
    const errors: string[] = []
    
    // Cache for company IDs to avoid duplicate lookups
    const companyCache: Record<string, number> = {}

    for (const contact of contacts) {
      try {
        // First, find or create the ClientCorporation
        let clientCorporationId: number
        const companyName = contact.company || 'Unknown Company'
        
        if (companyCache[companyName]) {
          clientCorporationId = companyCache[companyName]
        } else {
          clientCorporationId = await findOrCreateClientCorporation(
            tokens.restUrl,
            tokens.bhRestToken,
            companyName
          )
          companyCache[companyName] = clientCorporationId
        }
        
        // Generate skills string based on contact data and search preferences
        const skillsString = generateSkillsString(contact, searchPreferences)
        console.log(`Skills for ${contact.name}: ${skillsString || '(none)'}`)
        
        // Then create the contact with the corporation reference and skills
        const contactId = await findOrCreateClientContact(
          tokens.restUrl,
          tokens.bhRestToken,
          contact,
          clientCorporationId,
          skillsString
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