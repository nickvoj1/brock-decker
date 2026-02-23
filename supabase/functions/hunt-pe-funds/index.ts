import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'
import { evaluateSignalQuality } from '../_shared/signal-quality.ts'

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

function normalizeUrlForDedup(url?: string | null): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    const path = parsed.pathname.replace(/\/+$/, '')
    return `${host}${path}`.toLowerCase()
  } catch {
    return String(url).trim().toLowerCase()
  }
}

function normalizeTextForDedup(text?: string | null): string {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleFingerprint(text?: string | null): string {
  return normalizeTextForDedup(text).split(' ').slice(0, 14).join(' ')
}

function parseKeyPeople(raw?: string | null): string[] {
  if (!raw) return []
  if (raw.trim().toLowerCase() === 'n/a') return []
  return raw
    .split(/[,;]| and /i)
    .map((v) => v.replace(/\([^)]*\)/g, '').trim())
    .filter(Boolean)
    .slice(0, 5)
}

function resolveSourceHost(url?: string | null): string {
  if (!url) return 'Google Search'
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Google Search'
  }
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

    const dedupeCutoffIso = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentSignals } = await supabase
      .from('signals')
      .select('url, title, company, region, signal_type, source, details, published_at')
      .gte('published_at', dedupeCutoffIso)
      .limit(5000)

    const seenUrlKeys = new Set<string>()
    const seenTitleKeys = new Set<string>()
    const seenCompanyTypeKeys = new Set<string>()
    const seenDedupeKeys = new Set<string>()

    for (const existing of recentSignals || []) {
      const urlKey = normalizeUrlForDedup(existing.url)
      if (urlKey) seenUrlKeys.add(urlKey)

      const titleKey = titleFingerprint(existing.title)
      if (titleKey) seenTitleKeys.add(titleKey)

      const companyTypeKey = [
        normalizeTextForDedup(existing.company),
        normalizeTextForDedup(existing.region),
        normalizeTextForDedup(existing.signal_type),
        normalizeTextForDedup((existing as any).source),
        normalizeTextForDedup(Array.isArray((existing as any)?.details?.key_people) ? (existing as any).details.key_people.join('|') : ''),
        normalizeTextForDedup((existing as any)?.details?.deal_signature || ''),
        titleKey,
      ].join('|')
      if (companyTypeKey.replace(/\|/g, '').length > 0) seenCompanyTypeKeys.add(companyTypeKey)

      const existingDedupeKey = String((existing as any)?.details?.dedupe_key || '').trim().toLowerCase()
      if (existingDedupeKey) seenDedupeKeys.add(existingDedupeKey)
    }

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

        // Insert into signals table
        let inserted = 0
        let qualityAccepted = 0
        const acceptedForOutput: ParsedSignal[] = []
        for (const signal of filtered) {
          const source = resolveSourceHost(signal.url)
          const description = `${signal.fund_name}${signal.key_people && signal.key_people !== 'N/A' ? ` • Key People: ${signal.key_people}` : ''}`
          const fallbackAmount = parseAmountToMillions(signal.size)
          const fallbackCurrency = detectCurrency(signal.size)
          const normalizedSignalType = mapSignalType(signal.signal_type)
          const quality = evaluateSignalQuality({
            title: signal.summary,
            description,
            rawContent: `${signal.summary} ${signal.fund_name} ${signal.size} ${signal.key_people || ''}`,
            company: signal.firm,
            source,
            url: signal.url,
            expectedRegion: region,
            signalType: normalizedSignalType,
            keyPeople: parseKeyPeople(signal.key_people),
          })
          if (!quality.accepted) {
            console.log(`Skipping by quality pipeline (${quality.reason || 'unknown'}): ${signal.summary.slice(0, 60)}...`)
            continue
          }
          qualityAccepted++
          acceptedForOutput.push(signal)

          const resolvedAmount = quality.amount ?? fallbackAmount
          const resolvedCurrency = quality.currency ?? fallbackCurrency ?? null
          const dealSignature = quality.dealSignature
          const dedupeKey = quality.dedupeKey.toLowerCase()
          const sourceKey = normalizeTextForDedup(source)
          const urlKey = normalizeUrlForDedup(signal.url)
          const title = signal.summary.slice(0, 255)
          const titleKey = titleFingerprint(title)
          const companyTypeKey = [
            normalizeTextForDedup(quality.company),
            normalizeTextForDedup(region),
            normalizeTextForDedup(quality.signalType),
            sourceKey,
            normalizeTextForDedup(quality.keyPeople.join('|')),
            normalizeTextForDedup(dealSignature),
            titleKey,
          ].join('|')

          if (
            (urlKey && seenUrlKeys.has(urlKey)) ||
            seenTitleKeys.has(titleKey) ||
            seenCompanyTypeKeys.has(companyTypeKey) ||
            seenDedupeKeys.has(dedupeKey)
          ) {
            continue
          }

          let publishedAt = new Date().toISOString()
          if (signal.date) {
            const parsedDate = new Date(signal.date)
            if (!Number.isNaN(parsedDate.getTime())) {
              publishedAt = parsedDate.toISOString()
            }
          }

          const row = {
            title,
            company: quality.company,
            region: region,
            tier: quality.mustHave ? 'tier_1' : signal.priority === 'HIGH' ? 'tier_1' : signal.priority === 'MEDIUM' ? 'tier_2' : 'tier_3',
            score: signal.priority === 'HIGH' ? 90 : signal.priority === 'MEDIUM' ? 70 : 50,
            amount: resolvedAmount,
            currency: resolvedCurrency,
            signal_type: quality.signalType,
            description,
            url: signal.url,
            source,
            published_at: publishedAt,
            is_high_intent: quality.mustHave || signal.priority === 'HIGH',
            detected_region: quality.detectedRegion || region,
            validated_region: region.toUpperCase(),
            raw_content: JSON.stringify(signal),
            details: {
              key_people: quality.keyPeople,
              deal_signature: dealSignature,
              source_key: sourceKey,
              dedupe_key: dedupeKey,
              strict_deal_region: quality.detectedRegion || quality.expectedRegion,
              must_have: quality.mustHave,
            },
          }

          const { error: insertErr } = await supabase.from('signals').insert(row)
          if (insertErr) {
            console.error(`Failed to insert signal for ${signal.firm}:`, insertErr.message)
          } else {
            inserted++
            if (urlKey) seenUrlKeys.add(urlKey)
            seenTitleKeys.add(titleKey)
            seenCompanyTypeKeys.add(companyTypeKey)
            seenDedupeKeys.add(dedupeKey)
          }
        }

        regionResults[region] = {
          searched: searchResults.length,
          parsed: qualityAccepted,
          inserted,
        }

        allParsed.push(...acceptedForOutput)
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
    return new Response(JSON.stringify({ error: (err as Error).message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
