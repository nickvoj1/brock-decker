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

// Helper: sleep for retry backoff
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Helper: fetch with automatic retry on 429/throttling
async function bullhornFetch(
  url: string,
  init?: RequestInit,
  opts?: { retries?: number; initialDelayMs?: number }
): Promise<Response> {
  const retries = opts?.retries ?? 5
  let delayMs = opts?.initialDelayMs ?? 1000

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, init)
    
    // Check for throttling
    if (res.status === 429) {
      console.log(`Rate limited (429), attempt ${attempt + 1}/${retries + 1}, waiting ${delayMs}ms...`)
      if (attempt === retries) return res
      await sleep(delayMs)
      delayMs = Math.min(delayMs * 2, 8000)
      continue
    }
    
    // Check for throttling in response body (Bullhorn sometimes returns 500 with throttle message)
    if (res.status === 500) {
      const cloned = res.clone()
      const bodyText = await cloned.text()
      if (bodyText.includes('requestThrottled') || bodyText.includes('Server API capacity exceeded')) {
        console.log(`Throttled (in 500 body), attempt ${attempt + 1}/${retries + 1}, waiting ${delayMs}ms...`)
        if (attempt === retries) {
          return new Response(bodyText, { status: 500, headers: { 'Content-Type': 'application/json' } })
        }
        await sleep(delayMs)
        delayMs = Math.min(delayMs * 2, 8000)
        continue
      }
    }
    
    return res
  }

  return fetch(url, init)
}

async function refreshBullhornTokens(supabase: any, refreshToken: string): Promise<BullhornTokens | null> {
  console.log('Attempting to refresh Bullhorn token...')
  
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

  const expiresAt = expiresIn 
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null

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
  
  if (token.expires_at && new Date(token.expires_at) < new Date()) {
    console.log('Token expired, attempting refresh...')
    
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
  const searchUrl = `${restUrl}search/ClientCorporation?BhRestToken=${bhRestToken}&query=name:"${companyName}"&fields=id,name`
  const searchResponse = await bullhornFetch(searchUrl)
  
  if (searchResponse.ok) {
    const searchData = await searchResponse.json()
    if (searchData.data && searchData.data.length > 0) {
      console.log(`Found existing ClientCorporation: ${companyName} (ID: ${searchData.data[0].id})`)
      return searchData.data[0].id
    }
  }

  console.log(`Creating new ClientCorporation: ${companyName}`)
  const createUrl = `${restUrl}entity/ClientCorporation?BhRestToken=${bhRestToken}`
  const createResponse = await bullhornFetch(createUrl, {
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
  const parts = (location || '').split(',').map(p => p.trim()).filter(Boolean)
  
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
    const lower = parts[0].toLowerCase()
    if (countryMap[lower]) {
      countryName = parts[0]
      countryCode = countryMap[lower]
    } else {
      city = parts[0]
    }
  } else if (parts.length === 2) {
    city = parts[0]
    const lower = parts[1].toLowerCase()
    countryName = parts[1]
    countryCode = countryMap[lower] || ''
  } else if (parts.length >= 3) {
    city = parts[0]
    state = parts[1]
    const lower = parts[parts.length - 1].toLowerCase()
    countryName = parts[parts.length - 1]
    countryCode = countryMap[lower] || ''
  }

  return { city, state, countryName, countryCode }
}

// Cache for country IDs
const countryIdCache: Record<string, number> = {}

function normalizeCountryName(countryName: string, countryCode: string): string {
  const name = (countryName || '').trim()
  const code = (countryCode || '').trim().toUpperCase()
  if (!name && !code) return ''

  const byCode: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    AE: 'United Arab Emirates',
    IT: 'Italy',
    DE: 'Germany',
    FR: 'France',
    ES: 'Spain',
    NL: 'Netherlands',
    SE: 'Sweden',
    NO: 'Norway',
    DK: 'Denmark',
    CH: 'Switzerland',
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

  return name
}

// Use Bullhorn options/Country endpoint to get correct countryID
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

  // Use options/Country endpoint with filter
  const optionsUrl = `${restUrl}options/Country?BhRestToken=${encodeURIComponent(bhRestToken)}&filter=${encodeURIComponent(normalizedName)}&count=50`
  const res = await bullhornFetch(optionsUrl)

  if (!res.ok) {
    await res.text()
    console.log(`Failed to fetch country options for: ${normalizedName}`)
    return null
  }

  const json = await res.json()
  const options: any[] = json?.data || []
  const normalizedLower = normalizedName.toLowerCase()

  // Find exact match first, then starts-with match
  const exact = options.find((o) => String(o?.label || '').toLowerCase() === normalizedLower)
  const starts = options.find((o) => String(o?.label || '').toLowerCase().startsWith(normalizedLower))
  const match = exact || starts

  const value = match?.value
  if (typeof value === 'number') {
    console.log(`Resolved country "${normalizedName}" to ID: ${value}`)
    countryIdCache[cacheKey] = value
    return value
  }

  console.log(`Could not resolve country: ${normalizedName} (options: ${options.map(o => o.label).join(', ')})`)
  return null
}

// Cache for skills field name detection
let cachedSkillsFieldName: string | null = null
let skillsFieldChecked = false

async function getSkillsFieldName(
  restUrl: string,
  bhRestToken: string
): Promise<string> {
  if (skillsFieldChecked) {
    return cachedSkillsFieldName || 'desiredSkills'
  }
  skillsFieldChecked = true

  try {
    const metaUrl = `${restUrl}meta/ClientContact?BhRestToken=${encodeURIComponent(bhRestToken)}&fields=*`
    const res = await bullhornFetch(metaUrl)
    if (!res.ok) {
      await res.text()
      return 'desiredSkills'
    }

    const meta = await res.json()
    const fields: any[] = meta?.fields || []

    // First check if desiredSkills field exists (standard Bullhorn field)
    const desiredSkillsField = fields.find((f) => f?.name === 'desiredSkills')
    if (desiredSkillsField) {
      cachedSkillsFieldName = 'desiredSkills'
      console.log('Using standard Bullhorn field: desiredSkills')
      return 'desiredSkills'
    }

    // Look for a custom field labeled "Skills" or similar
    const skillsField = fields.find((f) => {
      const label = String(f?.label || '').toLowerCase()
      return label === 'skills' || label.includes('skills')
    })

    if (skillsField?.name) {
      cachedSkillsFieldName = skillsField.name
      console.log(`Detected custom skills field: ${skillsField.name} (label: ${skillsField.label})`)
      return skillsField.name
    }
  } catch (e) {
    console.error('Error detecting skills field:', e)
  }

  // Default to desiredSkills (standard Bullhorn field for ClientContact)
  console.log('Using default skills field: desiredSkills')
  return 'desiredSkills'
}

async function findOrCreateClientContact(
  restUrl: string,
  bhRestToken: string,
  contact: ApolloContact,
  clientCorporationId: number,
  skillsString: string,
  skillsFieldName: string
): Promise<number> {
  const nameParts = (contact.name || 'Unknown').trim().split(/\s+/)
  const firstName = nameParts[0] || 'Unknown'
  const lastName = nameParts.slice(1).join(' ') || '-'
  const fullName = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim()

  const { city, state, countryName, countryCode } = await parseLocation(contact.location || '')
  const countryID = await getBullhornCountryId(restUrl, bhRestToken, countryName, countryCode)

  const occupation = (contact.title || '').substring(0, 100)

  console.log(`Processing contact: ${fullName} (${contact.email}) - Location: ${city}, ${countryName} -> countryID: ${countryID}`)

  const address: Record<string, any> = {}
  if (city) address.city = city
  if (state) address.state = state
  if (countryID) address.countryID = countryID

  const searchUrl = `${restUrl}search/ClientContact?BhRestToken=${bhRestToken}&query=email:"${contact.email}"&fields=id,firstName,lastName`
  const searchResponse = await bullhornFetch(searchUrl)
  
  if (searchResponse.ok) {
    const searchData = await searchResponse.json()
    if (searchData.data && searchData.data.length > 0) {
      const existingId = searchData.data[0].id
      console.log(`Updating existing contact ID ${existingId}: ${fullName}`)
      
      const updateUrl = `${restUrl}entity/ClientContact/${existingId}?BhRestToken=${bhRestToken}`
      const updatePayload: Record<string, any> = {
        name: fullName,
        firstName,
        lastName,
        occupation,
        address,
        clientCorporation: { id: clientCorporationId },
      }
      updatePayload[skillsFieldName] = skillsString
      
      const updateResponse = await bullhornFetch(updateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        console.error(`Failed to update contact ${existingId}: ${errorText}`)
      } else {
        console.log(`Updated contact ${existingId} with skills in ${skillsFieldName}: ${skillsString}`)
      }
      
      return existingId
    }
  }

  console.log(`Creating new contact: ${fullName}`)
  
  const createUrl = `${restUrl}entity/ClientContact?BhRestToken=${bhRestToken}`
  const createPayload: Record<string, any> = {
    name: fullName,
    firstName,
    lastName,
    email: contact.email,
    occupation,
    address,
    status: 'Active',
    clientCorporation: { id: clientCorporationId },
  }
  createPayload[skillsFieldName] = skillsString
  
  console.log(`Create payload: ${JSON.stringify(createPayload)}`)
  
  const createResponse = await bullhornFetch(createUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createPayload),
  })

  if (!createResponse.ok) {
    const errorText = await createResponse.text()
    throw new Error(`Failed to create ClientContact: ${errorText}`)
  }

  const createData = await createResponse.json()
  console.log(`Created contact ID ${createData.changedEntityId}: ${fullName}`)
  return createData.changedEntityId
}

async function createDistributionList(
  restUrl: string,
  bhRestToken: string,
  listName: string,
  contactIds: number[]
): Promise<number> {
  console.log(`Creating Distribution List: ${listName} with ${contactIds.length} contacts`)
  
  // Step 1: Create a DistributionList (NOT Tearsheet - Tearsheet = Hotlists)
  // DistributionList is the entity that appears under Menu > Distribution Lists
  const createListUrl = `${restUrl}entity/DistributionList?BhRestToken=${bhRestToken}`
  const listResponse = await bullhornFetch(createListUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: listName,
      description: `Auto-generated distribution list from contact search`,
    }),
  })

  if (!listResponse.ok) {
    const errorText = await listResponse.text()
    console.error(`Failed to create DistributionList: ${errorText}`)
    // Fallback to Tearsheet if DistributionList entity is not available
    console.log('Falling back to Tearsheet creation...')
    return await createDistributionListViaTearsheet(restUrl, bhRestToken, listName, contactIds)
  }

  const listData = await listResponse.json()
  const listId = listData.changedEntityId
  console.log(`DistributionList created with ID: ${listId}`)

  // Step 2: Add contacts as DistributionListMembers
  console.log(`Adding ${contactIds.length} contacts as DistributionListMembers...`)
  let successCount = 0
  
  for (const contactId of contactIds) {
    try {
      // Create DistributionListMember entry - this links contacts to the Distribution List
      const memberUrl = `${restUrl}entity/DistributionListMember?BhRestToken=${bhRestToken}`
      const memberResponse = await bullhornFetch(memberUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributionList: { id: listId },
          person: { id: contactId },
        }),
      })
      
      if (memberResponse.ok) {
        successCount++
        console.log(`Added DistributionListMember for contact ${contactId}`)
      } else {
        const errorText = await memberResponse.text()
        console.error(`Failed to add DistributionListMember for contact ${contactId}: ${errorText}`)
      }
    } catch (err: any) {
      console.error(`Error adding contact ${contactId}: ${err.message}`)
    }
    
    // Small delay to avoid rate limiting
    await sleep(100)
  }
  
  console.log(`Successfully added ${successCount}/${contactIds.length} contacts to distribution list ${listId}`)
  return listId
}

// Fallback function using Tearsheet (in case DistributionList entity is not available in some Bullhorn instances)
async function createDistributionListViaTearsheet(
  restUrl: string,
  bhRestToken: string,
  listName: string,
  contactIds: number[]
): Promise<number> {
  console.log(`Creating Tearsheet as fallback: ${listName} with ${contactIds.length} contacts`)
  
  const createTearsheetUrl = `${restUrl}entity/Tearsheet?BhRestToken=${bhRestToken}`
  const tearsheetResponse = await bullhornFetch(createTearsheetUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: listName,
      description: `Auto-generated from contact search (fallback)`,
      isPrivate: false,
    }),
  })

  if (!tearsheetResponse.ok) {
    const errorText = await tearsheetResponse.text()
    throw new Error(`Failed to create tearsheet: ${errorText}`)
  }

  const tearsheetData = await tearsheetResponse.json()
  const tearsheetId = tearsheetData.changedEntityId
  console.log(`Tearsheet created with ID: ${tearsheetId}`)

  // Add contacts as TearsheetRecipients
  console.log(`Adding ${contactIds.length} contacts as TearsheetRecipients...`)
  let successCount = 0
  
  for (const contactId of contactIds) {
    try {
      const recipientUrl = `${restUrl}entity/TearsheetRecipient?BhRestToken=${bhRestToken}`
      const recipientResponse = await bullhornFetch(recipientUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tearsheet: { id: tearsheetId },
          person: { id: contactId },
          comments: 'Added via automated contact search export',
        }),
      })
      
      if (recipientResponse.ok) {
        successCount++
      } else {
        const errorText = await recipientResponse.text()
        console.error(`Failed to add TearsheetRecipient for contact ${contactId}: ${errorText}`)
      }
    } catch (err: any) {
      console.error(`Error adding contact ${contactId}: ${err.message}`)
    }
    
    await sleep(100)
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

    const searchPreferences = run.preferences_data as SearchPreference | undefined

    console.log('Fetching stored Bullhorn tokens...')
    const tokens = await getStoredBullhornTokens(supabase)
    
    if (!tokens) {
      throw new Error('Bullhorn not connected. Please connect via Settings → Bullhorn → Connect to Bullhorn.')
    }
    console.log('Bullhorn tokens retrieved successfully')

    // Detect the correct skills field name
    const skillsFieldName = await getSkillsFieldName(tokens.restUrl, tokens.bhRestToken)
    console.log(`Using skills field: ${skillsFieldName}`)

    const candidateName = (run.candidates_data as any[])?.[0]?.name || 'Unknown'
    const runDate = new Date(run.created_at)
    const listName = `${runDate.toISOString().slice(0, 10)}_${runDate.toISOString().slice(11, 16).replace(':', '-')}_${candidateName.replace(/[^a-zA-Z0-9]/g, '_')}`

    console.log(`Creating/updating ${contacts.length} ClientContacts...`)
    const contactIds: number[] = []
    const errors: string[] = []
    
    const companyCache: Record<string, number> = {}

    for (const contact of contacts) {
      try {
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
        
        const skillsString = generateSkillsString(contact, searchPreferences)
        console.log(`Skills for ${contact.name}: ${skillsString || '(none)'}`)
        
        const contactId = await findOrCreateClientContact(
          tokens.restUrl,
          tokens.bhRestToken,
          contact,
          clientCorporationId,
          skillsString,
          skillsFieldName
        )
        contactIds.push(contactId)
      } catch (error: any) {
        console.error(`Error creating contact ${contact.email}:`, error.message)
        errors.push(`${contact.email}: ${error.message}`)
      }
      // Small delay between contacts
      await sleep(150)
    }

    if (contactIds.length === 0) {
      throw new Error('Failed to create any contacts in Bullhorn')
    }

    console.log(`Creating distribution list: ${listName}`)
    const tearsheetId = await createDistributionList(
      tokens.restUrl,
      tokens.bhRestToken,
      listName,
      contactIds
    )
    console.log(`Distribution list created with ID: ${tearsheetId}`)

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
