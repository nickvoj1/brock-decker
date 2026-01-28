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
  industry?: string
  industries?: string[]
  sectors?: string[]
  roles?: string[]
  targetRoles?: string[]
  locations?: string[]
  location?: string
}

function normalizePreferences(raw: unknown): SearchPreference | undefined {
  const anyRaw = raw as any
  if (!anyRaw) return undefined

  // Stored as an array of per-industry preference objects in DB
  if (Array.isArray(anyRaw)) {
    const first = anyRaw[0] || {}
    const industries = anyRaw.map((p: any) => p?.industry).filter(Boolean)
    return {
      ...first,
      industries: industries.length ? industries : first.industries,
    } as SearchPreference
  }

  return anyRaw as SearchPreference
}

// Skills mapping based on Bullhorn patterns - EXPANDED for 4+ skills per contact

// Direct industry name to skill mapping (from search preferences)
const INDUSTRY_DIRECT_SKILLS: Record<string, string[]> = {
  'real estate': ['RE', 'PROPERTY'],
  'capital markets': ['CAP MKTS', 'FIN SVCS'],
  'private equity': ['PE', 'BUY SIDE'],
  'private equity (pe)': ['PE', 'BUY SIDE'],
  'venture capital': ['VC', 'GROWTH'],
  'venture capital (vc)': ['VC', 'GROWTH'],
  'investment banking': ['IB', 'FIN SVCS'],
  'management consulting': ['CONSULTING', 'ADVISORY'],
  'hedge fund': ['HEDGE FUND', 'BUY SIDE'],
  'asset management': ['ASSET MAN', 'BUY SIDE'],
  'infrastructure': ['INFRA', 'RE'],
  'corporate finance': ['CORP FIN', 'FIN SVCS'],
  'wealth management': ['WEALTH MAN', 'FIN SVCS'],
  'family office': ['FAMILY OFFICE', 'WEALTH MAN'],
}

// Sector to skill mapping
const SECTOR_SKILLS: Record<string, string[]> = {
  'real estate & construction': ['RE', 'PROPERTY'],
  'financial services': ['FIN SVCS'],
  'technology': ['TECH'],
  'healthcare': ['HEALTHCARE'],
  'energy': ['ENERGY'],
  'industrials': ['INDUSTRIALS'],
  'consumer': ['CONSUMER'],
  'media': ['MEDIA'],
  'telecommunications': ['TELECOM'],
  'retail': ['RETAIL'],
}

// Skills mapping based on Bullhorn patterns
const INDUSTRY_SKILLS: Record<string, string[]> = {
  'private equity': ['PE'],
  'venture capital': ['VC'],
  'hedge fund': ['HEDGE FUND'],
  'investment bank': ['IB'],
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
  'real estate': ['RE'],
  'property': ['RE', 'PROPERTY'],
  'infrastructure': ['INFRA'],
  'credit': ['CREDIT'],
  'distressed': ['DISTRESSED'],
  'growth equity': ['GROWTH'],
  'buyout': ['LBO'],
}

const LOCATION_SKILLS: Record<string, string[]> = {
  'london': ['UK', 'LONDON'],
  'united kingdom': ['UK'],
  'uk': ['UK'],
  'england': ['UK'],
  'frankfurt': ['DACH', 'GERMANY'],
  'munich': ['DACH', 'GERMANY'],
  'berlin': ['DACH', 'GERMANY'],
  'germany': ['DACH', 'GERMANY'],
  'dach': ['DACH'],
  'zurich': ['SWISS', 'DACH'],
  'geneva': ['SWISS', 'DACH'],
  'switzerland': ['SWISS', 'DACH'],
  'dubai': ['UAE', 'MENA'],
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
  'rome': ['ITALY'],
  'madrid': ['SPAIN'],
  'spain': ['SPAIN'],
  'new york': ['NYC', 'US'],
  'nyc': ['NYC', 'US'],
  'boston': ['US', 'NORTHEAST'],
  'chicago': ['US', 'MIDWEST'],
  'san francisco': ['US', 'WEST COAST'],
  'los angeles': ['US', 'WEST COAST'],
  'texas': ['US', 'SOUTH'],
  'dallas': ['US', 'SOUTH'],
  'houston': ['US', 'SOUTH'],
  'atlanta': ['US', 'SOUTH'],
  'miami': ['US', 'SOUTH'],
  'united states': ['US'],
  'usa': ['US'],
  'singapore': ['APAC', 'SINGAPORE'],
  'hong kong': ['APAC', 'HK'],
  'tokyo': ['APAC', 'JAPAN'],
  'australia': ['APAC', 'ANZ'],
  'sydney': ['APAC', 'ANZ'],
}

const ROLE_SKILLS: Record<string, string[]> = {
  // Leadership
  'head': ['HEAD', 'SENIOR'],
  'director': ['HEAD', 'SENIOR'],
  'partner': ['HEAD', 'SENIOR', 'PARTNER'],
  'managing partner': ['HEAD', 'SENIOR', 'PARTNER', 'MP'],
  'senior partner': ['HEAD', 'SENIOR', 'PARTNER'],
  'equity partner': ['HEAD', 'SENIOR', 'PARTNER'],
  'managing director': ['HEAD', 'MD'],
  'md': ['HEAD', 'MD'],
  'principal': ['HEAD', 'SENIOR'],
  'vice president': ['VP'],
  'vp': ['VP'],
  'svp': ['VP', 'SENIOR'],
  'evp': ['VP', 'SENIOR', 'C-SUITE'],
  'senior': ['SENIOR'],
  'associate': ['ASSOCIATE'],
  'analyst': ['ANALYST'],
  'manager': ['MANAGER'],
  // Investment
  'portfolio manager': ['PM', 'BUY SIDE'],
  'investment manager': ['IM', 'BUY SIDE'],
  'fund manager': ['FM', 'BUY SIDE'],
  'buy side': ['BUY SIDE'],
  'buyside': ['BUY SIDE'],
  'growth': ['GROWTH'],
  'fundraising': ['FUNDRAISING', 'IR'],
  'investor relations': ['IR', 'FUNDRAISING'],
  'ir': ['IR'],
  // C-Suite
  'cfo': ['CFO', 'C-SUITE'],
  'ceo': ['CEO', 'C-SUITE'],
  'coo': ['COO', 'C-SUITE'],
  'cio': ['CIO', 'C-SUITE'],
  'cto': ['CTO', 'C-SUITE'],
  'chief': ['C-SUITE'],
  'founder': ['FOUNDER', 'C-SUITE'],
  'co-founder': ['FOUNDER', 'C-SUITE'],
  // HR & Talent
  'hr': ['HR', 'TALENT'],
  'human resources': ['HR', 'TALENT'],
  'talent': ['TALENT', 'HR'],
  'recruiting': ['TALENT', 'HR'],
  'recruiter': ['TALENT', 'HR'],
  // Legal
  'general counsel': ['LEGAL', 'GC', 'C-SUITE'],
  'gc': ['LEGAL', 'GC'],
  'legal counsel': ['LEGAL'],
  'counsel': ['LEGAL'],
  'attorney': ['LEGAL'],
  'lawyer': ['LEGAL'],
  'legal director': ['LEGAL', 'HEAD'],
  'head of legal': ['LEGAL', 'HEAD'],
  'chief legal officer': ['LEGAL', 'CLO', 'C-SUITE'],
  'clo': ['LEGAL', 'CLO', 'C-SUITE'],
  'compliance': ['COMPLIANCE', 'LEGAL'],
  'regulatory': ['REGULATORY', 'COMPLIANCE'],
  // Operations & Strategy
  'operations': ['OPS'],
  'strategy': ['STRATEGY'],
  'business development': ['BD'],
  'bd': ['BD'],
  'corporate development': ['CORP DEV', 'M&A'],
}

function generateSkillsString(
  contact: ApolloContact,
  searchPreferences?: SearchPreference
): string {
  const skills = new Set<string>()

  // 1. Match from search preferences - direct industry mapping
  if (searchPreferences?.industry) {
    const lowerIndustry = searchPreferences.industry.toLowerCase()
    for (const [keyword, skillCodes] of Object.entries(INDUSTRY_DIRECT_SKILLS)) {
      if (lowerIndustry.includes(keyword) || keyword.includes(lowerIndustry)) {
        skillCodes.forEach(s => skills.add(s))
      }
    }
  }

  // 2. Match from industries array in preferences
  if (searchPreferences?.industries) {
    for (const industry of searchPreferences.industries) {
      const lowerIndustry = industry.toLowerCase()
      for (const [keyword, skillCodes] of Object.entries(INDUSTRY_DIRECT_SKILLS)) {
        if (lowerIndustry.includes(keyword) || keyword.includes(lowerIndustry)) {
          skillCodes.forEach(s => skills.add(s))
        }
      }
      for (const [keyword, skillCodes] of Object.entries(INDUSTRY_SKILLS)) {
        if (lowerIndustry.includes(keyword) || keyword.includes(lowerIndustry)) {
          skillCodes.forEach(s => skills.add(s))
        }
      }
    }
  }

  // 3. Match from sectors in preferences
  if (searchPreferences?.sectors) {
    for (const sector of searchPreferences.sectors) {
      const lowerSector = sector.toLowerCase()
      for (const [keyword, skillCodes] of Object.entries(SECTOR_SKILLS)) {
        if (lowerSector.includes(keyword) || keyword.includes(lowerSector)) {
          skillCodes.forEach(s => skills.add(s))
        }
      }
    }
  }

  // 4. Match from company name
  const companyLower = contact.company?.toLowerCase() || ''
  for (const [keyword, skillCodes] of Object.entries(INDUSTRY_SKILLS)) {
    if (companyLower.includes(keyword)) {
      skillCodes.forEach(s => skills.add(s))
    }
  }

  // 5. Match from contact location AND extract city name
  const locationLower = contact.location?.toLowerCase() || ''
  for (const [keyword, skillCodes] of Object.entries(LOCATION_SKILLS)) {
    if (locationLower.includes(keyword)) {
      skillCodes.forEach(s => skills.add(s))
    }
  }

  // 5b. ALWAYS add a city identifier (first segment of location)
  if (contact.location) {
    const city = contact.location.split(',')[0]?.trim()
    if (city) skills.add(city.toUpperCase())
  }

  // 6. Match from search preference locations
  if (searchPreferences?.locations) {
    for (const loc of searchPreferences.locations) {
      const lowerLoc = loc.toLowerCase()
      for (const [keyword, skillCodes] of Object.entries(LOCATION_SKILLS)) {
        if (lowerLoc.includes(keyword) || keyword.includes(lowerLoc)) {
          skillCodes.forEach(s => skills.add(s))
        }
      }
    }
  }

  // 7. Match from title (role-based skills)
  const titleLower = contact.title?.toLowerCase() || ''
  for (const [keyword, skillCodes] of Object.entries(ROLE_SKILLS)) {
    if (titleLower.includes(keyword)) {
      skillCodes.forEach(s => skills.add(s))
    }
  }

  // 8. Match from target roles in preferences (adds context about search intent)
  if (searchPreferences?.targetRoles) {
    for (const role of searchPreferences.targetRoles) {
      const lowerRole = role.toLowerCase()
      for (const [keyword, skillCodes] of Object.entries(ROLE_SKILLS)) {
        if (lowerRole.includes(keyword) || keyword.includes(lowerRole)) {
          skillCodes.forEach(s => skills.add(s))
        }
      }
    }
  }

  // Return semicolon-separated unique skills (Bullhorn requires semicolons for Skills Count to work)
  return Array.from(skills).join(' ; ')
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

  // Calculate skills count from semicolon-separated skills string (Bullhorn requires semicolons)
  const skillsArray = skillsString ? skillsString.split(' ; ').map(s => s.trim()).filter(Boolean) : []
  const skillsCount = skillsArray.length

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
  // Set skills text field
      updatePayload[skillsFieldName] = skillsString
      // Also set customText1 (max 100 chars in Bullhorn) and customInt1 for skills count
      updatePayload.customText1 = skillsString.substring(0, 100)
      updatePayload.customInt1 = skillsCount
      
      const updateResponse = await bullhornFetch(updateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        console.error(`Failed to update contact ${existingId}: ${errorText}`)
      } else {
        console.log(`Updated contact ${existingId} with skills in ${skillsFieldName}: ${skillsString} (count: ${skillsCount})`)
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
  // Set skills text field
  createPayload[skillsFieldName] = skillsString
  // Also set customText1 (max 100 chars in Bullhorn) and customInt1 for skills count
  createPayload.customText1 = skillsString.substring(0, 100)
  createPayload.customInt1 = skillsCount
  
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
  console.log(`Created contact ID ${createData.changedEntityId}: ${fullName} (skills count: ${skillsCount})`)
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

    // IMPORTANT: We must NEVER fall back to Tearsheet/Hotlists.
    // Bullhorn explicitly blocks DistributionList via external API unless the instance has
    // the internal API feature enabled / partner entitlements.
    if (errorText.includes("bhInternalApi") || errorText.includes('errors.featureDisabled') || errorText.includes('"errorCode":403')) {
      throw new Error(
        "Bullhorn blocked Distribution Lists via API (Feature 'bhInternalApi' not enabled). This Bullhorn instance cannot create Distribution Lists through the external API. Please ask your Bullhorn admin/support to enable Distribution Lists API access (partner/internal API entitlements), then retry export."
      )
    }

    throw new Error(
      `Bullhorn could not create a Distribution List. Export was stopped to avoid creating a Hotlist instead. Details: ${errorText}`
    )
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

async function assertDistributionListsApiAvailable(restUrl: string, bhRestToken: string): Promise<void> {
  // Fast preflight check to avoid doing work (creating contacts) when Distribution Lists
  // are not available for this Bullhorn instance.
  const metaUrl = `${restUrl}meta/DistributionList?BhRestToken=${encodeURIComponent(bhRestToken)}`
  const res = await bullhornFetch(metaUrl)

  if (res.ok) {
    // Consume body
    await res.text()
    return
  }

  const errorText = await res.text()
  if (errorText.includes("bhInternalApi") || errorText.includes('errors.featureDisabled') || errorText.includes('"errorCode":403')) {
    throw new Error(
      "Bullhorn blocked Distribution Lists via API (Feature 'bhInternalApi' not enabled). This Bullhorn instance cannot create Distribution Lists through the external API. Please ask your Bullhorn admin/support to enable Distribution Lists API access (partner/internal API entitlements), then retry export."
    )
  }

  throw new Error(`Distribution Lists API is not available in this Bullhorn instance. Details: ${errorText}`)
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

    const searchPreferences = normalizePreferences(run.preferences_data)

    console.log('Fetching stored Bullhorn tokens...')
    const tokens = await getStoredBullhornTokens(supabase)
    
    if (!tokens) {
      throw new Error('Bullhorn not connected. Please connect via Settings → Bullhorn → Connect to Bullhorn.')
    }
    console.log('Bullhorn tokens retrieved successfully')

    // TEMPORARILY DISABLED: Distribution Lists API check - waiting for Bullhorn to enable access
    // TODO: Re-enable when Bullhorn grants Distribution Lists API access
    // await assertDistributionListsApiAvailable(tokens.restUrl, tokens.bhRestToken)

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

    // TEMPORARILY DISABLED: Distribution List creation - waiting for Bullhorn to enable access
    // TODO: Re-enable when Bullhorn grants Distribution Lists API access
    // console.log(`Creating distribution list: ${listName}`)
    // const listId = await createDistributionList(
    //   tokens.restUrl,
    //   tokens.bhRestToken,
    //   listName,
    //   contactIds
    // )
    // console.log(`Distribution list created with ID: ${listId}`)
    const listId = null // Placeholder until Distribution Lists are enabled
    console.log(`Contacts exported to Bullhorn (Distribution List creation disabled pending API access)`)

    await supabase
      .from('enrichment_runs')
      .update({
        bullhorn_list_name: listName,
        bullhorn_list_id: listId,
        bullhorn_exported_at: new Date().toISOString(),
        bullhorn_errors: errors.length > 0 ? errors : null,
      })
      .eq('id', runId)

    return new Response(
      JSON.stringify({
        success: true,
        listName,
        listId,
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
