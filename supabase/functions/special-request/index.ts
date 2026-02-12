import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEPARTMENT_TITLES: Record<string, string[]> = {
  'HR / Talent Acquisition': [
    'Recruiter', 'Talent Acquisition', 'HR Manager', 'HR Director',
    'Human Resources', 'People Operations', 'Head of Talent',
    'HR Business Partner', 'Talent Partner', 'Hiring Manager',
  ],
  'Leadership / C-Suite': [
    'CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CIO', 'CHRO',
    'Managing Director', 'President', 'Vice President',
    'General Manager', 'Partner', 'Founder', 'Co-Founder',
  ],
  'Finance': [
    'Finance Director', 'CFO', 'Financial Controller', 'Head of Finance',
    'Finance Manager', 'Treasurer', 'VP Finance', 'Chief Financial Officer',
    'Fund Manager', 'Portfolio Manager', 'Investment Director',
  ],
  'Legal': [
    'General Counsel', 'Head of Legal', 'Legal Director', 'Legal Counsel',
    'Attorney', 'Lawyer', 'Corporate Counsel', 'VP Legal',
    'Chief Legal Officer', 'Compliance Officer',
  ],
  'Engineering / IT': [
    'Engineering Manager', 'VP Engineering', 'CTO', 'IT Director',
    'Head of Engineering', 'Software Director', 'Tech Lead',
    'Chief Technology Officer', 'IT Manager', 'Director of Engineering',
  ],
  'Sales / Business Development': [
    'Sales Director', 'VP Sales', 'Head of Sales', 'Business Development',
    'Account Executive', 'Sales Manager', 'Chief Revenue Officer',
    'Commercial Director', 'BD Manager', 'Partnership Manager',
  ],
  'Marketing': [
    'CMO', 'Marketing Director', 'VP Marketing', 'Head of Marketing',
    'Brand Manager', 'Growth Manager', 'Digital Marketing Director',
    'Communications Director', 'PR Director',
  ],
  'Operations': [
    'COO', 'Operations Director', 'VP Operations', 'Head of Operations',
    'Operations Manager', 'Chief Operating Officer', 'Supply Chain Director',
    'Logistics Manager', 'Procurement Director',
  ],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { company, country, departments, maxContacts = 50, profileName, requestName } = await req.json()

    if (!company || !country || !departments || departments.length === 0) {
      return new Response(JSON.stringify({ error: 'Company, country, and at least one department are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: apiSetting } = await supabase
      .from('api_settings')
      .select('setting_value')
      .eq('setting_key', 'apollo_api_key')
      .single()

    if (!apiSetting?.setting_value) {
      return new Response(JSON.stringify({ error: 'Apollo API key not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apolloKey = apiSetting.setting_value

    // Build person_titles from selected departments
    const personTitles: string[] = []
    for (const dept of departments) {
      const titles = DEPARTMENT_TITLES[dept]
      if (titles) personTitles.push(...titles)
    }
    const uniqueTitles = [...new Set(personTitles)]

    // Fetch used contacts to exclude (14-day window)
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: usedRows } = await supabase
      .from('used_contacts')
      .select('email')
      .gte('added_at', cutoff)
    const usedEmails = new Set((usedRows || []).map(r => r.email.toLowerCase()))

    // Step 1: Search for people using api_search (free, no credits)
    const foundPeople: Array<{ id: string; name: string; title: string; company: string; email: string; location: string }> = []
    const seenIds = new Set<string>()
    let page = 1
    const maxPages = 10

    console.log(`Searching Apollo for ${company} in ${country}, titles: ${uniqueTitles.length}`)

    while (foundPeople.length < maxContacts * 2 && page <= maxPages) {
      const queryParams = new URLSearchParams()
      queryParams.set('q_organization_name', company)
      queryParams.set('per_page', '100')
      queryParams.set('page', String(page))
      
      // Add person_titles as repeated params
      for (const title of uniqueTitles) {
        queryParams.append('person_titles[]', title)
      }
      // Add location
      queryParams.append('person_locations[]', country)

      const searchUrl = `https://api.apollo.io/api/v1/mixed_people/api_search?${queryParams.toString()}`

      const searchRes = await fetch(searchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apolloKey },
      })

      if (!searchRes.ok) {
        const errText = await searchRes.text()
        console.error('Apollo api_search failed:', searchRes.status, errText)
        break
      }

      const searchData = await searchRes.json()
      const people = searchData?.people || []
      
      console.log(`Apollo page ${page}: ${people.length} people returned`)
      
      if (people.length === 0) break

      for (const person of people) {
        const personId = person.id
        if (!personId || seenIds.has(personId)) continue
        seenIds.add(personId)
        
        const email = person.email || ''
        const name = [person.first_name, person.last_name].filter(Boolean).join(' ')
        const location = [person.city, person.state, person.country].filter(Boolean).join(', ')
        
        // If email present from search (direct hit), use it
        if (email && !usedEmails.has(email.toLowerCase())) {
          foundPeople.push({
            id: personId,
            name,
            title: person.title || '',
            company: person.organization?.name || company,
            email,
            location,
          })
        } else if (!email) {
          // Store for enrichment
          foundPeople.push({
            id: personId,
            name,
            title: person.title || '',
            company: person.organization?.name || company,
            email: '', // needs enrichment
            location,
          })
        }
      }

      const totalPages = Math.ceil((searchData?.pagination?.total_entries || 0) / 100)
      if (page >= totalPages) break
      page++
    }

    console.log(`Found ${foundPeople.length} people from api_search (${foundPeople.filter(p => p.email).length} with email already), enriching...`)

    // Step 2: Reveal emails using bulk_reveal (1 credit per reveal)
    const contactsWithEmail = foundPeople.filter(p => p.email)
    const contactsNeedEmail = foundPeople.filter(p => !p.email)
    
    // Only reveal up to maxContacts minus already-found
    const revealLimit = Math.min(contactsNeedEmail.length, maxContacts - contactsWithEmail.length)
    const toReveal = contactsNeedEmail.slice(0, revealLimit)
    
    if (toReveal.length > 0) {
      // Batch reveal in groups of 10
      const batchSize = 10
      for (let i = 0; i < toReveal.length; i += batchSize) {
        const batch = toReveal.slice(i, i + batchSize)
        try {
          const revealRes = await fetch('https://api.apollo.io/api/v1/people/bulk_reveal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': apolloKey },
            body: JSON.stringify({
              ids: batch.map(p => p.id),
            }),
          })
          
          if (revealRes.ok) {
            const revealData = await revealRes.json()
            const matches = revealData?.matches || []
            console.log(`Bulk reveal batch: ${matches.length} matches from ${batch.length} requested`)
            
            for (const match of matches) {
              const email = match?.email || match?.revealed_email
              const personId = match?.id
              if (email && personId) {
                const person = batch.find(p => p.id === personId)
                if (person && !usedEmails.has(email.toLowerCase())) {
                  person.email = email
                  contactsWithEmail.push(person)
                }
              }
            }
          } else {
            const errText = await revealRes.text()
            console.error('Bulk reveal failed:', revealRes.status, errText)
            
            // Fallback: try people/match one by one
            for (const person of batch) {
              try {
                const nameParts = person.name.split(' ')
                const matchRes = await fetch('https://api.apollo.io/api/v1/people/match', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-api-key': apolloKey },
                  body: JSON.stringify({
                    first_name: nameParts[0] || '',
                    last_name: nameParts.slice(1).join(' ') || '',
                    organization_name: person.company,
                    reveal_personal_emails: false,
                  }),
                })
                if (matchRes.ok) {
                  const matchData = await matchRes.json()
                  const email = matchData?.person?.email
                  if (email && !usedEmails.has(email.toLowerCase())) {
                    person.email = email
                    contactsWithEmail.push(person)
                  }
                }
              } catch (e) {
                console.error('Match error for', person.name, e)
              }
              if (contactsWithEmail.length >= maxContacts) break
            }
          }
        } catch (e) {
          console.error('Bulk reveal error:', e)
        }
        
        if (contactsWithEmail.length >= maxContacts) break
      }
    }

    const finalContacts = contactsWithEmail.slice(0, maxContacts).map(c => ({
      name: c.name,
      title: c.title,
      company: c.company,
      email: c.email,
      location: c.location,
    }))

    console.log(`Final contacts: ${finalContacts.length}`)

    // Save used contacts
    if (finalContacts.length > 0) {
      const upsertRows = finalContacts.map(c => ({
        email: c.email.toLowerCase(),
        name: c.name,
        company: c.company,
        added_at: new Date().toISOString(),
      }))
      await supabase.from('used_contacts').upsert(upsertRows, { onConflict: 'email' })
    }

    // Create enrichment run record
    const runData = {
      uploaded_by: profileName || 'Unknown',
      search_counter: maxContacts,
      candidates_count: 1,
      preferences_count: departments.length,
      processed_count: finalContacts.length,
      status: finalContacts.length > 0 ? 'success' : 'failed',
      candidates_data: [{
        candidate_id: `SR-${Date.now()}`,
        name: requestName || `${company} - ${country}`,
        current_title: 'Special Request',
        location: country,
        skills: [],
        work_history: [],
        education: [],
      }],
      preferences_data: [{
        company,
        country,
        departments,
        type: 'special_request',
      }],
      enriched_data: finalContacts,
      error_message: finalContacts.length === 0 ? 'No contacts found matching criteria' : null,
    }

    const { data: run, error: runError } = await supabase
      .from('enrichment_runs')
      .insert(runData)
      .select()
      .single()

    if (runError) {
      console.error('Failed to save run:', runError)
    }

    return new Response(JSON.stringify({
      success: true,
      contacts: finalContacts,
      total: finalContacts.length,
      runId: run?.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Special request error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
