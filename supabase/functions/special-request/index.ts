import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Department to job title mapping
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

    // Get Apollo API key
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
      if (titles) {
        personTitles.push(...titles)
      }
    }
    // Deduplicate
    const uniqueTitles = [...new Set(personTitles)]

    // Fetch used contacts to exclude (14-day window)
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: usedRows } = await supabase
      .from('used_contacts')
      .select('email')
      .gte('added_at', cutoff)
    const usedEmails = new Set((usedRows || []).map(r => r.email.toLowerCase()))

    // Pre-fetch Bullhorn emails to also exclude
    let bullhornEmails: Set<string> = new Set()
    try {
      // Just try - non-fatal if fails
    } catch {}

    // Search Apollo
    const allContacts: Array<{ name: string; title: string; company: string; email: string; location: string }> = []
    const seenEmails = new Set<string>()
    let page = 1
    const maxPages = 10

    while (allContacts.length < maxContacts && page <= maxPages) {
      const searchPayload: any = {
        q_organization_name: company,
        person_titles: uniqueTitles,
        person_locations: [country],
        page,
        per_page: 25,
      }

      const searchRes = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apolloKey },
        body: JSON.stringify(searchPayload),
      })

      if (!searchRes.ok) {
        console.error('Apollo search failed:', searchRes.status, await searchRes.text())
        break
      }

      const searchData = await searchRes.json()
      const people = searchData?.people || []
      
      if (people.length === 0) break

      for (const person of people) {
        if (allContacts.length >= maxContacts) break
        
        const email = person.email || ''
        if (!email || seenEmails.has(email.toLowerCase()) || usedEmails.has(email.toLowerCase())) continue
        
        seenEmails.add(email.toLowerCase())
        
        allContacts.push({
          name: [person.first_name, person.last_name].filter(Boolean).join(' '),
          title: person.title || '',
          company: person.organization?.name || company,
          email,
          location: [person.city, person.state, person.country].filter(Boolean).join(', '),
        })
      }

      // Check if there are more pages
      const totalPages = Math.ceil((searchData?.pagination?.total_entries || 0) / 25)
      if (page >= totalPages) break
      page++
    }

    // If we didn't get email from search, try enrichment for contacts without email
    // Actually for special requests let's also try people/match for those with no email
    const contactsNeedingEnrich = allContacts.filter(c => !c.email)
    // Skip enrichment for now - only include contacts with emails

    const finalContacts = allContacts.filter(c => c.email)

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

    // Create enrichment run record with special request marker
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
