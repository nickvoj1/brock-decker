import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Candidate {
  candidate_id: string
  name: string
  position: string
  location: string
  company?: string
  [key: string]: string | undefined
}

interface Preference {
  industry: string
  companies: string
  exclusions: string
  [key: string]: string
}

interface ApolloSearchPayload {
  person_titles?: string[]
  person_locations?: string[]
  organization_names?: string[]
  q_organization_name?: string
  page?: number
  per_page?: number
}

interface ApolloResult {
  name: string
  title: string
  organization_name: string
  email: string
  phone: string
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

    const candidates = run.candidates_data as Candidate[]
    const preferences = run.preferences_data as Preference[]
    const enrichedCandidates: (Candidate & { keywords: string; email: string; phone: string })[] = []
    let processedCount = 0

    // Process candidates in batches of 10
    const batchSize = 10
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize)
      
      for (let j = 0; j < batch.length; j++) {
        const candidate = batch[j]
        const prefIndex = (i + j) % preferences.length
        const pref = preferences[prefIndex]

        try {
          // Build Apollo search payload
          const searchPayload: ApolloSearchPayload = {
            person_titles: [candidate.position, pref.industry].filter(Boolean),
            person_locations: candidate.location ? [candidate.location] : undefined,
            q_organization_name: pref.companies || candidate.company || undefined,
            page: 1,
            per_page: 1,
          }

          // Call Apollo API
          const apolloResponse = await fetch('https://api.apollo.io/v1/mixed_people/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': apolloApiKey,
            },
            body: JSON.stringify(searchPayload),
          })

          let apolloResult: ApolloResult | null = null

          if (apolloResponse.ok) {
            const apolloData = await apolloResponse.json()
            const people = apolloData.people || []
            
            // Find best match by name similarity
            apolloResult = people.find((p: any) => 
              p.name?.toLowerCase().includes(candidate.name.split(' ')[0]?.toLowerCase())
            ) || people[0] || null
          }

          if (apolloResult) {
            enrichedCandidates.push({
              ...candidate,
              keywords: `${apolloResult.title} (${apolloResult.organization_name})`,
              email: apolloResult.email || '',
              phone: apolloResult.phone || '',
            })
          } else {
            enrichedCandidates.push({
              ...candidate,
              keywords: 'No match found',
              email: '',
              phone: '',
            })
          }

          processedCount++
        } catch (error) {
          console.error(`Error processing candidate ${candidate.candidate_id}:`, error)
          enrichedCandidates.push({
            ...candidate,
            keywords: 'Error during enrichment',
            email: '',
            phone: '',
          })
          processedCount++
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Update progress periodically
      await supabase
        .from('enrichment_runs')
        .update({ processed_count: processedCount })
        .eq('id', runId)
    }

    // Handle Bullhorn integration if enabled
    const bullhornErrors: string[] = []
    
    if (run.bullhorn_enabled) {
      const { data: bhSettings } = await supabase
        .from('api_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['bullhorn_client_id', 'bullhorn_client_secret', 'bullhorn_username', 'bullhorn_password'])

      const bhConfig = Object.fromEntries(
        (bhSettings || []).map(s => [s.setting_key, s.setting_value])
      )

      if (bhConfig.bullhorn_client_id && bhConfig.bullhorn_client_secret) {
        try {
          // Bullhorn OAuth flow
          const authUrl = `https://auth.bullhornstaffing.com/oauth/authorize?client_id=${bhConfig.bullhorn_client_id}&response_type=code&username=${bhConfig.bullhorn_username}&password=${bhConfig.bullhorn_password}&action=Login`
          
          // Note: In a real implementation, you'd complete the full OAuth flow
          // For now, we'll mark this as a placeholder for Bullhorn integration
          bullhornErrors.push('Bullhorn integration requires manual OAuth setup - please contact support')
          
        } catch (error: any) {
          bullhornErrors.push(`Bullhorn auth error: ${error.message}`)
        }
      } else {
        bullhornErrors.push('Bullhorn credentials not configured')
      }
    }

    // Determine final status
    const hasErrors = enrichedCandidates.some(c => c.keywords === 'Error during enrichment')
    const noMatches = enrichedCandidates.filter(c => c.keywords === 'No match found').length
    const status = hasErrors || bullhornErrors.length > 0 
      ? 'partial' 
      : noMatches === enrichedCandidates.length 
        ? 'failed' 
        : 'success'

    // Update run with results
    await supabase
      .from('enrichment_runs')
      .update({
        status,
        processed_count: processedCount,
        enriched_data: enrichedCandidates,
        bullhorn_errors: bullhornErrors,
        error_message: hasErrors ? 'Some candidates failed to enrich' : null,
      })
      .eq('id', runId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        processedCount,
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
