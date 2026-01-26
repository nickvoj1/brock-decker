import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
}

interface ApolloContact {
  name: string
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
    const maxContacts = run.search_counter || 50 // Use search_counter as max contacts
    const maxPerCompany = 3

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

    // Search for hiring contacts based on industries
    const allContacts: ApolloContact[] = []
    const companyContactCount: Record<string, number> = {}
    let processedCount = 0

    // Get target roles from preferences (all prefs share the same roles)
    // Fall back to default HR/Recruiting roles if not specified
    const defaultRoles = [
      'Recruiter', 'Talent Acquisition', 'HR Manager', 'Human Resources',
      'Hiring Manager', 'Head of Talent', 'People Operations', 'HR Director',
      'Talent Partner', 'HR Business Partner'
    ]
    const targetRoles = preferences[0]?.targetRoles?.length ? preferences[0].targetRoles : defaultRoles

    // Get locations from preferences (all prefs share the same locations)
    const searchLocations = preferences[0]?.locations || []
    
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
      'amsterdam': 'Amsterdam, Netherlands',
      'zurich': 'Zurich, Switzerland',
      'dublin': 'Dublin, Ireland',
      'madrid': 'Madrid, Spain',
      'milan': 'Milan, Italy',
      'singapore': 'Singapore',
      'hong-kong': 'Hong Kong',
      'tokyo': 'Tokyo, Japan',
      'sydney': 'Sydney, Australia',
      'melbourne': 'Melbourne, Australia',
      'dubai': 'Dubai, UAE',
      'toronto': 'Toronto, Canada',
      'vancouver': 'Vancouver, Canada',
      'montreal': 'Montreal, Canada',
    }
    
    const apolloLocations = searchLocations.map(loc => locationLabels[loc] || loc)

    // Search across each selected industry
    for (const pref of preferences) {
      if (allContacts.length >= maxContacts) break

      const remainingNeeded = maxContacts - allContacts.length
      const perPage = Math.min(remainingNeeded * 2, 100) // Get extra to account for filtering

      try {
        // Build query params for new API search endpoint
        const queryParams = new URLSearchParams()
        
        // Add target roles
        targetRoles.forEach(title => queryParams.append('person_titles[]', title))
        
        // Add locations
        if (apolloLocations.length > 0) {
          apolloLocations.forEach(loc => queryParams.append('person_locations[]', loc))
        }
        
        queryParams.append('per_page', String(perPage))
        queryParams.append('page', '1')

        // Use the new api_search endpoint (note: /api/v1/ not /v1/)
        const searchUrl = `https://api.apollo.io/api/v1/mixed_people/api_search?${queryParams.toString()}`
        
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
          
          // Collect person IDs to enrich (get emails)
          const peopleToEnrich: Array<{id: string, name: string, company: string, location: string}> = []
          
          for (const person of people) {
            if (peopleToEnrich.length >= remainingNeeded) break
            
            const companyName = person.organization?.name || person.organization_name || 'Unknown'
            const personLocation = person.city || person.state || person.country || 'Unknown'
            
            // Skip contacts from candidate's previous employers
            const normalizedCompany = companyName.toLowerCase().trim()
            const isExcludedCompany = Array.from(excludedCompanies).some(excluded => 
              normalizedCompany.includes(excluded) || excluded.includes(normalizedCompany)
            )
            if (isExcludedCompany) {
              console.log(`Skipping contact from excluded company: ${companyName}`)
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
                  
                  // Only add if we got an email and a valid name
                  if (email && fullName && fullName !== 'Unknown') {
                    allContacts.push({
                      name: fullName,
                      location: fullLocation,
                      email: email,
                      company: companyName,
                    })
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
        }

        processedCount++
        
        // Update progress
        await supabase
          .from('enrichment_runs')
          .update({ processed_count: processedCount })
          .eq('id', runId)

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error) {
        console.error(`Error searching for industry ${pref.industry}:`, error)
        processedCount++
      }
    }

    // Generate CSV content
    const csvHeader = 'Name,Location,Email,Company'
    const csvRows = allContacts.map(c => 
      `"${escapeCSV(c.name)}","${escapeCSV(c.location)}","${escapeCSV(c.email)}","${escapeCSV(c.company)}"`
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        contactsFound: allContacts.length,
        status 
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
