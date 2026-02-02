import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SkillPattern {
  pattern_type: 'company' | 'title' | 'location'
  pattern_value: string
  skills: string[]
  frequency: number
  confidence: number
}

interface BullhornContact {
  id: number
  occupation?: string
  desiredSkills?: string
  customText1?: string
  categorySkills?: string
  address?: {
    city?: string
    countryID?: number
  }
  clientCorporation?: {
    id?: number
    name?: string
  }
}

// Helper: sleep for rate limiting
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Parse skills string into array (handles semicolon and comma separators)
function parseSkillsString(skillsStr: string | null | undefined): string[] {
  if (!skillsStr) return []
  // Split by semicolon or comma, clean up whitespace
  return skillsStr
    .split(/[;,]/)
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length > 0 && s.length < 50) // Filter out empty or too-long values
}

// Normalize pattern value for consistent matching
function normalizePatternValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s&.-]/g, '') // Remove special chars except common ones
    .replace(/\s+/g, ' ') // Normalize whitespace
}

// Extract patterns from a contact
function extractPatterns(contact: BullhornContact): SkillPattern[] {
  const patterns: SkillPattern[] = []
  
  // Collect all skills from the contact
  const allSkills: string[] = [
    ...parseSkillsString(contact.desiredSkills),
    ...parseSkillsString(contact.customText1),
    ...parseSkillsString(contact.categorySkills),
  ]
  
  // Dedupe skills
  const uniqueSkills = [...new Set(allSkills)]
  
  if (uniqueSkills.length === 0) return patterns
  
  // Company pattern
  if (contact.clientCorporation?.name) {
    const companyName = normalizePatternValue(contact.clientCorporation.name)
    if (companyName.length >= 2) {
      patterns.push({
        pattern_type: 'company',
        pattern_value: companyName,
        skills: uniqueSkills,
        frequency: 1,
        confidence: 0,
      })
    }
  }
  
  // Title pattern (occupation)
  if (contact.occupation) {
    const title = normalizePatternValue(contact.occupation)
    if (title.length >= 2) {
      patterns.push({
        pattern_type: 'title',
        pattern_value: title,
        skills: uniqueSkills,
        frequency: 1,
        confidence: 0,
      })
    }
  }
  
  // Location pattern (city)
  if (contact.address?.city) {
    const city = normalizePatternValue(contact.address.city)
    if (city.length >= 2) {
      patterns.push({
        pattern_type: 'location',
        pattern_value: city,
        skills: uniqueSkills,
        frequency: 1,
        confidence: 0,
      })
    }
  }
  
  return patterns
}

// Merge skills from multiple patterns with same key
function mergePatterns(patterns: SkillPattern[]): Map<string, SkillPattern> {
  const merged = new Map<string, SkillPattern>()
  
  for (const pattern of patterns) {
    const key = `${pattern.pattern_type}:${pattern.pattern_value}`
    
    if (merged.has(key)) {
      const existing = merged.get(key)!
      // Merge skills and increment frequency
      const mergedSkills = [...new Set([...existing.skills, ...pattern.skills])]
      existing.skills = mergedSkills
      existing.frequency++
    } else {
      merged.set(key, { ...pattern })
    }
  }
  
  // Calculate confidence scores (frequency / 20, capped at 1.0)
  for (const pattern of merged.values()) {
    pattern.confidence = Math.min(1.0, pattern.frequency / 20)
  }
  
  return merged
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { maxContacts = 1000 } = await req.json().catch(() => ({}))

    console.log(`[AnalyzeSkills] Starting analysis, max contacts: ${maxContacts}`)

    // Get Bullhorn tokens
    const { data: token, error: tokenError } = await supabase
      .from('bullhorn_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (tokenError || !token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bullhorn not connected. Please connect first.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const restUrl = token.rest_url
    const bhRestToken = token.bh_rest_token

    // Query Bullhorn contacts in batches
    const batchSize = 100
    const allPatterns: SkillPattern[] = []
    let start = 0
    let totalFetched = 0

    console.log(`[AnalyzeSkills] Fetching contacts from Bullhorn...`)

    while (totalFetched < maxContacts) {
      const count = Math.min(batchSize, maxContacts - totalFetched)
      const searchUrl = `${restUrl}search/ClientContact?fields=id,occupation,desiredSkills,customText1,categorySkills,address(city,countryID),clientCorporation(id,name)&count=${count}&start=${start}&BhRestToken=${bhRestToken}`
      
      console.log(`[AnalyzeSkills] Fetching batch starting at ${start}...`)
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        console.error(`[AnalyzeSkills] Bullhorn API error: ${response.status}`)
        break
      }

      const data = await response.json()
      const contacts = data.data as BullhornContact[] || []

      if (contacts.length === 0) {
        console.log(`[AnalyzeSkills] No more contacts to fetch`)
        break
      }

      // Extract patterns from each contact
      for (const contact of contacts) {
        const patterns = extractPatterns(contact)
        allPatterns.push(...patterns)
      }

      totalFetched += contacts.length
      start += batchSize

      console.log(`[AnalyzeSkills] Fetched ${totalFetched} contacts, extracted ${allPatterns.length} patterns`)

      // Rate limit: 200ms between batches
      if (totalFetched < maxContacts) {
        await sleep(200)
      }
    }

    console.log(`[AnalyzeSkills] Total contacts analyzed: ${totalFetched}`)
    console.log(`[AnalyzeSkills] Total raw patterns: ${allPatterns.length}`)

    // Merge patterns with same key
    const mergedPatterns = mergePatterns(allPatterns)
    console.log(`[AnalyzeSkills] Unique patterns after merge: ${mergedPatterns.size}`)

    // Filter patterns: minimum frequency of 3 to reduce noise
    const MIN_FREQUENCY = 3
    const significantPatterns = Array.from(mergedPatterns.values())
      .filter(p => p.frequency >= MIN_FREQUENCY)
      .filter(p => p.skills.length > 0)

    console.log(`[AnalyzeSkills] Significant patterns (freq >= ${MIN_FREQUENCY}): ${significantPatterns.length}`)

    // Clear existing patterns and insert new ones
    const { error: deleteError } = await supabase
      .from('skill_patterns')
      .delete()
      .gte('created_at', '1970-01-01') // Delete all

    if (deleteError) {
      console.error(`[AnalyzeSkills] Error clearing patterns:`, deleteError)
    }

    // Insert in batches
    const insertBatchSize = 50
    let insertedCount = 0

    for (let i = 0; i < significantPatterns.length; i += insertBatchSize) {
      const batch = significantPatterns.slice(i, i + insertBatchSize).map(p => ({
        pattern_type: p.pattern_type,
        pattern_value: p.pattern_value,
        skills: p.skills,
        frequency: p.frequency,
        confidence: p.confidence,
        last_analyzed_at: new Date().toISOString(),
      }))

      const { error: insertError } = await supabase
        .from('skill_patterns')
        .insert(batch)

      if (insertError) {
        console.error(`[AnalyzeSkills] Error inserting batch:`, insertError)
      } else {
        insertedCount += batch.length
      }
    }

    console.log(`[AnalyzeSkills] Inserted ${insertedCount} patterns`)

    // Get summary statistics
    const companyCounts = significantPatterns.filter(p => p.pattern_type === 'company').length
    const titleCounts = significantPatterns.filter(p => p.pattern_type === 'title').length
    const locationCounts = significantPatterns.filter(p => p.pattern_type === 'location').length

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          contactsAnalyzed: totalFetched,
          patternsFound: significantPatterns.length,
          companyPatterns: companyCounts,
          titlePatterns: titleCounts,
          locationPatterns: locationCounts,
          topPatterns: significantPatterns
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10)
            .map(p => ({
              type: p.pattern_type,
              value: p.pattern_value,
              skillCount: p.skills.length,
              frequency: p.frequency,
              confidence: p.confidence,
            })),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[AnalyzeSkills] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
