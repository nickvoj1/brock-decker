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
    const { company, country, departments, maxContacts = 50, emailOnly = false, profileName, requestName } = await req.json()

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

    // Step 1: Search using api_search (free, no credits)
    // If strict country/location is too narrow, fallback to no location filter.
    const candidates: Array<{ id: string; firstName: string; lastName: string; name: string; title: string; company: string; email: string; location: string }> = []
    const seenIds = new Set<string>()
    console.log(`Searching Apollo for ${company} in ${country}, titles: ${uniqueTitles.length}, maxContacts: ${maxContacts}`)

    const locationPasses: Array<string | null> = [country, null]
    for (const locationFilter of locationPasses) {
      if (candidates.length >= maxContacts * 2) break

      let page = 1
      const maxPages = locationFilter ? 3 : 2
      console.log(`Apollo search pass: ${locationFilter ? `location=${locationFilter}` : "location=ANY (fallback)"}`)

      while (candidates.length < maxContacts * 3 && page <= maxPages) {
        const queryParams = new URLSearchParams()
        queryParams.set('q_organization_name', company)
        queryParams.set('per_page', '100')
        queryParams.set('page', String(page))
        for (const title of uniqueTitles) {
          queryParams.append('person_titles[]', title)
        }
        if (locationFilter) {
          queryParams.append('person_locations[]', locationFilter)
        }

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
        console.log(`Apollo page ${page} (${locationFilter || "ANY"}): ${people.length} people`)
        if (people.length === 0) break

        for (const person of people) {
          const personId = person.id
          if (!personId || seenIds.has(personId)) continue
          seenIds.add(personId)

          const firstName = person.first_name || ''
          const lastName = person.last_name || ''
          const name = [firstName, lastName].filter(Boolean).join(' ')
          const email = person.email || ''
          const location = [person.city, person.state, person.country].filter(Boolean).join(', ')

          if (email && !usedEmails.has(email.toLowerCase())) {
            candidates.push({
              id: personId, firstName, lastName, name,
              title: person.title || '',
              company: person.organization?.name || company,
              email, location,
            })
          } else if (!email && candidates.length < maxContacts * 3) {
            candidates.push({
              id: personId, firstName, lastName, name,
              title: person.title || '',
              company: person.organization?.name || company,
              email: '', location,
            })
          }
        }

        const totalPages = Math.ceil((searchData?.pagination?.total_entries || 0) / 100)
        if (page >= totalPages) break
        page++
      }
    }

    const withEmail = candidates.filter(c => c.email)
    const needEmail = candidates.filter(c => !c.email)

    console.log(`Search: ${candidates.length} total, ${withEmail.length} with email, ${needEmail.length} need enrichment`)

    // Step 2: Enrich using people/match (1 credit each), concurrent batches
    const enrichLimit = Math.max(0, maxContacts - withEmail.length)
    const enrichCap = emailOnly ? Math.min(maxContacts, 40) : 15
    const toEnrich = needEmail.slice(0, Math.min(enrichLimit, enrichCap))

    if (toEnrich.length > 0) {
      console.log(`Enriching ${toEnrich.length} people via people/match...`)
      
      const batchSize = 5
      for (let i = 0; i < toEnrich.length; i += batchSize) {
        if (withEmail.length >= maxContacts) break
        const batch = toEnrich.slice(i, i + batchSize)
        
        const results = await Promise.allSettled(
          batch.map(async (person) => {
            const matchRes = await fetch('https://api.apollo.io/api/v1/people/match', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': apolloKey },
              body: JSON.stringify({
                first_name: person.firstName,
                last_name: person.lastName,
                organization_name: person.company,
                reveal_personal_emails: false,
              }),
            })
            if (!matchRes.ok) return null
            const matchData = await matchRes.json()
            return { personId: person.id, email: matchData?.person?.email || null }
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value?.email) {
            const { personId, email } = result.value
            if (!usedEmails.has(email.toLowerCase())) {
              const person = toEnrich.find(p => p.id === personId)
              if (person) {
                person.email = email
                withEmail.push(person)
              }
            }
          }
        }
      }
    }

    console.log(`After enrichment: ${withEmail.length} contacts with email`)

    // For job-board Apollo flow, emailOnly ensures returned contacts are actionable.
    const allContacts = emailOnly ? withEmail : [...withEmail, ...needEmail.filter(c => !c.email)]
    const finalContacts = allContacts.slice(0, maxContacts).map(c => ({
      name: c.name,
      title: c.title,
      company: c.company,
      email: c.email || '',
      location: c.location,
    }))

    console.log(`Final contacts: ${finalContacts.length} (${finalContacts.filter(c => c.email).length} with email)`)

    // Save used contacts (only those with email)
    const contactsWithEmails = finalContacts.filter(c => c.email)
    if (contactsWithEmails.length > 0) {
      const upsertRows = contactsWithEmails.map(c => ({
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
      error_message: finalContacts.length === 0
        ? (emailOnly ? 'No contacts with email found matching criteria' : 'No contacts found matching criteria')
        : null,
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
