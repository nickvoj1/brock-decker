import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============ Role Title Translations ============
// Map of languages and their associated location slugs
const languageLocationMap: Record<string, string[]> = {
  de: ["frankfurt", "berlin", "munich", "hamburg", "dusseldorf", "vienna", "zurich", "basel"],
  fr: ["paris", "lyon", "marseille", "geneva", "brussels", "luxembourg-city", "montreal"],
  es: ["madrid", "barcelona", "mexico-city"],
  it: ["milan", "rome"],
  nl: ["amsterdam", "rotterdam", "antwerp"],
  pt: ["lisbon", "porto", "sao-paulo", "rio"],
  pl: ["warsaw", "krakow"],
  sv: ["stockholm", "gothenburg"],
  da: ["copenhagen"],
  no: ["oslo"],
  fi: ["helsinki"],
  ja: ["tokyo", "osaka"],
  zh: ["shanghai", "beijing", "shenzhen", "hong-kong"],
  ko: ["seoul"],
  ar: ["dubai", "abu-dhabi", "riyadh"],
  he: ["tel-aviv"],
}

// Role translations by language code (includes gender variants where applicable)
const roleTranslations: Record<string, Record<string, string[]>> = {
  de: {
    "Recruiter": ["Recruiter", "Recruiterin", "Personalvermittler", "Personalvermittlerin"],
    "Talent Acquisition": ["Talent Acquisition", "Talentakquise", "Personalgewinnung"],
    "HR Manager": ["HR Manager", "HR Managerin", "Personalleiter", "Personalleiterin", "Personalmanager"],
    "Human Resources": ["Human Resources", "Personalwesen", "Personalabteilung"],
    "Hiring Manager": ["Hiring Manager", "Einstellungsleiter", "Einstellungsleiterin"],
    "Head of Talent": ["Head of Talent", "Leiter Talentmanagement", "Leiterin Talentmanagement"],
    "People Operations": ["People Operations", "People & Culture"],
    "HR Director": ["HR Director", "Personaldirektor", "Personaldirektorin", "Leiter Personal", "Leiterin Personal"],
    "Talent Partner": ["Talent Partner", "Talent Partnerin"],
    "HR Business Partner": ["HR Business Partner", "Personalreferent", "Personalreferentin"],
    "CEO": ["CEO", "Geschäftsführer", "Geschäftsführerin", "Vorstandsvorsitzender"],
    "CTO": ["CTO", "Technischer Leiter", "Technische Leiterin"],
    "CFO": ["CFO", "Finanzvorstand"],
    "Managing Director": ["Managing Director", "Geschäftsführer", "Geschäftsführerin"],
    "Director": ["Director", "Direktor", "Direktorin", "Leiter", "Leiterin"],
    "Partner": ["Partner", "Partnerin"],
    "Founder": ["Founder", "Gründer", "Gründerin", "Mitgründer"],
    "General Counsel": ["General Counsel", "Chefjurist", "Chefjuristin"],
    "Attorney": ["Attorney", "Rechtsanwalt", "Rechtsanwältin"],
    "Lawyer": ["Lawyer", "Rechtsanwalt", "Rechtsanwältin", "Jurist", "Juristin"],
    "Finance Director": ["Finance Director", "Finanzdirektor", "Finanzdirektorin"],
    "Engineering Manager": ["Engineering Manager", "Entwicklungsleiter", "Entwicklungsleiterin"],
    "IT Director": ["IT Director", "IT-Direktor", "IT-Direktorin", "IT-Leiter"],
  },
  fr: {
    "Recruiter": ["Recruteur", "Recruteuse", "Chargé de recrutement", "Chargée de recrutement"],
    "HR Manager": ["Responsable RH", "Directeur RH", "Directrice RH"],
    "Human Resources": ["Ressources Humaines", "RH"],
    "HR Director": ["Directeur RH", "Directrice RH"],
    "CEO": ["CEO", "PDG", "Directeur Général", "Directrice Générale"],
    "CTO": ["CTO", "Directeur Technique", "Directrice Technique"],
    "CFO": ["CFO", "Directeur Financier", "Directrice Financière"],
    "Managing Director": ["Directeur Général", "Directrice Générale"],
    "Director": ["Directeur", "Directrice"],
    "Partner": ["Associé", "Associée"],
    "Founder": ["Fondateur", "Fondatrice"],
    "General Counsel": ["Directeur Juridique", "Directrice Juridique"],
    "Attorney": ["Avocat", "Avocate"],
    "Lawyer": ["Avocat", "Avocate", "Juriste"],
  },
  es: {
    "Recruiter": ["Reclutador", "Reclutadora"],
    "HR Manager": ["Gerente de RRHH", "Director de RRHH", "Directora de RRHH"],
    "HR Director": ["Director de Recursos Humanos", "Directora de Recursos Humanos"],
    "CEO": ["CEO", "Director General", "Directora General"],
    "CTO": ["CTO", "Director de Tecnología", "Directora de Tecnología"],
    "Managing Director": ["Director General", "Directora General"],
    "Director": ["Director", "Directora"],
    "Partner": ["Socio", "Socia"],
    "Founder": ["Fundador", "Fundadora"],
    "Attorney": ["Abogado", "Abogada"],
    "Lawyer": ["Abogado", "Abogada"],
  },
  it: {
    "Recruiter": ["Recruiter", "Selezionatore", "Selezionatrice"],
    "HR Manager": ["HR Manager", "Responsabile Risorse Umane"],
    "HR Director": ["Direttore Risorse Umane", "Direttrice Risorse Umane"],
    "CEO": ["CEO", "Amministratore Delegato"],
    "Managing Director": ["Direttore Generale", "Direttrice Generale"],
    "Director": ["Direttore", "Direttrice"],
    "Partner": ["Partner", "Socio", "Socia"],
    "Founder": ["Fondatore", "Fondatrice"],
    "Attorney": ["Avvocato", "Avvocatessa"],
  },
  nl: {
    "Recruiter": ["Recruiter", "Werving"],
    "HR Manager": ["HR Manager", "Personeelsmanager"],
    "HR Director": ["HR Directeur", "Directeur HR"],
    "CEO": ["CEO", "Directeur", "Algemeen Directeur"],
    "Managing Director": ["Algemeen Directeur", "Managing Director"],
    "Director": ["Directeur"],
    "Partner": ["Partner", "Vennoot"],
    "Founder": ["Oprichter", "Medeoprichter"],
    "Attorney": ["Advocaat"],
    "Lawyer": ["Advocaat", "Jurist"],
  },
  pt: {
    "Recruiter": ["Recrutador", "Recrutadora"],
    "HR Manager": ["Gerente de RH", "Gestor de Recursos Humanos"],
    "HR Director": ["Diretor de RH", "Diretora de RH"],
    "CEO": ["CEO", "Diretor Executivo", "Diretora Executiva"],
    "Managing Director": ["Diretor Geral", "Diretora Geral"],
    "Director": ["Diretor", "Diretora"],
    "Partner": ["Sócio", "Sócia"],
    "Founder": ["Fundador", "Fundadora"],
    "Attorney": ["Advogado", "Advogada"],
  },
  pl: {
    "Recruiter": ["Rekruter", "Rekruterka"],
    "HR Manager": ["Kierownik HR", "Manager HR"],
    "HR Director": ["Dyrektor HR"],
    "CEO": ["CEO", "Prezes", "Dyrektor Generalny"],
    "Managing Director": ["Dyrektor Zarządzający"],
    "Director": ["Dyrektor"],
    "Founder": ["Założyciel", "Założycielka"],
  },
  sv: {
    "Recruiter": ["Rekryterare"],
    "HR Manager": ["HR-chef", "Personalchef"],
    "HR Director": ["HR-direktör", "Personaldirektör"],
    "CEO": ["CEO", "VD", "Verkställande direktör"],
    "Managing Director": ["VD", "Verkställande direktör"],
    "Director": ["Direktör", "Chef"],
    "Founder": ["Grundare", "Medgrundare"],
  },
  da: {
    "Recruiter": ["Rekrutterer"],
    "HR Manager": ["HR-chef", "Personalechef"],
    "HR Director": ["HR-direktør"],
    "CEO": ["CEO", "Administrerende direktør"],
    "Managing Director": ["Administrerende direktør"],
    "Director": ["Direktør"],
    "Founder": ["Grundlægger"],
  },
  no: {
    "Recruiter": ["Rekrutterer"],
    "HR Manager": ["HR-sjef", "Personalsjef"],
    "HR Director": ["HR-direktør"],
    "CEO": ["CEO", "Administrerende direktør", "Daglig leder"],
    "Managing Director": ["Administrerende direktør"],
    "Director": ["Direktør"],
    "Founder": ["Grunnlegger"],
  },
  fi: {
    "Recruiter": ["Rekrytoija"],
    "HR Manager": ["HR-päällikkö", "Henkilöstöpäällikkö"],
    "HR Director": ["HR-johtaja", "Henkilöstöjohtaja"],
    "CEO": ["CEO", "Toimitusjohtaja"],
    "Managing Director": ["Toimitusjohtaja"],
    "Director": ["Johtaja"],
    "Founder": ["Perustaja"],
  },
  ja: {
    "Recruiter": ["リクルーター", "採用担当"],
    "HR Manager": ["人事マネージャー", "人事部長"],
    "HR Director": ["人事部長", "人事ディレクター"],
    "CEO": ["CEO", "代表取締役", "社長"],
    "CTO": ["CTO", "最高技術責任者"],
    "Managing Director": ["代表取締役"],
    "Director": ["ディレクター", "部長"],
    "Founder": ["創業者", "ファウンダー"],
  },
  zh: {
    "Recruiter": ["招聘专员", "招聘经理"],
    "HR Manager": ["人力资源经理", "人事经理"],
    "HR Director": ["人力资源总监", "人事总监"],
    "CEO": ["CEO", "首席执行官", "总裁"],
    "CTO": ["CTO", "首席技术官"],
    "Managing Director": ["总经理"],
    "Director": ["总监", "董事"],
    "Founder": ["创始人"],
  },
  ko: {
    "Recruiter": ["채용담당자", "리크루터"],
    "HR Manager": ["인사매니저", "인사부장"],
    "HR Director": ["인사이사"],
    "CEO": ["CEO", "대표이사"],
    "Managing Director": ["대표이사"],
    "Director": ["이사", "디렉터"],
    "Founder": ["창업자"],
  },
  ar: {
    "Recruiter": ["مسؤول التوظيف"],
    "HR Manager": ["مدير الموارد البشرية"],
    "HR Director": ["مدير إدارة الموارد البشرية"],
    "CEO": ["الرئيس التنفيذي", "المدير العام"],
    "Managing Director": ["المدير العام"],
    "Director": ["مدير"],
    "Founder": ["مؤسس"],
  },
  he: {
    "Recruiter": ["מגייס", "מגייסת"],
    "HR Manager": ["מנהל משאבי אנוש", "מנהלת משאבי אנוש"],
    "HR Director": ["סמנכ\"ל משאבי אנוש"],
    "CEO": ["מנכ\"ל"],
    "Managing Director": ["מנכ\"ל"],
    "Director": ["מנהל", "מנהלת"],
    "Founder": ["מייסד", "מייסדת"],
  },
}

function getLanguagesForLocations(locationSlugs: string[]): string[] {
  const languages = new Set<string>()
  for (const slug of locationSlugs) {
    for (const [lang, locations] of Object.entries(languageLocationMap)) {
      if (locations.includes(slug.toLowerCase())) {
        languages.add(lang)
      }
    }
  }
  return Array.from(languages)
}

function expandRolesWithTranslations(englishRoles: string[], locationSlugs: string[]): string[] {
  const languages = getLanguagesForLocations(locationSlugs)
  const allRoles = new Set<string>(englishRoles)
  
  for (const lang of languages) {
    const langTranslations = roleTranslations[lang]
    if (!langTranslations) continue
    
    for (const englishRole of englishRoles) {
      const translations = langTranslations[englishRole]
      if (translations) {
        translations.forEach(t => allRoles.add(t))
      }
    }
  }
  
  return Array.from(allRoles)
}
// ============ End Role Title Translations ============

interface WorkExperience {
  company: string
  title: string
  duration?: string
}

interface CandidateData {
  candidate_id: string
  name: string
  current_title: string
  location: string
  email?: string
  phone?: string
  summary?: string
  skills: string[]
  work_history: WorkExperience[]
}

interface Preference {
  industry: string
  companies: string
  exclusions: string
  locations?: string[]
  targetRoles?: string[]
  sectors?: string[]
  targetCompany?: string
  signalTitle?: string // For fallback company extraction
  signalRegion?: string // For location widening
}

interface ApolloContact {
  name: string
  title: string
  location: string
  email: string
  company: string
}

interface ApolloSearchPayload {
  person_titles?: string[]
  person_locations?: string[]
  q_organization_name?: string
  organization_industry_tag_ids?: string[]
  page?: number
  per_page?: number
}

// ============ Company Name Normalization & Matching ============
const COMPANY_SUFFIXES = [
  'ltd', 'limited', 'llc', 'inc', 'incorporated', 'corp', 'corporation',
  'plc', 'gmbh', 'ag', 'sa', 'sas', 'sarl', 'bv', 'nv', 'co', 'company',
  'capital', 'partners', 'ventures', 'equity', 'advisors', 'advisory',
  'management', 'group', 'holdings', 'fund', 'investments', 'asset',
  'uk', 'us', 'europe', 'eu', 'global', 'international', 'intl'
]

function normalizeCompanyName(name: string): string {
  if (!name) return ''
  let normalized = name
    .toLowerCase()
    .trim()
    .replace(/[''`]/g, "'") // Normalize quotes
    .replace(/[^\w\s'-]/g, ' ') // Remove special chars except apostrophe/hyphen
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim()
  return normalized
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
  
  // Exact match
  if (normTarget === normCandidate) return true
  
  // Stripped suffix match
  const strippedTarget = stripCompanySuffixes(target)
  const strippedCandidate = stripCompanySuffixes(candidate)
  if (strippedTarget === strippedCandidate) return true
  
  // One contains the other (for cases like "Fleet" vs "Fleet Technologies")
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

// Keywords in selected industries that indicate user wants to target legal sector
const LEGAL_INTENT_KEYWORDS = ['legal', 'law', 'solicitor', 'attorney', 'barrister', 'counsel']

function hasLegalIndustryIntent(selectedIndustries: string[]): boolean {
  if (!selectedIndustries || selectedIndustries.length === 0) return false
  
  for (const industry of selectedIndustries) {
    const industryLower = (industry || '').toLowerCase()
    for (const keyword of LEGAL_INTENT_KEYWORDS) {
      if (industryLower.includes(keyword)) {
        return true
      }
    }
  }
  return false
}

function isLawFirm(companyName: string, industry?: string | null, skipExclusion = false): boolean {
  // If user is specifically targeting legal industry, don't exclude law firms
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

// Extract company from signal title (fallback when signal.company fails)
function extractCompanyFromSignalTitle(title: string): string {
  if (!title) return ''
  
  // Clean title - remove leading descriptors
  let cleanTitle = title
    .replace(/^(breaking|exclusive|update|report|news|watch):\s*/i, "")
    .replace(/^(french|german|uk|british|european|spanish|dutch|swiss|us|american)\s+/i, "")
    .replace(/^(fintech|proptech|healthtech|edtech|insurtech|legaltech|deeptech|biotech|cleantech)\s+/i, "")
    .replace(/^(it\s+)?scale-up\s+/i, "")
    .replace(/^startup\s+/i, "")
    .trim()
  
  // Extract company BEFORE common action verbs
  const verbPattern = /^([A-Z][A-Za-z0-9''\-\.&\s]{1,40}?)\s+(?:raises|closes|secures|announces|completes|launches|acquires|enters|targets|opens|hires|appoints|names|promotes|backs|invests|exits|sells|buys|takes|signs|expands|reaches|receives|lands|wins|gets|has|is|to|in|at|for|joins|adds|extends)/i
  
  const match = cleanTitle.match(verbPattern)
  if (match) {
    let company = match[1]
      .trim()
      .replace(/['']s$/i, "") // Remove possessive
      .replace(/\s+/g, " ") // Normalize spaces
    
    // Skip if it's a generic phrase
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

// Region to country-level locations mapping (for widening)
const REGION_COUNTRY_LOCATIONS: Record<string, string[]> = {
  europe: ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Switzerland', 'Ireland', 'Spain', 'Italy', 'Belgium', 'Luxembourg', 'Sweden', 'Denmark', 'Norway', 'Finland', 'Austria', 'Poland', 'Portugal'],
  uae: ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Kuwait', 'Oman'],
  east_usa: ['New York', 'Massachusetts', 'Connecticut', 'New Jersey', 'Pennsylvania', 'Washington D.C.', 'Virginia', 'Maryland', 'Florida', 'Georgia', 'Illinois'],
  west_usa: ['California', 'Washington', 'Oregon', 'Colorado', 'Texas', 'Arizona'],
}

interface RetryStrategy {
  name: string
  companyName: string
  locations: string[]
}

function buildRetryStrategies(
  originalCompany: string,
  signalTitle: string,
  signalRegion: string,
  originalLocations: string[]
): RetryStrategy[] {
  const strategies: RetryStrategy[] = []
  
  // Strategy 1: Original company, original locations (already tried)
  
  // Strategy 2: Stripped suffixes company name
  const strippedCompany = stripCompanySuffixes(originalCompany)
  if (strippedCompany !== normalizeCompanyName(originalCompany)) {
    strategies.push({
      name: 'stripped_suffixes',
      companyName: strippedCompany,
      locations: originalLocations,
    })
  }
  
  // Strategy 3: Title-derived company name
  const titleCompany = extractCompanyFromSignalTitle(signalTitle)
  if (titleCompany && normalizeCompanyName(titleCompany) !== normalizeCompanyName(originalCompany)) {
    strategies.push({
      name: 'title_derived',
      companyName: titleCompany,
      locations: originalLocations,
    })
  }
  
  // Strategy 4: Widen to country-level locations
  const countryLocations = REGION_COUNTRY_LOCATIONS[signalRegion] || []
  if (countryLocations.length > 0) {
    strategies.push({
      name: 'widen_location',
      companyName: originalCompany,
      locations: countryLocations,
    })
    
    // Also try stripped company + widened locations
    if (strippedCompany !== normalizeCompanyName(originalCompany)) {
      strategies.push({
        name: 'stripped_widen',
        companyName: strippedCompany,
        locations: countryLocations,
      })
    }
  }
  
  // Strategy 5: No location filter (last resort)
  strategies.push({
    name: 'no_location_filter',
    companyName: originalCompany,
    locations: [],
  })
  
  return strategies
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { runId } = await req.json()

    console.log('Starting enrichment run:', runId)

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

    // Fetch Apollo API key
    const { data: apolloSetting } = await supabase
      .from('api_settings')
      .select('setting_value')
      .eq('setting_key', 'apollo_api_key')
      .single()

    const apolloApiKey = apolloSetting?.setting_value

    if (!apolloApiKey) {
      await supabase
        .from('enrichment_runs')
        .update({ 
          status: 'failed', 
          error_message: 'Apollo API key not configured. Please add it in Settings.' 
        })
        .eq('id', runId)

      return new Response(
        JSON.stringify({ error: 'Apollo API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const candidateData = (run.candidates_data as CandidateData[])?.[0]
    const preferences = run.preferences_data as Preference[]
    const maxContacts = run.search_counter || 100 // Use search_counter as max contacts
    const maxPerCompany = 4 // Allow up to 4 contacts per company for better coverage

    if (!candidateData) {
      throw new Error('No candidate data found')
    }

    // Extract companies from candidate's work history to exclude
    const excludedCompanies = new Set<string>()
    if (candidateData.work_history && Array.isArray(candidateData.work_history)) {
      candidateData.work_history.forEach(job => {
        if (job.company) {
          // Add normalized company name (lowercase, trimmed)
          excludedCompanies.add(job.company.toLowerCase().trim())
        }
      })
    }
    console.log('Excluding contacts from candidate\'s previous employers:', Array.from(excludedCompanies))

    // Fetch recently used contacts (within last 3 days) to exclude them
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    
    const { data: recentlyUsedContacts } = await supabase
      .from('used_contacts')
      .select('email')
      .gte('added_at', threeDaysAgo.toISOString())
    
    const usedEmails = new Set((recentlyUsedContacts || []).map(c => c.email.toLowerCase()))
    console.log(`Found ${usedEmails.size} recently used contacts to exclude`)

    // Search for hiring contacts based on industries
    const allContacts: ApolloContact[] = []
    const seenEmails = new Set<string>() // Track unique contacts by email
    const seenPersonIds = new Set<string>() // Track unique Apollo person IDs to prevent double-enrichment
    const companyContactCount: Record<string, number> = {}
    let processedCount = 0
    let creditsUsed = 0 // Track people/match calls for logging

    // Get target roles from preferences (all prefs share the same roles)
    // Fall back to default HR/Recruiting roles if not specified
    const defaultRoles = [
      'Recruiter', 'Talent Acquisition', 'HR Manager', 'Human Resources',
      'Hiring Manager', 'Head of Talent', 'People Operations', 'HR Director',
      'Talent Partner', 'HR Business Partner'
    ]
    const baseTargetRoles = preferences[0]?.targetRoles?.length ? preferences[0].targetRoles : defaultRoles

    // Get locations from preferences (all prefs share the same locations)
    const searchLocations = preferences[0]?.locations || []
    
    // Get target company if specified (for signal-based searches)
    const targetCompany = preferences[0]?.targetCompany || null
    const signalTitle = (preferences[0] as any)?.signalTitle || ''
    const signalRegion = (preferences[0] as any)?.signalRegion || ''
    const TARGET_COMPANY_MIN_CONTACTS = 10 // Stop when we find this many contacts at target company
    
    if (targetCompany) {
      console.log(`Signal-based search: targeting company "${targetCompany}"`)
      console.log(`Will retry with fallback strategies until ${TARGET_COMPANY_MIN_CONTACTS} contacts found`)
    }
    
    // Expand target roles with native language translations based on selected locations
    const targetRoles = expandRolesWithTranslations(baseTargetRoles, searchLocations)
    const detectedLanguages = getLanguagesForLocations(searchLocations)
    
    if (detectedLanguages.length > 0) {
      console.log(`Detected languages from locations: ${detectedLanguages.join(', ')}`)
      console.log(`Expanded ${baseTargetRoles.length} base roles to ${targetRoles.length} total (including translations)`)
    }
    
    // Map location values to human-readable names for Apollo
    const locationLabels: Record<string, string> = {
      'new-york': 'New York, NY',
      'los-angeles': 'Los Angeles, CA',
      'chicago': 'Chicago, IL',
      'houston': 'Houston, TX',
      'san-francisco': 'San Francisco, CA',
      'boston': 'Boston, MA',
      'miami': 'Miami, FL',
      'dallas': 'Dallas, TX',
      'seattle': 'Seattle, WA',
      'denver': 'Denver, CO',
      'atlanta': 'Atlanta, GA',
      'austin': 'Austin, TX',
      'london': 'London, United Kingdom',
      'manchester': 'Manchester, United Kingdom',
      'birmingham': 'Birmingham, United Kingdom',
      'edinburgh': 'Edinburgh, United Kingdom',
      'paris': 'Paris, France',
      'berlin': 'Berlin, Germany',
      'frankfurt': 'Frankfurt, Germany',
      'munich': 'Munich, Germany',
      'hamburg': 'Hamburg, Germany',
      'dusseldorf': 'Dusseldorf, Germany',
      'amsterdam': 'Amsterdam, Netherlands',
      'rotterdam': 'Rotterdam, Netherlands',
      'zurich': 'Zurich, Switzerland',
      'geneva': 'Geneva, Switzerland',
      'basel': 'Basel, Switzerland',
      'dublin': 'Dublin, Ireland',
      'cork': 'Cork, Ireland',
      'madrid': 'Madrid, Spain',
      'barcelona': 'Barcelona, Spain',
      'milan': 'Milan, Italy',
      'rome': 'Rome, Italy',
      'lisbon': 'Lisbon, Portugal',
      'porto': 'Porto, Portugal',
      'vienna': 'Vienna, Austria',
      'brussels': 'Brussels, Belgium',
      'antwerp': 'Antwerp, Belgium',
      'luxembourg-city': 'Luxembourg City, Luxembourg',
      'stockholm': 'Stockholm, Sweden',
      'gothenburg': 'Gothenburg, Sweden',
      'copenhagen': 'Copenhagen, Denmark',
      'oslo': 'Oslo, Norway',
      'helsinki': 'Helsinki, Finland',
      'warsaw': 'Warsaw, Poland',
      'krakow': 'Krakow, Poland',
      'singapore': 'Singapore',
      'hong-kong': 'Hong Kong',
      'tokyo': 'Tokyo, Japan',
      'osaka': 'Osaka, Japan',
      'sydney': 'Sydney, Australia',
      'melbourne': 'Melbourne, Australia',
      'mumbai': 'Mumbai, India',
      'bangalore': 'Bangalore, India',
      'delhi': 'Delhi, India',
      'shanghai': 'Shanghai, China',
      'beijing': 'Beijing, China',
      'shenzhen': 'Shenzhen, China',
      'seoul': 'Seoul, South Korea',
      'dubai': 'Dubai, UAE',
      'abu-dhabi': 'Abu Dhabi, UAE',
      'riyadh': 'Riyadh, Saudi Arabia',
      'tel-aviv': 'Tel Aviv, Israel',
      'toronto': 'Toronto, Canada',
      'vancouver': 'Vancouver, Canada',
      'montreal': 'Montreal, Canada',
      'mexico-city': 'Mexico City, Mexico',
      'sao-paulo': 'São Paulo, Brazil',
      'rio': 'Rio de Janeiro, Brazil',
    }
    
    const apolloLocations = searchLocations.map(loc => locationLabels[loc] || loc)

    // Build all search combinations: industries × sectors (OR logic for maximum coverage)
    // If no sectors, just use industries. If no industries, just use sectors.
    const allIndustries = preferences.map(p => p.industry).filter(Boolean)
    const allSectors = preferences[0]?.sectors || []
    
    interface SearchCombo {
      industry: string | null
      sector: string | null
      label: string
    }
    
    const searchCombinations: SearchCombo[] = []
    
    if (allIndustries.length > 0 && allSectors.length > 0) {
      // Create all industry × sector combinations for maximum coverage
      for (const industry of allIndustries) {
        for (const sector of allSectors) {
          searchCombinations.push({
            industry,
            sector,
            label: `${industry} + ${sector}`
          })
        }
      }
      // Also search each industry alone (without sector constraint)
      for (const industry of allIndustries) {
        searchCombinations.push({
          industry,
          sector: null,
          label: `${industry} (no sector filter)`
        })
      }
    } else if (allIndustries.length > 0) {
      // Only industries selected
      for (const industry of allIndustries) {
        searchCombinations.push({
          industry,
          sector: null,
          label: industry
        })
      }
    } else if (allSectors.length > 0) {
      // Only sectors selected
      for (const sector of allSectors) {
        searchCombinations.push({
          industry: null,
          sector,
          label: sector
        })
      }
    } else {
      // No filters - run a single broad search
      searchCombinations.push({
        industry: null,
        sector: null,
        label: 'Broad search (no filters)'
      })
    }

    console.log(`Running ${searchCombinations.length} search combinations for maximum coverage:`, 
      searchCombinations.map(c => c.label))

    // Calculate equal distribution of contacts per industry
    // Group combinations by industry and allocate quota per industry
    const industryQuotas: Record<string, number> = {}
    const industryContacts: Record<string, ApolloContact[]> = {}
    
    if (allIndustries.length > 1) {
      const quotaPerIndustry = Math.floor(maxContacts / allIndustries.length)
      const remainder = maxContacts % allIndustries.length
      
      allIndustries.forEach((industry, idx) => {
        // Distribute remainder to first industries
        industryQuotas[industry] = quotaPerIndustry + (idx < remainder ? 1 : 0)
        industryContacts[industry] = []
      })
      
      console.log('Contact quotas per industry:', industryQuotas)
    }
    
    const useEqualDistribution = allIndustries.length > 1
    
    // Check if targeting legal sector (include law firms if so)
    const includeLawFirms = hasLegalIndustryIntent(allIndustries)
    if (includeLawFirms) {
      console.log('Legal industry intent detected - law firms will be INCLUDED in results')
    }

    // Search across each combination
    for (const combo of searchCombinations) {
      if (allContacts.length >= maxContacts) break
      
      // For equal distribution: check if this industry's quota is already filled
      const comboIndustry = combo.industry
      if (useEqualDistribution && comboIndustry) {
        const currentCount = industryContacts[comboIndustry]?.length || 0
        const quota = industryQuotas[comboIndustry] || 0
        if (currentCount >= quota) {
          console.log(`Skipping ${combo.label} - industry quota reached (${currentCount}/${quota})`)
          continue
        }
      }

      try {
        // Build query params for new API search endpoint
        const queryParams = new URLSearchParams()
        
        // Add target roles
        targetRoles.forEach(title => queryParams.append('person_titles[]', title))
        
        // Add locations
        if (apolloLocations.length > 0) {
          apolloLocations.forEach(loc => queryParams.append('person_locations[]', loc))
        }
        
        // Add target company filter if specified (signal-based search)
        if (targetCompany) {
          queryParams.append('q_organization_name', targetCompany)
          console.log(`Filtering by company: ${targetCompany}`)
        }
        
        // Build optimized keyword query from industry and/or sector
        const qKeywords = buildApolloKeywordQuery(combo.industry, combo.sector)

        if (qKeywords) {
          queryParams.append('q_keywords', qKeywords)
          console.log(`Search [${combo.label}] - Apollo keywords:`, qKeywords)
        } else {
          console.log(`Search [${combo.label}] - No keyword filter (broad search)`)
        }
        
        // Use pagination to get more results - fetch up to 5 pages per combination for better coverage
        const maxPages = 5
        let currentPage = 1
        let hasMoreResults = true
        
        while (hasMoreResults && currentPage <= maxPages && allContacts.length < maxContacts) {
          const perPage = 100 // Always request max per page for efficiency
          
          const pageParams = new URLSearchParams(queryParams)
          pageParams.set('per_page', String(perPage))
          pageParams.set('page', String(currentPage))

          // Use the new api_search endpoint (note: /api/v1/ not /v1/)
          const searchUrl = `https://api.apollo.io/api/v1/mixed_people/api_search?${pageParams.toString()}`
          if (currentPage === 1) {
            console.log('Apollo search URL params:', pageParams.toString())
          }
          
          const apolloResponse = await fetch(searchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apolloApiKey,
            },
          })

          if (apolloResponse.ok) {
            const apolloData = await apolloResponse.json()
            let people = apolloData.people || []
            const totalAvailable = apolloData.pagination?.total_entries || 0

            console.log(`Apollo page ${currentPage}: ${people.length} people returned (total available: ${totalAvailable})`)

            // If no results on first page with sector, retry without sector constraint
            if (people.length === 0 && currentPage === 1 && combo.sector && combo.industry) {
              try {
                console.log('No people found; retrying without sector keyword...')
                const retryParams = new URLSearchParams(pageParams)
                retryParams.delete('q_keywords')
                // Use industry-only keyword for retry
                const industryOnlyKeyword = buildApolloKeywordQuery(combo.industry, null)
                if (industryOnlyKeyword) {
                  retryParams.append('q_keywords', industryOnlyKeyword)
                }

                const retryUrl = `https://api.apollo.io/api/v1/mixed_people/api_search?${retryParams.toString()}`
                const retryResponse = await fetch(retryUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apolloApiKey,
                  },
                })

                if (retryResponse.ok) {
                  const retryData = await retryResponse.json()
                  people = retryData.people || []
                  console.log('Apollo people returned (retry):', people.length)
                } else {
                  const errorText = await retryResponse.text()
                  console.error('Apollo retry error:', retryResponse.status, errorText)
                }
              } catch (retryError) {
                console.error('Apollo retry exception:', retryError)
              }
            }
            
            // Stop pagination if no more results
            if (people.length === 0) {
              hasMoreResults = false
              break
            }
            
            // Process contacts - use email from search if available, otherwise mark for enrichment
            const contactsWithEmail: ApolloContact[] = []
            const peopleToEnrich: Array<{id: string, name: string, title: string, company: string, location: string}> = []
            
            // Determine quota limit for this combination's industry
            const comboIndustryQuota = (useEqualDistribution && comboIndustry) 
              ? (industryQuotas[comboIndustry] || maxContacts) 
              : maxContacts
            const currentIndustryCount = (useEqualDistribution && comboIndustry)
              ? (industryContacts[comboIndustry]?.length || 0)
              : 0
            
            for (const person of people) {
              if (allContacts.length + contactsWithEmail.length + peopleToEnrich.length >= maxContacts) break
              
              // For equal distribution: check industry-specific quota
              if (useEqualDistribution && comboIndustry) {
                if (currentIndustryCount + contactsWithEmail.length + peopleToEnrich.length >= comboIndustryQuota) {
                  console.log(`Industry ${comboIndustry} quota reached, stopping collection`)
                  break
                }
              }
              
              const companyName = person.organization?.name || person.organization_name || 'Unknown'
              const personIndustry = person.organization?.industry || null
              const personLocation = person.city || person.state || person.country || 'Unknown'
              
              // For signal-based searches: STRICT company matching
              if (targetCompany) {
                if (!companiesMatch(targetCompany, companyName)) {
                  // Skip contacts not from target company
                  continue
                }
              }
              
              // Exclude law firms (they often appear in PE/Buy Side searches as deal advisors)
              // Skip exclusion if user is targeting legal sector
              if (isLawFirm(companyName, personIndustry, includeLawFirms)) {
                continue
              }
              
              // Skip contacts from candidate's previous employers
              const normalizedCompany = companyName.toLowerCase().trim()
              const isExcludedCompany = Array.from(excludedCompanies).some(excluded => 
                normalizedCompany.includes(excluded) || excluded.includes(normalizedCompany)
              )
              if (isExcludedCompany) {
                continue
              }
              
              // Check max per company limit (relax for target company searches)
              const effectiveMaxPerCompany = targetCompany ? 50 : maxPerCompany // Allow more for target company
              if ((companyContactCount[companyName] || 0) >= effectiveMaxPerCompany) {
                continue
              }
              
              // Check if we already have this contact
              const isDuplicate = allContacts.some(c => 
                c.name === person.name && c.company === companyName
              )
              
              if (isDuplicate) continue
              
              const personName = person.name || 'Unknown'
              const personTitle = person.title || 'Unknown'
              
              // Build location from search data
              const locationParts = [person.city, person.state, person.country].filter(Boolean)
              const fullLocation = locationParts.length > 0 ? locationParts.join(', ') : personLocation
              
              // Check if email is already available from search results (SAVES 1 CREDIT!)
              if (person.email) {
                const emailLower = person.email.toLowerCase()
                
                // Check for duplicates and recently used
                if (usedEmails.has(emailLower)) {
                  console.log(`Skipping recently used contact: ${personName} (${person.email})`)
                  continue
                }
                if (seenEmails.has(emailLower)) {
                  console.log(`Skipping duplicate: ${personName} (${person.email})`)
                  continue
                }
                
                // Add directly without enrichment call
                const newContact: ApolloContact = {
                  name: personName,
                  title: personTitle,
                  location: fullLocation,
                  email: person.email,
                  company: companyName,
                }
                
                contactsWithEmail.push(newContact)
                seenEmails.add(emailLower)
                companyContactCount[companyName] = (companyContactCount[companyName] || 0) + 1
                console.log(`[Direct] Adding contact: ${personName} at ${companyName} (email from search)`)
              } else if (person.id && !seenPersonIds.has(person.id)) {
                // No email in search results - need to enrich (only if not already seen)
                seenPersonIds.add(person.id) // Mark as seen to prevent duplicate enrichment
                peopleToEnrich.push({
                  id: person.id,
                  name: personName,
                  title: personTitle,
                  company: companyName,
                  location: fullLocation,
                })
                companyContactCount[companyName] = (companyContactCount[companyName] || 0) + 1
              }
            }
            
            // Add contacts that had emails directly from search
            for (const contact of contactsWithEmail) {
              // Track per-industry for equal distribution
              if (useEqualDistribution && comboIndustry) {
                const quota = industryQuotas[comboIndustry] || 0
                const currentCount = industryContacts[comboIndustry]?.length || 0
                if (currentCount >= quota) {
                  console.log(`Skipping - industry ${comboIndustry} quota full (${currentCount}/${quota})`)
                  continue
                }
                industryContacts[comboIndustry].push(contact)
                console.log(`Adding contact for ${comboIndustry}: ${contact.name} at ${contact.company} (${currentCount + 1}/${quota})`)
              }
              allContacts.push(contact)
            }
            
            console.log(`Found ${contactsWithEmail.length} contacts with email from search, ${peopleToEnrich.length} need enrichment`)
          
            // Only enrich people who didn't have emails in search results (FALLBACK)
            // CREDIT OPTIMIZATION: Only enrich as many as we need to reach quota
            if (peopleToEnrich.length > 0) {
              // Calculate how many more contacts we actually need
              const contactsStillNeeded = useEqualDistribution && comboIndustry
                ? Math.max(0, (industryQuotas[comboIndustry] || 0) - (industryContacts[comboIndustry]?.length || 0))
                : Math.max(0, maxContacts - allContacts.length)
              
              // Only enrich up to what we need (saves credits!)
              const enrichLimit = Math.min(peopleToEnrich.length, contactsStillNeeded)
              const limitedPeopleToEnrich = peopleToEnrich.slice(0, enrichLimit)
              
              if (limitedPeopleToEnrich.length < peopleToEnrich.length) {
                console.log(`CREDIT SAVER: Only enriching ${limitedPeopleToEnrich.length}/${peopleToEnrich.length} (quota limit reached)`)
              } else {
                console.log(`Enriching ${limitedPeopleToEnrich.length} contacts to get emails...`)
              }
              
              for (let i = 0; i < limitedPeopleToEnrich.length; i += 10) {
                // Double-check we still need contacts before each batch
                if (allContacts.length >= maxContacts) {
                  console.log('CREDIT SAVER: Stopping enrichment - global quota reached')
                  break
                }
                if (useEqualDistribution && comboIndustry) {
                  const currentCount = industryContacts[comboIndustry]?.length || 0
                  const quota = industryQuotas[comboIndustry] || 0
                  if (currentCount >= quota) {
                    console.log(`CREDIT SAVER: Stopping enrichment - industry ${comboIndustry} quota reached`)
                    break
                  }
                }
                
                const batch = limitedPeopleToEnrich.slice(i, i + 10)
                
                for (const personData of batch) {
                  // Final check before each individual enrichment call
                  if (allContacts.length >= maxContacts) break
                  if (useEqualDistribution && comboIndustry) {
                    const currentCount = industryContacts[comboIndustry]?.length || 0
                    const quota = industryQuotas[comboIndustry] || 0
                    if (currentCount >= quota) break
                  }
                  
                  try {
                    const enrichResponse = await fetch('https://api.apollo.io/api/v1/people/match', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apolloApiKey,
                      },
                      body: JSON.stringify({ id: personData.id }),
                    })
                    creditsUsed++ // Track credit usage
                    
                    if (enrichResponse.ok) {
                      const enriched = await enrichResponse.json()
                      const person = enriched.person || {}
                      
                      // Get full details from enrichment response
                      const email = person.email || ''
                      const fullName = person.name || (person.first_name && person.last_name 
                        ? `${person.first_name} ${person.last_name}`.trim() 
                        : personData.name)
                      
                      // Build location from enrichment data
                      const locationParts = [
                        person.city,
                        person.state,
                        person.country
                      ].filter(Boolean)
                      const fullLocation = locationParts.length > 0 ? locationParts.join(', ') : personData.location
                      
                      // Get company from enrichment if available
                      const companyName = person.organization?.name || personData.company
                      
                      // Get job title from enrichment
                      const jobTitle = person.title || personData.title || 'Unknown'
                      
                      // Only add if we got an email and a valid name
                      if (email && fullName && fullName !== 'Unknown') {
                        const emailLower = email.toLowerCase()
                        // Check if this contact was recently used
                        if (usedEmails.has(emailLower)) {
                          console.log(`Skipping recently used contact: ${fullName} (${email})`)
                        } else if (seenEmails.has(emailLower)) {
                          // Skip duplicates from other search combinations
                          console.log(`Skipping duplicate from other search: ${fullName} (${email})`)
                        } else {
                          const newContact: ApolloContact = {
                            name: fullName,
                            title: jobTitle,
                            location: fullLocation,
                            email: email,
                            company: companyName,
                          }
                          
                          // Track per-industry for equal distribution
                          if (useEqualDistribution && comboIndustry) {
                            const quota = industryQuotas[comboIndustry] || 0
                            const currentCount = industryContacts[comboIndustry]?.length || 0
                            if (currentCount >= quota) {
                              console.log(`Skipping - industry ${comboIndustry} quota full (${currentCount}/${quota})`)
                              continue
                            }
                            industryContacts[comboIndustry].push(newContact)
                            console.log(`[Enriched] Adding contact for ${comboIndustry}: ${fullName} at ${companyName} (${currentCount + 1}/${quota})`)
                          } else {
                            console.log(`[Enriched] Adding contact: ${fullName} at ${companyName}`)
                          }
                          
                          seenEmails.add(emailLower)
                          allContacts.push(newContact)
                        }
                      } else {
                        console.log('Skipping contact with missing data:', { name: fullName, email: !!email })
                      }
                    } else {
                      console.log('Enrichment failed for', personData.name)
                    }
                    
                    // Small delay between enrichment calls
                    await new Promise(resolve => setTimeout(resolve, 100))
                  } catch (enrichError) {
                    console.error('Enrichment error for', personData.name, enrichError)
                  }
                }
              }
            }
          } else {
            const errorText = await apolloResponse.text()
            console.error('Apollo API error:', apolloResponse.status, errorText)
            hasMoreResults = false
          }
          
          currentPage++
          
          // Small delay to avoid rate limiting between pages
          await new Promise(resolve => setTimeout(resolve, 200))
        } // end while loop

        processedCount++
        
        // Update progress
        await supabase
          .from('enrichment_runs')
          .update({ processed_count: processedCount })
          .eq('id', runId)

      } catch (error) {
        console.error(`Error searching for combination ${combo.label}:`, error)
        processedCount++
      }
    }

    // ============ SIGNAL-BASED RETRY LOOP ============
    // If this is a signal-based search and we haven't found enough contacts, try retry strategies
    if (targetCompany && allContacts.length < TARGET_COMPANY_MIN_CONTACTS) {
      console.log(`\n=== SIGNAL RETRY LOOP ===`)
      console.log(`Only found ${allContacts.length} contacts at "${targetCompany}", need ${TARGET_COMPANY_MIN_CONTACTS}`)
      
      const retryStrategies = buildRetryStrategies(targetCompany, signalTitle, signalRegion, apolloLocations)
      console.log(`Trying ${retryStrategies.length} retry strategies...`)
      
      for (const strategy of retryStrategies) {
        if (allContacts.length >= TARGET_COMPANY_MIN_CONTACTS) {
          console.log(`Target reached (${allContacts.length} contacts), stopping retries`)
          break
        }
        
        console.log(`\n--- Retry strategy: ${strategy.name} ---`)
        console.log(`Company: "${strategy.companyName}", Locations: ${strategy.locations.length > 0 ? strategy.locations.slice(0, 3).join(', ') + '...' : 'none'}`)
        
        try {
          // Build query params for retry
          const retryParams = new URLSearchParams()
          targetRoles.forEach(title => retryParams.append('person_titles[]', title))
          
          // Add locations (may be widened)
          if (strategy.locations.length > 0) {
            strategy.locations.forEach(loc => retryParams.append('person_locations[]', loc))
          }
          
          // Use the strategy's company name
          retryParams.append('q_organization_name', strategy.companyName)
          
          // Search more pages for retries
          const maxRetryPages = 10
          let currentPage = 1
          let hasMoreResults = true
          
          while (hasMoreResults && currentPage <= maxRetryPages && allContacts.length < TARGET_COMPANY_MIN_CONTACTS) {
            const pageParams = new URLSearchParams(retryParams)
            pageParams.set('per_page', '100')
            pageParams.set('page', String(currentPage))
            
            const searchUrl = `https://api.apollo.io/api/v1/mixed_people/api_search?${pageParams.toString()}`
            if (currentPage === 1) {
              console.log(`Retry search params:`, pageParams.toString().substring(0, 200) + '...')
            }
            
            const apolloResponse = await fetch(searchUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apolloApiKey,
              },
            })
            
            if (apolloResponse.ok) {
              const apolloData = await apolloResponse.json()
              const people = apolloData.people || []
              console.log(`Retry page ${currentPage}: ${people.length} people`)
              
              if (people.length === 0) {
                hasMoreResults = false
                break
              }
              
              // Process people with strict company matching - use email from search if available
              const contactsWithEmail: ApolloContact[] = []
              const peopleToEnrich: Array<{id: string, name: string, title: string, company: string, location: string}> = []
              
              for (const person of people) {
                if (allContacts.length + contactsWithEmail.length + peopleToEnrich.length >= maxContacts) break
                
                const personCompanyName = person.organization?.name || person.organization_name || 'Unknown'
                const personIndustry = person.organization?.industry || null
                const personLocation = person.city || person.state || person.country || 'Unknown'
                
                // STRICT company matching - must match target
                if (!companiesMatch(targetCompany, personCompanyName)) {
                  continue
                }
                
                // Exclude law firms (they often appear in PE/Buy Side searches as deal advisors)
                // Exclude law firms (they often appear in PE/Buy Side searches as deal advisors)
                // Skip exclusion if user is targeting legal sector
                if (isLawFirm(personCompanyName, personIndustry, includeLawFirms)) {
                  continue
                }
                
                // Skip excluded and duplicates
                const normalizedCompany = personCompanyName.toLowerCase().trim()
                const isExcludedCompany = Array.from(excludedCompanies).some(excluded => 
                  normalizedCompany.includes(excluded) || excluded.includes(normalizedCompany)
                )
                if (isExcludedCompany) continue
                
                const isDuplicate = allContacts.some(c => c.name === person.name && c.company === personCompanyName) ||
                                   seenEmails.has((person.email || '').toLowerCase())
                if (isDuplicate) continue
                
                const personName = person.name || 'Unknown'
                const personTitle = person.title || 'Unknown'
                const locationParts = [person.city, person.state, person.country].filter(Boolean)
                const fullLocation = locationParts.length > 0 ? locationParts.join(', ') : personLocation
                
                // Check if email is already available from search results (SAVES 1 CREDIT!)
                if (person.email) {
                  const emailLower = person.email.toLowerCase()
                  if (!usedEmails.has(emailLower) && !seenEmails.has(emailLower)) {
                    contactsWithEmail.push({
                      name: personName,
                      title: personTitle,
                      location: fullLocation,
                      email: person.email,
                      company: personCompanyName,
                    })
                    seenEmails.add(emailLower)
                    console.log(`[Retry Direct] Adding: ${personName} at ${personCompanyName} (email from search)`)
                  }
                } else if (person.id && !seenPersonIds.has(person.id)) {
                  seenPersonIds.add(person.id) // Mark as seen to prevent double enrichment
                  peopleToEnrich.push({
                    id: person.id,
                    name: personName,
                    title: personTitle,
                    company: personCompanyName,
                    location: fullLocation,
                  })
                }
              }
              
              // Add contacts that had emails directly from search
              for (const contact of contactsWithEmail) {
                if (allContacts.length >= TARGET_COMPANY_MIN_CONTACTS) break
                allContacts.push(contact)
              }
              
              console.log(`[Retry] Found ${contactsWithEmail.length} with email from search, ${peopleToEnrich.length} need enrichment`)
              
              // CREDIT OPTIMIZATION: Only enrich people we actually need
              if (peopleToEnrich.length > 0 && allContacts.length < TARGET_COMPANY_MIN_CONTACTS) {
                const contactsStillNeeded = TARGET_COMPANY_MIN_CONTACTS - allContacts.length
                const limitedPeopleToEnrich = peopleToEnrich.slice(0, contactsStillNeeded)
                
                if (limitedPeopleToEnrich.length < peopleToEnrich.length) {
                  console.log(`CREDIT SAVER: Only enriching ${limitedPeopleToEnrich.length}/${peopleToEnrich.length} for retry`)
                }
                
                for (let i = 0; i < limitedPeopleToEnrich.length; i += 10) {
                  if (allContacts.length >= TARGET_COMPANY_MIN_CONTACTS) break
                  
                  const batch = limitedPeopleToEnrich.slice(i, i + 10)
                  
                  for (const personData of batch) {
                    if (allContacts.length >= TARGET_COMPANY_MIN_CONTACTS) break
                    
                    try {
                      const enrichResponse = await fetch('https://api.apollo.io/api/v1/people/match', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-api-key': apolloApiKey,
                        },
                        body: JSON.stringify({ id: personData.id }),
                      })
                      creditsUsed++ // Track credit usage
                      
                      if (enrichResponse.ok) {
                        const enriched = await enrichResponse.json()
                        const person = enriched.person || {}
                        
                        const email = person.email || ''
                        const fullName = person.name || personData.name
                        const companyName = person.organization?.name || personData.company
                        const jobTitle = person.title || personData.title || 'Unknown'
                        const locationParts = [person.city, person.state, person.country].filter(Boolean)
                        const fullLocation = locationParts.length > 0 ? locationParts.join(', ') : personData.location
                        
                        if (email && fullName && fullName !== 'Unknown') {
                          const emailLower = email.toLowerCase()
                          if (!usedEmails.has(emailLower) && !seenEmails.has(emailLower)) {
                            seenEmails.add(emailLower)
                            allContacts.push({
                              name: fullName,
                              title: jobTitle,
                              location: fullLocation,
                              email: email,
                              company: companyName,
                            })
                            console.log(`[Retry Enriched] Added: ${fullName} at ${companyName} (total: ${allContacts.length})`)
                          }
                        }
                      }
                      
                      await new Promise(resolve => setTimeout(resolve, 100))
                    } catch (enrichError) {
                      console.error('Retry enrichment error:', enrichError)
                    }
                  }
                }
              }
            } else {
              const errorText = await apolloResponse.text()
              console.error(`Retry Apollo error:`, apolloResponse.status, errorText.substring(0, 200))
              hasMoreResults = false
            }
            
            currentPage++
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        } catch (retryError) {
          console.error(`Retry strategy ${strategy.name} failed:`, retryError)
        }
      }
      
      console.log(`\n=== RETRY COMPLETE: Found ${allContacts.length} total contacts ===\n`)
    }
    // ============ END SIGNAL RETRY LOOP ============

    if (allContacts.length > 0) {
      const contactsToSave = allContacts.map(c => ({
        email: c.email.toLowerCase(),
        name: c.name,
        company: c.company,
      }))
      
      // Use upsert to handle duplicates (update added_at if already exists)
      const { error: saveError } = await supabase
        .from('used_contacts')
        .upsert(contactsToSave, { 
          onConflict: 'email',
          ignoreDuplicates: false // Update the timestamp when re-adding
        })
      
      if (saveError) {
        console.error('Error saving used contacts:', saveError)
      } else {
        console.log(`Saved ${allContacts.length} contacts to used_contacts table`)
      }
    }

    // Generate CSV content
    const csvHeader = 'Name,Title,Location,Email,Company'
    const csvRows = allContacts.map(c => 
      `"${escapeCSV(c.name)}","${escapeCSV(c.title)}","${escapeCSV(c.location)}","${escapeCSV(c.email)}","${escapeCSV(c.company)}"`
    )
    const csvContent = [csvHeader, ...csvRows].join('\n')

    // Determine status
    const status = allContacts.length === 0 ? 'failed' : 
                   allContacts.length < maxContacts ? 'partial' : 'success'

    // Update run with results
    await supabase
      .from('enrichment_runs')
      .update({
        status,
        processed_count: preferences.length,
        enriched_data: allContacts,
        enriched_csv_url: csvContent, // Store CSV content directly for now
        error_message: allContacts.length === 0 ? 'No contacts found matching criteria' : null,
      })
      .eq('id', runId)

    // Auto-export to Bullhorn if enabled and contacts found
    let bullhornResult = null
    if (run.bullhorn_enabled && allContacts.length > 0) {
      try {
        console.log('Auto-exporting to Bullhorn...')
        const bullhornUrl = `${supabaseUrl}/functions/v1/export-to-bullhorn`
        const bullhornResponse = await fetch(bullhornUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ runId }),
        })
        
        if (bullhornResponse.ok) {
          bullhornResult = await bullhornResponse.json()
          console.log('Bullhorn auto-export complete:', bullhornResult)
        } else {
          const errorText = await bullhornResponse.text()
          console.error('Bullhorn auto-export failed:', errorText)
        }
      } catch (bhError: any) {
        console.error('Bullhorn auto-export error:', bhError.message)
      }
    }

    // Log credit usage summary
    const directContacts = allContacts.length - creditsUsed
    console.log(`\n=== CREDIT USAGE SUMMARY ===`)
    console.log(`Total contacts saved: ${allContacts.length}`)
    console.log(`Direct (free): ${Math.max(0, directContacts)} contacts`)
    console.log(`Enriched (paid): ${creditsUsed} credits used`)
    console.log(`Efficiency: ${allContacts.length > 0 ? ((directContacts / allContacts.length) * 100).toFixed(1) : 0}% free`)
    console.log(`============================\n`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        contactsFound: allContacts.length,
        contacts: allContacts, // Return actual contacts for immediate use
        status,
        bullhornExport: bullhornResult,
        creditUsage: {
          totalContacts: allContacts.length,
          directContacts: Math.max(0, directContacts),
          enrichedContacts: creditsUsed,
          creditsUsed: creditsUsed,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Enrichment error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function escapeCSV(value: string): string {
  if (!value) return ''
  return value.replace(/"/g, '""')
}

function normalizeApolloKeyword(value: string): string {
  if (!value) return ''
  // Remove parenthetical abbreviations, normalize to clean keywords
  return value
    .replace(/\([^)]*\)/g, ' ') // remove (VC), (PE), etc.
    .replace(/&/g, 'and')       // Apollo prefers "and" over "&"
    .replace(/[-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Map industries to Apollo-optimized search terms
const INDUSTRY_TO_APOLLO_KEYWORDS: Record<string, string[]> = {
  'private equity (pe)': ['private equity', 'buyout', 'portfolio company'],
  'private equity': ['private equity', 'buyout', 'portfolio company'],
  'venture capital (vc)': ['venture capital', 'startup investing', 'early stage'],
  'venture capital': ['venture capital', 'startup investing', 'early stage'],
  'hedge fund': ['hedge fund', 'investment management', 'trading'],
  'asset management': ['asset management', 'investment management', 'portfolio management'],
  'wealth management': ['wealth management', 'private banking', 'family office'],
  'investment banking': ['investment banking', 'mergers acquisitions', 'capital markets'],
  'mergers & acquisitions (m&a)': ['mergers acquisitions', 'ma advisory', 'deal advisory'],
  'capital markets': ['capital markets', 'equity capital markets', 'debt capital markets'],
  'equity capital markets (ecm)': ['equity capital markets', 'ipo', 'equity offerings'],
  'debt capital markets (dcm)': ['debt capital markets', 'bond issuance', 'credit markets'],
  'leveraged finance': ['leveraged finance', 'leveraged lending', 'high yield'],
  'restructuring': ['restructuring', 'turnaround', 'distressed'],
  'private credit': ['private credit', 'direct lending', 'private debt'],
  'direct lending': ['direct lending', 'middle market lending'],
  'strategy consulting': ['strategy consulting', 'management consulting', 'strategic advisory'],
  'management consulting': ['management consulting', 'business consulting'],
  'corporate finance': ['corporate finance', 'financial planning analysis'],
  'corporate development': ['corporate development', 'strategic initiatives', 'business development'],
  'real estate': ['real estate', 'property', 'commercial real estate'],
  'real estate private equity': ['real estate private equity', 'repe', 'property investment'],
  'infrastructure': ['infrastructure', 'infrastructure investing'],
  'fintech': ['fintech', 'financial technology', 'payments technology'],
  'payments': ['payments', 'payment processing', 'fintech'],
  'blockchain & crypto': ['blockchain', 'cryptocurrency', 'digital assets', 'web3'],
  'insurance': ['insurance', 'underwriting'],
  'reinsurance': ['reinsurance'],
  'quantitative trading': ['quantitative trading', 'algorithmic trading', 'systematic trading'],
  'sales & trading': ['sales trading', 'trading', 'securities'],
  'equity research': ['equity research', 'investment research', 'securities analysis'],
}

function getIndustryApolloKeywords(industry: string): string[] {
  const key = industry.toLowerCase().trim()
  return INDUSTRY_TO_APOLLO_KEYWORDS[key] || [normalizeApolloKeyword(industry)]
}

function getSectorKeywords(sectors: string[]): string[] {
  const sectorKeywordMap: Record<string, string[]> = {
    'energy-utilities': ['energy', 'utility', 'utilities', 'power', 'oil', 'gas', 'renewable', 'solar', 'wind', 'electric'],
    'energy & utilities': ['energy', 'utility', 'utilities', 'power', 'oil', 'gas', 'renewable', 'solar', 'wind', 'electric'],
    'technology': ['technology', 'tech', 'software', 'saas', 'it', 'computer', 'digital'],
    'healthcare': ['healthcare', 'health', 'medical', 'pharma', 'biotech', 'hospital', 'clinical'],
    'financial-services': ['financial', 'finance', 'banking', 'insurance', 'investment', 'capital'],
    'financial services': ['financial', 'finance', 'banking', 'insurance', 'investment', 'capital'],
    'industrial': ['industrial', 'manufacturing', 'machinery', 'equipment', 'engineering'],
    'consumer': ['consumer', 'retail', 'cpg', 'fmcg', 'brand'],
    'media-entertainment': ['media', 'entertainment', 'content', 'streaming', 'gaming'],
    'media & entertainment': ['media', 'entertainment', 'content', 'streaming', 'gaming'],
    'real-estate-construction': ['real estate', 'property', 'construction', 'building', 'housing'],
    'real estate & construction': ['real estate', 'property', 'construction', 'building', 'housing'],
    'transportation-logistics': ['transportation', 'logistics', 'shipping', 'freight', 'supply chain'],
    'transportation & logistics': ['transportation', 'logistics', 'shipping', 'freight', 'supply chain'],
    'retail-ecommerce': ['retail', 'ecommerce', 'e-commerce', 'shopping', 'store'],
    'retail & e-commerce': ['retail', 'ecommerce', 'e-commerce', 'shopping', 'store'],
    'telecommunications': ['telecom', 'telecommunications', 'wireless', 'mobile', 'network'],
    'manufacturing': ['manufacturing', 'factory', 'production', 'industrial'],
    'education': ['education', 'edtech', 'school', 'university', 'learning'],
    'agriculture': ['agriculture', 'agri', 'farming', 'agtech', 'food'],
    'government-public': ['government', 'public sector', 'federal', 'municipal'],
    'government & public sector': ['government', 'public sector', 'federal', 'municipal'],
  }

  const out: string[] = []
  for (const sector of sectors || []) {
    const sectorLower = (sector || '').toLowerCase().trim()
    const mapped = sectorKeywordMap[sectorLower]
    if (mapped?.length) {
      out.push(...mapped)
    } else {
      out.push(...sectorLower.split(/[\s&,\-\/]+/).filter(w => w.length > 2))
    }
  }

  return Array.from(new Set(out))
}

function getSectorPrimaryKeyword(sectors: string[]): string {
  const keywords = getSectorKeywords(sectors)
  // Prefer a broad, high-recall keyword to avoid over-constraining Apollo searches.
  if (keywords.includes('energy')) return 'energy'
  if (keywords.includes('technology')) return 'technology'
  if (keywords.includes('healthcare')) return 'healthcare'
  if (keywords.includes('financial')) return 'financial services'
  if (keywords.includes('industrial')) return 'industrial'
  if (keywords.includes('consumer')) return 'consumer'
  if (keywords.includes('media')) return 'media'
  if (keywords.includes('real estate')) return 'real estate'
  return keywords[0] || ''
}

// Build optimized Apollo keyword query from industry
function buildApolloKeywordQuery(industry: string | null, sector: string | null): string {
  const parts: string[] = []
  
  if (industry) {
    const industryKeywords = getIndustryApolloKeywords(industry)
    // Use the first (most specific) keyword for Apollo
    if (industryKeywords.length > 0) {
      parts.push(industryKeywords[0])
    }
  }
  
  if (sector) {
    const sectorKeyword = getSectorPrimaryKeyword([sector])
    if (sectorKeyword && !parts.some(p => p.includes(sectorKeyword))) {
      parts.push(sectorKeyword)
    }
  }
  
  return parts.join(' ')
}

