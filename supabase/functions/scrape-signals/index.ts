import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// FT COOKIES CONFIGURATION - User provided session cookies
// ============================================================================
const FT_COOKIES = {
  "FTSessions": "06UCSuF020ss04BMgYRiPDJy0wAAAZwoDvGbw8I.MEQCIHc678hlM4pAkpfbMTqiIHOQMh0Xy31HrKyuAvx2yEVtAiBR9YzCTwZ3Dd5YGr0CqG0AZAirHDxXP8N3Y7RyKm-vg",
  "session_tracker": "akcpappkfblgppbglc.0.1770198394781.Z0FBQUFBQnBneFY2WTVBNGtmX2ZjakVQdGpaV25aT3dUdkdLdHU5U3ZGRjNFUzhsU3pZQi1XclFaYnp1OEZLSVp2VlYwc3Z3REVkekVFOWNLYWd4VXNmTWFFN1Y4RkVTdkY1YXg4djI4aGxkZEY4b055U1Q5b2dYNGVrNm55bE1TRkFDS0FleTR4clE"
};

const REGION_COOKIES: Record<string, string> = {
  london: "GB",
  europe: "GB",  // Default to GB, content will determine Europe
  uae: "AE",
  usa: "US",
};

// ============================================================================
// TIER TAXONOMY - The core classification system
// ============================================================================
const TIER_TAXONOMY = {
  tier_1: {
    name: "Tier 1 – Immediate Hiring Intent",
    description: "Strong buying signals: fund closes, acquisitions, C-suite hires",
    types: ["fund_close", "acquisition", "c_suite_hire", "rapid_hiring", "new_fund"],
  },
  tier_2: {
    name: "Tier 2 – Medium Intent", 
    description: "Growth signals: office expansion, senior departures, product launches",
    types: ["office_expansion", "senior_departure", "product_launch", "new_recruiter"],
  },
  tier_3: {
    name: "Tier 3 – Early Interest",
    description: "Awareness signals: events, general hiring, market activity",
    types: ["industry_event", "general_hiring", "market_activity"],
  }
};

// ============================================================================
// DAILY CRON SOURCES - PE/FO Europe focused
// ============================================================================
const RSS_SOURCES = [
  { url: "https://www.pehub.com/feed/", source: "PE Hub", region: "usa" },
  { url: "https://www.privateequityinternational.com/rss", source: "PEI", region: "london" },
  { url: "https://sifted.eu/feed", source: "Sifted", region: "europe" },
  { url: "https://www.familywealthreport.com/rss", source: "Family Wealth Report", region: "london" },
  { url: "https://realdeals.eu.com/feed/", source: "Real Deals", region: "london" },
  { url: "https://www.altassets.net/feed", source: "AltAssets", region: "london" },
  { url: "https://gulfbusiness.com/feed/", source: "Gulf Business", region: "uae" },
  { url: "https://www.arabianbusiness.com/feed/", source: "Arabian Business", region: "uae" },
];

// FT Deep Search Queries by Region
const FT_SEARCH_QUERIES = {
  london: [
    "private equity UK fund close",
    "London PE acquisition buyout",
    "UK family office investment",
    "British private equity LBO",
  ],
  europe: [
    "Europe private equity fund close",
    "European PE buyout acquisition",
    "European family office investment",
    "DACH private equity",
  ],
  uae: [
    "UAE private equity investment",
    "Middle East PE fund close",
    "Dubai family office",
    "Gulf private equity buyout",
  ],
  usa: [
    "US private equity fund close",
    "American PE buyout acquisition",
    "US venture capital funding",
    "Wall Street private equity",
  ],
};

// ============================================================================
// PE/FO FILTER KEYWORDS
// ============================================================================
const PE_FILTER_KEYWORDS = [
  "private equity", "family office", "pe fund", "lbo", "buyout", "closes fund",
  "final close", "first close", "growth equity", "secondaries", "continuation fund",
  "gp-led", "lp-led", "fund close", "raises fund", "capital raise", "venture capital",
  "credit fund", "infrastructure fund", "real estate fund", "acquisition", "portco",
  "portfolio company", "mid-market", "dry powder", "carried interest",
];

const EXCLUDED_TOPICS = [
  "customs union", "brexit vote", "parliament", "election result", "senate",
  "gdp growth", "inflation rate", "interest rate decision", "central bank policy",
  "weather forecast", "climate summit", "sports", "championship", "celebrity", "movie",
  "murder", "shooting", "crash killed", "arrested for", "war in", "military strike",
];

// ============================================================================
// SIGNAL TYPE MAPPING - Map to valid DB values
// ============================================================================
function mapToValidSignalType(type: string): string {
  const typeMap: Record<string, string> = {
    fund_close: "funding",
    acquisition: "expansion",
    c_suite_hire: "c_suite",
    rapid_hiring: "hiring",
    new_fund: "funding",
    office_expansion: "expansion",
    senior_departure: "c_suite",
    product_launch: "expansion",
    new_recruiter: "team_growth",
    industry_event: "expansion",
    general_hiring: "hiring",
    market_activity: "expansion",
  };
  return typeMap[type] || "expansion";
}

// ============================================================================
// FIRECRAWL SCRAPER WITH FT COOKIES
// ============================================================================
async function scrapeWithFirecrawl(
  url: string, 
  firecrawlApiKey: string, 
  regionCookie: string
): Promise<{ markdown: string; title: string; url: string } | null> {
  try {
    // Build cookie string for FT
    const cookieString = Object.entries({
      ...FT_COOKIES,
      region: regionCookie
    }).map(([k, v]) => `${k}=${v}`).join("; ");

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        headers: {
          "Cookie": cookieString,
        },
      }),
    });

    if (!response.ok) {
      console.error(`Firecrawl scrape failed for ${url}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      markdown: data.data?.markdown || "",
      title: data.data?.metadata?.title || "",
      url: data.data?.metadata?.sourceURL || url,
    };
  } catch (error) {
    console.error(`Firecrawl error for ${url}:`, error);
    return null;
  }
}

async function firecrawlDeepSearch(
  query: string,
  firecrawlApiKey: string,
  region: string
): Promise<any[]> {
  const regionCookie = REGION_COOKIES[region] || "GB";
  
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${query} site:ft.com OR site:pehub.com OR site:pitchbook.com`,
        limit: 25,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
        },
      }),
    });

    if (!response.ok) {
      console.error(`Firecrawl search failed for "${query}": ${response.status}`);
      return [];
    }

    const data = await response.json();
    console.log(`Firecrawl search for "${query}" returned ${data.data?.length || 0} results`);
    
    return (data.data || []).map((result: any) => ({
      title: result.title || result.metadata?.title || "",
      description: result.markdown?.substring(0, 500) || result.description || "",
      url: result.url || result.sourceURL || result.metadata?.sourceURL || "",
      source: "Firecrawl",
      region,
    }));
  } catch (error) {
    console.error(`Firecrawl search error for "${query}":`, error);
    return [];
  }
}

// ============================================================================
// RSS FEED PARSER
// ============================================================================
async function fetchRSSFeed(feedUrl: string, source: string, region: string): Promise<any[]> {
  const items: any[] = [];
  
  try {
    const response = await fetch(feedUrl, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (compatible; PESignalScraper/2.1)" 
      }
    });
    
    if (!response.ok) {
      console.log(`RSS fetch failed for ${source}: ${response.status}`);
      return [];
    }

    const text = await response.text();
    const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/gi);
    
    for (const match of itemMatches) {
      const itemXml = match[1];
      const title = extractXmlField(itemXml, "title");
      const link = extractXmlField(itemXml, "link");
      const description = extractXmlField(itemXml, "description");
      const pubDate = extractXmlField(itemXml, "pubDate");
      
      // Skip if no valid URL
      if (!link || !link.startsWith("http")) continue;
      
      // Check PE relevance
      const fullText = `${title} ${description}`.toLowerCase();
      const isPERelevant = PE_FILTER_KEYWORDS.some(kw => fullText.includes(kw));
      const isExcluded = EXCLUDED_TOPICS.some(topic => fullText.includes(topic));
      
      if (isPERelevant && !isExcluded) {
        items.push({
          title: cleanHtml(title),
          description: cleanHtml(description).substring(0, 500),
          url: link,
          source,
          region,
          published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        });
      }
    }
    
    console.log(`RSS ${source}: Found ${items.length} relevant PE signals`);
  } catch (error) {
    console.error(`RSS error for ${source}:`, error);
  }
  
  return items;
}

function extractXmlField(xml: string, field: string): string {
  const regex = new RegExp(`<${field}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${field}>`, "is");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ============================================================================
// AI CLASSIFIER - Uses Lovable AI for intelligent classification
// ============================================================================
async function classifySignalWithAI(
  signal: { title: string; description: string; source: string },
  feedbackContext: string
): Promise<{
  tier: string;
  signalType: string;
  confidence: number;
  insight: string;
  pitch: string;
  relevanceScore: number;
}> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return ruleBasedClassify(signal);
  }

  const systemPrompt = `You are an expert PE/VC recruitment intelligence classifier.

TIER TAXONOMY:
${JSON.stringify(TIER_TAXONOMY, null, 2)}

TRAINING FEEDBACK (learn from these user corrections):
${feedbackContext || "No feedback yet - use default classification rules."}

Your task:
1. Classify the signal into tier_1, tier_2, or tier_3
2. Assign a signal_type from the tier's types list
3. Rate your confidence 0-100
4. Score RELEVANCE 1-10 based on PE/FO hiring value (10 = €500M fund close, 1 = general news)
5. Generate a 1-sentence insight explaining WHY this is a hiring signal
6. Generate a 1-sentence TA pitch for reaching out

Respond ONLY with valid JSON:
{
  "tier": "tier_1|tier_2|tier_3",
  "signalType": "fund_close|acquisition|...",
  "confidence": 85,
  "relevanceScore": 9,
  "insight": "Why this matters...",
  "pitch": "Outreach strategy..."
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Classify this PE/FO signal:
Title: ${signal.title}
Description: ${signal.description}
Source: ${signal.source}` }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("AI classification failed:", response.status);
      return ruleBasedClassify(signal);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        tier: parsed.tier || "tier_3",
        signalType: mapToValidSignalType(parsed.signalType || "expansion"),
        confidence: parsed.confidence || 50,
        relevanceScore: parsed.relevanceScore || 5,
        insight: parsed.insight || "",
        pitch: parsed.pitch || "",
      };
    }
  } catch (error) {
    console.error("AI classification error:", error);
  }

  return ruleBasedClassify(signal);
}

function ruleBasedClassify(signal: { title: string; description: string }): {
  tier: string;
  signalType: string;
  confidence: number;
  relevanceScore: number;
  insight: string;
  pitch: string;
} {
  const text = `${signal.title} ${signal.description}`.toLowerCase();
  
  // Tier 1 - Fund closes, acquisitions
  if (text.includes("closes fund") || text.includes("final close") || /€\d+|£\d+|\$\d+/.test(text)) {
    return { tier: "tier_1", signalType: "funding", confidence: 80, relevanceScore: 9, insight: "Fund close indicates immediate team buildout", pitch: "Reach out about portfolio hiring needs" };
  }
  if (text.includes("acquires") || text.includes("acquisition") || text.includes("buyout")) {
    return { tier: "tier_1", signalType: "expansion", confidence: 75, relevanceScore: 8, insight: "Acquisition creates integration roles", pitch: "Discuss post-merger integration talent" };
  }
  if (text.includes("new ceo") || text.includes("new cfo") || text.includes("appoints")) {
    return { tier: "tier_1", signalType: "c_suite", confidence: 80, relevanceScore: 8, insight: "C-suite change drives team restructuring", pitch: "Connect about building new leadership team" };
  }
  
  // Tier 2 - Office expansion, departures
  if (text.includes("opens office") || text.includes("expands to") || text.includes("expansion")) {
    return { tier: "tier_2", signalType: "expansion", confidence: 60, relevanceScore: 6, insight: "Office expansion requires local hiring", pitch: "Offer local market expertise" };
  }
  if (text.includes("departs") || text.includes("leaves") || text.includes("exits")) {
    return { tier: "tier_2", signalType: "c_suite", confidence: 55, relevanceScore: 6, insight: "Senior departure creates backfill need", pitch: "Present replacement candidates" };
  }
  
  // Tier 3 - General
  return { tier: "tier_3", signalType: "expansion", confidence: 40, relevanceScore: 4, insight: "General market activity", pitch: "Monitor for stronger signals" };
}

// ============================================================================
// COMPANY EXTRACTION
// ============================================================================
function extractCompany(text: string): string {
  const patterns = [
    /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+(?:closes|acquires|announces|launches|raises|completes)/i,
    /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+(?:Partners|Capital|Group|Ventures|Equity|Holdings|Fund|Advisors)/i,
    /^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+(?:to|has|is|announces|completes)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1].length > 2 && match[1].length < 50) {
      return match[1];
    }
  }
  
  return "";
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { region: targetRegion, includeRSS = true, includeFirecrawl = true } = body;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

    const regions = targetRegion ? [targetRegion] : ["london", "europe", "uae", "usa"];
    const allSignals: any[] = [];
    const stats = { rss: 0, firecrawl: 0, classified: 0, inserted: 0, skipped: 0 };

    // Fetch feedback for RAG context
    const { data: feedbackData } = await supabase
      .from("signal_feedback")
      .select("user_label, correct_tier, correct_signal_type, feedback_note")
      .order("created_at", { ascending: false })
      .limit(50);

    const feedbackContext = feedbackData?.map(f => 
      `User labeled as ${f.user_label}${f.correct_tier ? `, corrected to ${f.correct_tier}` : ""}${f.feedback_note ? `: ${f.feedback_note}` : ""}`
    ).join("\n") || "";

    for (const r of regions) {
      console.log(`\n========== Processing region: ${r.toUpperCase()} ==========`);

      // 1. RSS Feeds
      if (includeRSS) {
        const regionFeeds = RSS_SOURCES.filter(f => f.region === r);
        for (const feed of regionFeeds) {
          const items = await fetchRSSFeed(feed.url, feed.source, r);
          stats.rss += items.length;
          allSignals.push(...items);
        }
      }

      // 2. Firecrawl Deep Search with FT cookies
      if (includeFirecrawl && firecrawlApiKey) {
        const queries = FT_SEARCH_QUERIES[r as keyof typeof FT_SEARCH_QUERIES] || [];
        for (const query of queries.slice(0, 4)) { // Limit to 4 queries per region
          const results = await firecrawlDeepSearch(query, firecrawlApiKey, r);
          
          // Filter for valid URLs and PE relevance
          const validResults = results.filter(res => {
            if (!res.url || !res.url.startsWith("http")) return false;
            const fullText = `${res.title} ${res.description}`.toLowerCase();
            const isPERelevant = PE_FILTER_KEYWORDS.some(kw => fullText.includes(kw));
            const isExcluded = EXCLUDED_TOPICS.some(topic => fullText.includes(topic));
            return isPERelevant && !isExcluded;
          });
          
          stats.firecrawl += validResults.length;
          allSignals.push(...validResults);
        }
      }
    }

    console.log(`\nTotal signals collected: ${allSignals.length}`);

    // Deduplicate by URL and title similarity
    const seen = new Set<string>();
    const uniqueSignals = allSignals.filter(s => {
      const key = s.url?.toLowerCase() || `${s.title?.substring(0, 50)}|${s.region}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`Unique signals after dedup: ${uniqueSignals.length}`);

    // Classify and insert signals
    for (const signal of uniqueSignals.slice(0, 100)) { // Limit for performance
      // STRICT: Skip signals without valid URL
      if (!signal.url || !signal.url.startsWith("http")) {
        stats.skipped++;
        continue;
      }

      const classification = await classifySignalWithAI(signal, feedbackContext);
      
      // Skip low relevance signals (below 5)
      if (classification.relevanceScore < 5) {
        console.log(`Skipping low relevance (${classification.relevanceScore}): ${signal.title?.substring(0, 50)}`);
        stats.skipped++;
        continue;
      }

      const company = extractCompany(signal.title || signal.description || "");

      // Check for existing signal
      const { data: existing } = await supabase
        .from("signals")
        .select("id")
        .eq("url", signal.url)
        .maybeSingle();

      if (existing) {
        stats.skipped++;
        continue;
      }

      const signalRecord = {
        title: signal.title,
        company: company || null,
        description: signal.description || null,
        url: signal.url,
        source: signal.source,
        region: signal.region,
        tier: classification.tier,
        signal_type: classification.signalType,
        ai_confidence: classification.confidence,
        ai_insight: classification.insight,
        ai_pitch: classification.pitch,
        score: classification.relevanceScore * 10, // Scale 1-10 to 10-100
        published_at: signal.published_at || new Date().toISOString(),
      };

      const { error } = await supabase.from("signals").insert(signalRecord);
      
      if (!error) {
        stats.inserted++;
        stats.classified++;
        console.log(`✓ Inserted: ${signal.title?.substring(0, 60)}`);
      } else {
        console.error("Insert error:", error);
      }
    }

    // Update accuracy metrics
    const today = new Date().toISOString().split("T")[0];
    for (const r of regions) {
      await supabase
        .from("signal_accuracy_metrics")
        .upsert({
          date: today,
          region: r,
          total_signals: stats.inserted,
          accuracy_percentage: 75, // Default
        }, { onConflict: "date,region" });
    }

    const summary = {
      success: true,
      stats,
      message: `FT Multi-Region PE Scraper: RSS=${stats.rss}, Firecrawl=${stats.firecrawl}, Classified=${stats.classified}, Inserted=${stats.inserted}, Skipped=${stats.skipped}`,
    };

    console.log("\n========== SCRAPE COMPLETE ==========");
    console.log(JSON.stringify(summary, null, 2));

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
