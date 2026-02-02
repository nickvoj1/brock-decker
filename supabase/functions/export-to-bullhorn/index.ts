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

interface LearnedPattern {
  pattern_type: 'company' | 'title' | 'location'
  pattern_value: string
  skills: string[]
  frequency: number
  confidence: number
}

// Cache for learned patterns (loaded once per function invocation)
let learnedPatternsCache: LearnedPattern[] | null = null

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

// Company name to skill mapping - specific firms get specific skills
// IMPORTANT: Use exact match patterns to avoid false positives
// E.g., "bain capital" should NOT match just "bain" to avoid confusion with Bain & Company
const COMPANY_SKILLS: Record<string, string[]> = {
  // Investment Banks (exact company names)
  'goldman sachs': ['CORPORATE BANKING', 'CAPITAL MARKETS', 'TIER 1'],
  'morgan stanley': ['CORPORATE BANKING', 'CAPITAL MARKETS', 'TIER 1'],
  'j.p. morgan': ['CORPORATE BANKING', 'CAPITAL MARKETS', 'TIER 1'],
  'jp morgan': ['CORPORATE BANKING', 'CAPITAL MARKETS', 'TIER 1'],
  'jpmorgan': ['CORPORATE BANKING', 'CAPITAL MARKETS', 'TIER 1'],
  'bank of america': ['CORPORATE BANKING', 'CAPITAL MARKETS', 'TIER 1'],
  'bofa securities': ['CORPORATE BANKING', 'CAPITAL MARKETS', 'TIER 1'],
  'citigroup': ['CORPORATE BANKING', 'CAPITAL MARKETS', 'TIER 1'],
  'citibank': ['CORPORATE BANKING', 'CAPITAL MARKETS', 'TIER 1'],
  'barclays': ['CORPORATE BANKING', 'CAPITAL MARKETS', 'TIER 1'],
  'deutsche bank': ['CORPORATE BANKING', 'DACH', 'TIER 1'],
  'ubs': ['CORPORATE BANKING', 'DACH', 'TIER 1'],
  'credit suisse': ['CORPORATE BANKING', 'DACH'],
  'hsbc': ['CORPORATE BANKING', 'ASIA'],
  'lazard': ['CORP M&A', 'ADVISORY INVESMENT', 'BOUTIQUE'],
  'evercore': ['CORP M&A', 'ADVISORY INVESMENT', 'BOUTIQUE'],
  'moelis': ['CORP M&A', 'ADVISORY INVESMENT', 'BOUTIQUE'],
  'centerview': ['CORP M&A', 'ADVISORY INVESMENT', 'BOUTIQUE'],
  'perella weinberg': ['CORP M&A', 'ADVISORY INVESMENT', 'BOUTIQUE'],
  'rothschild': ['CORP M&A', 'ADVISORY INVESMENT'],
  'greenhill': ['CORP M&A', 'ADVISORY INVESMENT', 'BOUTIQUE'],
  'pjt partners': ['CORP M&A', 'ADVISORY INVESMENT', 'BOUTIQUE'],
  'guggenheim': ['CORP M&A', 'ADVISORY INVESMENT'],
  'jefferies': ['CORPORATE BANKING', 'CAPITAL MARKETS'],
  'nomura': ['CORPORATE BANKING', 'ASIA'],
  'macquarie': ['CORPORATE BANKING', 'AUSTRALIA'],
  
  // Private Equity - MUST USE FULL NAMES to avoid matching consulting
  'blackstone': ['BUY SIDE', 'PE', 'CORP M&A', 'TIER 1'],
  'kkr': ['BUY SIDE', 'PE', 'CORP M&A', 'TIER 1'],
  'carlyle': ['BUY SIDE', 'PE', 'CORP M&A', 'TIER 1'],
  'apollo global': ['BUY SIDE', 'PE', 'CREDIT', 'TIER 1'],
  'tpg capital': ['BUY SIDE', 'PE', 'CORP M&A'],
  'tpg': ['BUY SIDE', 'PE', 'CORP M&A'],
  'warburg pincus': ['BUY SIDE', 'PE', 'CORP M&A'],
  'advent international': ['BUY SIDE', 'PE', 'CORP M&A'],
  'bain capital': ['BUY SIDE', 'PE', 'CORP M&A'],  // Full name to avoid matching Bain & Company
  'permira': ['BUY SIDE', 'PE', 'CORP M&A'],
  'cvc capital': ['BUY SIDE', 'PE', 'CORP M&A'],
  'apax partners': ['BUY SIDE', 'PE', 'CORP M&A'],
  'bc partners': ['BUY SIDE', 'PE', 'CORP M&A'],
  'eqt partners': ['BUY SIDE', 'PE', 'CORP M&A', 'COPENHAGEN'],
  'eqt': ['BUY SIDE', 'PE', 'CORP M&A', 'COPENHAGEN'],
  'cinven': ['BUY SIDE', 'PE', 'CORP M&A'],
  'pai partners': ['BUY SIDE', 'PE', 'CORP M&A', 'PARIS'],
  'bridgepoint': ['BUY SIDE', 'PE', 'CORP M&A'],
  'ardian': ['BUY SIDE', 'PE', 'CORP M&A', 'PARIS'],
  'partners group': ['BUY SIDE', 'PE', 'DACH'],
  'general atlantic': ['BUY SIDE', 'PE', 'CORP VC'],
  'silver lake': ['BUY SIDE', 'PE', 'DATA'],
  'thoma bravo': ['BUY SIDE', 'PE', 'DATA'],
  'vista equity': ['BUY SIDE', 'PE', 'DATA'],
  'hellman & friedman': ['BUY SIDE', 'PE', 'CORP M&A'],
  'providence equity': ['BUY SIDE', 'PE', 'CORP M&A'],
  'onex': ['BUY SIDE', 'PE', 'CREDIT'],
  'hg capital': ['BUY SIDE', 'PE', 'DATA'],
  'montagu': ['BUY SIDE', 'PE', 'CORP M&A'],
  'ik partners': ['BUY SIDE', 'PE', 'CORP M&A'],
  'triton': ['BUY SIDE', 'PE', 'COPENHAGEN'],
  'nordic capital': ['BUY SIDE', 'PE', 'COPENHAGEN'],
  'equistone': ['BUY SIDE', 'PE', 'CORP M&A'],
  'charterhouse': ['BUY SIDE', 'PE', 'CORP M&A'],
  'advent': ['BUY SIDE', 'PE', 'CORP M&A'],
  
  // Credit / Debt Funds
  'ares management': ['CREDIT', 'Debt', 'BUY SIDE'],
  'ares': ['CREDIT', 'Debt', 'BUY SIDE'],
  'blue owl': ['CREDIT', 'Debt'],
  'owl rock': ['CREDIT', 'Debt'],
  'golub capital': ['CREDIT', 'Debt'],
  'antares capital': ['CREDIT', 'Debt'],
  'hps investment': ['CREDIT', 'Debt'],
  'sixth street': ['CREDIT', 'Debt'],
  'oak hill': ['CREDIT', 'Debt'],
  'goldentree': ['CREDIT', 'Debt'],
  'oaktree': ['CREDIT', 'DISTRESSED', 'Debt'],
  'cerberus': ['CREDIT', 'DISTRESSED'],
  'pgim': ['CREDIT', 'ASS MAN'],
  'pimco': ['BOND', 'Debt', 'ASS MAN'],
  
  // Asset Management
  'blackrock': ['ASS MAN', 'BUY SIDE'],
  'vanguard': ['ASS MAN'],
  'fidelity investments': ['ASS MAN'],
  'wellington management': ['ASS MAN'],
  't. rowe price': ['ASS MAN'],
  'invesco': ['ASS MAN'],
  'franklin templeton': ['ASS MAN'],
  'nuveen': ['ASS MAN', 'CREDIT'],
  'gam investments': ['ASS MAN', 'ALT INVESTMENT'],
  'schroders': ['ASS MAN'],
  'jupiter': ['ASS MAN'],
  'abrdn': ['ASS MAN'],
  'man group': ['ASS MAN', 'ALT INVESTMENT'],
  
  // Hedge Funds
  'citadel': ['ALT INVESTMENT', 'BUY SIDE'],
  'millennium': ['ALT INVESTMENT', 'BUY SIDE'],
  'point72': ['ALT INVESTMENT', 'BUY SIDE'],
  'bridgewater': ['ALT INVESTMENT', 'BUY SIDE'],
  'two sigma': ['ALT INVESTMENT', 'DATA'],
  'd.e. shaw': ['ALT INVESTMENT', 'DATA'],
  'de shaw': ['ALT INVESTMENT', 'DATA'],
  'renaissance': ['ALT INVESTMENT', 'DATA'],
  'elliott management': ['ALT INVESTMENT', 'DISTRESSED'],
  'baupost': ['ALT INVESTMENT', 'BUY SIDE'],
  'brevan howard': ['ALT INVESTMENT', 'BUY SIDE'],
  'capula': ['ALT INVESTMENT', 'BUY SIDE'],
  'qube research': ['ALT INVESTMENT', 'DATA'],
  
  // Consulting - Use FULL NAMES to avoid overlap with PE
  'mckinsey': ['CONSULT', 'CORP STRATEGY'],
  'mckinsey & company': ['CONSULT', 'CORP STRATEGY'],
  'bain & company': ['CONSULT', 'CORP STRATEGY'],  // Full name - NOT "bain" alone
  'boston consulting group': ['CONSULT', 'CORP STRATEGY'],
  'bcg': ['CONSULT', 'CORP STRATEGY'],
  'deloitte': ['CONSULT', 'AUDIT'],
  'pwc': ['CONSULT', 'AUDIT'],
  'pricewaterhousecoopers': ['CONSULT', 'AUDIT'],
  'kpmg': ['CONSULT', 'AUDIT'],
  'ey': ['CONSULT', 'AUDIT'],
  'ernst & young': ['CONSULT', 'AUDIT'],
  'accenture': ['CONSULT', 'DATA'],
  'oliver wyman': ['CONSULT', 'CORP STRATEGY'],
  'roland berger': ['CONSULT', 'DACH'],
  'alvarez & marsal': ['CONSULT', 'BANKRUPCY'],
  'fti consulting': ['CONSULT', 'BANKRUPCY'],
  'linklaters': ['LEGAL'],
  'clifford chance': ['LEGAL'],
  'freshfields': ['LEGAL'],
  'allen & overy': ['LEGAL'],
  'kirkland & ellis': ['LEGAL', 'PE'],
  'simpson thacher': ['LEGAL', 'PE'],
  
  // Real Estate
  'brookfield': ['AREC', 'CONSTRUCTION', 'BUY SIDE'],
  'blackstone real estate': ['AREC', 'BUY SIDE', 'PE'],
  'starwood': ['AREC', 'BUY SIDE'],
  'cushman': ['AREC'],
  'cbre': ['AREC'],
  'jll': ['AREC'],
  'hines': ['AREC'],
  
  // VC
  'sequoia': ['CORP VC', 'VC', 'DATA'],
  'andreessen horowitz': ['CORP VC', 'VC', 'DATA'],
  'a16z': ['CORP VC', 'VC', 'DATA'],
  'benchmark': ['CORP VC', 'VC'],
  'accel': ['CORP VC', 'VC'],
  'kleiner perkins': ['CORP VC', 'VC'],
  'greylock': ['CORP VC', 'VC'],
  'lightspeed': ['CORP VC', 'VC'],
  'general catalyst': ['CORP VC', 'VC'],
  'index ventures': ['CORP VC', 'VC'],
  'insight partners': ['CORP VC', 'VC', 'BUY SIDE'],
  'balderton': ['CORP VC', 'VC'],
  'atomico': ['CORP VC', 'VC'],
  
  // Sovereign Wealth / Large Investors
  'qatar investment authority': ['BUY SIDE', 'SOVEREIGN'],
  'qia': ['BUY SIDE', 'SOVEREIGN'],
  'adia': ['BUY SIDE', 'SOVEREIGN', 'ABU DHABI'],
  'gic': ['BUY SIDE', 'SOVEREIGN', 'SINGAPORE'],
  'temasek': ['BUY SIDE', 'SOVEREIGN', 'SINGAPORE'],
  'cppib': ['BUY SIDE', 'SOVEREIGN', 'CANADA'],
  'cdpq': ['BUY SIDE', 'SOVEREIGN', 'CANADA'],
  'calpers': ['BUY SIDE', 'ASS MAN'],
}

// Title-specific skill mapping - more granular
const TITLE_SKILLS: Record<string, string[]> = {
  // Seniority indicators
  'head of': ['BUSINESS', 'C-SUITE'],
  'chief': ['BUSINESS', 'C-SUITE'],
  'managing director': ['BUSINESS', 'SENIOR'],
  'senior managing director': ['BUSINESS', 'SENIOR'],
  'managing partner': ['BUSINESS', 'BOUTIQUE', 'SENIOR'],
  'partner': ['BUSINESS', 'BOUTIQUE'],
  'senior partner': ['BUSINESS', 'BOUTIQUE', 'SENIOR'],
  'principal': ['BUSINESS', 'MID-LEVEL'],
  'senior principal': ['BUSINESS', 'SENIOR'],
  'director': ['BUSINESS', 'MID-LEVEL'],
  'senior director': ['BUSINESS', 'SENIOR'],
  'vice president': ['BUSINESS', 'MID-LEVEL'],
  'senior vice president': ['BUSINESS', 'SENIOR'],
  'svp': ['BUSINESS', 'SENIOR'],
  'evp': ['BUSINESS', 'SENIOR'],
  'executive vice president': ['BUSINESS', 'SENIOR'],
  'associate': ['BUSINESS', 'JUNIOR'],
  'senior associate': ['BUSINESS', 'MID-LEVEL'],
  'analyst': ['ANALYSIS', 'JUNIOR'],
  'senior analyst': ['ANALYSIS', 'MID-LEVEL'],
  // Function-specific
  'portfolio manager': ['BUY SIDE', 'ASS MAN', 'INVESTMENT'],
  'investment manager': ['BUY SIDE', 'ASS MAN', 'INVESTMENT'],
  'fund manager': ['BUY SIDE', 'ASS MAN'],
  'credit analyst': ['CREDIT', 'ANALYSIS'],
  'credit officer': ['CREDIT', 'RISK'],
  'credit principal': ['CREDIT', 'SENIOR'],
  'credit director': ['CREDIT', 'SENIOR'],
  'debt': ['Debt', 'CREDIT'],
  'fixed income': ['BOND', 'Debt'],
  'leveraged finance': ['Debt', 'ACQUISITION FINANCE'],
  'private credit': ['CREDIT', 'Debt', 'BUY SIDE'],
  'private debt': ['Debt', 'BUY SIDE'],
  'direct lending': ['CREDIT', 'Debt'],
  'structured': ['STRUCTURED PRODUCTS', 'Debt'],
  'securitization': ['STRUCTURED PRODUCTS', 'ABS'],
  // HR / Talent
  'talent acquisition': ['C&B', 'TALENT'],
  'talent': ['C&B', 'TALENT'],
  'recruiting': ['C&B', 'TALENT'],
  'recruiter': ['C&B', 'TALENT'],
  'human resources': ['C&B', 'COMPENSATION'],
  'human capital': ['C&B', 'COMPENSATION'],
  'hr business partner': ['C&B', 'COMPENSATION'],
  'hr director': ['C&B', 'SENIOR'],
  'head of hr': ['C&B', 'SENIOR'],
  'head of talent': ['C&B', 'SENIOR'],
  'chief people': ['C&B', 'C-SUITE'],
  'people operations': ['C&B'],
  // Investment roles
  'origination': ['BUS DEV', 'ORIGINATION'],
  'underwriting': ['CREDIT', 'UNDERWRITING'],
  'investor relations': ['Capital Formation', 'IR'],
  'fundraising': ['Capital Formation'],
  'capital markets': ['CAPITAL MARKETS', 'DCM'],
  'dcm': ['DCM', 'Debt'],
  'ecm': ['CAPITAL MARKETS', 'ECM'],
  'syndicate': ['CAPITAL MARKETS', 'SYNDICATION'],
  'm&a': ['CORP M&A'],
  'mergers': ['CORP M&A'],
  'acquisitions': ['CORP M&A', 'ACQUISITION FINANCE'],
  'corporate development': ['CORP DEV', 'CORP M&A'],
  'business development': ['BUS DEV'],
  'strategy': ['CORP STRATEGY'],
  'strategic': ['CORP STRATEGY'],
  // Risk & Compliance
  'risk': ['RISK', 'CYBER RISK'],
  'credit risk': ['CREDIT', 'RISK'],
  'market risk': ['RISK', 'CAPITAL MARKETS'],
  'operational risk': ['RISK', 'CONTROL'],
  'compliance': ['COMPLIANCE', 'CENTRAL COMPLIANCE'],
  'regulatory': ['COMPLIANCE', 'CONDUCT RISK'],
  'legal': ['COMPLIANCE', 'ARBITRATION'],
  'general counsel': ['COMPLIANCE', 'C-SUITE'],
  'audit': ['AUDIT', 'CONTROL'],
  // Operations
  'operations': ['CONTROL', 'BACK OFFICE'],
  'middle office': ['CONTROL', 'MIDDLE OFFICE'],
  'back office': ['BACK OFFICE'],
  'fund administration': ['BACK OFFICE', 'ASS MAN'],
  'treasury': ['TREASURY', 'CORP FIN'],
  'finance': ['CORP FIN', 'ACCOUNTING'],
  'controller': ['ACCOUNTING', 'CONTROL'],
  'cfo': ['CORP FIN', 'C-SUITE'],
  'coo': ['CONTROL', 'C-SUITE'],
  // Technology
  'technology': ['DATA', 'AUTOMATION'],
  'engineer': ['APPLICATION DEVELOPER', 'AUTOMATION'],
  'developer': ['APPLICATION DEVELOPER'],
  'data': ['DATA', 'DATASCIENCE'],
  'quantitative': ['DATA', 'QUANT'],
  'quant': ['DATA', 'QUANT'],
  'cto': ['DATA', 'C-SUITE'],
  'cio': ['DATA', 'C-SUITE'],
}

// Location to skill mapping
const LOCATION_SKILLS: Record<string, string[]> = {
  // Europe
  'london': ['LONDON'],
  'united kingdom': ['LONDON'],
  'uk': ['LONDON'],
  'england': ['LONDON'],
  'frankfurt': ['DACH', 'FRANKFURT'],
  'munich': ['DACH', 'MUNICH'],
  'berlin': ['BERLIN', 'DACH'],
  'germany': ['DACH'],
  'dach': ['DACH'],
  'zurich': ['DACH', 'ZURICH'],
  'geneva': ['DACH', 'GENEVA'],
  'switzerland': ['DACH'],
  'dubai': ['DUBAI', 'ABU DHABI'],
  'abu dhabi': ['ABU DHABI'],
  'uae': ['ABU DHABI'],
  'stockholm': ['STOCKHOLM', 'COPENHAGEN'],
  'oslo': ['OSLO', 'COPENHAGEN'],
  'copenhagen': ['COPENHAGEN'],
  'helsinki': ['HELSINKI', 'COPENHAGEN'],
  'nordics': ['COPENHAGEN'],
  'amsterdam': ['AMSTERDAM', 'BENELUX'],
  'brussels': ['BRUSSEL', 'BENELUX'],
  'benelux': ['BENELUX'],
  'paris': ['PARIS'],
  'france': ['PARIS'],
  'milan': ['MILAN'],
  'italy': ['MILAN'],
  'rome': ['MILAN'],
  'madrid': ['MADRID', 'BARCELONA'],
  'spain': ['BARCELONA'],
  'barcelona': ['BARCELONA'],
  'lisbon': ['LISBON'],
  'portugal': ['LISBON'],
  'dublin': ['DUBLIN'],
  'ireland': ['DUBLIN'],
  'edinburgh': ['EDINBURGH', 'LONDON'],
  'luxembourg': ['LUXEMBOURG', 'BENELUX'],
  'vienna': ['VIENNA', 'DACH'],
  'austria': ['VIENNA', 'DACH'],
  'warsaw': ['WARSAW', 'CEE'],
  'prague': ['PRAGUE', 'CEE'],
  // Americas
  'new york': ['NEW YORK', 'AMERICAS'],
  'nyc': ['NEW YORK', 'AMERICAS'],
  'manhattan': ['NEW YORK', 'AMERICAS'],
  'boston': ['BOSTON', 'AMERICAS'],
  'chicago': ['CHICAGO', 'AMERICAS'],
  'san francisco': ['SAN FRANCISCO', 'California', 'AMERICAS'],
  'los angeles': ['LOS ANGELES', 'California', 'AMERICAS'],
  'texas': ['DALLAS', 'AMERICAS'],
  'dallas': ['DALLAS', 'AMERICAS'],
  'houston': ['HOUSTON', 'AMERICAS'],
  'atlanta': ['ATLANTA', 'AMERICAS'],
  'miami': ['MIAMI', 'AMERICAS'],
  'charlotte': ['CHARLOTTE', 'AMERICAS'],
  'denver': ['DENVER', 'AMERICAS'],
  'seattle': ['SEATTLE', 'AMERICAS'],
  'washington': ['WASHINGTON DC', 'AMERICAS'],
  'united states': ['AMERICAS'],
  'usa': ['AMERICAS'],
  'canada': ['CANADA', 'AMERICAS'],
  'toronto': ['TORONTO', 'CANADA', 'AMERICAS'],
  'montreal': ['MONTREAL', 'CANADA', 'AMERICAS'],
  'brazil': ['BRAZIL', 'AMERICAS'],
  'sao paulo': ['SAO PAULO', 'BRAZIL', 'AMERICAS'],
  'mexico': ['MEXICO', 'AMERICAS'],
  // APAC
  'singapore': ['SINGAPORE', 'APAC', 'ASIA'],
  'hong kong': ['HONG KONG', 'APAC', 'ASIA'],
  'tokyo': ['TOKYO', 'APAC', 'ASIA'],
  'japan': ['TOKYO', 'APAC', 'ASIA'],
  'australia': ['AUSTRALIA', 'APAC'],
  'sydney': ['SYDNEY', 'AUSTRALIA', 'APAC'],
  'melbourne': ['MELBOURNE', 'AUSTRALIA', 'APAC'],
  'china': ['CHINA', 'APAC', 'ASIA'],
  'beijing': ['BEIJING', 'CHINA', 'APAC'],
  'shanghai': ['SHANGHAI', 'CHINA', 'APAC'],
  'bangkok': ['BANGKOK', 'APAC'],
  'asia': ['ASIA', 'APAC'],
  'mumbai': ['MUMBAI', 'INDIA', 'APAC'],
  'india': ['INDIA', 'APAC'],
  'seoul': ['SEOUL', 'APAC', 'ASIA'],
  'korea': ['SEOUL', 'APAC', 'ASIA'],
  // Middle East / Africa
  'bahrain': ['BAHRAIN'],
  'qatar': ['QATAR'],
  'doha': ['DOHA', 'QATAR'],
  'riyadh': ['RIYADH', 'SAUDI'],
  'saudi': ['SAUDI'],
  'cairo': ['CAIRO', 'AFRICA'],
  'africa': ['AFRICA'],
  'johannesburg': ['JOHANNESBURG', 'AFRICA'],
  'south africa': ['AFRICA'],
  // CEE
  'czech republic': ['CZECH REPUBLIC', 'CEE'],
  'czechia': ['CZECH REPUBLIC', 'CEE'],
  'poland': ['WARSAW', 'CEE'],
  'hungary': ['BUDAPEST', 'CEE'],
  'romania': ['BUCHAREST', 'CEE'],
  'bulgaria': ['BULGARIA', 'CEE'],
  'croatia': ['CROATIA', 'CEE'],
}

// Buy Side companies (PE, VC, Hedge Funds, Asset Managers, Credit Funds)
const BUY_SIDE_COMPANY_PATTERNS = [
  'blackstone', 'kkr', 'carlyle', 'apollo global', 'tpg', 'warburg pincus',
  'advent international', 'bain capital', 'permira', 'cvc capital', 'apax',
  'bc partners', 'eqt', 'cinven', 'pai partners', 'bridgepoint', 'ardian',
  'partners group', 'general atlantic', 'silver lake', 'thoma bravo', 'vista equity',
  'hellman', 'providence equity', 'onex', 'hg capital', 'montagu', 'ik partners',
  'triton', 'nordic capital', 'equistone', 'charterhouse', 'advent',
  // Credit funds
  'ares', 'blue owl', 'owl rock', 'golub capital', 'antares capital', 'hps investment',
  'sixth street', 'oak hill', 'goldentree', 'oaktree', 'cerberus', 'pgim', 'pimco',
  // Asset management
  'blackrock', 'vanguard', 'fidelity', 'wellington', 't. rowe', 'invesco',
  'franklin templeton', 'nuveen', 'gam', 'schroders', 'jupiter', 'abrdn', 'man group',
  // Hedge funds
  'citadel', 'millennium', 'point72', 'bridgewater', 'two sigma', 'de shaw', 'd.e. shaw',
  'renaissance', 'elliott', 'baupost', 'brevan howard', 'capula', 'qube',
  // VC
  'sequoia', 'andreessen', 'a16z', 'benchmark', 'accel', 'kleiner', 'greylock',
  'lightspeed', 'general catalyst', 'index ventures', 'insight partners', 'balderton', 'atomico',
  // Sovereign wealth
  'qatar investment', 'qia', 'adia', 'gic', 'temasek', 'cppib', 'cdpq', 'calpers',
]

// Sell Side companies (Investment Banks, M&A Advisory)
const SELL_SIDE_COMPANY_PATTERNS = [
  'goldman sachs', 'morgan stanley', 'j.p. morgan', 'jp morgan', 'jpmorgan',
  'bank of america', 'bofa securities', 'citigroup', 'citibank', 'barclays',
  'deutsche bank', 'ubs', 'credit suisse', 'hsbc',
  'lazard', 'evercore', 'moelis', 'centerview', 'perella weinberg', 'rothschild',
  'greenhill', 'pjt partners', 'guggenheim', 'jefferies', 'nomura', 'macquarie',
]

// Detect if company is buy-side or sell-side
function detectCompanySide(companyName: string): 'buy' | 'sell' | null {
  const lower = companyName.toLowerCase()
  for (const pattern of BUY_SIDE_COMPANY_PATTERNS) {
    if (lower.includes(pattern)) return 'buy'
  }
  for (const pattern of SELL_SIDE_COMPANY_PATTERNS) {
    if (lower.includes(pattern)) return 'sell'
  }
  return null
}

// Skills that conflict - cannot appear together
const BUY_SIDE_ONLY_SKILLS = ['BUY SIDE', 'PE', 'CORP VC', 'VC', 'ALT INVESTMENT', 'ASS MAN']
const SELL_SIDE_ONLY_SKILLS = ['SELL SIDE', 'CORPORATE BANKING', 'TIER 1']
// CORP M&A can appear on both sides (PE does M&A, IB advises on M&A)

// Helper to normalize pattern values for matching
function normalizeForPatternMatch(value: string): string {
  return value.toLowerCase().trim().replace(/[^\w\s&.-]/g, '').replace(/\s+/g, ' ')
}

// Get skills from learned patterns
function getLearnedSkills(
  contact: ApolloContact,
  patterns: LearnedPattern[],
  minConfidence: number = 0.15
): Set<string> {
  const skills = new Set<string>()
  
  const companyNorm = normalizeForPatternMatch(contact.company || '')
  const titleNorm = normalizeForPatternMatch(contact.title || '')
  const locationNorm = normalizeForPatternMatch(contact.location?.split(',')[0] || '')
  
  for (const pattern of patterns) {
    if (pattern.confidence < minConfidence) continue
    
    let matched = false
    
    if (pattern.pattern_type === 'company' && companyNorm.includes(pattern.pattern_value)) {
      matched = true
    } else if (pattern.pattern_type === 'title' && titleNorm.includes(pattern.pattern_value)) {
      matched = true
    } else if (pattern.pattern_type === 'location' && locationNorm.includes(pattern.pattern_value)) {
      matched = true
    }
    
    if (matched) {
      console.log(`[Skills] Learned pattern matched: ${pattern.pattern_type}="${pattern.pattern_value}" (freq=${pattern.frequency}, conf=${pattern.confidence.toFixed(2)})`)
      pattern.skills.forEach(s => skills.add(s))
    }
  }
  
  return skills
}

function generateSkillsString(
  contact: ApolloContact,
  searchPreferences?: SearchPreference,
  learnedPatterns?: LearnedPattern[]
): string {
  const skills = new Set<string>()

  // FIRST: Detect company side to enforce skill consistency
  const companySide = detectCompanySide(contact.company || '')
  console.log(`[Skills] Contact ${contact.name} @ ${contact.company} -> side: ${companySide || 'unknown'}`)

  // 0. PRIORITY: Add skills from learned patterns first (highest priority)
  if (learnedPatterns && learnedPatterns.length > 0) {
    const learnedSkills = getLearnedSkills(contact, learnedPatterns)
    learnedSkills.forEach(s => skills.add(s))
    if (learnedSkills.size > 0) {
      console.log(`[Skills] Added ${learnedSkills.size} skills from learned patterns`)
    }
  }

  // 1. PRIMARY: Match from contact's COMPANY (most specific to this contact)
  const companyLower = contact.company?.toLowerCase() || ''
  for (const [keyword, skillCodes] of Object.entries(COMPANY_SKILLS)) {
    if (companyLower.includes(keyword)) {
      skillCodes.forEach((s: string) => skills.add(s))
    }
  }

  // 2. PRIMARY: Match from contact's TITLE (contact-specific)
  const titleLower = contact.title?.toLowerCase() || ''
  for (const [keyword, skillCodes] of Object.entries(TITLE_SKILLS)) {
    if (titleLower.includes(keyword)) {
      skillCodes.forEach((s: string) => skills.add(s))
    }
  }

  // 3. PRIMARY: Match from contact's LOCATION (contact-specific)
  const locationLower = contact.location?.toLowerCase() || ''
  for (const [keyword, skillCodes] of Object.entries(LOCATION_SKILLS)) {
    if (locationLower.includes(keyword)) {
      skillCodes.forEach((s: string) => skills.add(s))
    }
  }

  // 4. Extract and add city name directly (always add the specific city)
  if (contact.location) {
    const city = contact.location.split(',')[0]?.trim()
    if (city && city.length > 2) {
      skills.add(city.toUpperCase())
    }
  }

  // 5. SECONDARY: Add industry context from search preferences (shared across run)
  // Add relevant skills based on search intent - these are CRITICAL for matching
  if (searchPreferences?.industry) {
    const lowerIndustry = searchPreferences.industry.toLowerCase()
    
    // Check for abbreviations and full names
    // PE / Private Equity
    if (lowerIndustry === 'pe' || lowerIndustry.includes('private equity') || lowerIndustry.includes('buyout')) {
      skills.add('BUY SIDE')
      skills.add('PE')
      skills.add('CORP M&A')
    }
    // VC / Venture Capital
    if (lowerIndustry === 'vc' || lowerIndustry.includes('venture capital') || lowerIndustry.includes('venture')) {
      skills.add('CORP VC')
      skills.add('VC')
    }
    // Credit / Debt / Private Credit
    if (lowerIndustry.includes('credit') || lowerIndustry.includes('debt') || lowerIndustry.includes('lending')) {
      skills.add('CREDIT')
      skills.add('Debt')
    }
    // Hedge Fund
    if (lowerIndustry.includes('hedge')) {
      skills.add('ALT INVESTMENT')
      skills.add('BUY SIDE')
    }
    // Real Estate
    if (lowerIndustry.includes('real estate') || lowerIndustry.includes('property')) {
      skills.add('AREC')
    }
    // Investment Banking / IB
    if (lowerIndustry === 'ib' || lowerIndustry.includes('investment bank') || lowerIndustry.includes('ibd')) {
      skills.add('CORPORATE BANKING')
      skills.add('CAPITAL MARKETS')
    }
    // Asset Management
    if (lowerIndustry.includes('asset management') || lowerIndustry.includes('fund management')) {
      skills.add('ASS MAN')
    }
    // Distressed / Special Situations
    if (lowerIndustry.includes('distressed') || lowerIndustry.includes('special situations')) {
      skills.add('DISTRESSED')
      skills.add('BANKRUPCY')
    }
    // Capital Markets / DCM / ECM
    if (lowerIndustry.includes('capital markets') || lowerIndustry === 'dcm' || lowerIndustry === 'ecm') {
      skills.add('CAPITAL MARKETS')
      if (lowerIndustry === 'dcm' || lowerIndustry.includes('debt capital')) {
        skills.add('DCM')
        skills.add('Debt')
      }
    }
    // M&A
    if (lowerIndustry === 'm&a' || lowerIndustry.includes('mergers') || lowerIndustry.includes('acquisitions')) {
      skills.add('CORP M&A')
    }
    // Infrastructure
    if (lowerIndustry.includes('infrastructure') || lowerIndustry.includes('infra')) {
      skills.add('CONSTRUCTION')
      skills.add('CAPITAL GOODS')
    }
    // Consulting - only add if explicitly consulting, NOT for PE firms
    if (lowerIndustry.includes('consulting') || lowerIndustry.includes('advisory')) {
      skills.add('CONSULT')
    }
  }

  // 6. Add industries array if present
  if (searchPreferences?.industries && searchPreferences.industries.length > 0) {
    for (const industry of searchPreferences.industries) {
      const lower = industry.toLowerCase()
      // Same abbreviation handling
      if (lower === 'pe' || lower.includes('private equity')) {
        skills.add('BUY SIDE')
        skills.add('PE')
      }
      if (lower === 'vc' || lower.includes('venture')) {
        skills.add('CORP VC')
        skills.add('VC')
      }
      if (lower.includes('credit') || lower.includes('private debt')) {
        skills.add('CREDIT')
        skills.add('Debt')
      }
      if (lower.includes('distressed')) skills.add('DISTRESSED')
      if (lower === 'dcm' || lower.includes('debt capital')) {
        skills.add('DCM')
        skills.add('Debt')
      }
      if (lower.includes('hedge')) skills.add('ALT INVESTMENT')
      if (lower.includes('real estate')) skills.add('AREC')
      if (lower === 'm&a' || lower.includes('mergers')) skills.add('CORP M&A')
    }
  }

  // 7. CONFLICT RESOLUTION: Remove conflicting skills based on company side
  if (companySide === 'buy') {
    // Remove sell-side skills
    SELL_SIDE_ONLY_SKILLS.forEach(s => skills.delete(s))
    // Ensure buy-side marker is present
    skills.add('BUY SIDE')
  } else if (companySide === 'sell') {
    // Remove buy-side skills
    BUY_SIDE_ONLY_SKILLS.forEach(s => skills.delete(s))
    // Ensure sell-side marker is present
    skills.add('SELL SIDE')
  }

  // 8. Ensure minimum skill count (at least 4 skills required)
  if (skills.size < 4) {
    // Add generic business skill
    skills.add('BUSINESS')
    // If still under 4, add from title seniority
    if (titleLower.includes('senior') || titleLower.includes('head') || titleLower.includes('director') || titleLower.includes('partner')) {
      skills.add('SENIOR')
    } else if (titleLower.includes('associate') || titleLower.includes('analyst')) {
      skills.add('JUNIOR')
    } else {
      skills.add('MID-LEVEL')
    }
    // Add functional area if not enough
    if (skills.size < 4 && (titleLower.includes('hr') || titleLower.includes('talent') || titleLower.includes('recruit'))) {
      skills.add('C&B')
      skills.add('TALENT')
    }
    // Still under 4? Add location-based fallback
    if (skills.size < 4 && locationLower) {
      if (locationLower.includes('london') || locationLower.includes('uk')) skills.add('LONDON')
      else if (locationLower.includes('new york') || locationLower.includes('usa')) skills.add('AMERICAS')
      else if (locationLower.includes('europe')) skills.add('EMEA')
      else skills.add('GLOBAL')
    }
  }

  // Hard guarantee: never return empty Skills
  if (skills.size === 0) {
    skills.add('BUSINESS')
    skills.add('GLOBAL')
    skills.add('SENIOR')
    skills.add('FINANCE')
  }

  console.log(`[Skills] Final skills for ${contact.name}: ${Array.from(skills).join(' ; ')} (count: ${skills.size})`)

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
  
  // Get all credentials from api_settings
  const { data: settings } = await supabase
    .from('api_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['bullhorn_client_id', 'bullhorn_client_secret', 'bullhorn_username', 'bullhorn_password'])

  const creds: Record<string, string> = {}
  settings?.forEach((s: any) => {
    creds[s.setting_key] = s.setting_value
  })

  if (!creds.bullhorn_client_id || !creds.bullhorn_client_secret) {
    console.error('Bullhorn credentials not configured for refresh')
    return null
  }

  let tokenData: any = null

  // First try refresh token
  if (refreshToken) {
    console.log('Attempting refresh token flow...')
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

    if (tokenResponse.ok) {
      tokenData = await tokenResponse.json()
      if (!tokenData.access_token) {
        console.log('Refresh token failed, will try password grant...')
        tokenData = null
      }
    } else {
      const errorText = await tokenResponse.text()
      console.log('Refresh token failed:', errorText, 'Will try password grant...')
    }
  }

  // If refresh failed, try password grant as fallback
  if (!tokenData?.access_token && creds.bullhorn_username && creds.bullhorn_password) {
    console.log('Attempting password grant flow for automatic reconnection...')
    
    // Step 1: Get authorization code using password grant
    const authUrl = `https://auth.bullhornstaffing.com/oauth/authorize?client_id=${creds.bullhorn_client_id}&response_type=code&username=${encodeURIComponent(creds.bullhorn_username)}&password=${encodeURIComponent(creds.bullhorn_password)}&action=Login`
    const authResponse = await fetch(authUrl, { redirect: 'manual' })
    
    // Extract code from redirect location
    const location = authResponse.headers.get('location')
    const codeMatch = location?.match(/code=([^&]+)/)
    
    if (codeMatch) {
      const code = codeMatch[1]
      
      // Step 2: Exchange code for tokens
      const tokenUrl = 'https://auth.bullhornstaffing.com/oauth/token'
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: creds.bullhorn_client_id,
        client_secret: creds.bullhorn_client_secret,
      })
      
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      })
      
      if (tokenResponse.ok) {
        tokenData = await tokenResponse.json()
        if (tokenData.access_token) {
          console.log('Password grant successful, obtained new tokens')
        }
      }
    }
  }

  if (!tokenData?.access_token) {
    console.error('All Bullhorn authentication methods failed')
    return null
  }

  // Get REST session
  const loginUrl = `https://rest.bullhornstaffing.com/rest-services/login?version=*&access_token=${tokenData.access_token}`
  const loginResponse = await fetch(loginUrl, { method: 'GET' })

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text()
    console.error('REST login failed after refresh:', errorText)
    return null
  }

  const loginData = await loginResponse.json()
  const restUrl = loginData.restUrl
  const bhRestToken = loginData.BhRestToken
  const accessToken = tokenData.access_token
  const newRefreshToken = tokenData.refresh_token

  const expiresAt = tokenData.expires_in 
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  // Delete old tokens and insert new one
  await supabase.from('bullhorn_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  const { error: insertError } = await supabase.from('bullhorn_tokens').insert({
    access_token: accessToken,
    refresh_token: newRefreshToken || refreshToken,
    rest_url: restUrl,
    bh_rest_token: bhRestToken,
    expires_at: expiresAt,
  })

  if (insertError) {
    console.error('Failed to save refreshed tokens:', insertError)
    return null
  }

  console.log('Bullhorn tokens refreshed and stored successfully')
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

type ClientContactSkillAssociationTarget = {
  fieldName: string
  associatedEntity: 'Skill' | 'Category'
}

let cachedClientContactSkillAssociation: ClientContactSkillAssociationTarget | null = null
let clientContactSkillAssociationChecked = false

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

async function detectClientContactSkillAssociation(
  restUrl: string,
  bhRestToken: string
): Promise<ClientContactSkillAssociationTarget | null> {
  if (clientContactSkillAssociationChecked) {
    return cachedClientContactSkillAssociation
  }
  clientContactSkillAssociationChecked = true

  try {
    const metaUrl = `${restUrl}meta/ClientContact?BhRestToken=${encodeURIComponent(bhRestToken)}&fields=*`
    const res = await bullhornFetch(metaUrl)
    if (!res.ok) {
      await res.text().catch(() => undefined)
      return null
    }

    const meta = await res.json().catch(() => null)
    const fields: any[] = (meta as any)?.fields || []

    // 1) Prefer an actual Skill association (populates the Skills tab)
    const skillAssoc = fields.find((f) => {
      const type = String(f?.type || '').toUpperCase()
      const entity = String(f?.associatedEntity?.entity || '')
      return type === 'TO_MANY' && entity === 'Skill'
    })

    if (skillAssoc?.name) {
      cachedClientContactSkillAssociation = { fieldName: skillAssoc.name, associatedEntity: 'Skill' }
      console.log(`Detected ClientContact Skill association field: ${skillAssoc.name}`)
      return cachedClientContactSkillAssociation
    }

    // 2) Fallback: some instances model "Skills" as Categories (Admin → Categories)
    const categoryAssoc = fields.find((f) => {
      const type = String(f?.type || '').toUpperCase()
      const entity = String(f?.associatedEntity?.entity || '')
      const label = String(f?.label || '').toLowerCase()
      const name = String(f?.name || '').toLowerCase()
      return type === 'TO_MANY' && entity === 'Category' && (label.includes('skill') || name.includes('skill'))
    })

    if (categoryAssoc?.name) {
      cachedClientContactSkillAssociation = { fieldName: categoryAssoc.name, associatedEntity: 'Category' }
      console.log(`Detected ClientContact Category-based skills association field: ${categoryAssoc.name}`)
      return cachedClientContactSkillAssociation
    }
  } catch (e) {
    console.error('Error detecting ClientContact skill association field:', e)
  }

  return null
}

// Cache for skill IDs
const skillIdCache: Record<string, number | null> = {}

// Cache for Category IDs (in case this instance models Skills as Categories)
const categoryIdCache: Record<string, number | null> = {}

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
    const raw = String(skillName || '').trim()
    if (!raw) {
      skillIdCache[cacheKey] = null
      return null
    }

    // Try a few safe variants in case Skill name matching is case-sensitive in this instance.
    // (We keep it small for performance; cacheKey ensures we only do this once per unique skill.)
    const variants = Array.from(
      new Set([
        raw,
        raw.toUpperCase(),
        raw
          .split(/\s+/)
          .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
          .join(' '),
      ])
    )

    const tryQuery = async (name: string): Promise<number | null> => {
      const where = `name='${name.replace(/'/g, "''")}'`
      const params = new URLSearchParams({
        BhRestToken: bhRestToken,
        where,
        fields: 'id,name',
        count: '1',
      })
      const url = `${restUrl}query/Skill?${params.toString()}`
      const res = await bullhornFetch(url)
      if (!res.ok) {
        await res.text()
        return null
      }
      const json = await res.json().catch(() => null)
      const rows = (json as any)?.data
      const first = Array.isArray(rows) ? rows[0] : null
      const id = first?.id
      return typeof id === 'number' ? id : null
    }

    const trySearch = async (name: string): Promise<number | null> => {
      const query = `name:"${name.replace(/"/g, '\\"')}"`
      const params = new URLSearchParams({
        BhRestToken: bhRestToken,
        query,
        fields: 'id,name',
        count: '1',
      })
      const url = `${restUrl}search/Skill?${params.toString()}`
      const res = await bullhornFetch(url)
      if (!res.ok) {
        await res.text()
        return null
      }
      const json = await res.json().catch(() => null)
      const rows = (json as any)?.data
      const first = Array.isArray(rows) ? rows[0] : null
      const id = first?.id
      return typeof id === 'number' ? id : null
    }

    for (const name of variants) {
      // Prefer query() (exact match), fall back to search() (Lucene)
      const idFromQuery = await tryQuery(name)
      if (typeof idFromQuery === 'number') {
        skillIdCache[cacheKey] = idFromQuery
        return idFromQuery
      }

      const idFromSearch = await trySearch(name)
      if (typeof idFromSearch === 'number') {
        skillIdCache[cacheKey] = idFromSearch
        return idFromSearch
      }
    }

    skillIdCache[cacheKey] = null
    return null
  } catch (e) {
    console.error(`Error looking up skill "${skillName}":`, e)
    skillIdCache[cacheKey] = null
    return null
  }
}

async function lookupCategoryId(
  restUrl: string,
  bhRestToken: string,
  categoryName: string
): Promise<number | null> {
  const cacheKey = String(categoryName || '').toUpperCase().trim()
  if (cacheKey in categoryIdCache) return categoryIdCache[cacheKey]

  try {
    const raw = String(categoryName || '').trim()
    if (!raw) {
      categoryIdCache[cacheKey] = null
      return null
    }

    const variants = Array.from(
      new Set([
        raw,
        raw.toUpperCase(),
        raw
          .split(/\s+/)
          .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
          .join(' '),
      ])
    )

    const tryQuery = async (name: string): Promise<number | null> => {
      const where = `name='${name.replace(/'/g, "''")}'`
      const params = new URLSearchParams({
        BhRestToken: bhRestToken,
        where,
        fields: 'id,name',
        count: '1',
      })
      const url = `${restUrl}query/Category?${params.toString()}`
      const res = await bullhornFetch(url)
      if (!res.ok) {
        await res.text().catch(() => undefined)
        return null
      }
      const json = await res.json().catch(() => null)
      const rows = (json as any)?.data
      const first = Array.isArray(rows) ? rows[0] : null
      const id = first?.id
      return typeof id === 'number' ? id : null
    }

    const trySearch = async (name: string): Promise<number | null> => {
      const query = `name:"${name.replace(/"/g, '\\"')}"`
      const params = new URLSearchParams({
        BhRestToken: bhRestToken,
        query,
        fields: 'id,name',
        count: '1',
      })
      const url = `${restUrl}search/Category?${params.toString()}`
      const res = await bullhornFetch(url)
      if (!res.ok) {
        await res.text().catch(() => undefined)
        return null
      }
      const json = await res.json().catch(() => null)
      const rows = (json as any)?.data
      const first = Array.isArray(rows) ? rows[0] : null
      const id = first?.id
      return typeof id === 'number' ? id : null
    }

    for (const name of variants) {
      const idFromQuery = await tryQuery(name)
      if (typeof idFromQuery === 'number') {
        categoryIdCache[cacheKey] = idFromQuery
        return idFromQuery
      }

      const idFromSearch = await trySearch(name)
      if (typeof idFromSearch === 'number') {
        categoryIdCache[cacheKey] = idFromSearch
        return idFromSearch
      }
    }

    categoryIdCache[cacheKey] = null
    return null
  } catch (e) {
    console.error(`Error looking up category "${categoryName}":`, e)
    categoryIdCache[cacheKey] = null
    return null
  }
}

async function getExistingClientContactToManyIds(
  restUrl: string,
  bhRestToken: string,
  contactId: number,
  toManyFieldName: string
): Promise<number[]> {
  try {
    const params = new URLSearchParams({
      BhRestToken: bhRestToken,
      fields: 'id',
      count: '500',
      start: '0',
    })
    const url = `${restUrl}entity/ClientContact/${contactId}/${toManyFieldName}?${params.toString()}`
    const res = await bullhornFetch(url)
    if (!res.ok) {
      await res.text().catch(() => undefined)
      return []
    }
    const json = await res.json().catch(() => null)
    const rows = (json as any)?.data
    return Array.isArray(rows)
      ? rows.map((r: any) => r?.id).filter((id: any) => typeof id === 'number')
      : []
  } catch (_e) {
    return []
  }
}

async function associateSkillsWithContact(
  restUrl: string,
  bhRestToken: string,
  contactId: number,
  skillsString: string
): Promise<number> {
  if (!skillsString) return 0

  const assoc = await detectClientContactSkillAssociation(restUrl, bhRestToken)
  if (!assoc) {
    console.warn(
      'Could not detect a ClientContact to-many association for Skills in this Bullhorn instance; leaving Skills text fields populated only.'
    )
    return 0
  }

  const names = skillsString.split(' ; ').map((s) => s.trim()).filter(Boolean)
  if (names.length === 0) return 0

  const idPromises =
    assoc.associatedEntity === 'Skill'
      ? names.map((n) => lookupSkillId(restUrl, bhRestToken, n))
      : names.map((n) => lookupCategoryId(restUrl, bhRestToken, n))
  const idResults = await Promise.all(idPromises)
  const desiredIds = idResults.filter((id): id is number => id !== null)

  if (desiredIds.length === 0) {
    console.log(`No valid ${assoc.associatedEntity} IDs found for contact ${contactId} (skills: ${names.join(', ')})`)
    return 0
  }

  // Make it deterministic (so skills actually update): remove extras, then add missing
  const existingIds = await getExistingClientContactToManyIds(restUrl, bhRestToken, contactId, assoc.fieldName)
  const desiredSet = new Set(desiredIds)
  const existingSet = new Set(existingIds)

  const toRemove = existingIds.filter((id) => !desiredSet.has(id))
  const toAdd = desiredIds.filter((id) => !existingSet.has(id))

  const params = new URLSearchParams({ BhRestToken: bhRestToken })

  if (toRemove.length > 0) {
    const disUrl = `${restUrl}entity/ClientContact/${contactId}/${assoc.fieldName}/${toRemove.join(',')}?${params.toString()}`
    const disRes = await bullhornFetch(disUrl, { method: 'DELETE' })
    if (!disRes.ok) {
      const errorText = await disRes.text().catch(() => '')
      console.error(`Failed to disassociate ${assoc.fieldName} from contact ${contactId}: ${errorText}`)
    } else {
      await disRes.text().catch(() => undefined)
      console.log(`Disassociated ${toRemove.length} ${assoc.associatedEntity}(s) from contact ${contactId}`)
    }
  }

  if (toAdd.length === 0) {
    console.log(`Skills already up to date for contact ${contactId} (${assoc.associatedEntity} via ${assoc.fieldName})`)
    return desiredIds.length
  }

  const addUrl = `${restUrl}entity/ClientContact/${contactId}/${assoc.fieldName}/${toAdd.join(',')}?${params.toString()}`
  const addRes = await bullhornFetch(addUrl, { method: 'PUT' })
  if (!addRes.ok) {
    const errorText = await addRes.text().catch(() => '')
    console.error(`Failed to associate skills with contact ${contactId}: ${errorText}`)
    return 0
  }

  await addRes.text().catch(() => undefined)
  console.log(`Associated ${toAdd.length} ${assoc.associatedEntity}(s) with contact ${contactId} via ${assoc.fieldName}`)
  return desiredIds.length
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

  // Check if contact with this email already exists - if so, DELETE it first
  const searchUrl = `${restUrl}search/ClientContact?BhRestToken=${bhRestToken}&query=email:"${contact.email}"&fields=id,firstName,lastName`
  const searchResponse = await bullhornFetch(searchUrl)
  
  if (searchResponse.ok) {
    const searchData = await searchResponse.json()
    if (searchData.data && searchData.data.length > 0) {
      // Delete ALL existing contacts with this email (there could be duplicates)
      for (const existing of searchData.data) {
        const existingId = existing.id
        console.log(`Deleting existing contact ID ${existingId} (${existing.firstName} ${existing.lastName}) to recreate from CV`)
        
        const deleteUrl = `${restUrl}entity/ClientContact/${existingId}?BhRestToken=${bhRestToken}`
        const deleteResponse = await bullhornFetch(deleteUrl, {
          method: 'DELETE',
        })
        
        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text()
          console.error(`Failed to delete contact ${existingId}: ${errorText}`)
          // Continue anyway - we'll try to create the new one
        } else {
          await deleteResponse.text() // Consume body
          console.log(`Deleted existing contact ${existingId}`)
        }
        
        // Small delay after delete to let Bullhorn index update
        await sleep(100)
      }
    }
  } else {
    await searchResponse.text() // Consume body
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

  // Step 2: Add contacts using the to-many association endpoint
  // DistributionList has a 'members' to-many field (associatedEntity: Person)
  // Bullhorn uses: PUT /entity/DistributionList/{listId}/members/{personId1,personId2,...}
  console.log(`Adding ${contactIds.length} contacts to distribution list via 'members' field...`)
  
  // Batch the contact IDs to avoid URL length limits (max ~50 at a time)
  const BATCH_SIZE = 50
  let successCount = 0
  
  for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
    const batch = contactIds.slice(i, i + BATCH_SIZE)
    const batchIds = batch.join(',')
    
    try {
      // Use the 'members' to-many association endpoint (Person entities)
      const assocUrl = `${restUrl}entity/DistributionList/${listId}/members/${batchIds}?BhRestToken=${bhRestToken}`
      const assocResponse = await bullhornFetch(assocUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (assocResponse.ok) {
        successCount += batch.length
        console.log(`Added batch of ${batch.length} contacts to distribution list (${successCount}/${contactIds.length} total)`)
        await assocResponse.text() // consume response
      } else {
        const errorText = await assocResponse.text()
        console.error(`Failed to add batch of contacts to distribution list via 'members': ${errorText}`)
      }
    } catch (err: any) {
      console.error(`Error adding batch of contacts: ${err.message}`)
    }
    
    // Small delay between batches
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

    // Load learned patterns from database for enhanced skill generation
    const { data: patterns } = await supabase
      .from('skill_patterns')
      .select('pattern_type, pattern_value, skills, frequency, confidence')
      .gte('confidence', 0.15)
      .order('frequency', { ascending: false })
      .limit(500)
    
    learnedPatternsCache = (patterns as LearnedPattern[]) || []
    console.log(`Loaded ${learnedPatternsCache.length} learned skill patterns from database`)

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
          
          const skillsString = generateSkillsString(contact, searchPreferences, learnedPatternsCache || undefined)
          
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

    // Create Distribution List with exported contacts
    console.log(`Creating distribution list: ${listName}`)
    const listId = await createDistributionList(
      tokens.restUrl,
      tokens.bhRestToken,
      listName,
      contactIds
    )
    console.log(`Distribution list created with ID: ${listId}`)

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
