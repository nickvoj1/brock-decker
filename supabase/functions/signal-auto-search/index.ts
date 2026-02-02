import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ============ All Role Categories ============
const ROLE_CATEGORIES: Record<string, string[]> = {
  'HR & Recruiting': [
    'Recruiter', 'Talent Acquisition', 'HR Manager', 'Human Resources',
    'Hiring Manager', 'Head of Talent', 'People Operations', 'HR Director',
    'Talent Partner', 'HR Business Partner'
  ],
  'Senior Leadership': [
    'CEO', 'CTO', 'CFO', 'COO', 'Managing Director', 'Managing Partner',
    'Senior Partner', 'Equity Partner', 'Partner', 'SVP', 'EVP', 
    'Founder', 'Co-Founder', 'President', 'Vice President'
  ],
  'Finance & Investment': [
    'Investor Relations', 'Fundraising', 'Finance Director', 
    'Head of Finance', 'Investment Director', 'Portfolio Manager',
    'Fund Manager', 'Chief Investment Officer'
  ],
  'Legal & Compliance': [
    'General Counsel', 'CLO', 'Legal Director', 'Head of Legal',
    'Attorney', 'Lawyer', 'Legal Partner', 'Compliance Officer',
    'Regulatory Affairs', 'Chief Legal Officer'
  ],
  'Strategy & Operations': [
    'Corporate Development', 'Business Development', 'Strategy Director',
    'Head of Strategy', 'Operations Director', 'Chief Strategy Officer',
    'Head of Operations', 'COO'
  ],
}

// All categories in priority order for TA search
const CATEGORY_PRIORITY = [
  'HR & Recruiting',
  'Senior Leadership', 
  'Finance & Investment',
  'Legal & Compliance',
  'Strategy & Operations',
]

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
    .replace(/[''`]/g, "'")
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripCompanySuffixes(name: string): string {
  let stripped = normalizeCompanyName(name)
  for (const suffix of COMPANY_SUFFIXES) {
    const pattern = new RegExp(`\\s+${suffix}$`, 'i')
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
    .replace(/^(breaking|exclusive|update|report|news|watch):\s*/i, "")
    .replace(/^(french|german|uk|british|european|spanish|dutch|swiss|us|american)\s+/i, "")
    .replace(/^(fintech|proptech|healthtech|edtech|insurtech|legaltech|deeptech|biotech|cleantech)\s+/i, "")
    .replace(/^(it\s+)?scale-up\s+/i, "")
    .replace(/^startup\s+/i, "")
    .replace(/^bootstrapped\s+for\s+\w+\s+years?,?\s*/i, "")
    .trim()
  
  const verbPattern = /^([A-Z][A-Za-z0-9''\-\.&\s]{1,40}?)\s+(?:raises|closes|secures|announces|completes|launches|acquires|enters|targets|opens|hires|appoints|names|promotes|backs|invests|exits|sells|buys|takes|signs|expands|reaches|receives|lands|wins|gets|has|is|to|in|at|for|joins|adds|extends)/i
  
  const match = cleanTitle.match(verbPattern)
  if (match) {
    let company = match[1]
      .trim()
      .replace(/['']s$/i, "")
      .replace(/\s+/g, " ")
    
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

interface ApolloContact {
  name: string
  title: string
  location: string
  email: string
  company: string
  category: string
}

interface SearchResult {
  contacts: ApolloContact[]
  strategy: string
  targetCompany: string
  categoriesTried: string[]
  categoriesWithResults: string[]
}

interface SearchStrategy {
  name: string
  company: string
  locations: string[]
}

async function searchWithStrategy(
  apolloApiKey: string,
  strategy: SearchStrategy,
  roles: string[],
  categoryName: string,
  seenEmails: Set<string>,
  targetCompany: string,
  maxPerCompany: number
): Promise<ApolloContact[]> {
  const contacts: ApolloContact[] = []
  
  const searchPayload: Record<string, unknown> = {
    person_titles: roles,
    q_organization_name: strategy.company,
    per_page: 25,
    page: 1,
  }

  if (strategy.locations.length > 0) {
    searchPayload.person_locations = strategy.locations
  }

  // Search up to 3 pages per strategy
  for (let page = 1; page <= 3; page++) {
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
        const errorText = await apolloResponse.text()
        console.error(`Apollo API error: ${apolloResponse.status} - ${errorText}`)
        break
      }

      const apolloData = await apolloResponse.json()
      const people = apolloData.people || []

      if (people.length === 0) {
        break
      }

      for (const person of people) {
        const email = person.email?.toLowerCase()
        if (!email || seenEmails.has(email)) continue

        const personCompany = person.organization?.name || ''
        
        // Strict company match
        if (!companiesMatch(strategy.company, personCompany)) {
          continue
        }

        // Check max per company
        const companyKey = normalizeCompanyName(personCompany)
        const companyCount = contacts.filter(c => 
          normalizeCompanyName(c.company) === companyKey
        ).length
        if (companyCount >= maxPerCompany) continue

        const firstName = person.first_name || ''
        const lastName = person.last_name || ''
        const fullName = `${firstName} ${lastName}`.trim()
        if (!fullName || fullName.length < 2) continue

        const locationParts = [
          person.city,
          person.state,
          person.country
        ].filter(Boolean)
        const location = locationParts.join(', ') || 'Unknown'

        contacts.push({
          name: fullName,
          title: person.title || 'Unknown',
          location,
          email,
          company: personCompany,
          category: categoryName,
        })
        seenEmails.add(email)
      }

    } catch (err) {
      console.error(`Apollo request failed:`, err)
      break
    }
  }

  return contacts
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

    // Get locations for the signal's region
    const region = signal.region || 'europe'
    const cityLocations = REGION_LOCATIONS[region] || REGION_LOCATIONS.europe
    const countryLocations = REGION_COUNTRY_LOCATIONS[region] || REGION_COUNTRY_LOCATIONS.europe

    console.log(`Region: ${region}, Locations: ${cityLocations.join(', ')}`)

    // Build company name variants
    const companyVariants = [targetCompany]
    const strippedCompany = stripCompanySuffixes(targetCompany)
    if (strippedCompany !== normalizeCompanyName(targetCompany)) {
      companyVariants.push(strippedCompany)
    }
    const titleCompany = extractCompanyFromTitle(signal.title)
    if (titleCompany && normalizeCompanyName(titleCompany) !== normalizeCompanyName(targetCompany)) {
      companyVariants.push(titleCompany)
    }

    // Build search strategies (company variant × location level)
    const strategies: SearchStrategy[] = []
    for (const company of companyVariants) {
      strategies.push({ name: `${company}_cities`, company, locations: cityLocations })
      strategies.push({ name: `${company}_countries`, company, locations: countryLocations })
    }
    // Final fallback: no location filter
    strategies.push({ name: 'no_location', company: targetCompany, locations: [] })

    const TARGET_MIN_CONTACTS = 10
    const MAX_PER_COMPANY = 10 // Allow more contacts per company for exhaustive search
    const allContacts: ApolloContact[] = []
    const seenEmails = new Set<string>()
    const categoriesTried: string[] = []
    const categoriesWithResults: string[] = []
    let usedStrategy = 'none'

    console.log(`Will try ${CATEGORY_PRIORITY.length} role categories across ${strategies.length} strategies`)

    // Try EVERY category, not just until we have enough
    for (const categoryName of CATEGORY_PRIORITY) {
      const roles = ROLE_CATEGORIES[categoryName]
      categoriesTried.push(categoryName)
      let categoryFoundContacts = false

      console.log(`\n=== Trying category: ${categoryName} (${roles.length} roles) ===`)

      // Try each strategy for this category
      for (const strategy of strategies) {
        console.log(`  Strategy: ${strategy.name}`)

        const contacts = await searchWithStrategy(
          apolloApiKey,
          strategy,
          roles,
          categoryName,
          seenEmails,
          strategy.company,
          MAX_PER_COMPANY
        )

        if (contacts.length > 0) {
          console.log(`  Found ${contacts.length} contacts in ${categoryName} with ${strategy.name}`)
          allContacts.push(...contacts)
          categoryFoundContacts = true
          usedStrategy = strategy.name
          
          // If we found contacts in this category, move to next category
          // (we want breadth across categories, not depth in one strategy)
          break
        }
      }

      if (categoryFoundContacts) {
        categoriesWithResults.push(categoryName)
      }
    }

    console.log(`\nSearch complete: ${allContacts.length} contacts found across ${categoriesWithResults.length} categories`)
    console.log(`Categories with results: ${categoriesWithResults.join(', ')}`)

    // Update signal with contacts count
    await supabase
      .from('signals')
      .update({ contacts_found: allContacts.length })
      .eq('id', signalId)

    const result: SearchResult = {
      contacts: allContacts,
      strategy: usedStrategy,
      targetCompany,
      categoriesTried,
      categoriesWithResults,
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
