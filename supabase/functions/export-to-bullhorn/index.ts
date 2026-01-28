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

// Skills mapping using EXACT Bullhorn Skill entity names
// These MUST match the skill names in the Bullhorn Skill table for association to work

// Direct industry name to skill mapping (from search preferences)
const INDUSTRY_DIRECT_SKILLS: Record<string, string[]> = {
  'real estate': ['AREC', 'CONSTRUCTION'],
  'capital markets': ['CAPITAL MARKETS'],
  'private equity': ['BUY SIDE', 'CORP M&A'],
  'private equity (pe)': ['BUY SIDE', 'CORP M&A'],
  'venture capital': ['CORP VC', 'BUY SIDE'],
  'venture capital (vc)': ['CORP VC', 'BUY SIDE'],
  'investment banking': ['CORPORATE BANKING', 'CAPITAL MARKETS'],
  'management consulting': ['CONSULT', 'ADVISORY INVESMENT'],
  'hedge fund': ['BUY SIDE', 'ALT INVESTMENT'],
  'asset management': ['ASS MAN', 'BUY SIDE'],
  'infrastructure': ['CONSTRUCTION', 'CAPITAL GOODS'],
  'corporate finance': ['CORP FIN', 'CORPORATE BANKING'],
  'wealth management': ['AFFLUENT BANKING', 'ADVISORY INVESMENT'],
  'family office': ['AFFLUENT BANKING', 'BUY SIDE'],
  'private credit': ['CREDIT', 'Debt', 'BUY SIDE'],
  'credit': ['CREDIT', 'Debt'],
  'distressed': ['CREDIT', 'BANKRUPCY', 'Debt'],
}

// Sector to skill mapping
const SECTOR_SKILLS: Record<string, string[]> = {
  'real estate & construction': ['AREC', 'CONSTRUCTION'],
  'financial services': ['CORPORATE BANKING', 'CAPITAL MARKETS'],
  'technology': ['DATA', 'AUTOMATION'],
  'healthcare': ['CLINICAL', 'BIOTEC'],
  'energy': ['ATOMIC ENERGY', 'CLEANTECH'],
  'industrials': ['CAPITAL GOODS', 'AUTOMATION'],
  'consumer': ['CONSUMER GOOD', 'B2C'],
  'media': ['COMMUNICATION', 'ADVERTISING'],
  'telecommunications': ['COMMUNICATION'],
  'retail': ['B2C', 'CONSUMER GOOD'],
}

// Skills mapping based on Bullhorn Skill entity names
const INDUSTRY_SKILLS: Record<string, string[]> = {
  'private equity': ['BUY SIDE'],
  'venture capital': ['CORP VC'],
  'hedge fund': ['BUY SIDE', 'ALT INVESTMENT'],
  'investment bank': ['CORPORATE BANKING'],
  'asset management': ['ASS MAN'],
  'mergers': ['CORP M&A'],
  'acquisitions': ['CORP M&A', 'ACQUISITION FINANCE'],
  'm&a': ['CORP M&A'],
  'leveraged buyout': ['Debt', 'BUY SIDE'],
  'lbo': ['Debt', 'BUY SIDE'],
  'debt capital': ['DCM', 'Debt'],
  'dcm': ['DCM'],
  'consulting': ['CONSULT'],
  'management consulting': ['CONSULT'],
  'real estate': ['AREC'],
  'property': ['AREC', 'CONSTRUCTION'],
  'infrastructure': ['CONSTRUCTION', 'CAPITAL GOODS'],
  'credit': ['CREDIT', 'Debt'],
  'distressed': ['CREDIT', 'BANKRUPCY'],
  'growth equity': ['BUY SIDE', 'CORP VC'],
  'buyout': ['BUY SIDE', 'Debt'],
  'commodities': ['COMMODITIES'],
  'derivatives': ['CDS', 'CVA'],
  'trading': ['DEALER'],
  'bonds': ['BOND', 'Debt'],
  'fixed income': ['BOND', 'Debt'],
  'equities': ['CAPITAL MARKETS'],
  'crypto': ['CRYPTO', 'BLOCKCHAIN'],
  'blockchain': ['BLOCKCHAIN'],
  'fintech': ['AUTOMATION', 'DATA'],
  'insurance': ['ASSURANCE'],
  'banking': ['BANK', 'CORPORATE BANKING'],
  'clearing': ['CLEARING', 'CUSTODY'],
  'custody': ['CUSTODY'],
}

const LOCATION_SKILLS: Record<string, string[]> = {
  // Europe
  'london': ['LONDON'],
  'united kingdom': ['LONDON'],
  'uk': ['LONDON'],
  'england': ['LONDON'],
  'frankfurt': ['DACH', 'FRANKFURT'],
  'munich': ['DACH'],
  'berlin': ['BERLIN', 'DACH'],
  'germany': ['DACH'],
  'dach': ['DACH'],
  'zurich': ['DACH', 'BASEL'],
  'geneva': ['DACH'],
  'switzerland': ['DACH', 'BASEL'],
  'dubai': ['ABU DHABI'],
  'abu dhabi': ['ABU DHABI'],
  'uae': ['ABU DHABI'],
  'stockholm': ['COPENHAGEN'],
  'oslo': ['COPENHAGEN'],
  'copenhagen': ['COPENHAGEN'],
  'helsinki': ['COPENHAGEN'],
  'nordics': ['COPENHAGEN'],
  'amsterdam': ['AMSTERDAM', 'BENELUX'],
  'brussels': ['BRUSSEL', 'BENELUX'],
  'benelux': ['BENELUX', 'AMSTERDAM'],
  'paris': ['PARIS'],
  'france': ['PARIS'],
  'milan': ['MILAN'],
  'italy': ['MILAN'],
  'rome': ['MILAN'],
  'madrid': ['BARCELONA'],
  'spain': ['BARCELONA'],
  'barcelona': ['BARCELONA'],
  // Americas
  'new york': ['NEW YORK', 'AMERICAS'],
  'nyc': ['NEW YORK', 'AMERICAS'],
  'boston': ['Boston', 'AMERICAS'],
  'chicago': ['CHICAGO', 'AMERICAS'],
  'san francisco': ['California', 'AMERICAS'],
  'los angeles': ['California', 'AMERICAS'],
  'texas': ['DALLAS', 'AMERICAS'],
  'dallas': ['DALLAS', 'AMERICAS'],
  'houston': ['DALLAS', 'AMERICAS'],
  'atlanta': ['ATL', 'AMERICAS'],
  'miami': ['AMERICAS'],
  'charlotte': ['CHARLOTTE', 'AMERICAS'],
  'united states': ['AMERICAS'],
  'usa': ['AMERICAS'],
  'canada': ['CANADA', 'AMERICAS'],
  'brazil': ['BRAZIL', 'AMERICAS'],
  // APAC
  'singapore': ['APAC', 'ASIA'],
  'hong kong': ['APAC', 'ASIA', 'CHINA'],
  'tokyo': ['APAC', 'ASIA'],
  'japan': ['APAC', 'ASIA'],
  'australia': ['AUSTRALIA', 'APAC'],
  'sydney': ['AUSTRALIA', 'APAC'],
  'china': ['CHINA', 'APAC', 'ASIA'],
  'beijing': ['BEIJING', 'CHINA', 'APAC'],
  'bangkok': ['BANGKOK', 'APAC'],
  'asia': ['ASIA', 'APAC'],
  // Middle East / Africa
  'bahrain': ['BAHRAIN'],
  'cairo': ['CAIRO', 'AFRICA'],
  'africa': ['AFRICA', 'AFRICAN'],
  // CEE
  'czech republic': ['CZECH REPUBLIC', 'CEE'],
  'poland': ['CEE'],
  'hungary': ['CEE'],
  'romania': ['CEE'],
  'bulgaria': ['BULGARIA', 'CEE'],
  'croatia': ['CROATIA', 'CEE'],
}

const ROLE_SKILLS: Record<string, string[]> = {
  // Leadership
  'head': ['BUSINESS'],
  'director': ['BUSINESS'],
  'partner': ['BUSINESS', 'BOUTIQUE'],
  'managing partner': ['BUSINESS', 'BOUTIQUE'],
  'senior partner': ['BUSINESS', 'BOUTIQUE'],
  'equity partner': ['BUSINESS', 'BOUTIQUE'],
  'managing director': ['BUSINESS'],
  'md': ['BUSINESS'],
  'principal': ['BUSINESS'],
  'vice president': ['BUSINESS'],
  'vp': ['BUSINESS'],
  'svp': ['BUSINESS'],
  'evp': ['BUSINESS'],
  'senior': ['BUSINESS'],
  'associate': ['BUSINESS'],
  'analyst': ['ANALYSIS'],
  'manager': ['BUSINESS'],
  // Investment
  'portfolio manager': ['BUY SIDE', 'ASS MAN'],
  'investment manager': ['BUY SIDE', 'ASS MAN'],
  'fund manager': ['BUY SIDE', 'ASS MAN'],
  'buy side': ['BUY SIDE'],
  'buyside': ['BUY SIDE'],
  'growth': ['CORP VC'],
  'fundraising': ['Capital Formation'],
  'investor relations': ['Capital Formation'],
  'ir': ['Capital Formation'],
  // C-Suite
  'cfo': ['CORP FIN', 'ACCOUNTING'],
  'ceo': ['BUSINESS'],
  'coo': ['CONTROL', 'BUSINESS'],
  'cio': ['DATA', 'BUSINESS'],
  'cto': ['DATA', 'AUTOMATION'],
  'chief': ['BUSINESS'],
  'founder': ['BUSINESS'],
  'co-founder': ['BUSINESS'],
  // HR & Talent
  'hr': ['C&B', 'COMPENSATION'],
  'human resources': ['C&B', 'COMPENSATION'],
  'talent': ['C&B'],
  'recruiting': ['C&B'],
  'recruiter': ['C&B'],
  // Legal
  'general counsel': ['COMPLIANCE', 'ARBITRATION'],
  'gc': ['COMPLIANCE'],
  'legal counsel': ['COMPLIANCE', 'ARBITRATION'],
  'counsel': ['COMPLIANCE'],
  'attorney': ['ARBITRATION'],
  'lawyer': ['ARBITRATION'],
  'legal director': ['COMPLIANCE'],
  'head of legal': ['COMPLIANCE'],
  'chief legal officer': ['COMPLIANCE'],
  'clo': ['COMPLIANCE'],
  'compliance': ['COMPLIANCE', 'CENTRAL COMPLIANCE'],
  'regulatory': ['COMPLIANCE', 'CONDUCT RISK'],
  // Operations & Strategy
  'operations': ['CONTROL', 'BACK OFFICE'],
  'strategy': ['CORP STRATEGY'],
  'business development': ['BUS DEV'],
  'bd': ['BUS DEV'],
  'corporate development': ['CORP DEV', 'CORP M&A'],
  // Risk
  'risk': ['CYBER RISK', 'CONDUCT RISK'],
  'audit': ['AUDIT', 'CONTROL'],
  // Tech
  'developer': ['APPLICATION DEVELOPER'],
  'engineer': ['APPLICATION DEVELOPER', 'AUTOMATION'],
  'data': ['DATA', 'DATASCIENCE', 'BIG DATA'],
  'cloud': ['CLOUD', 'AWS', 'AZURE'],
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
let cachedHasDesiredSkillsField: boolean | null = null
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

    const hasDesiredSkills = Boolean(fields.find((f) => f?.name === 'desiredSkills'))
    cachedHasDesiredSkillsField = hasDesiredSkills

    // Prefer a custom field labeled "Skills" (or containing "skills") if it exists.
    // In many Bullhorn instances, the standard desiredSkills field exists but is not shown on the UI.
    const customSkillsField = fields.find((f) => {
      const label = String(f?.label || '').toLowerCase()
      return label === 'skills' || label.includes('skills')
    })

    if (customSkillsField?.name) {
      cachedSkillsFieldName = customSkillsField.name
      console.log(`Detected custom skills field: ${customSkillsField.name} (label: ${customSkillsField.label})`)
      return customSkillsField.name
    }

    // Try lowercase "skills" field first (some Bullhorn instances use this)
    const lowerSkillsField = fields.find((f) => f?.name === 'skills')
    if (lowerSkillsField) {
      cachedSkillsFieldName = 'skills'
      console.log('Using lowercase Bullhorn field: skills')
      return 'skills'
    }

    // Fall back to desiredSkills if available
    if (hasDesiredSkills) {
      cachedSkillsFieldName = 'desiredSkills'
      console.log('Using standard Bullhorn field: desiredSkills')
      return 'desiredSkills'
    }
  } catch (e) {
    console.error('Error detecting skills field:', e)
  }

  // Default to lowercase "skills" first, then fallback
  console.log('Using default skills field: skills')
  return 'skills'
}

// Cache for skill IDs
const skillIdCache: Record<string, number | null> = {}

async function lookupSkillId(
  restUrl: string,
  bhRestToken: string,
  skillName: string
): Promise<number | null> {
  const cacheKey = skillName.toUpperCase().trim()
  if (cacheKey in skillIdCache) {
    return skillIdCache[cacheKey]
  }

  try {
    // Search for skill by name
    const searchUrl = `${restUrl}search/Skill?BhRestToken=${encodeURIComponent(bhRestToken)}&query=name:"${encodeURIComponent(skillName)}"&fields=id,name&count=1`
    const res = await bullhornFetch(searchUrl)

    if (!res.ok) {
      await res.text()
      skillIdCache[cacheKey] = null
      return null
    }

    const data = await res.json()
    if (data?.data && data.data.length > 0) {
      const skillId = data.data[0].id
      skillIdCache[cacheKey] = skillId
      return skillId
    }

    // Skill doesn't exist in Bullhorn, cache as null
    skillIdCache[cacheKey] = null
    return null
  } catch (e) {
    console.error(`Error looking up skill "${skillName}":`, e)
    skillIdCache[cacheKey] = null
    return null
  }
}

async function associateSkillsWithContact(
  restUrl: string,
  bhRestToken: string,
  contactId: number,
  skillsString: string
): Promise<number> {
  if (!skillsString) return 0

  const skillNames = skillsString.split(' ; ').map(s => s.trim()).filter(Boolean)
  if (skillNames.length === 0) return 0

  // Look up skill IDs in parallel
  const skillIdPromises = skillNames.map(name => lookupSkillId(restUrl, bhRestToken, name))
  const skillIdResults = await Promise.all(skillIdPromises)

  // Filter to valid skill IDs
  const validSkillIds = skillIdResults.filter((id): id is number => id !== null)

  if (validSkillIds.length === 0) {
    console.log(`No valid skill IDs found for contact ${contactId} (skills: ${skillNames.join(', ')})`)
    return 0
  }

  // Associate skills with the contact using PUT /association endpoint
  // PUT /association/ClientContact/{entityId}/primarySkills/{associatedEntityIds}
  const associationUrl = `${restUrl}association/ClientContact/${contactId}/primarySkills/${validSkillIds.join(',')}?BhRestToken=${encodeURIComponent(bhRestToken)}`

  const res = await bullhornFetch(associationUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`Failed to associate skills with contact ${contactId}: ${errorText}`)
    return 0
  }

  console.log(`Associated ${validSkillIds.length} skills with contact ${contactId} (IDs: ${validSkillIds.join(', ')})`)
  return validSkillIds.length
}

async function findOrCreateClientContact(
  restUrl: string,
  bhRestToken: string,
  contact: ApolloContact,
  clientCorporationId: number,
  skillsString: string,
  skillsFieldName: string
): Promise<{ contactId: number; skillsString: string }> {
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
      // Set skills text field (for CSV compatibility/display)
      updatePayload[skillsFieldName] = skillsString
      // If we detected desiredSkills exists but we're writing into a custom UI field,
      // also populate desiredSkills so the data remains consistent across layouts.
      if (skillsFieldName !== 'desiredSkills' && cachedHasDesiredSkillsField) {
        updatePayload.desiredSkills = skillsString
      }
      // Also populate categorySkills if it exists (for Skills tab text display)
      updatePayload.categorySkills = skillsString
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
      
      return { contactId: existingId, skillsString }
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
  // If we detected desiredSkills exists but we're writing into a custom UI field,
  // also populate desiredSkills so the data remains consistent across layouts.
  if (skillsFieldName !== 'desiredSkills' && cachedHasDesiredSkillsField) {
    createPayload.desiredSkills = skillsString
  }
  // Also populate categorySkills if it exists (for Skills tab text display)
  createPayload.categorySkills = skillsString
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
  return { contactId: createData.changedEntityId, skillsString }
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

    // Process contacts in batches of 5 for better throughput
    const BATCH_SIZE = 5
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE)
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(contacts.length / BATCH_SIZE)} (contacts ${i + 1}-${Math.min(i + BATCH_SIZE, contacts.length)})`)
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (contact) => {
          let clientCorporationId: number
          const companyName = contact.company || 'Unknown Company'
          
          // Check cache first (synchronous)
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
          
          const { contactId, skillsString: generatedSkills } = await findOrCreateClientContact(
            tokens.restUrl,
            tokens.bhRestToken,
            contact,
            clientCorporationId,
            skillsString,
            skillsFieldName
          )
          
          // STEP 2: Associate skill entities with the contact for Skills tab + Count
          const associatedCount = await associateSkillsWithContact(
            tokens.restUrl,
            tokens.bhRestToken,
            contactId,
            generatedSkills
          )
          
          console.log(`Created/updated contact ${contact.name} (ID: ${contactId}, associated ${associatedCount} skills)`)
          return contactId
        })
      )
      
      // Collect results
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j]
        if (result.status === 'fulfilled') {
          contactIds.push(result.value)
        } else {
          const contact = batch[j]
          console.error(`Error creating contact ${contact.email}:`, result.reason?.message || result.reason)
          errors.push(`${contact.email}: ${result.reason?.message || 'Unknown error'}`)
        }
      }
      
      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < contacts.length) {
        await sleep(100)
      }
    }
    
    console.log(`Export complete: ${contactIds.length}/${contacts.length} contacts processed`)

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
