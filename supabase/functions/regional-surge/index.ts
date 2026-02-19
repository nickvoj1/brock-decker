import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================================
// BOMBORA NEWS SURGE SCRAPER v2.1 - Regional Accuracy + Self-Learning AI
// ============================================================================

// SOURCES per region - curated news feeds for PE/VC intelligence
const SOURCES = {
  london: [
    { url: "https://www.ft.com/private-equity", source: "FT Private Equity", isFT: true },
    { url: "https://www.cityam.com/feed/", source: "City AM", isRSS: true },
    { url: "https://realdeals.eu.com/feed/", source: "Real Deals UK", isRSS: true },
    { url: "https://sifted.eu/feed", source: "Sifted UK", isRSS: true },
  ],
  europe: [
    { url: "https://www.pehub.com/europe/feed/", source: "PE Hub Europe", isRSS: true },
    { url: "https://sifted.eu/feed", source: "Sifted", isRSS: true },
    { url: "https://tech.eu/feed", source: "Tech.eu", isRSS: true },
  ],
  uae: [
    { url: "https://www.zawya.com/rss/", source: "Zawya", isRSS: true },
    { url: "https://www.arabianbusiness.com/feed/", source: "Arabian Business", isRSS: true },
    { url: "https://gulfbusiness.com/feed/", source: "Gulf Business", isRSS: true },
  ],
  usa: [
    { url: "https://www.pehub.com/feed/", source: "PE Hub", isRSS: true },
    { url: "https://techcrunch.com/category/venture/feed/", source: "TechCrunch VC", isRSS: true },
    { url: "https://news.crunchbase.com/feed/", source: "Crunchbase News", isRSS: true },
  ],
};

// High-intent keywords for surge scoring
const SURGE_KEYWORDS = [
  "closes fund", "closed fund", "final close", "first close", "raises fund",
  "fundraise", "lbo", "leveraged buyout", "acquisition", "acquires",
  "private equity", "venture capital", "pe fund", "vc fund",
  "new ceo", "new cfo", "new chro", "appoints", "hires",
  "expansion", "opens office", "team growth", "hiring spree",
];

// Nordic countries - for self-learning rejection
const NORDIC_KEYWORDS = [
  "sweden", "swedish", "stockholm", "norway", "norwegian", "oslo",
  "denmark", "danish", "copenhagen", "finland", "finnish", "helsinki",
  "iceland", "icelandic", "reykjavik", "nordic", "scandinavia",
];

// Region validation keywords
const REGION_KEYWORDS = {
  london: ["london", "uk", "united kingdom", "britain", "england", "ftse", "lse"],
  europe: ["berlin", "paris", "frankfurt", "amsterdam", "munich", "zurich", "milan", "madrid", "germany", "france", "netherlands", "switzerland"],
  uae: ["dubai", "abu dhabi", "uae", "emirates", "difc", "adgm", "gulf"],
  usa: ["new york", "nyc", "boston", "san francisco", "los angeles", "miami", "chicago", "usa", "america", "nasdaq", "wall street"],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractCompanyName(text: string): string | null {
  // Look for company name patterns
  const patterns = [
    /(?:company|firm|fund|PE firm|VC firm|investor)\s+([A-Z][A-Za-z0-9\s&]+?)(?:\s+(?:has|is|closes|raises|acquires|announces|appoints))/i,
    /([A-Z][A-Za-z0-9\s&]+?)\s+(?:closes|raises|acquires|announces|appoints)/,
    /([A-Z][A-Za-z0-9\s&]+?)\s+(?:PE|VC|Capital|Partners|Group|Holdings|Investments)/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length > 2 && match[1].length < 50) {
      return match[1].trim();
    }
  }
  
  return null;
}

function countKeywords(text: string): { count: number; matched: string[] } {
  const lowerText = text.toLowerCase();
  const matched: string[] = [];
  
  for (const keyword of SURGE_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      matched.push(keyword);
    }
  }
  
  return { count: matched.length, matched };
}

function isNordic(text: string): boolean {
  const lowerText = text.toLowerCase();
  return NORDIC_KEYWORDS.some(kw => lowerText.includes(kw));
}

function detectContentRegion(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  const scores: Record<string, number> = {
    london: 0,
    europe: 0,
    uae: 0,
    usa: 0,
  };
  
  for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        scores[region]++;
      }
    }
  }
  
  // London gets priority weight
  scores.london *= 1.5;
  
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return null;
  
  const detectedRegion = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0];
  return detectedRegion || null;
}

function calculateSurgeScore(keywordCount: number): number {
  // Surge scoring: >5 = HIGH (90+), 3-4 = MEDIUM (70-89), 1-2 = LOW (50-69)
  if (keywordCount >= 5) return Math.min(90 + keywordCount * 2, 100);
  if (keywordCount >= 3) return 70 + keywordCount * 3;
  if (keywordCount >= 1) return 50 + keywordCount * 5;
  return 30;
}

function normalizeUrlForDedup(url?: string | null): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return String(url).trim().toLowerCase();
  }
}

function normalizeTextForDedup(text?: string | null): string {
  return String(text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFingerprint(text?: string | null): string {
  return normalizeTextForDedup(text).split(" ").slice(0, 14).join(" ");
}

function classifySignalTypeFromContent(text: string): "funding" | "expansion" | "c_suite" | "hiring" | "team_growth" {
  const t = text.toLowerCase();
  if (/fund close|final close|first close|raises fund|raises \$|raises €|series [abc]|investment round/.test(t)) {
    return "funding";
  }
  if (/new ceo|new cfo|new coo|appoints|appointed|leadership change|chief executive|chief financial/.test(t)) {
    return "c_suite";
  }
  if (/hiring|hires|hired|open roles|job openings|talent acquisition|recruiter/.test(t)) {
    return "hiring";
  }
  if (/people team|hr team|headcount growth|workforce expansion/.test(t)) {
    return "team_growth";
  }
  if (/acquires|acquired|acquisition|expands|expansion|opens office|launches/.test(t)) {
    return "expansion";
  }
  return "expansion";
}

// ============================================================================
// FIRECRAWL SCRAPING
// ============================================================================

async function scrapeWithFirecrawl(url: string, isRSS: boolean = false): Promise<{ content: string; title: string } | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    console.error("FIRECRAWL_API_KEY not configured");
    return null;
  }
  
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });
    
    if (!response.ok) {
      console.error(`Firecrawl error for ${url}:`, response.status);
      return null;
    }
    
    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || "";
    const title = data.data?.metadata?.title || data.metadata?.title || "";
    
    return { content: markdown, title };
  } catch (error) {
    console.error(`Firecrawl scrape failed for ${url}:`, error);
    return null;
  }
}

// ============================================================================
// LLM GEO-VALIDATION
// ============================================================================

async function validateRegionWithAI(content: string, expectedRegion: string): Promise<{
  company: string | null;
  detectedRegion: string | null;
  geoConfidence: number;
  rawContent: string;
} | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("LOVABLE_API_KEY not configured");
    return null;
  }
  
  const systemPrompt = `You are a regional news classifier for PE/VC recruitment intelligence.
Region: ${expectedRegion.toUpperCase()}

Analyze the news content and determine:
1. The company HQ/location (must strictly match ${expectedRegion})
2. If news clearly mentions a different location (e.g., Stockholm = Nordic, not Europe)
3. Reject: Nordic/Asia companies in Europe sources, USA news in London sources

IMPORTANT:
- Nordic countries (Sweden, Norway, Denmark, Finland, Iceland) should be REJECTED if the expected region is LONDON or EUROPE
- Only validate signals where the company or news is genuinely from ${expectedRegion}

Return JSON only:
{
  "company": "Company Name or null",
  "detected_region": "london|europe|uae|usa|rejected",
  "geo_confidence": 0-100,
  "reasoning": "brief explanation"
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: content.substring(0, 2000) }, // Limit content length
        ],
        temperature: 0.1,
      }),
    });
    
    if (!response.ok) {
      console.error("AI geo-validation failed:", response.status);
      return null;
    }
    
    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      company: parsed.company || null,
      detectedRegion: parsed.detected_region || null,
      geoConfidence: parsed.geo_confidence || 0,
      rawContent: content.substring(0, 500),
    };
  } catch (error) {
    console.error("AI geo-validation error:", error);
    return null;
  }
}

// ============================================================================
// LLM SURGE SCORING
// ============================================================================

async function scoreSurgeWithAI(content: string, company: string): Promise<{
  surgeScore: number;
  insight: string;
  keywords: string[];
} | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  
  const systemPrompt = `You are a PE/VC hiring intelligence analyst.

Analyze this validated news for hiring surge indicators.

Keywords to look for:
- Fundraise, fund close, LBO, PE, VC
- CHRO, hiring, team growth, expansion
- New CEO, CFO, office opening

Scoring:
- 5+ keyword mentions = HIGH (90-100)
- 3-4 mentions = MEDIUM (70-89)
- 1-2 mentions = LOW (50-69)

Return JSON only:
{
  "surge_score": 0-100,
  "insight": "1-2 sentence insight about hiring intent",
  "keywords": ["matched", "keywords"]
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Company: ${company}\n\nContent:\n${content.substring(0, 1500)}` },
        ],
        temperature: 0.1,
      }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || "";
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      surgeScore: parsed.surge_score || 0,
      insight: parsed.insight || "",
      keywords: parsed.keywords || [],
    };
  } catch (error) {
    console.error("AI surge scoring error:", error);
    return null;
  }
}

// ============================================================================
// SELF-LEARNING FILTER
// ============================================================================

async function checkSelfLearningRejection(
  supabase: any,
  company: string,
  region: string
): Promise<boolean> {
  // Check feedback_log for patterns that should be auto-rejected
  const { data: rejections } = await supabase
    .from("feedback_log")
    .select("reason")
    .eq("action", "REJECT")
    .ilike("reason", `%${company}%`)
    .limit(3);
  
  // If same company has been rejected 2+ times, auto-reject
  if (rejections && rejections.length >= 2) {
    console.log(`Self-learning: Auto-rejecting ${company} (rejected ${rejections.length} times before)`);
    return true;
  }
  
  // Check for Nordic rejections in Europe feed
  if (region === "europe" || region === "london") {
    const { data: nordicRejections } = await supabase
      .from("feedback_log")
      .select("id")
      .eq("action", "REJECT")
      .ilike("reason", "%nordic%")
      .limit(10);
    
    // If we have Nordic rejections, be more strict about Nordic companies
    if (nordicRejections && nordicRejections.length >= 3) {
      // Check if company name contains Nordic indicators
      if (isNordic(company)) {
        console.log(`Self-learning: Auto-rejecting Nordic company ${company}`);
        return true;
      }
    }
  }
  
  return false;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { region: targetRegion } = await req.json().catch(() => ({}));
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const regionsToProcess = targetRegion 
      ? [targetRegion] 
      : ["london", "europe", "uae", "usa"];

    const dedupeCutoffIso = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentSignals } = await supabase
      .from("signals")
      .select("url, title, company, region, signal_type, published_at")
      .gte("published_at", dedupeCutoffIso)
      .limit(5000);

    const seenUrlKeys = new Set<string>();
    const seenTitleKeys = new Set<string>();
    const seenCompanyTypeKeys = new Set<string>();

    for (const existing of recentSignals || []) {
      const urlKey = normalizeUrlForDedup(existing.url);
      if (urlKey) seenUrlKeys.add(urlKey);
      const titleKey = titleFingerprint(existing.title);
      if (titleKey) seenTitleKeys.add(titleKey);
      const companyTypeKey = [
        normalizeTextForDedup(existing.company),
        normalizeTextForDedup(existing.region),
        normalizeTextForDedup(existing.signal_type),
        titleKey,
      ].join("|");
      if (companyTypeKey.replace(/\|/g, "").length > 0) seenCompanyTypeKeys.add(companyTypeKey);
    }
    
    const results = {
      processed: 0,
      validated: 0,
      rejected: 0,
      pending: 0,
      byRegion: {} as Record<string, { validated: number; rejected: number; pending: number }>,
    };
    
    for (const region of regionsToProcess) {
      const sources = SOURCES[region as keyof typeof SOURCES] || [];
      results.byRegion[region] = { validated: 0, rejected: 0, pending: 0 };
      
      console.log(`Processing ${sources.length} sources for ${region}...`);
      
      for (const source of sources) {
        console.log(`Scraping ${source.source}: ${source.url}`);
        
        const scraped = await scrapeWithFirecrawl(source.url, source.isRSS);
        if (!scraped) continue;
        
        results.processed++;
        
        // Split content into articles (rough heuristic)
        const articles = scraped.content.split(/\n#{1,3}\s/).filter(a => a.length > 100);
        
        for (const articleContent of articles.slice(0, 5)) { // Max 5 articles per source
          // Step 1: LLM Geo-Validation
          const geoResult = await validateRegionWithAI(articleContent, region);
          if (!geoResult) continue;
          
          const { company, detectedRegion, geoConfidence, rawContent } = geoResult;
          
          // Reject if no company detected
          if (!company) {
            console.log(`Rejected: No company detected`);
            results.rejected++;
            results.byRegion[region].rejected++;
            continue;
          }
          
          // Reject if wrong region
          if (detectedRegion === "rejected" || (detectedRegion && detectedRegion !== region)) {
            console.log(`Rejected: Region mismatch (${detectedRegion} vs ${region})`);
            results.rejected++;
            results.byRegion[region].rejected++;
            continue;
          }
          
          // Self-learning check
          const shouldAutoReject = await checkSelfLearningRejection(supabase, company, region);
          if (shouldAutoReject) {
            results.rejected++;
            results.byRegion[region].rejected++;
            continue;
          }
          
          // Step 2: Surge Scoring
          const surgeResult = await scoreSurgeWithAI(articleContent, company);
          const surgeScore = surgeResult?.surgeScore || calculateSurgeScore(countKeywords(articleContent).count);
          const insight = surgeResult?.insight || "";
          const keywords = surgeResult?.keywords || countKeywords(articleContent).matched;
          
          // Determine validation status
          const isPending = geoConfidence < 80;
          const validatedRegion = isPending ? null : region.toUpperCase();
          
          const contentTitle = articleContent.split("\n")[0]?.trim() || `${company} ${source.source} update`;
          const title = contentTitle.slice(0, 255);
          const signalType = classifySignalTypeFromContent(articleContent);
          const urlKey = normalizeUrlForDedup(source.url);
          const titleKey = titleFingerprint(title);
          const companyTypeKey = [
            normalizeTextForDedup(company),
            normalizeTextForDedup(region),
            normalizeTextForDedup(signalType),
            titleKey,
          ].join("|");

          if ((urlKey && seenUrlKeys.has(urlKey)) || seenTitleKeys.has(titleKey) || seenCompanyTypeKeys.has(companyTypeKey)) {
            console.log(`Skipping duplicate: ${company} (${source.source})`);
            continue;
          }
          
          // Insert signal
          const { error: insertError } = await supabase
            .from("signals")
            .insert({
              title,
              company,
              region,
              detected_region: detectedRegion,
              validated_region: validatedRegion,
              score: surgeScore,
              keywords_count: keywords.length,
              keywords,
              source_urls: [source.url],
              raw_content: rawContent,
              ai_confidence: geoConfidence,
              ai_insight: insight,
              source: source.source,
              signal_type: signalType,
              tier: surgeScore >= 90 ? "tier_1" : surgeScore >= 70 ? "tier_2" : "tier_3",
              published_at: new Date().toISOString(),
              user_feedback: isPending ? null : "AUTO_VALIDATED",
            });
          
          if (insertError) {
            console.error("Insert error:", insertError);
          } else {
            if (urlKey) seenUrlKeys.add(urlKey);
            seenTitleKeys.add(titleKey);
            seenCompanyTypeKeys.add(companyTypeKey);
            if (isPending) {
              results.pending++;
              results.byRegion[region].pending++;
            } else {
              results.validated++;
              results.byRegion[region].validated++;
            }
          }
        }
        
        // Rate limit between sources
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log("Regional surge scrape complete:", results);
    
    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Regional surge error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
