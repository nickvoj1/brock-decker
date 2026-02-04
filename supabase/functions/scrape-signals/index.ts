import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// TIER TAXONOMY - The core classification system
// ============================================================================
const TIER_TAXONOMY = {
  tier_1: {
    name: "Tier 1 – Immediate Hiring Intent",
    description: "Strong buying signals: fund closes, acquisitions, C-suite hires",
    types: ["fund_close", "acquisition", "c_suite_hire", "rapid_hiring", "new_fund"],
    examples: [
      "€500M fund close - immediate team buildout",
      "PE firm acquires portfolio company",
      "New CFO appointed at growth equity firm"
    ]
  },
  tier_2: {
    name: "Tier 2 – Medium Intent", 
    description: "Growth signals: office expansion, senior departures, product launches",
    types: ["office_expansion", "senior_departure", "product_launch", "new_recruiter"],
    examples: [
      "Opens Berlin office",
      "MD departs to competitor",
      "Launches new infrastructure fund product"
    ]
  },
  tier_3: {
    name: "Tier 3 – Early Interest",
    description: "Awareness signals: events, general hiring, market activity",
    types: ["industry_event", "general_hiring", "market_activity"],
    examples: [
      "Speaking at PE conference",
      "General hiring posts on LinkedIn",
      "Industry report mentions"
    ]
  }
};

// ============================================================================
// REGION CONFIGURATION
// ============================================================================
const REGIONS = {
  london: { 
    label: "London", 
    adzunaCountries: ["gb"],
    cities: ["London", "City of London", "Canary Wharf", "Westminster", "Mayfair"],
  },
  europe: { 
    label: "Europe", 
    adzunaCountries: ["de", "fr", "nl", "ch"],
    cities: ["Berlin", "Paris", "Amsterdam", "Frankfurt", "Munich", "Zurich"],
  },
  uae: { 
    label: "UAE", 
    adzunaCountries: [],
    cities: ["Dubai", "Abu Dhabi", "DIFC", "ADGM"],
  },
  usa: { 
    label: "USA", 
    adzunaCountries: ["us"],
    cities: ["New York", "Boston", "Chicago", "San Francisco", "Los Angeles"],
  },
};

// ============================================================================
// RSS FEEDS BY REGION - PE/VC/Finance focused
// ============================================================================
const RSS_FEEDS = {
  london: [
    { url: "https://www.privateequitywire.co.uk/feed/", source: "PE Wire UK" },
    { url: "https://realdeals.eu.com/feed/", source: "Real Deals" },
    { url: "https://www.altassets.net/feed", source: "AltAssets" },
  ],
  europe: [
    { url: "https://sifted.eu/feed", source: "Sifted" },
    { url: "https://www.eu-startups.com/feed/", source: "EU-Startups" },
    { url: "https://www.investeurope.eu/news-opinion/rss/", source: "Invest Europe" },
  ],
  uae: [
    { url: "https://gulfbusiness.com/feed/", source: "Gulf Business" },
    { url: "https://www.arabianbusiness.com/feed/", source: "Arabian Business" },
  ],
  usa: [
    { url: "https://www.pehub.com/feed/", source: "PE Hub" },
    { url: "https://news.crunchbase.com/feed/", source: "Crunchbase News" },
    { url: "https://pitchbook.com/rss/news", source: "PitchBook" },
  ],
};

// ============================================================================
// CAREER PAGES FOR FIRECRAWL - COMPREHENSIVE PE/VC/FINANCE FIRMS
// ============================================================================
const CAREER_PAGES: Record<string, { url: string; company: string; region: string }[]> = {
  london: [
    // Global PE Firms with London presence
    { url: "https://www.blackstone.com/careers/", company: "Blackstone", region: "london" },
    { url: "https://www.kkr.com/careers", company: "KKR", region: "london" },
    { url: "https://www.carlyle.com/careers", company: "Carlyle Group", region: "london" },
    { url: "https://www.permira.com/careers", company: "Permira", region: "london" },
    { url: "https://www.cvc.com/careers/", company: "CVC Capital", region: "london" },
    { url: "https://www.apax.com/careers/", company: "Apax Partners", region: "london" },
    { url: "https://www.cinven.com/careers/", company: "Cinven", region: "london" },
    { url: "https://www.bc-partners.com/careers/", company: "BC Partners", region: "london" },
    { url: "https://www.bridgepoint.eu/en/careers/", company: "Bridgepoint", region: "london" },
    { url: "https://www.hgcapital.com/careers/", company: "HG Capital", region: "london" },
    { url: "https://www.3i.com/careers/", company: "3i Group", region: "london" },
    { url: "https://www.tikehaucapital.com/en/careers", company: "Tikehau Capital", region: "london" },
    // VC Firms
    { url: "https://www.indexventures.com/about/join-us", company: "Index Ventures", region: "london" },
    { url: "https://www.balderton.com/jobs/", company: "Balderton Capital", region: "london" },
    { url: "https://www.atomico.com/careers/", company: "Atomico", region: "london" },
    { url: "https://www.accel.com/about/join-us", company: "Accel", region: "london" },
    { url: "https://www.draper-esprit.com/careers/", company: "Draper Esprit", region: "london" },
    // Investment Banks London
    { url: "https://www.goldmansachs.com/careers/", company: "Goldman Sachs", region: "london" },
    { url: "https://www.morganstanley.com/careers/", company: "Morgan Stanley", region: "london" },
    { url: "https://www.jpmorgan.com/careers", company: "JP Morgan", region: "london" },
    { url: "https://home.barclays/careers/", company: "Barclays", region: "london" },
    { url: "https://www.hsbc.com/careers", company: "HSBC", region: "london" },
    { url: "https://www.lazard.com/careers/", company: "Lazard", region: "london" },
    { url: "https://www.rothschildandco.com/en/careers/", company: "Rothschild & Co", region: "london" },
    { url: "https://www.evercore.com/careers/", company: "Evercore", region: "london" },
  ],
  europe: [
    // European PE
    { url: "https://www.eqtgroup.com/careers/", company: "EQT Partners", region: "europe" },
    { url: "https://www.ardian.com/en/careers", company: "Ardian", region: "europe" },
    { url: "https://www.partnersgroup.com/en/careers/", company: "Partners Group", region: "europe" },
    { url: "https://www.ica-ap.com/careers/", company: "IK Investment Partners", region: "europe" },
    { url: "https://www.montagu.com/careers/", company: "Montagu Private Equity", region: "europe" },
    { url: "https://www.equistone.com/careers/", company: "Equistone Partners", region: "europe" },
    { url: "https://www.triton-partners.com/careers/", company: "Triton Partners", region: "europe" },
    { url: "https://www.nordicCapital.com/careers/", company: "Nordic Capital", region: "europe" },
    { url: "https://www.capenergy.com/careers/", company: "Capvis", region: "europe" },
    // European VC
    { url: "https://www.northzone.com/about#careers", company: "Northzone", region: "europe" },
    { url: "https://www.lakestar.com/jobs/", company: "Lakestar", region: "europe" },
    { url: "https://www.partech.com/careers/", company: "Partech", region: "europe" },
    { url: "https://www.projectaventures.com/careers/", company: "Project A Ventures", region: "europe" },
    { url: "https://www.speedinvest.com/careers", company: "Speedinvest", region: "europe" },
    // European Banks
    { url: "https://www.db.com/careers", company: "Deutsche Bank", region: "europe" },
    { url: "https://www.ubs.com/careers", company: "UBS", region: "europe" },
    { url: "https://www.credit-suisse.com/careers", company: "Credit Suisse", region: "europe" },
    { url: "https://www.bnpparibas.com/en/careers", company: "BNP Paribas", region: "europe" },
  ],
  uae: [
    // Sovereign Wealth Funds
    { url: "https://www.mubadala.com/en/careers", company: "Mubadala", region: "uae" },
    { url: "https://www.adia.ae/en/careers", company: "ADIA", region: "uae" },
    { url: "https://www.adq.ae/careers/", company: "ADQ", region: "uae" },
    { url: "https://www.investcorp.com/careers/", company: "Investcorp", region: "uae" },
    // Regional PE/Finance
    { url: "https://www.abraaj.com/careers/", company: "Abraaj (Legacy)", region: "uae" },
    { url: "https://www.gulf-capital.com/careers/", company: "Gulf Capital", region: "uae" },
    { url: "https://www.waha-capital.com/careers/", company: "Waha Capital", region: "uae" },
    // Banks MENA
    { url: "https://www.emiratesnbd.com/en/careers", company: "Emirates NBD", region: "uae" },
    { url: "https://www.fab.ae/en/careers", company: "First Abu Dhabi Bank", region: "uae" },
  ],
  usa: [
    // Mega PE Firms
    { url: "https://www.apolloglobal.com/careers/", company: "Apollo Global", region: "usa" },
    { url: "https://www.tpg.com/careers", company: "TPG", region: "usa" },
    { url: "https://www.warburgpincus.com/careers/", company: "Warburg Pincus", region: "usa" },
    { url: "https://www.bfranco.com/careers/", company: "Francisco Partners", region: "usa" },
    { url: "https://www.thoma-bravo.com/careers/", company: "Thoma Bravo", region: "usa" },
    { url: "https://www.silverlake.com/careers/", company: "Silver Lake", region: "usa" },
    { url: "https://www.vistaequitypartners.com/careers/", company: "Vista Equity Partners", region: "usa" },
    { url: "https://www.hellman-friedman.com/careers/", company: "Hellman & Friedman", region: "usa" },
    { url: "https://www.baincapital.com/careers/", company: "Bain Capital", region: "usa" },
    { url: "https://www.gtcr.com/careers/", company: "GTCR", region: "usa" },
    { url: "https://www.leonardgreen.com/careers/", company: "Leonard Green", region: "usa" },
    { url: "https://www.wellsfargoassetmanagement.com/careers/", company: "Wells Fargo AM", region: "usa" },
    // Top VC Firms
    { url: "https://www.sequoiacap.com/jobs/", company: "Sequoia Capital", region: "usa" },
    { url: "https://a16z.com/about/jobs/", company: "Andreessen Horowitz", region: "usa" },
    { url: "https://www.kpcb.com/careers", company: "Kleiner Perkins", region: "usa" },
    { url: "https://www.greylock.com/careers/", company: "Greylock Partners", region: "usa" },
    { url: "https://www.lsvp.com/about/#careers", company: "Lightspeed Venture", region: "usa" },
    { url: "https://www.generalcatalyst.com/join-us", company: "General Catalyst", region: "usa" },
    { url: "https://www.insightpartners.com/careers/", company: "Insight Partners", region: "usa" },
    { url: "https://www.tigerglobal.com/careers/", company: "Tiger Global", region: "usa" },
    // US Banks
    { url: "https://careers.bankofamerica.com/", company: "Bank of America", region: "usa" },
    { url: "https://www.moelis.com/careers/", company: "Moelis & Company", region: "usa" },
    { url: "https://www.pjtpartners.com/careers", company: "PJT Partners", region: "usa" },
    { url: "https://www.centerview.com/careers/", company: "Centerview Partners", region: "usa" },
    { url: "https://www.greenhill.com/careers/", company: "Greenhill", region: "usa" },
  ],
};

// ============================================================================
// SECTOR WHITELIST
// ============================================================================
const ALLOWED_SECTORS = [
  "private equity", "pe fund", "buyout", "lbo", "growth equity",
  "venture capital", "vc fund", "seed fund", "series a", "series b",
  "investment bank", "m&a", "corporate finance", "leveraged finance",
  "fintech", "financial technology", "neobank", "insurtech",
  "mckinsey", "bain", "boston consulting", "bcg", "pwc", "deloitte", "kpmg", "ey",
  "secondaries", "continuation fund", "gp-led",
  "fund close", "closes fund", "raises fund", "capital raise",
  "infrastructure fund", "credit fund", "real estate fund", "hedge fund",
];

const EXCLUDED_TOPICS = [
  "customs union", "brexit", "parliament", "election", "senate",
  "gdp", "inflation rate", "interest rate", "central bank",
  "weather", "climate", "sports", "championship", "celebrity", "movie",
  "murder", "shooting", "crash", "arrested", "war ", "military",
];

// ============================================================================
// AI CLASSIFIER - Uses Lovable AI for intelligent classification
// ============================================================================
async function classifySignalWithAI(
  signal: { title: string; description: string; company: string; source: string },
  feedbackContext: string
): Promise<{
  tier: string;
  signalType: string;
  confidence: number;
  insight: string;
  pitch: string;
}> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    // Fallback to rule-based classification
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
4. Generate a 1-sentence insight explaining WHY this is a hiring signal
5. Generate a 1-sentence TA pitch for reaching out

Respond ONLY with valid JSON:
{
  "tier": "tier_1|tier_2|tier_3",
  "signalType": "fund_close|acquisition|...",
  "confidence": 85,
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
          { role: "user", content: `Classify this signal:
Title: ${signal.title}
Company: ${signal.company}
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
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        tier: parsed.tier || "tier_3",
        signalType: mapToValidSignalType(parsed.signalType || "expansion"),
        confidence: parsed.confidence || 50,
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
  insight: string;
  pitch: string;
} {
  const text = `${signal.title} ${signal.description}`.toLowerCase();
  
  // Tier 1 keywords
  if (text.includes("closes fund") || text.includes("final close") || text.includes("€") || text.includes("$")) {
    return { tier: "tier_1", signalType: "funding", confidence: 75, insight: "Fund close indicates team expansion", pitch: "Reach out about portfolio hiring needs" };
  }
  if (text.includes("acquires") || text.includes("acquisition") || text.includes("merger")) {
    return { tier: "tier_1", signalType: "expansion", confidence: 70, insight: "Acquisition creates integration roles", pitch: "Discuss post-merger integration talent" };
  }
  if (text.includes("new ceo") || text.includes("new cfo") || text.includes("appoints")) {
    return { tier: "tier_1", signalType: "c_suite", confidence: 80, insight: "C-suite change drives team restructuring", pitch: "Connect about building new leadership team" };
  }
  
  // Tier 2 keywords
  if (text.includes("opens office") || text.includes("expands to") || text.includes("expansion")) {
    return { tier: "tier_2", signalType: "expansion", confidence: 60, insight: "Office expansion requires local hiring", pitch: "Offer local market expertise" };
  }
  if (text.includes("departs") || text.includes("leaves") || text.includes("exits")) {
    return { tier: "tier_2", signalType: "c_suite", confidence: 55, insight: "Senior departure creates backfill need", pitch: "Present replacement candidates" };
  }
  
  // Tier 3 default
  return { tier: "tier_3", signalType: "expansion", confidence: 40, insight: "General market activity", pitch: "Monitor for stronger signals" };
}

function mapToValidSignalType(type: string): string {
  const validTypes = ["funding", "hiring", "expansion", "c_suite", "team_growth"];
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
  return typeMap[type] || (validTypes.includes(type) ? type : "expansion");
}

// ============================================================================
// DATA FETCHERS
// ============================================================================

async function fetchAdzunaJobs(
  region: string,
  adzunaAppId: string,
  adzunaAppKey: string
): Promise<any[]> {
  const config = REGIONS[region as keyof typeof REGIONS];
  if (!config || config.adzunaCountries.length === 0) return [];

  const jobs: any[] = [];
  const searchTerms = ["private equity", "venture capital", "private credit", "buyout", "M&A"];

  for (const country of config.adzunaCountries.slice(0, 2)) {
    for (const term of searchTerms.slice(0, 3)) {
      try {
        const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${adzunaAppId}&app_key=${adzunaAppKey}&what=${encodeURIComponent(term)}&results_per_page=10&max_days_old=30`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.results) {
            jobs.push(...data.results.map((job: any) => ({
              title: job.title,
              company: job.company?.display_name || "Unknown",
              description: job.description?.substring(0, 500) || "",
              url: job.redirect_url,
              location: job.location?.display_name || "",
              source: "Adzuna",
              region,
            })));
          }
        }
      } catch (error) {
        console.error(`Adzuna fetch error for ${country}/${term}:`, error);
      }
    }
  }

  return jobs.slice(0, 30); // Limit per region
}

async function fetchRSSFeeds(region: string): Promise<any[]> {
  const feeds = RSS_FEEDS[region as keyof typeof RSS_FEEDS] || [];
  const items: any[] = [];

  for (const feed of feeds) {
    try {
      const response = await fetch(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SignalScraper/1.0)" }
      });
      
      if (response.ok) {
        const text = await response.text();
        // Simple XML parsing for RSS items
        const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/gi);
        
        for (const match of itemMatches) {
          const itemXml = match[1];
          const title = itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1] || "";
          const link = itemXml.match(/<link>(.*?)<\/link>/i)?.[1] || "";
          const description = itemXml.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i)?.[1] || "";
          
          if (title && isRelevantContent(title + " " + description)) {
            items.push({
              title: cleanHtml(title),
              company: extractCompany(title + " " + description),
              description: cleanHtml(description).substring(0, 500),
              url: link,
              source: feed.source,
              region,
            });
          }
        }
      }
    } catch (error) {
      console.error(`RSS fetch error for ${feed.source}:`, error);
    }
  }

  return items.slice(0, 20);
}

async function scrapeCareerPages(
  region: string,
  firecrawlApiKey: string
): Promise<any[]> {
  const pages = CAREER_PAGES[region as keyof typeof CAREER_PAGES] || [];
  const signals: any[] = [];

  for (const page of pages.slice(0, 5)) { // Limit to 5 per region (Firecrawl free tier)
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: page.url,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const markdown = data.data?.markdown || "";
        
        // Extract job counts and positions
        const jobMatches = markdown.match(/(\d+)\s*(open\s*)?(position|role|job|opportunit)/gi);
        const jobCount = jobMatches ? parseInt(jobMatches[0]) : 0;
        
        if (jobCount > 0 || markdown.toLowerCase().includes("hiring") || markdown.toLowerCase().includes("join us")) {
          signals.push({
            title: `${page.company} hiring: ${jobCount || "multiple"} positions`,
            company: page.company,
            description: `Active job openings at ${page.company}. Career page indicates hiring activity.`,
            url: page.url,
            source: "Firecrawl",
            region,
          });
        }
      }
    } catch (error) {
      console.error(`Firecrawl error for ${page.company}:`, error);
    }
  }

  return signals;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isRelevantContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Check exclusions
  for (const excluded of EXCLUDED_TOPICS) {
    if (lowerText.includes(excluded)) return false;
  }
  
  // Check for allowed sectors
  return ALLOWED_SECTORS.some(sector => lowerText.includes(sector));
}

function extractCompany(text: string): string {
  // Try to extract company name from common patterns
  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:closes|acquires|announces|launches|raises)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Partners|Capital|Group|Ventures|Equity)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  return "";
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { region, includeAdzuna = true, includeRSS = true, includeFirecrawl = true } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const adzunaAppId = Deno.env.get("ADZUNA_APP_ID");
    const adzunaAppKey = Deno.env.get("ADZUNA_APP_KEY");
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

    const regions = region ? [region] : ["london", "europe", "uae", "usa"];
    const allSignals: any[] = [];
    const stats = { adzuna: 0, rss: 0, firecrawl: 0, classified: 0, inserted: 0 };

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
      console.log(`Processing region: ${r}`);

      // 1. Adzuna Jobs
      if (includeAdzuna && adzunaAppId && adzunaAppKey) {
        const adzunaJobs = await fetchAdzunaJobs(r, adzunaAppId, adzunaAppKey);
        stats.adzuna += adzunaJobs.length;
        allSignals.push(...adzunaJobs);
      }

      // 2. RSS Feeds
      if (includeRSS) {
        const rssItems = await fetchRSSFeeds(r);
        stats.rss += rssItems.length;
        allSignals.push(...rssItems);
      }

      // 3. Firecrawl Career Pages
      if (includeFirecrawl && firecrawlApiKey) {
        const careerSignals = await scrapeCareerPages(r, firecrawlApiKey);
        stats.firecrawl += careerSignals.length;
        allSignals.push(...careerSignals);
      }
    }

    // Deduplicate by title/company/region
    const seen = new Set<string>();
    const uniqueSignals = allSignals.filter(s => {
      const key = `${s.company}|${s.title?.substring(0, 50)}|${s.region}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Classify each signal with AI
    const classifiedSignals: any[] = [];
    
    for (const signal of uniqueSignals.slice(0, 50)) { // Limit for performance
      const classification = await classifySignalWithAI(signal, feedbackContext);
      
      classifiedSignals.push({
        title: signal.title,
        company: signal.company || null,
        description: signal.description || null,
        url: signal.url || null,
        source: signal.source,
        region: signal.region,
        tier: classification.tier,
        signal_type: classification.signalType,
        ai_confidence: classification.confidence,
        ai_insight: classification.insight,
        ai_pitch: classification.pitch,
        score: classification.confidence,
        published_at: new Date().toISOString(),
      });
      
      stats.classified++;
    }

    // Check for existing signals and insert new ones
    for (const signal of classifiedSignals) {
      const { data: existing } = await supabase
        .from("signals")
        .select("id")
        .eq("company", signal.company)
        .eq("region", signal.region)
        .eq("signal_type", signal.signal_type)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase
          .from("signals")
          .insert(signal);
        
        if (!error) {
          stats.inserted++;
        } else {
          console.error("Insert error:", error);
        }
      }
    }

    // Update accuracy metrics
    const today = new Date().toISOString().split("T")[0];
    for (const r of regions) {
      const regionSignals = classifiedSignals.filter(s => s.region === r);
      if (regionSignals.length > 0) {
        const avgConfidence = regionSignals.reduce((sum, s) => sum + s.ai_confidence, 0) / regionSignals.length;
        
        await supabase
          .from("signal_accuracy_metrics")
          .upsert({
            date: today,
            region: r,
            total_signals: regionSignals.length,
            accuracy_percentage: avgConfidence,
          }, { onConflict: "date,region" });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        message: `Scraped ${stats.adzuna + stats.rss + stats.firecrawl} signals, classified ${stats.classified}, inserted ${stats.inserted} new`,
      }),
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
