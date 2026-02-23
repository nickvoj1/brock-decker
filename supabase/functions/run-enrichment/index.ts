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

interface PersonToEnrich {
  id: string
  name: string
  title: string
  company: string
  location: string
  city?: string
  state?: string
  country?: string
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

// Known major global law firms (case-insensitive partial matching)
// These firms often don't have "law" or "LLP" in their commonly used names
const KNOWN_LAW_FIRMS = [
  // Magic Circle / UK Elite
  'norton rose fulbright', 'norton rose', 'linklaters', 'clifford chance', 
  'freshfields', 'allen & overy', 'allen and overy', 'a&o shearman',
  'slaughter and may', 'slaughter & may', 'herbert smith', 'ashurst',
  'hogan lovells', 'dla piper', 'eversheds', 'eversheds sutherland',
  'addleshaw goddard', 'cms cameron', 'dentons', 'pinsent masons',
  'burges salmon', 'travers smith', 'macfarlanes', 'stephenson harwood',
  'osborne clarke', 'taylor wessing', 'shoosmiths', 'fieldfisher',
  'bird & bird', 'bird and bird', 'simmons & simmons', 'simmons and simmons',
  'clyde & co', 'clyde and co', 'gowling wlg', 'mayer brown', 'reed smith',
  'watson farley', 'mishcon de reya', 'charles russell speechlys',
  'withers', 'farrer & co', 'farrer and co', 'forsters',
  
  // US Elite / Wall Street
  'kirkland & ellis', 'kirkland and ellis', 'latham & watkins', 'latham and watkins',
  'skadden', 'skadden arps', 'sullivan & cromwell', 'sullivan and cromwell',
  'wachtell', 'wachtell lipton', 'davis polk', 'cravath', 'simpson thacher',
  'paul weiss', 'cleary gottlieb', 'weil gotshal', 'debevoise', 'debevoise & plimpton',
  'willkie farr', 'milbank', 'fried frank', 'quinn emanuel', 'gibson dunn',
  'sidley austin', 'sidley', 'jones day', 'white & case', 'white and case',
  'covington', 'covington & burling', 'orrick', 'morrison & foerster', 
  'morrison foerster', 'mofo', 'paul hastings', 'proskauer', 'akin gump',
  'baker mckenzie', 'baker & mckenzie', 'king & spalding', 'king and spalding',
  'ropes & gray', 'ropes and gray', 'morgan lewis', 'goodwin', 'goodwin procter',
  'cooley', 'fenwick', 'fenwick & west', 'wilson sonsini', 'perkins coie',
  'sheppard mullin', 'greenberg traurig', 'holland & knight', 'katten',
  'dechert', 'cadwalader', 'schulte roth', 'kramer levin', 'stroock',
  
  // European / German / Swiss
  'gleiss lutz', 'hengeler mueller', 'hengeler müller', 'freshfields bruckhaus',
  'noerr', 'luther', 'oppenhoff', 'white & case germany', 'homburger',
  'bär & karrer', 'walder wyss', 'lenz & staehelin', 'niederer kraft frey',
  
  // French
  'bredin prat', 'darrois villey', 'gide loyrette', 'cleary paris',
  
  // Other Global
  'baker botts', 'vinson & elkins', 'vinson and elkins', 'bracewell',
  'haynes and boone', 'haynes boone', 'king & wood mallesons', 
  'king wood mallesons', 'herbert smith freehills', 'allens',
  'blake cassels', 'stikeman elliott', 'osler', 'mccarthy tetrault',
  
  // Nordic
  'mannheimer swartling', 'roschier', 'gernandt & danielsson',
  
  // Spanish / LatAm  
  'garrigues', 'cuatrecasas', 'uria menendez', 'pérez-llorca',
  
  // Asian
  'nishimura', 'nagashima', 'anderson mori', 'mori hamada', 'kim & chang',
  'rajah & tann', 'wong partnership', 'drew & napier'
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
  
  // Check against known law firms list (highest priority - catches firms like "Norton Rose Fulbright")
  for (const firm of KNOWN_LAW_FIRMS) {
    if (nameLower.includes(firm)) {
      console.log(`[LAW FIRM EXCLUDED] "${companyName}" - matched known firm: ${firm}`)
      return true
    }
  }
  
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

// ============ Recruitment Company Detection ============
// Recruitment/headhunting firms should not appear in results (we're looking for clients, not competitors)
const RECRUITMENT_SUFFIXES = [
  'recruitment', 'recruiting', 'staffing', 'headhunters', 'headhunting',
  'executive search', 'talent solutions', 'talent acquisition', 'personnel',
  'search partners', 'search consultants', 'search firm', 'search group',
  'hr solutions', 'hr consulting', 'workforce solutions', 'employment agency',
  'employment services', 'placement', 'job agency'
]

const RECRUITMENT_KEYWORDS = [
  'recruitment', 'recruiting', 'headhunt', 'headhunting', 'executive search',
  'talent acquisition', 'staffing agency', 'staffing firm', 'employment agency',
  'personnel agency', 'search firm', 'job placement', 'hiring solutions',
  'hr consulting', 'workforce solutions', 'temp agency', 'contract staffing'
]

// Known major recruitment companies (case-insensitive matching)
const KNOWN_RECRUITMENT_COMPANIES = [
  'cornell search', 'heidrick & struggles', 'heidrick and struggles', 'korn ferry',
  'spencer stuart', 'russell reynolds', 'egon zehnder', 'boyden', 'stanton chase',
  'odgers berndtson', 'michael page', 'page executive', 'robert half', 'robert walters',
  'randstad', 'manpower', 'manpowergroup', 'adecco', 'kelly services', 'hays',
  'harvey nash', 'la fosse', 'phaidon international', 'sthree', 'signium',
  'alexander mann', 'cielo', 'hudson', 'talent works', 'reed', 'reed specialist',
  'charterhouse', 'alumni global', 'beaumont bailey', 'norman broadbent', 'ward howell',
  'jm search', 'whitney partners', 'dhillon consulting', 'amrop', 'ims group',
  'hanover search', 'stone executive', 'praxis partners'
]

function isRecruitmentCompany(companyName: string, industry?: string | null): boolean {
  if (!companyName) return false
  
  const nameLower = companyName.toLowerCase().trim()
  
  // Check against known recruitment companies
  for (const known of KNOWN_RECRUITMENT_COMPANIES) {
    if (nameLower.includes(known) || known.includes(nameLower)) {
      console.log(`[RECRUITMENT EXCLUDED] "${companyName}" - known recruitment company: ${known}`)
      return true
    }
  }
  
  // Check for recruitment suffixes in company name
  for (const suffix of RECRUITMENT_SUFFIXES) {
    if (nameLower.endsWith(` ${suffix}`) || nameLower === suffix || nameLower.includes(` ${suffix} `)) {
      console.log(`[RECRUITMENT EXCLUDED] "${companyName}" - matched suffix: ${suffix}`)
      return true
    }
  }
  
  // Check for recruitment keywords in company name
  for (const keyword of RECRUITMENT_KEYWORDS) {
    if (nameLower.includes(keyword)) {
      console.log(`[RECRUITMENT EXCLUDED] "${companyName}" - matched keyword: ${keyword}`)
      return true
    }
  }
  
  // Check industry field from Apollo
  if (industry) {
    const industryLower = industry.toLowerCase()
    if (industryLower.includes('staffing') || industryLower.includes('recruiting') ||
        industryLower.includes('recruitment') || industryLower.includes('employment services') ||
        industryLower.includes('human resources') || industryLower.includes('hr services')) {
      console.log(`[RECRUITMENT EXCLUDED] "${companyName}" - industry: ${industry}`)
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
  london: ['United Kingdom'],
  europe: ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Switzerland', 'Ireland', 'Spain', 'Italy', 'Belgium', 'Luxembourg', 'Sweden', 'Denmark', 'Norway', 'Finland', 'Austria', 'Poland', 'Portugal'],
  uae: ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Kuwait', 'Oman'],
  usa: ['United States'],
  east_usa: ['New York', 'Massachusetts', 'Connecticut', 'New Jersey', 'Pennsylvania', 'Washington D.C.', 'Virginia', 'Maryland', 'Florida', 'Georgia', 'Illinois'],
  west_usa: ['California', 'Washington', 'Oregon', 'Colorado', 'Texas', 'Arizona'],
}

interface RetryStrategy {
  name: string
  companyName: string
  locations: string[]
  locationMode: 'city' | 'country' | 'none'
}

const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'united kingdom',
  'u k': 'united kingdom',
  england: 'united kingdom',
  'britain': 'united kingdom',
  'great britain': 'united kingdom',
  'united states of america': 'united states',
  'usa': 'united states',
  'us': 'united states',
  'u s': 'united states',
  'ny': 'united states',
  'ma': 'united states',
  'ca': 'united states',
  'il': 'united states',
  'wa': 'united states',
  'tx': 'united states',
  'fl': 'united states',
  'dc': 'united states',
  'new york': 'united states',
  'massachusetts': 'united states',
  'california': 'united states',
  'illinois': 'united states',
  'washington': 'united states',
  'texas': 'united states',
  'florida': 'united states',
  'georgia': 'united states',
  'virginia': 'united states',
  'maryland': 'united states',
  'connecticut': 'united states',
  'new jersey': 'united states',
  'pennsylvania': 'united states',
  'oregon': 'united states',
  'colorado': 'united states',
  'arizona': 'united states',
  'london': 'united kingdom',
  'manchester': 'united kingdom',
  'birmingham': 'united kingdom',
  'edinburgh': 'united kingdom',
  'paris': 'france',
  'lyon': 'france',
  'marseille': 'france',
  'berlin': 'germany',
  'frankfurt': 'germany',
  'munich': 'germany',
  'hamburg': 'germany',
  'dusseldorf': 'germany',
  'amsterdam': 'netherlands',
  'rotterdam': 'netherlands',
  'zurich': 'switzerland',
  'geneva': 'switzerland',
  'basel': 'switzerland',
  'dublin': 'ireland',
  'cork': 'ireland',
  'madrid': 'spain',
  'barcelona': 'spain',
  'milan': 'italy',
  'rome': 'italy',
  'lisbon': 'portugal',
  'porto': 'portugal',
  'vienna': 'austria',
  'brussels': 'belgium',
  'antwerp': 'belgium',
  'luxembourg city': 'luxembourg',
  'stockholm': 'sweden',
  'gothenburg': 'sweden',
  'copenhagen': 'denmark',
  'oslo': 'norway',
  'helsinki': 'finland',
  'warsaw': 'poland',
  'krakow': 'poland',
  'dubai': 'united arab emirates',
  'abu dhabi': 'united arab emirates',
  'riyadh': 'saudi arabia',
  'bahrain': 'bahrain',
  'doha': 'qatar',
  'new york city': 'united states',
  'boston': 'united states',
  'chicago': 'united states',
  'san francisco': 'united states',
  'los angeles': 'united states',
  'seattle': 'united states',
  'miami': 'united states',
  'dallas': 'united states',
  'houston': 'united states',
  'atlanta': 'united states',
  'austin': 'united states',
  'denver': 'united states',
  'washington dc': 'united states',
  'washington d c': 'united states',
  'uae': 'united arab emirates',
  'emirates': 'united arab emirates',
}

function normalizeLocationToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[().]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCountry(value: string): string {
  const normalized = normalizeLocationToken(value)
  if (!normalized) return ''
  return COUNTRY_ALIASES[normalized] || normalized
}

function isLocationCountryOnly(value: string): boolean {
  if (!value) return false
  return !value.includes(',')
}

function extractCountryFromApolloLocation(value: string): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (raw.includes(',')) {
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length > 1) {
      return normalizeCountry(parts[parts.length - 1])
    }
  }
  if (isLocationCountryOnly(raw)) {
    return normalizeCountry(raw)
  }
  return null
}

function countryTokenToQueryLabel(token: string): string {
  const normalized = normalizeCountry(token)
  if (!normalized) return ''
  const map: Record<string, string> = {
    'united kingdom': 'United Kingdom',
    'united states': 'United States',
    'united arab emirates': 'United Arab Emirates',
    'germany': 'Germany',
    'france': 'France',
    'netherlands': 'Netherlands',
    'switzerland': 'Switzerland',
    'ireland': 'Ireland',
    'spain': 'Spain',
    'italy': 'Italy',
    'belgium': 'Belgium',
    'luxembourg': 'Luxembourg',
    'saudi arabia': 'Saudi Arabia',
    'qatar': 'Qatar',
    'bahrain': 'Bahrain',
    'kuwait': 'Kuwait',
    'oman': 'Oman',
    'austria': 'Austria',
    'poland': 'Poland',
    'portugal': 'Portugal',
    'sweden': 'Sweden',
    'denmark': 'Denmark',
    'norway': 'Norway',
    'finland': 'Finland',
  }
  if (map[normalized]) return map[normalized]
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function matchesStrictLocation(
  person: { city?: string | null; state?: string | null; country?: string | null },
  mode: 'city' | 'country' | 'none',
  allowedCities: Set<string>,
  allowedCountries: Set<string>
): boolean {
  if (mode === 'none') return true

  const city = normalizeLocationToken(person.city || '')
  const state = normalizeLocationToken(person.state || '')
  const country = normalizeCountry(person.country || '')

  if (mode === 'city') {
    if (allowedCities.size === 0) return true
    if (city && allowedCities.has(city)) return true
    if (state && allowedCities.has(state)) return true
    return false
  }

  if (allowedCountries.size === 0) return true
  return !!country && allowedCountries.has(country)
}

function buildRetryStrategies(
  originalCompany: string,
  signalTitle: string,
  signalRegion: string,
  originalLocations: string[],
  countryFallbackLocations: string[],
  strictLocationEnabled: boolean
): RetryStrategy[] {
  const strategies: RetryStrategy[] = []
  const originalLocationMode: 'city' | 'country' =
    originalLocations.some((loc) => String(loc || '').includes(',')) ? 'city' : 'country'
  
  // Strategy 1: Original company, original locations (already tried)
  
  // Strategy 2: Stripped suffixes company name
  const strippedCompany = stripCompanySuffixes(originalCompany)
  if (strippedCompany !== normalizeCompanyName(originalCompany)) {
    strategies.push({
      name: 'stripped_suffixes',
      companyName: strippedCompany,
      locations: originalLocations,
      locationMode: originalLocationMode,
    })
  }
  
  // Strategy 3: Title-derived company name
  const titleCompany = extractCompanyFromSignalTitle(signalTitle)
  if (titleCompany && normalizeCompanyName(titleCompany) !== normalizeCompanyName(originalCompany)) {
    strategies.push({
      name: 'title_derived',
      companyName: titleCompany,
      locations: originalLocations,
      locationMode: originalLocationMode,
    })
  }
  
  // Strategy 4: Widen to country-level locations
  const countryLocations = countryFallbackLocations.length > 0
    ? countryFallbackLocations
    : (REGION_COUNTRY_LOCATIONS[signalRegion] || [])
  if (countryLocations.length > 0) {
    strategies.push({
      name: 'widen_location',
      companyName: originalCompany,
      locations: countryLocations,
      locationMode: 'country',
    })
    
    // Also try stripped company + widened locations
    if (strippedCompany !== normalizeCompanyName(originalCompany)) {
      strategies.push({
        name: 'stripped_widen',
        companyName: strippedCompany,
        locations: countryLocations,
        locationMode: 'country',
      })
    }
  }
  
  // Strategy 5: No location filter (last resort, disabled for strict location mode)
  if (!strictLocationEnabled) {
    strategies.push({
      name: 'no_location_filter',
      companyName: originalCompany,
      locations: [],
      locationMode: 'none',
    })
  }
  
  return strategies
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { runId, bullhornEmails } = await req.json()

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
    const searchType = String((preferences[0] as any)?.type || '').toLowerCase()
    const isJobBoardSearch = searchType === 'jobboard_contact_search'
    const isSpecialRequestSearch = searchType === 'special_request'
    const skipUsedContactsExclusion = isJobBoardSearch || isSpecialRequestSearch

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

    // Fetch recently used contacts (within last 14 days) to exclude them
    // This prevents the same contacts from appearing in different searches
    // by different users with similar industries/sectors/locations
    const CONTACT_EXCLUSION_DAYS = 14
    const exclusionCutoff = new Date()
    exclusionCutoff.setDate(exclusionCutoff.getDate() - CONTACT_EXCLUSION_DAYS)
    
    const usedEmails = new Set<string>()
    if (!skipUsedContactsExclusion) {
      const { data: recentlyUsedContacts } = await supabase
        .from('used_contacts')
        .select('email')
        .gte('added_at', exclusionCutoff.toISOString())
      ;(recentlyUsedContacts || []).forEach((c) => {
        if (c?.email) usedEmails.add(String(c.email).toLowerCase())
      })
      console.log(`Excluding ${usedEmails.size} contacts used in the last ${CONTACT_EXCLUSION_DAYS} days`)
    } else {
      console.log('Used-contacts exclusion disabled for this run (jobboard/special request)')
    }

    // Bullhorn email tracking - allows up to 50% of contacts to be from Bullhorn
    // This ensures we find NEW contacts while still allowing some existing ones
    const bullhornEmailSet = new Set<string>()
    if (bullhornEmails && Array.isArray(bullhornEmails)) {
      bullhornEmails.forEach((email: string) => {
        if (email) bullhornEmailSet.add(email.toLowerCase())
      })
      console.log(`Tracking ${bullhornEmailSet.size} contacts from Bullhorn CRM (max 50% allowed in results)`)
    }
    
    // Track Bullhorn vs new contact counts for 50% cap
    let bullhornContactCount = 0
    const MAX_BULLHORN_PERCENTAGE = 0.5 // Allow up to 50% from Bullhorn

    // Search for hiring contacts based on industries
    const allContacts: ApolloContact[] = []
    const seenEmails = new Set<string>() // Track unique contacts by email
    const seenPersonIds = new Set<string>() // Track unique Apollo person IDs to prevent double-enrichment
    const seenNameCompany = new Set<string>() // O(1) dedup for name+company across all loops
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
    
    // Get target company if specified (signal/job-board/special targeted searches)
    const targetCompany = preferences[0]?.targetCompany || null
    const signalTitle = (preferences[0] as any)?.signalTitle || ''
    const signalRegion = (preferences[0] as any)?.signalRegion || ''
    const targetCompanyGoalContacts = targetCompany
      ? (
          (isJobBoardSearch || isSpecialRequestSearch)
            ? maxContacts
            : Math.min(maxContacts, 10)
        )
      : 0
    
    if (targetCompany) {
      console.log(`Target-company search: targeting "${targetCompany}" (type=${searchType || 'general'})`)
      console.log(`Location fallback goal: ${targetCompanyGoalContacts} contacts`)
      if (skipUsedContactsExclusion) {
        console.log('Used-contacts exclusion disabled for this run (jobboard/special request)')
      }
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
    const strictLocationEnabled = Boolean(targetCompany)
    const strictCityLocations = Array.from(
      new Set(apolloLocations.filter((loc) => !isLocationCountryOnly(loc)))
    )
    const explicitCountryTokens = apolloLocations
      .filter((loc) => isLocationCountryOnly(loc))
      .map((loc) => normalizeCountry(loc))
      .filter(Boolean)
    const derivedCountryTokens = strictCityLocations
      .map((loc) => {
        const parts = String(loc || '').split(',').map((p) => p.trim()).filter(Boolean)
        return parts.length > 1 ? normalizeCountry(parts[parts.length - 1]) : ''
      })
      .filter(Boolean)
    const strictCountryTokens = Array.from(new Set([
      ...explicitCountryTokens,
      ...derivedCountryTokens,
    ].filter(Boolean)))
    const strictCountryLocations = Array.from(
      new Set(strictCountryTokens.map((token) => countryTokenToQueryLabel(token)).filter(Boolean))
    )
    const primarySearchLocations = strictLocationEnabled && strictCityLocations.length > 0
      ? strictCityLocations
      : apolloLocations
    const initialLocationMode: 'city' | 'country' =
      strictLocationEnabled && strictCityLocations.length > 0 ? 'city' : 'country'

    const allowedCityTokens = new Set(
      primarySearchLocations
        .map((loc) => normalizeLocationToken(loc.split(',')[0] || loc))
        .filter(Boolean)
    )
    const allowedCountryTokens = new Set(
      strictCountryTokens
    )

    if (strictLocationEnabled) {
      console.log('Strict location mode enabled for target-company search')
      console.log(`Primary city locations: ${primarySearchLocations.join(' | ') || 'none'}`)
      console.log(`Country fallback locations: ${strictCountryLocations.join(' | ') || 'none'}`)
    }

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
        if (primarySearchLocations.length > 0) {
          primarySearchLocations.forEach(loc => queryParams.append('person_locations[]', loc))
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
        
        // Speed mode defaults: fewer pages unless target-company search needs depth.
        const maxPages = targetCompany
          ? ((isJobBoardSearch || isSpecialRequestSearch) ? 4 : 3)
          : 2
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
            const peopleToEnrich: PersonToEnrich[] = []
            const pendingByCompany: Record<string, number> = {}
            
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

              if (strictLocationEnabled) {
                const isLocationMatch = matchesStrictLocation(
                  { city: person.city, state: person.state, country: person.country },
                  initialLocationMode,
                  allowedCityTokens,
                  allowedCountryTokens
                )
                if (!isLocationMatch) {
                  continue
                }
              }
              
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
              
              // Exclude recruitment/headhunting companies (competitors, not clients)
              if (isRecruitmentCompany(companyName, personIndustry)) {
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
              const existingCompanyCount = companyContactCount[companyName] || 0
              const pendingCompanyCount = pendingByCompany[companyName] || 0
              if (existingCompanyCount + pendingCompanyCount >= effectiveMaxPerCompany) {
                continue
              }
              
              // Check if we already have this contact
              const dedupeKey = `${(person.name || '').toLowerCase().trim()}|${companyName.toLowerCase().trim()}`
              if (seenNameCompany.has(dedupeKey)) continue
              
              const personName = person.name || 'Unknown'
              const personTitle = person.title || 'Unknown'
              
              // Build location from search data
              const locationParts = [person.city, person.state, person.country].filter(Boolean)
              const fullLocation = locationParts.length > 0 ? locationParts.join(', ') : personLocation
              
              // Check if email is already available from search results (SAVES 1 CREDIT!)
              if (person.email) {
                const emailLower = person.email.toLowerCase()
                
                // Check for duplicates and recently used
                if (!skipUsedContactsExclusion && usedEmails.has(emailLower)) {
                  console.log(`Skipping recently used contact: ${personName} (${person.email})`)
                  continue
                }
                if (seenEmails.has(emailLower)) {
                  console.log(`Skipping duplicate: ${personName} (${person.email})`)
                  continue
                }
                
                // Check Bullhorn 50% cap: prefer new contacts, but allow Bullhorn contacts up to 50%
                const isFromBullhorn = bullhornEmailSet.has(emailLower)
                if (isFromBullhorn) {
                  const currentTotal = allContacts.length + contactsWithEmail.length
                  const maxBullhornAllowed = Math.floor((currentTotal + 1) * MAX_BULLHORN_PERCENTAGE)
                  if (bullhornContactCount >= maxBullhornAllowed) {
                    console.log(`Skipping Bullhorn contact (50% cap): ${personName} (${person.email}) - ${bullhornContactCount}/${currentTotal + 1}`)
                    continue
                  }
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
                seenNameCompany.add(`${personName.toLowerCase().trim()}|${companyName.toLowerCase().trim()}`)
                companyContactCount[companyName] = (companyContactCount[companyName] || 0) + 1
                if (isFromBullhorn) bullhornContactCount++
                console.log(`[Direct] Adding contact: ${personName} at ${companyName} (email from search)${isFromBullhorn ? ' [BULLHORN]' : ''}`)
              } else if (person.id && !seenPersonIds.has(person.id)) {
                // No email in search results - need to enrich (only if not already seen)
                seenPersonIds.add(person.id) // Mark as seen to prevent duplicate enrichment
                peopleToEnrich.push({
                  id: person.id,
                  name: personName,
                  title: personTitle,
                  company: companyName,
                  location: fullLocation,
                  city: person.city || undefined,
                  state: person.state || undefined,
                  country: person.country || undefined,
                })
                pendingByCompany[companyName] = (pendingByCompany[companyName] || 0) + 1
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
                const enrichResults = await Promise.allSettled(
                  batch.map(async (personData) => {
                    creditsUsed++
                    const enrichResponse = await fetch('https://api.apollo.io/api/v1/people/match', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apolloApiKey,
                      },
                      body: JSON.stringify({ id: personData.id }),
                    })
                    if (!enrichResponse.ok) return null
                    const enriched = await enrichResponse.json()
                    return { personData, person: enriched.person || {} }
                  })
                )

                for (const result of enrichResults) {
                  if (allContacts.length >= maxContacts) break
                  if (result.status !== 'fulfilled' || !result.value) continue

                  const { personData, person } = result.value
                  const email = person.email || ''
                  const fullName = person.name || (person.first_name && person.last_name
                    ? `${person.first_name} ${person.last_name}`.trim()
                    : personData.name)
                  const locationParts = [
                    person.city || personData.city,
                    person.state || personData.state,
                    person.country || personData.country,
                  ].filter(Boolean)
                  const fullLocation = locationParts.length > 0 ? locationParts.join(', ') : personData.location
                  const companyName = person.organization?.name || personData.company
                  const jobTitle = person.title || personData.title || 'Unknown'

                  if (strictLocationEnabled) {
                    const isLocationMatch = matchesStrictLocation(
                      {
                        city: person.city || personData.city,
                        state: person.state || personData.state,
                        country: person.country || personData.country,
                      },
                      initialLocationMode,
                      allowedCityTokens,
                      allowedCountryTokens
                    )
                    if (!isLocationMatch) continue
                  }

                  const effectiveMaxPerCompany = targetCompany ? 50 : maxPerCompany
                  if ((companyContactCount[companyName] || 0) >= effectiveMaxPerCompany) continue

                  if (!(email && fullName && fullName !== 'Unknown')) continue
                  const emailLower = email.toLowerCase()
                  if ((!skipUsedContactsExclusion && usedEmails.has(emailLower)) || seenEmails.has(emailLower)) continue

                  const dedupeKey = `${fullName.toLowerCase().trim()}|${companyName.toLowerCase().trim()}`
                  if (seenNameCompany.has(dedupeKey)) continue

                  const isFromBullhorn = bullhornEmailSet.has(emailLower)
                  if (isFromBullhorn) {
                    const currentTotal = allContacts.length
                    const maxBullhornAllowed = Math.floor((currentTotal + 1) * MAX_BULLHORN_PERCENTAGE)
                    if (bullhornContactCount >= maxBullhornAllowed) continue
                  }

                  const newContact: ApolloContact = {
                    name: fullName,
                    title: jobTitle,
                    location: fullLocation,
                    email,
                    company: companyName,
                  }

                  if (useEqualDistribution && comboIndustry) {
                    const quota = industryQuotas[comboIndustry] || 0
                    const currentCount = industryContacts[comboIndustry]?.length || 0
                    if (currentCount >= quota) continue
                    industryContacts[comboIndustry].push(newContact)
                  }

                  seenEmails.add(emailLower)
                  seenNameCompany.add(dedupeKey)
                  companyContactCount[companyName] = (companyContactCount[companyName] || 0) + 1
                  if (isFromBullhorn) bullhornContactCount++
                  allContacts.push(newContact)
                }
              }
            }
          } else {
            const errorText = await apolloResponse.text()
            console.error('Apollo API error:', apolloResponse.status, errorText)
            hasMoreResults = false
          }
          
          currentPage++
          
          // Keep a short pause between pages to reduce burst rate.
          await new Promise(resolve => setTimeout(resolve, 50))
        } // end while loop

        processedCount++
        
        // Update progress periodically to reduce DB write overhead.
        if (processedCount % 5 === 0 || processedCount === searchCombinations.length) {
          await supabase
            .from('enrichment_runs')
            .update({ processed_count: processedCount })
            .eq('id', runId)
        }

      } catch (error) {
        console.error(`Error searching for combination ${combo.label}:`, error)
        processedCount++
      }
    }

    // ============ TARGET-COMPANY RETRY LOOP ============
    // If this is a target-company search and we haven't found enough contacts, try retry strategies
    if (targetCompany && allContacts.length < targetCompanyGoalContacts) {
      console.log(`\n=== TARGET-COMPANY RETRY LOOP ===`)
      console.log(`Only found ${allContacts.length} contacts at "${targetCompany}", need ${targetCompanyGoalContacts}`)
      
      const retryStrategies = buildRetryStrategies(
        targetCompany,
        signalTitle,
        signalRegion,
        primarySearchLocations,
        strictCountryLocations,
        strictLocationEnabled
      )
      console.log(`Trying ${retryStrategies.length} retry strategies...`)
      
      for (const strategy of retryStrategies) {
        if (allContacts.length >= targetCompanyGoalContacts) {
          console.log(`Target reached (${allContacts.length} contacts), stopping retries`)
          break
        }
        
        console.log(`\n--- Retry strategy: ${strategy.name} ---`)
        console.log(`Company: "${strategy.companyName}", Locations: ${strategy.locations.length > 0 ? strategy.locations.slice(0, 3).join(', ') + '...' : 'none'}`)

        const retryAllowedCityTokens = new Set(
          (strategy.locationMode === 'city' ? strategy.locations : [])
            .map((loc) => normalizeLocationToken(loc.split(',')[0] || loc))
            .filter(Boolean)
        )
        const retryAllowedCountryTokens = new Set(
          (strategy.locationMode === 'country' ? strategy.locations : strictCountryLocations)
            .map((loc) => normalizeCountry(loc))
            .filter(Boolean)
        )
        
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
          const maxRetryPages = (isJobBoardSearch || isSpecialRequestSearch) ? 5 : 4
          let currentPage = 1
          let hasMoreResults = true
          
          while (hasMoreResults && currentPage <= maxRetryPages && allContacts.length < targetCompanyGoalContacts) {
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
              const peopleToEnrich: PersonToEnrich[] = []
              
              for (const person of people) {
                if (allContacts.length + contactsWithEmail.length + peopleToEnrich.length >= maxContacts) break
                
                const personCompanyName = person.organization?.name || person.organization_name || 'Unknown'
                const personIndustry = person.organization?.industry || null
                const personLocation = person.city || person.state || person.country || 'Unknown'

                if (strictLocationEnabled) {
                  const locationMatch = matchesStrictLocation(
                    { city: person.city, state: person.state, country: person.country },
                    strategy.locationMode,
                    retryAllowedCityTokens,
                    retryAllowedCountryTokens
                  )
                  if (!locationMatch) continue
                }
                
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
                
                const dedupeKey = `${(person.name || '').toLowerCase().trim()}|${personCompanyName.toLowerCase().trim()}`
                const isDuplicate = seenNameCompany.has(dedupeKey) || seenEmails.has((person.email || '').toLowerCase())
                if (isDuplicate) continue
                
                const personName = person.name || 'Unknown'
                const personTitle = person.title || 'Unknown'
                const locationParts = [person.city, person.state, person.country].filter(Boolean)
                const fullLocation = locationParts.length > 0 ? locationParts.join(', ') : personLocation
                
                // Check if email is already available from search results (SAVES 1 CREDIT!)
                if (person.email) {
                  const emailLower = person.email.toLowerCase()
                  if ((skipUsedContactsExclusion || !usedEmails.has(emailLower)) && !seenEmails.has(emailLower)) {
                    contactsWithEmail.push({
                      name: personName,
                      title: personTitle,
                      location: fullLocation,
                      email: person.email,
                      company: personCompanyName,
                    })
                    seenEmails.add(emailLower)
                    seenNameCompany.add(`${personName.toLowerCase().trim()}|${personCompanyName.toLowerCase().trim()}`)
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
                    city: person.city || undefined,
                    state: person.state || undefined,
                    country: person.country || undefined,
                  })
                }
              }
              
              // Add contacts that had emails directly from search
              for (const contact of contactsWithEmail) {
                if (allContacts.length >= targetCompanyGoalContacts) break
                allContacts.push(contact)
              }
              
              console.log(`[Retry] Found ${contactsWithEmail.length} with email from search, ${peopleToEnrich.length} need enrichment`)
              
              // CREDIT OPTIMIZATION: Only enrich people we actually need
              if (peopleToEnrich.length > 0 && allContacts.length < targetCompanyGoalContacts) {
                const contactsStillNeeded = targetCompanyGoalContacts - allContacts.length
                const limitedPeopleToEnrich = peopleToEnrich.slice(0, contactsStillNeeded)
                
                if (limitedPeopleToEnrich.length < peopleToEnrich.length) {
                  console.log(`CREDIT SAVER: Only enriching ${limitedPeopleToEnrich.length}/${peopleToEnrich.length} for retry`)
                }
                
                for (let i = 0; i < limitedPeopleToEnrich.length; i += 10) {
                  if (allContacts.length >= targetCompanyGoalContacts) break
                  
                  const batch = limitedPeopleToEnrich.slice(i, i + 10)
                  const retryEnrichResults = await Promise.allSettled(
                    batch.map(async (personData) => {
                      creditsUsed++
                      const enrichResponse = await fetch('https://api.apollo.io/api/v1/people/match', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-api-key': apolloApiKey,
                        },
                        body: JSON.stringify({ id: personData.id }),
                      })
                      if (!enrichResponse.ok) return null
                      const enriched = await enrichResponse.json()
                      return { personData, person: enriched.person || {} }
                    })
                  )

                  for (const result of retryEnrichResults) {
                    if (allContacts.length >= targetCompanyGoalContacts) break
                    if (result.status !== 'fulfilled' || !result.value) continue
                    const { personData, person } = result.value

                    const email = person.email || ''
                    const fullName = person.name || personData.name
                    const companyName = person.organization?.name || personData.company
                    const jobTitle = person.title || personData.title || 'Unknown'
                    const locationParts = [
                      person.city || personData.city,
                      person.state || personData.state,
                      person.country || personData.country,
                    ].filter(Boolean)
                    const fullLocation = locationParts.length > 0 ? locationParts.join(', ') : personData.location

                    if (strictLocationEnabled) {
                      const locationMatch = matchesStrictLocation(
                        {
                          city: person.city || personData.city,
                          state: person.state || personData.state,
                          country: person.country || personData.country,
                        },
                        strategy.locationMode,
                        retryAllowedCityTokens,
                        retryAllowedCountryTokens
                      )
                      if (!locationMatch) continue
                    }

                    if (!(email && fullName && fullName !== 'Unknown')) continue
                    const emailLower = email.toLowerCase()
                    if ((!skipUsedContactsExclusion && usedEmails.has(emailLower)) || seenEmails.has(emailLower)) continue

                    const dedupeKey = `${fullName.toLowerCase().trim()}|${companyName.toLowerCase().trim()}`
                    if (seenNameCompany.has(dedupeKey)) continue

                    seenEmails.add(emailLower)
                    seenNameCompany.add(dedupeKey)
                    allContacts.push({
                      name: fullName,
                      title: jobTitle,
                      location: fullLocation,
                      email,
                      company: companyName,
                    })
                  }
                }
              }
            } else {
              const errorText = await apolloResponse.text()
              console.error(`Retry Apollo error:`, apolloResponse.status, errorText.substring(0, 200))
              hasMoreResults = false
            }
            
            currentPage++
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        } catch (retryError) {
          console.error(`Retry strategy ${strategy.name} failed:`, retryError)
        }
      }
      
      console.log(`\n=== RETRY COMPLETE: Found ${allContacts.length} total contacts ===\n`)
    }
    // ============ END TARGET-COMPANY RETRY LOOP ============

    // Log Bullhorn ratio summary
    const newContactCount = allContacts.length - bullhornContactCount
    console.log(`\n=== SEARCH SUMMARY ===`)
    console.log(`Total contacts: ${allContacts.length}`)
    console.log(`New contacts: ${newContactCount} (${allContacts.length > 0 ? Math.round(newContactCount / allContacts.length * 100) : 0}%)`)
    console.log(`Bullhorn contacts: ${bullhornContactCount} (${allContacts.length > 0 ? Math.round(bullhornContactCount / allContacts.length * 100) : 0}%)`)
    console.log(`======================\n`)

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
