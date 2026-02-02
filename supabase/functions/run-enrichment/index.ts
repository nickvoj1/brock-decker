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
    const companyContactCount: Record<string, number> = {}
    let processedCount = 0

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
            
            // Collect person IDs to enrich (get emails)
            const peopleToEnrich: Array<{id: string, name: string, title: string, company: string, location: string}> = []
            
            // Determine quota limit for this combination's industry
            const comboIndustryQuota = (useEqualDistribution && comboIndustry) 
              ? (industryQuotas[comboIndustry] || maxContacts) 
              : maxContacts
            const currentIndustryCount = (useEqualDistribution && comboIndustry)
              ? (industryContacts[comboIndustry]?.length || 0)
              : 0
            
            for (const person of people) {
              if (allContacts.length + peopleToEnrich.length >= maxContacts) break
              
              // For equal distribution: check industry-specific quota
              if (useEqualDistribution && comboIndustry) {
                if (currentIndustryCount + peopleToEnrich.length >= comboIndustryQuota) {
                  console.log(`Industry ${comboIndustry} quota reached, stopping collection`)
                  break
                }
              }
              
              const companyName = person.organization?.name || person.organization_name || 'Unknown'
              const personLocation = person.city || person.state || person.country || 'Unknown'
              
              // Skip contacts from candidate's previous employers
              const normalizedCompany = companyName.toLowerCase().trim()
              const isExcludedCompany = Array.from(excludedCompanies).some(excluded => 
                normalizedCompany.includes(excluded) || excluded.includes(normalizedCompany)
              )
              if (isExcludedCompany) {
                continue
              }
              
              // Check max per company limit
              if ((companyContactCount[companyName] || 0) >= maxPerCompany) {
                continue
              }
              
              // Check if we already have this contact
              const isDuplicate = allContacts.some(c => 
                c.name === person.name && c.company === companyName
              )
              
              if (isDuplicate) continue
              
              if (person.id) {
                peopleToEnrich.push({
                  id: person.id,
                  name: person.name || 'Unknown',
                  title: person.title || 'Unknown',
                  company: companyName,
                  location: personLocation,
                })
                companyContactCount[companyName] = (companyContactCount[companyName] || 0) + 1
              }
            }
          
          // Enrich people to get email/phone (batch of up to 10)
          for (let i = 0; i < peopleToEnrich.length; i += 10) {
            const batch = peopleToEnrich.slice(i, i + 10)
            
            for (const personData of batch) {
              try {
                const enrichResponse = await fetch('https://api.apollo.io/api/v1/people/match', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apolloApiKey,
                  },
                  body: JSON.stringify({ id: personData.id }),
                })
                
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
                  
                  // NOTE: Removed overly strict sector post-filtering to get more results
                  // The Apollo API already filters by keywords, so this was causing too many false negatives
                  
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
                        console.log(`Adding contact for ${comboIndustry}: ${fullName} at ${companyName} (${currentCount + 1}/${quota})`)
                      } else {
                        console.log(`Adding contact: ${fullName} at ${companyName} (industry: ${person.organization?.industry || 'unknown'})`)
                      }
                      
                      seenEmails.add(emailLower)
                      allContacts.push(newContact)
                    }
                  } else {
                    console.log('Skipping contact with missing data:', { name: fullName, email: !!email })
                  }
                } else {
                  // Skip contacts without email
                  console.log('Enrichment failed for', personData.name)
                }
                
                // Small delay between enrichment calls
                await new Promise(resolve => setTimeout(resolve, 100))
              } catch (enrichError) {
                console.error('Enrichment error for', personData.name, enrichError)
                // Skip contacts that fail enrichment
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

    // Save newly found contacts to used_contacts table
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        contactsFound: allContacts.length,
        contacts: allContacts, // Return actual contacts for immediate use
        status,
        bullhornExport: bullhornResult,
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

