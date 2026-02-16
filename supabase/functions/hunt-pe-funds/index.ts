import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface ParsedSignal {
  date: string
  firm: string
  fund_name: string
  size: string
  region: string
  signal_type: string
  fits: boolean
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  url: string
  summary: string
  key_people: string
}

const REGION_QUERIES: Record<string, string> = {
  london: '"private equity" OR PE "fund close" OR "final close" OR "fundraising" London OR UK OR "United Kingdom"',
  europe: '"private equity" OR PE "fund close" OR "final close" OR "fundraising" Europe OR EU OR Germany OR France OR Spain OR Netherlands OR Nordics',
  uae: '"private equity" OR PE "fund close" OR "final close" OR "fundraising" UAE OR Dubai OR "Abu Dhabi" OR "Middle East" OR DIFC',
  usa: '"private equity" OR PE "fund close" OR "final close" OR "fundraising" US OR USA OR "New York" OR California OR Boston',
}

// Calculate date 10 days ago for search filtering
function getDateFilter(): string {
  const d = new Date()
  d.setDate(d.getDate() - 10)
  return d.toISOString().split('T')[0]
}

async function searchSerper(query: string, apiKey: string): Promise<any[]> {
  const dateFilter = getDateFilter()
  const fullQuery = `${query} after:${dateFilter}`

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: fullQuery,
      num: 20,
      gl: 'us',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('Serper error:', res.status, errText)
    throw new Error(`Serper search failed: ${res.status}`)
  }

  const data = await res.json()
  const results = [
    ...(data.organic || []),
    ...(data.news || []),
  ]

  return results.map((r: any) => ({
    title: r.title || '',
    snippet: r.snippet || r.description || '',
    link: r.link || '',
    date: r.date || '',
    source: r.source || new URL(r.link || 'https://unknown.com').hostname,
  }))
}

async function parseWithAI(results: any[], region: string, apiKey: string): Promise<ParsedSignal[]> {
  if (results.length === 0) return []

  const inputText = results
    .map((r, i) => `[${i + 1}] Title: ${r.title}\nSnippet: ${r.snippet}\nURL: ${r.link}\nDate: ${r.date}\nSource: ${r.source}`)
    .join('\n\n')

  const systemPrompt = `You are a PE fund intelligence analyst. Parse the following search results into structured data about Private Equity fund activity. 

ONLY extract results that are ACTUALLY about:
- Fund closes (final close, first close, hard cap)
- Fund raises / fundraising
- Major acquisitions or stake purchases
- Geographic expansions of PE firms
- Senior hires at PE/VC firms

For each valid result, extract:
- date: The date mentioned (format: YYYY-MM-DD, use today's month/year if only day given)
- firm: The PE/VC firm name (clean, no suffixes like "LLC")
- fund_name: The specific fund or transaction name
- size: The amount (e.g. "$1.4 billion", "€850 million", "N/A" if not mentioned)
- region: The geographic region from the news
- signal_type: One of: fund_close, first_close, hard_cap, fundraising, acquisition, expansion, hiring
- fits: true if fund size > $50M or is a strategic expansion/hire
- priority: HIGH if size > $500M or major strategic move, MEDIUM if $50-500M, LOW otherwise
- url: The source URL
- summary: One-sentence summary of the news
- key_people: Names and titles of key people mentioned (e.g. "Dr. Stephan Wessel (CEO), Paul Frigo (Media Contact)") or "N/A"

IMPORTANT: Skip results that are:
- Job postings or recruitment ads
- Generic industry commentary without specific firms
- Duplicates of the same news
- Results older than 10 days

Return a JSON array of objects. If no valid results found, return [].`

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Region context: ${region.toUpperCase()}\n\nSearch results:\n${inputText}` },
      ],
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('AI parse error:', response.status, errText)
    return []
  }

  const aiData = await response.json()
  const content = aiData.choices?.[0]?.message?.content || ''

  // Extract JSON from response
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ParsedSignal[]
    }
  } catch (e) {
    console.error('Failed to parse AI response:', e, content.slice(0, 500))
  }

  return []
}

function mapSignalType(type: string): string {
  const map: Record<string, string> = {
    fund_close: 'funding',
    first_close: 'funding',
    hard_cap: 'funding',
    fundraising: 'funding',
    acquisition: 'expansion',
    expansion: 'expansion',
    hiring: 'hiring',
  }
  return map[type] || 'funding'
}

function parseAmountToMillions(size: string): number | null {
  if (!size || size === 'N/A' || size === '-') return null
  const cleaned = size.replace(/[^0-9.,bmBM€$£]/g, '')
  const num = parseFloat(cleaned.replace(/,/g, ''))
  if (isNaN(num)) return null

  const lower = size.toLowerCase()
  if (lower.includes('billion') || lower.includes('bn') || lower.includes('b')) {
    return num * 1000
  }
  if (lower.includes('million') || lower.includes('mn') || lower.includes('m')) {
    return num
  }
  // If number > 100 assume millions
  return num > 100 ? num : num * 1000
}

function detectCurrency(size: string): string {
  if (size.includes('€')) return 'EUR'
  if (size.includes('£')) return 'GBP'
  return 'USD'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { regions } = await req.json()
    const targetRegions: string[] = regions || ['london', 'europe', 'uae', 'usa']

    const serperKey = Deno.env.get('SERPER_API_KEY')
    if (!serperKey) {
      return new Response(JSON.stringify({ error: 'SERPER_API_KEY not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const allParsed: ParsedSignal[] = []
    const regionResults: Record<string, { searched: number; parsed: number; inserted: number }> = {}

    for (const region of targetRegions) {
      const query = REGION_QUERIES[region]
      if (!query) {
        console.log(`Unknown region: ${region}, skipping`)
        continue
      }

      console.log(`Hunting PE funds in ${region}...`)

      try {
        const searchResults = await searchSerper(query, serperKey)
        console.log(`Serper returned ${searchResults.length} results for ${region}`)

        const parsed = await parseWithAI(searchResults, region, lovableKey)
        console.log(`AI parsed ${parsed.length} valid signals for ${region}`)

        // Filter: fits=true, size > 50M or strategic, < 10 days old
        const filtered = parsed.filter(p => p.fits)

        // Deduplicate against existing signals by title+company
        const existingTitles = new Set<string>()
        const { data: existing } = await supabase
          .from('signals')
          .select('title, company')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

        if (existing) {
          for (const e of existing) {
            existingTitles.add(`${e.company?.toLowerCase()}::${e.title?.toLowerCase()?.slice(0, 50)}`)
          }
        }

        const newSignals = filtered.filter(p => {
          const key = `${p.firm.toLowerCase()}::${p.summary.toLowerCase().slice(0, 50)}`
          return !existingTitles.has(key)
        })

        // Insert into signals table
        let inserted = 0
        for (const signal of newSignals) {
          const amountM = parseAmountToMillions(signal.size)
          const currency = detectCurrency(signal.size)

          const row = {
            title: signal.summary,
            company: signal.firm,
            region: region,
            tier: signal.priority === 'HIGH' ? 'tier_1' : signal.priority === 'MEDIUM' ? 'tier_2' : 'tier_3',
            score: signal.priority === 'HIGH' ? 90 : signal.priority === 'MEDIUM' ? 70 : 50,
            amount: amountM,
            currency,
            signal_type: mapSignalType(signal.signal_type),
            description: `${signal.fund_name}${signal.key_people && signal.key_people !== 'N/A' ? ` • Key People: ${signal.key_people}` : ''}`,
            url: signal.url,
            source: signal.url ? new URL(signal.url).hostname.replace('www.', '') : 'Google Search',
            published_at: signal.date ? new Date(signal.date).toISOString() : new Date().toISOString(),
            is_high_intent: signal.priority === 'HIGH',
            detected_region: region,
            validated_region: region.toUpperCase(),
            raw_content: JSON.stringify(signal),
          }

          const { error: insertErr } = await supabase.from('signals').insert(row)
          if (insertErr) {
            console.error(`Failed to insert signal for ${signal.firm}:`, insertErr.message)
          } else {
            inserted++
          }
        }

        regionResults[region] = {
          searched: searchResults.length,
          parsed: filtered.length,
          inserted,
        }

        allParsed.push(...newSignals)
      } catch (regionErr) {
        console.error(`Error hunting ${region}:`, regionErr)
        regionResults[region] = { searched: 0, parsed: 0, inserted: 0 }
      }
    }

    const totalInserted = Object.values(regionResults).reduce((s, r) => s + r.inserted, 0)

    return new Response(JSON.stringify({
      success: true,
      totalInserted,
      totalParsed: allParsed.length,
      regionResults,
      signals: allParsed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Hunt PE funds error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
