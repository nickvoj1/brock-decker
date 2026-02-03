import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ============ AI-Powered Signal Analysis ============
interface AISignalAnalysis {
  companyName: string
  companyVariants: string[]  // Alternative names, abbreviations
  industry: string
  prioritizedCategories: string[]  // Ordered by relevance
  searchKeywords: string[]  // Industry/context keywords for Apollo
  confidence: number
}

async function analyzeSignalWithAI(signal: {
  title: string
  description?: string | null
  company?: string | null
  signal_type?: string | null
  region?: string | null
  amount?: number | null
}): Promise<AISignalAnalysis | null> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!lovableApiKey) {
    console.log('LOVABLE_API_KEY not set, skipping AI analysis')
    return null
  }

  const prompt = `Analyze this business signal and extract information for finding hiring contacts at the company.

SIGNAL:
Title: ${signal.title}
${signal.description ? `Description: ${signal.description}` : ''}
${signal.company ? `Company (from source): ${signal.company}` : ''}
${signal.signal_type ? `Signal Type: ${signal.signal_type}` : ''}
${signal.region ? `Region: ${signal.region}` : ''}
${signal.amount ? `Amount: ${signal.amount}` : ''}

TASK: Return a JSON object with:
1. "companyName": The exact company name mentioned (clean, no suffixes like Ltd/Inc unless part of brand)
2. "companyVariants": Array of alternative names people might use (abbreviations, common names, parent company). Example: ["McKinsey", "McKinsey & Company", "McKinsey & Co"]
3. "industry": The company's industry (e.g., "Private Equity", "Technology", "Healthcare", "Financial Services")
4. "prioritizedCategories": Order these 5 categories by relevance to the signal type (most likely to hire first):
   - "HR & Recruiting" (always relevant for hiring)
   - "Senior Leadership" (for major expansions, fundraises)
   - "Finance & Investment" (for funding rounds, M&A)
   - "Legal & Compliance" (for acquisitions, regulatory news)
   - "Strategy & Operations" (for expansions, new markets)
5. "searchKeywords": 2-3 industry keywords to help find the company on Apollo (e.g., ["private equity", "investment management"])
6. "confidence": 0-1 score for how confident you are in the company identification

For a fund close or fundraise, prioritize: Finance → Leadership → HR
For hiring/expansion news, prioritize: HR → Leadership → Strategy
For M&A or acquisition, prioritize: Legal → Leadership → Finance

Return ONLY valid JSON, no markdown or explanation.`

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      console.error('AI analysis failed:', response.status)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
    }
    
    const analysis = JSON.parse(jsonStr) as AISignalAnalysis
    console.log('AI Signal Analysis:', JSON.stringify(analysis, null, 2))
    return analysis
  } catch (err) {
    console.error('AI analysis error:', err)
    return null
  }
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

// Default category priority (used if AI analysis fails)
const DEFAULT_CATEGORY_PRIORITY = [
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

// ============ Law Firm Detection ============
// Law firms often get mixed into PE/Buy Side results because they advise on deals
// They're typically named after founding partners (multiple surnames)
const LAW_FIRM_SUFFIXES = [
  'llp', 'law', 'legal', 'solicitors', 'attorneys', 'barristers', 
  'advocates', 'avocats', 'rechtsanwälte', 'abogados', 'advogados',
  'notaries', 'notaires', 'law firm', 'law office', 'law offices',
  'legal services', 'legal group', 'chambers'
]

const LAW_FIRM_KEYWORDS = [
  'law firm', 'legal practice', 'legal counsel', 'solicitor', 
  'barrister', 'attorney at law', 'attorneys at law'
]

// Keywords that indicate the signal/search is targeting legal sector
const LEGAL_INTENT_KEYWORDS = ['legal', 'law', 'solicitor', 'attorney', 'barrister', 'counsel']

function hasLegalIntent(aiAnalysis: AISignalAnalysis | null): boolean {
  if (!aiAnalysis) return false
  
  // Check if AI identified the company as being in legal industry
  const industryLower = (aiAnalysis.industry || '').toLowerCase()
  for (const keyword of LEGAL_INTENT_KEYWORDS) {
    if (industryLower.includes(keyword)) {
      return true
    }
  }
  
  // Check search keywords
  for (const kw of aiAnalysis.searchKeywords || []) {
    const kwLower = kw.toLowerCase()
    for (const keyword of LEGAL_INTENT_KEYWORDS) {
      if (kwLower.includes(keyword)) {
        return true
      }
    }
  }
  
  return false
}

function isLawFirm(companyName: string, industry?: string | null, skipExclusion = false): boolean {
  // If targeting legal sector, don't exclude law firms
  if (skipExclusion) return false
  
  if (!companyName) return false
  
  const nameLower = companyName.toLowerCase().trim()
  
  // Check for law firm suffixes in company name
  for (const suffix of LAW_FIRM_SUFFIXES) {
    if (nameLower.endsWith(` ${suffix}`) || nameLower === suffix) {
      console.log(`[LAW FIRM EXCLUDED] "${companyName}" - matched suffix: ${suffix}`)
      return true
    }
  }
  
  // Check for law firm keywords in company name
  for (const keyword of LAW_FIRM_KEYWORDS) {
    if (nameLower.includes(keyword)) {
      console.log(`[LAW FIRM EXCLUDED] "${companyName}" - matched keyword: ${keyword}`)
      return true
    }
  }
  
  // Check industry field from Apollo
  if (industry) {
    const industryLower = industry.toLowerCase()
    if (industryLower.includes('law') || industryLower.includes('legal services') || 
        industryLower.includes('legal practice') || industryLower === 'legal') {
      console.log(`[LAW FIRM EXCLUDED] "${companyName}" - industry: ${industry}`)
      return true
    }
  }
  
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

async function revealEmail(apolloApiKey: string, personId: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.apollo.io/api/v1/people/bulk_reveal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apolloApiKey,
      },
      body: JSON.stringify({ ids: [personId] }),
    })

    if (!response.ok) {
      console.error(`Reveal API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    const matches = data.matches || []
    if (matches.length > 0 && matches[0].email) {
      return matches[0].email.toLowerCase()
    }
    return null
  } catch (err) {
    console.error('Reveal email failed:', err)
    return null
  }
}

// Track credit usage globally
let globalCreditsUsed = 0

async function searchWithStrategy(
  apolloApiKey: string,
  strategy: SearchStrategy,
  roles: string[],
  categoryName: string,
  seenEmails: Set<string>,
  seenPersonIds: Set<string>,
  targetCompany: string,
  maxPerCompany: number,
  maxContactsNeeded: number = 50, // Limit how many contacts we actually need
  includeLawFirms: boolean = false // Skip law firm exclusion if targeting legal sector
): Promise<ApolloContact[]> {
  const contacts: ApolloContact[] = []
  const pendingReveals: { person: Record<string, unknown>; categoryName: string }[] = []
  
  // Build query params for Apollo api_search endpoint
  const queryParams = new URLSearchParams()
  
  // Add target roles
  roles.forEach(title => queryParams.append('person_titles[]', title))
  
  // Add locations
  if (strategy.locations.length > 0) {
    strategy.locations.forEach(loc => queryParams.append('person_locations[]', loc))
  }
  
  // Add company filter
  queryParams.append('q_organization_name', strategy.company)

  // Search up to 3 pages per strategy
  for (let page = 1; page <= 3; page++) {
    // CREDIT OPTIMIZATION: Stop if we already have enough contacts
    if (contacts.length >= maxContactsNeeded) {
      console.log(`  CREDIT SAVER: Already have ${contacts.length} contacts, skipping further pages`)
      break
    }
    
    queryParams.set('per_page', '25')
    queryParams.set('page', String(page))

    try {
      // Use the new api_search endpoint (POST with query params)
      const searchUrl = `https://api.apollo.io/api/v1/mixed_people/api_search?${queryParams.toString()}`
      
      const apolloResponse = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apolloApiKey,
        },
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
        // CREDIT OPTIMIZATION: Stop collecting if we have enough
        if (contacts.length + pendingReveals.length >= maxContactsNeeded) break
        
        const personId = person.id
        if (!personId || seenPersonIds.has(personId)) continue
        seenPersonIds.add(personId)

        const personCompany = person.organization?.name || ''
        const personIndustry = person.organization?.industry || null
        
        // Strict company match
        if (!companiesMatch(strategy.company, personCompany)) {
          continue
        }
        
        // Exclude law firms (they often appear in PE/Buy Side searches as deal advisors)
        // Skip exclusion if user is targeting legal sector
        if (isLawFirm(personCompany, personIndustry, includeLawFirms)) {
          continue
        }

        // Check max per company
        const companyKey = normalizeCompanyName(personCompany)
        const companyCount = contacts.filter(c => 
          normalizeCompanyName(c.company) === companyKey
        ).length + pendingReveals.filter(p => 
          normalizeCompanyName((p.person.organization as Record<string, unknown>)?.name as string || '') === companyKey
        ).length
        if (companyCount >= maxPerCompany) continue

        const firstName = person.first_name || ''
        const lastName = person.last_name || ''
        const fullName = `${firstName} ${lastName}`.trim()
        if (!fullName || fullName.length < 2) continue

        // If email already available (already revealed), use it directly
        if (person.email) {
          const email = person.email.toLowerCase()
          if (!seenEmails.has(email)) {
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
            console.log(`  [Direct] ${fullName} at ${personCompany} (email from search)`)
          }
        } else {
          // Queue for reveal (only if we still need more contacts)
          pendingReveals.push({ person, categoryName })
        }
      }

    } catch (err) {
      console.error(`Apollo request failed:`, err)
      break
    }
  }

  // CREDIT OPTIMIZATION: Only enrich as many as we actually need
  if (pendingReveals.length > 0) {
    const contactsStillNeeded = maxContactsNeeded - contacts.length
    const limitedPendingReveals = pendingReveals.slice(0, Math.max(0, contactsStillNeeded))
    
    if (limitedPendingReveals.length < pendingReveals.length) {
      console.log(`  CREDIT SAVER: Only enriching ${limitedPendingReveals.length}/${pendingReveals.length} (have ${contacts.length} already)`)
    } else if (limitedPendingReveals.length > 0) {
      console.log(`  Enriching ${limitedPendingReveals.length} contacts...`)
    }
    
    for (const pending of limitedPendingReveals) {
      // Double-check we still need more contacts
      if (contacts.length >= maxContactsNeeded) {
        console.log(`  CREDIT SAVER: Stopping enrichment - reached ${contacts.length} contacts`)
        break
      }
      
      const person = pending.person
      const personId = person.id as string
      
      try {
        const enrichResponse = await fetch('https://api.apollo.io/api/v1/people/match', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apolloApiKey,
          },
          body: JSON.stringify({ id: personId }),
        })
        globalCreditsUsed++ // Track credit usage

        if (enrichResponse.ok) {
          const enriched = await enrichResponse.json()
          const enrichedPerson = enriched.person || {}
          
          const email = enrichedPerson.email?.toLowerCase()
          if (!email || seenEmails.has(email)) continue
          
          const firstName = enrichedPerson.first_name || person.first_name || ''
          const lastName = enrichedPerson.last_name || person.last_name || ''
          const fullName = `${firstName} ${lastName}`.trim()
          const personCompany = enrichedPerson.organization?.name || (person.organization as Record<string, unknown>)?.name as string || ''
          
          const locationParts = [
            enrichedPerson.city || person.city,
            enrichedPerson.state || person.state,
            enrichedPerson.country || person.country
          ].filter(Boolean)
          const location = (locationParts as string[]).join(', ') || 'Unknown'

          contacts.push({
            name: fullName,
            title: enrichedPerson.title || (person.title as string) || 'Unknown',
            location,
            email,
            company: personCompany,
            category: pending.categoryName,
          })
          seenEmails.add(email)
          console.log(`  [Enriched] ${fullName} at ${personCompany}`)
        }
        
        // Small delay between calls
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (err) {
        console.error('Enrichment failed:', err)
      }
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

    // ============ AI-Powered Signal Analysis ============
    console.log('Running AI analysis on signal...')
    const aiAnalysis = await analyzeSignalWithAI({
      title: signal.title,
      description: signal.description,
      company: signal.company,
      signal_type: signal.signal_type,
      region: signal.region,
      amount: signal.amount,
    })

    // Determine target company - prefer AI analysis, fallback to regex extraction
    let targetCompany = ''
    let companyVariants: string[] = []
    let categoryPriority = DEFAULT_CATEGORY_PRIORITY
    let searchKeywords: string[] = []

    if (aiAnalysis && aiAnalysis.confidence >= 0.5) {
      targetCompany = aiAnalysis.companyName
      companyVariants = aiAnalysis.companyVariants || []
      categoryPriority = aiAnalysis.prioritizedCategories?.length > 0 
        ? aiAnalysis.prioritizedCategories 
        : DEFAULT_CATEGORY_PRIORITY
      searchKeywords = aiAnalysis.searchKeywords || []
      console.log(`AI identified company: "${targetCompany}" (confidence: ${aiAnalysis.confidence})`)
      console.log(`AI company variants: ${companyVariants.join(', ')}`)
      console.log(`AI prioritized categories: ${categoryPriority.join(' → ')}`)
      console.log(`AI search keywords: ${searchKeywords.join(', ')}`)
    } else {
      // Fallback to regex-based extraction
      targetCompany = signal.company || ''
      if (!targetCompany) {
        targetCompany = extractCompanyFromTitle(signal.title)
      }
      console.log(`Regex extracted company: "${targetCompany}"`)
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

    // Build company name variants (combine AI variants + regex variants)
    const allCompanyVariants = new Set<string>([targetCompany])
    
    // Add AI-suggested variants
    for (const variant of companyVariants) {
      if (variant && variant.trim()) {
        allCompanyVariants.add(variant.trim())
      }
    }
    
    // Add regex-derived variants
    const strippedCompany = stripCompanySuffixes(targetCompany)
    if (strippedCompany !== normalizeCompanyName(targetCompany)) {
      allCompanyVariants.add(strippedCompany)
    }
    const titleCompany = extractCompanyFromTitle(signal.title)
    if (titleCompany && normalizeCompanyName(titleCompany) !== normalizeCompanyName(targetCompany)) {
      allCompanyVariants.add(titleCompany)
    }

    const uniqueVariants = Array.from(allCompanyVariants)
    console.log(`All company variants to try: ${uniqueVariants.join(', ')}`)

    // Build search strategies (company variant × location level)
    const strategies: SearchStrategy[] = []
    for (const company of uniqueVariants) {
      strategies.push({ name: `${company}_cities`, company, locations: cityLocations })
      strategies.push({ name: `${company}_countries`, company, locations: countryLocations })
    }
    // Final fallback: no location filter
    strategies.push({ name: 'no_location', company: targetCompany, locations: [] })

    const TARGET_MIN_CONTACTS = 10
    const MAX_PER_COMPANY = 10 // Allow more contacts per company for exhaustive search
    const allContacts: ApolloContact[] = []
    const seenEmails = new Set<string>()
    const seenPersonIds = new Set<string>()
    const categoriesTried: string[] = []
    const categoriesWithResults: string[] = []
    let usedStrategy = 'none'
    
    // Check if targeting legal sector (include law firms if so)
    const includeLawFirms = hasLegalIntent(aiAnalysis)
    if (includeLawFirms) {
      console.log('Legal industry intent detected - law firms will be INCLUDED in results')
    }

    console.log(`Will try ${categoryPriority.length} role categories across ${strategies.length} strategies`)

    // Try EVERY category, not just until we have enough
    for (const categoryName of categoryPriority) {
      const roles = ROLE_CATEGORIES[categoryName]
      if (!roles) {
        console.log(`Skipping unknown category: ${categoryName}`)
        continue
      }
      categoriesTried.push(categoryName)
      let categoryFoundContacts = false

      console.log(`\n=== Trying category: ${categoryName} (${roles.length} roles) ===`)

      // Try each strategy for this category
      for (const strategy of strategies) {
        console.log(`  Strategy: ${strategy.name}`)

        // Pass maxContactsNeeded to limit credit usage per category
        const maxContactsPerCategory = 15 // Limit contacts per category to save credits
        const contacts = await searchWithStrategy(
          apolloApiKey,
          strategy,
          roles,
          categoryName,
          seenEmails,
          seenPersonIds,
          strategy.company,
          MAX_PER_COMPANY,
          maxContactsPerCategory,
          includeLawFirms
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

    // Log credit usage summary
    const directContacts = allContacts.length - globalCreditsUsed
    console.log(`\n=== CREDIT USAGE SUMMARY ===`)
    console.log(`Total contacts: ${allContacts.length}`)
    console.log(`Direct (free): ${Math.max(0, directContacts)}`)
    console.log(`Enriched (paid): ${globalCreditsUsed} credits`)
    console.log(`============================\n`)
    
    console.log(`Search complete: ${allContacts.length} contacts found across ${categoriesWithResults.length} categories`)
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

    // Reset global counter for next request
    const creditsUsedThisRun = globalCreditsUsed
    globalCreditsUsed = 0

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        creditUsage: {
          totalContacts: allContacts.length,
          directContacts: Math.max(0, allContacts.length - creditsUsedThisRun),
          creditsUsed: creditsUsedThisRun,
        }
      }),
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
