import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============ Company Industry Detection ============
// Mapping of company name keywords to likely industries
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  'Private Equity': [
    'capital', 'partners', 'equity', 'investments', 'fund', 'holdings',
    'private equity', 'buyout', 'lbo', 'leveraged'
  ],
  'Venture Capital': [
    'ventures', 'vc', 'venture', 'seed', 'series', 'startup'
  ],
  'Investment Banking': [
    'bank', 'banking', 'securities', 'advisory', 'm&a', 'mergers'
  ],
  'Asset Management': [
    'asset management', 'wealth', 'investment management', 'portfolio'
  ],
  'Technology': [
    'tech', 'software', 'digital', 'data', 'cloud', 'ai', 'saas', 'platform',
    'fintech', 'proptech', 'healthtech', 'edtech', 'insurtech'
  ],
  'Financial Services': [
    'financial', 'finance', 'credit', 'lending', 'insurance'
  ],
  'Consulting': [
    'consulting', 'consultants', 'advisory', 'advisors'
  ],
  'Real Estate': [
    'real estate', 'property', 'properties', 'realty', 'reit'
  ],
  'Healthcare': [
    'health', 'medical', 'pharma', 'biotech', 'life sciences'
  ],
}

// Signal type to industry mapping
const SIGNAL_TYPE_INDUSTRIES: Record<string, string[]> = {
  fund_close: ['Private Equity', 'Venture Capital', 'Asset Management'],
  new_fund: ['Private Equity', 'Venture Capital', 'Asset Management'],
  deal: ['Private Equity', 'Investment Banking', 'Corporate Finance'],
  exit: ['Private Equity', 'Venture Capital'],
  expansion: ['Financial Services', 'Technology'],
  senior_hire: ['Financial Services', 'Private Equity', 'Technology'],
  funding: ['Venture Capital', 'Technology', 'Private Equity'],
}

// Region to locations mapping
const REGION_LOCATIONS: Record<string, string[]> = {
  europe: ['London, United Kingdom', 'Frankfurt, Germany', 'Paris, France', 'Amsterdam, Netherlands', 'Zurich, Switzerland'],
  uae: ['Dubai, UAE', 'Abu Dhabi, UAE'],
  east_usa: ['New York, NY', 'Boston, MA', 'Chicago, IL', 'Washington D.C.'],
  west_usa: ['San Francisco, CA', 'Los Angeles, CA', 'Seattle, WA'],
}

// Wider region locations for fallback
const REGION_COUNTRY_LOCATIONS: Record<string, string[]> = {
  europe: ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Switzerland', 'Ireland', 'Spain', 'Italy', 'Belgium', 'Luxembourg'],
  uae: ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Bahrain'],
  east_usa: ['New York', 'Massachusetts', 'Connecticut', 'New Jersey', 'Pennsylvania', 'Illinois', 'Florida'],
  west_usa: ['California', 'Washington', 'Oregon', 'Colorado', 'Texas'],
}

// Default target roles for TA searches
const DEFAULT_ROLES = [
  'Recruiter', 'Talent Acquisition', 'HR Manager', 'Human Resources',
  'Hiring Manager', 'Head of Talent', 'People Operations', 'HR Director',
  'Talent Partner', 'HR Business Partner'
]

// Company name normalization
const COMPANY_SUFFIXES = [
  'ltd', 'limited', 'llc', 'inc', 'incorporated', 'corp', 'corporation',
  'plc', 'gmbh', 'ag', 'sa', 'sas', 'sarl', 'bv', 'nv', 'co', 'company',
  'capital', 'partners', 'ventures', 'equity', 'advisors', 'advisory',
  'management', 'group', 'holdings', 'fund', 'investments', 'asset',
  'uk', 'us', 'europe', 'eu', 'global', 'international', 'intl'
]

function normalizeCompanyName(name: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .trim()
    .replace(/['`]/g, "'")
    .replace(/[^\\w\\s'-]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim()
}

function stripCompanySuffixes(name: string): string {
  let stripped = normalizeCompanyName(name)
  for (const suffix of COMPANY_SUFFIXES) {
    const pattern = new RegExp(`\\\\s+${suffix}$`, 'i')
    stripped = stripped.replace(pattern, '').trim()
  }
  return stripped
}

function companiesMatch(target: string, candidate: string): boolean {
  const normTarget = normalizeCompanyName(target)
  const normCandidate = normalizeCompanyName(candidate)
  
  if (normTarget === normCandidate) return true
  
  const strippedTarget = stripCompanySuffixes(target)
  const strippedCandidate = stripCompanySuffixes(candidate)
  if (strippedTarget === strippedCandidate) return true
  
  if (strippedTarget.length >= 3 && strippedCandidate.includes(strippedTarget)) return true
  if (strippedCandidate.length >= 3 && strippedTarget.includes(strippedCandidate)) return true
  
  return false
}

// Extract company from signal title
function extractCompanyFromTitle(title: string): string {
  if (!title) return ''
  
  let cleanTitle = title
    .replace(/^(breaking|exclusive|update|report|news|watch):\\s*/i, "")
    .replace(/^(french|german|uk|british|european|spanish|dutch|swiss|us|american)\\s+/i, "")
    .replace(/^(fintech|proptech|healthtech|edtech|insurtech|legaltech|deeptech|biotech|cleantech)\\s+/i, "")
    .replace(/^(it\\s+)?scale-up\\s+/i, "")
    .replace(/^startup\\s+/i, "")
    .replace(/^bootstrapped\\s+for\\s+\\w+\\s+years?,?\\s*/i, "")
    .trim()
  
  const verbPattern = /^([A-Z][A-Za-z0-9''\\-\\.\\s]{1,40}?)\\s+(?:raises|closes|secures|announces|completes|launches|acquires|enters|targets|opens|hires|appoints|names|promotes|backs|invests|exits|sells|buys|takes|signs|expands|reaches|receives|lands|wins|gets|has|is|to|in|at|for|joins|adds|extends)/i
  
  const match = cleanTitle.match(verbPattern)
  if (match) {
    let company = match[1]
      .trim()
      .replace(/['']s$/i, "")
      .replace(/\\s+/g, " ")
    
    const skipPhrases = [
      "the", "a", "an", "new", "report", "update", "breaking", "exclusive",
      "bootstrapped for seven years", "backed by", "formerly known as",
      "sources say", "according to", "report says", "rumor has it"
    ]
    
    if (skipPhrases.some(phrase => company.toLowerCase() === phrase || company.toLowerCase().startsWith(phrase + " "))) {
      return ''
    }
    
    if (company.length >= 2 && company.length <= 50) {
      return company
    }
  }
  
  return ''
}

// Detect industry from company name and signal context
function detectIndustry(companyName: string, signalType: string | null, signalTitle: string): string[] {
  const industries: Set<string> = new Set()
  
  // First, check signal type mapping
  if (signalType && SIGNAL_TYPE_INDUSTRIES[signalType]) {
    SIGNAL_TYPE_INDUSTRIES[signalType].forEach(ind => industries.add(ind))
  }
  
  // Then check company name keywords
  const lowerCompany = (companyName + ' ' + signalTitle).toLowerCase()
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerCompany.includes(keyword)) {
        industries.add(industry)
        break
      }
    }
  }
  
  // Default to Private Equity + Financial Services if nothing detected
  if (industries.size === 0) {
    industries.add('Private Equity')
    industries.add('Financial Services')
  }
  
  return Array.from(industries).slice(0, 3) // Max 3 industries
}

interface ApolloContact {
  name: string
  title: string
  location: string
  email: string
  company: string
}

interface SearchResult {
  contacts: ApolloContact[]
  strategy: string
  targetCompany: string
  industries: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { signalId, profileName } = await req.json()

    console.log('Signal auto-search starting:', { signalId, profileName })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch the signal
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .select('*')
      .eq('id', signalId)
      .single()

    if (signalError || !signal) {
      throw new Error('Signal not found')
    }

    // Fetch Apollo API key
    const { data: apolloSetting } = await supabase
      .from('api_settings')
      .select('setting_value')
      .eq('setting_key', 'apollo_api_key')
      .single()

    const apolloApiKey = apolloSetting?.setting_value

    if (!apolloApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Apollo API key not configured. Please add it in Settings.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract company name - try signal.company first, then parse from title
    let targetCompany = signal.company || ''
    if (!targetCompany) {
      targetCompany = extractCompanyFromTitle(signal.title)
    }
    
    if (!targetCompany) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not determine company name from signal' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Target company: "${targetCompany}"`)

    // Auto-detect industries
    const industries = detectIndustry(targetCompany, signal.signal_type, signal.title)
    console.log(`Detected industries: ${industries.join(', ')}`)

    // Get locations for the signal's region
    const region = signal.region || 'europe'
    const cityLocations = REGION_LOCATIONS[region] || REGION_LOCATIONS.europe
    const countryLocations = REGION_COUNTRY_LOCATIONS[region] || REGION_COUNTRY_LOCATIONS.europe

    console.log(`Region: ${region}, Locations: ${cityLocations.join(', ')}`)

    // Build search strategies
    const strategies = [
      { name: 'exact_cities', company: targetCompany, locations: cityLocations },
      { name: 'stripped_cities', company: stripCompanySuffixes(targetCompany), locations: cityLocations },
      { name: 'exact_countries', company: targetCompany, locations: countryLocations },
      { name: 'stripped_countries', company: stripCompanySuffixes(targetCompany), locations: countryLocations },
      { name: 'no_location', company: targetCompany, locations: [] },
    ]

    // Also try title-derived company if different
    const titleCompany = extractCompanyFromTitle(signal.title)
    if (titleCompany && normalizeCompanyName(titleCompany) !== normalizeCompanyName(targetCompany)) {
      strategies.splice(2, 0, { 
        name: 'title_derived_cities', 
        company: titleCompany, 
        locations: cityLocations 
      })
    }

    const TARGET_MIN_CONTACTS = 10
    const MAX_PER_COMPANY = 4
    const allContacts: ApolloContact[] = []
    const seenEmails = new Set<string>()
    let usedStrategy = 'none'

    // Try each strategy until we get enough contacts
    for (const strategy of strategies) {
      if (allContacts.length >= TARGET_MIN_CONTACTS) {
        console.log(`Found ${allContacts.length} contacts, stopping search`)
        break
      }

      console.log(`Trying strategy: ${strategy.name} with company "${strategy.company}"`)

      // Build Apollo search payload
      const searchPayload: Record<string, unknown> = {
        person_titles: DEFAULT_ROLES,
        q_organization_name: strategy.company,
        per_page: 25,
        page: 1,
      }

      if (strategy.locations.length > 0) {
        searchPayload.person_locations = strategy.locations
      }

      // Search up to 5 pages
      for (let page = 1; page <= 5; page++) {
        if (allContacts.length >= TARGET_MIN_CONTACTS) break

        searchPayload.page = page

        try {
          const apolloResponse = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': apolloApiKey,
            },
            body: JSON.stringify(searchPayload),
          })

          if (!apolloResponse.ok) {
            console.error(`Apollo API error: ${apolloResponse.status}`)
            continue
          }

          const apolloData = await apolloResponse.json()
          const people = apolloData.people || []

          if (people.length === 0) {
            console.log(`No results on page ${page}`)
            break
          }

          // Filter and process contacts
          for (const person of people) {
            const email = person.email?.toLowerCase()
            if (!email || seenEmails.has(email)) continue

            const personCompany = person.organization?.name || ''
            
            // Strict company match - only keep contacts at target company
            if (!companiesMatch(strategy.company, personCompany)) {
              continue
            }

            // Check max per company
            const companyKey = normalizeCompanyName(personCompany)
            const companyCount = allContacts.filter(c => 
              normalizeCompanyName(c.company) === companyKey
            ).length
            if (companyCount >= MAX_PER_COMPANY) continue

            const firstName = person.first_name || ''
            const lastName = person.last_name || ''
            const fullName = `${firstName} ${lastName}`.trim()
            if (!fullName || fullName.length < 2) continue

            // Build location string
            const locationParts = [
              person.city,
              person.state,
              person.country
            ].filter(Boolean)
            const location = locationParts.join(', ') || 'Unknown'

            allContacts.push({
              name: fullName,
              title: person.title || 'Unknown',
              location,
              email,
              company: personCompany,
            })
            seenEmails.add(email)

            console.log(`Found: ${fullName} - ${person.title} at ${personCompany}`)
          }

          console.log(`Page ${page}: Found ${people.length} people, ${allContacts.length} total contacts`)

        } catch (err) {
          console.error(`Apollo request failed:`, err)
        }
      }

      if (allContacts.length > 0) {
        usedStrategy = strategy.name
      }
    }

    console.log(`Search complete: ${allContacts.length} contacts found using strategy "${usedStrategy}"`)

    // Update signal with contacts count
    await supabase
      .from('signals')
      .update({ contacts_found: allContacts.length })
      .eq('id', signalId)

    const result: SearchResult = {
      contacts: allContacts,
      strategy: usedStrategy,
      targetCompany,
      industries,
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Signal auto-search error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
