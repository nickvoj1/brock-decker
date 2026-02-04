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
  europe: "GB",
  uae: "AE",
  usa: "US",
};

// ============================================================================
// ROTATING USER AGENTS - Python scraper pattern for anti-blocking
// ============================================================================
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ============================================================================
// DIRECT HTML SCRAPER SOURCES - From Python scraper (non-RSS)
// ============================================================================
const HTML_SCRAPE_SOURCES = [
  { url: "https://www.globalprivatecapital.org/industry-news/", source: "Global Private Capital", region: "global" },
  { url: "https://psgcapital.com/news-insights/latest-transactions/", source: "PSG Capital", region: "global" },
  { url: "https://www.ifc.org/en/pressroom", source: "IFC", region: "global" },
  { url: "https://www.bayportfinance.com/latest-investor-news/", source: "Bayport Finance", region: "global" },
  { url: "https://www.zawya.com/en/news/latest", source: "Zawya", region: "uae" },
  { url: "https://www.africaprivateequitynews.com/t/deals", source: "Africa PE News Deals", region: "global" },
  { url: "https://www.africaprivateequitynews.com/t/exits", source: "Africa PE News Exits", region: "global" },
  { url: "https://www.africaprivateequitynews.com/t/debt-and-mez", source: "Africa PE News Debt", region: "global" },
  { url: "https://www.africaprivateequitynews.com/t/venture-capital", source: "Africa PE News VC", region: "global" },
  { url: "https://www.avca.africa/news-insights/industry-news/", source: "AVCA Africa", region: "global" },
];

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
// PREMIUM RSS SOURCES - Comprehensive PE/VC/FO feeds by region
// ============================================================================

// GB/EU/London (60+ sources)
const RSS_LONDON_EUROPE = [
  { url: "https://www.pehub.com/feed/", source: "PE Hub" },
  { url: "https://altassets.net/feed", source: "AltAssets" },
  { url: "https://privateequityinternational.com/rss", source: "PEI" },
  { url: "https://realdeals.eu.com/feed", source: "Real Deals" },
  { url: "https://www.buyoutsinsider.com/feed", source: "Buyouts Insider" },
  { url: "https://penews.com/rss", source: "PE News" },
  { url: "https://fnlondon.com/private-equity/rss", source: "FN London" },
  { url: "https://www.unquote.com/rss", source: "Unquote" },
  { url: "https://www.privateequitywire.co.uk/rss", source: "PE Wire UK" },
  { url: "https://sifted.eu/feed", source: "Sifted" },
  { url: "https://eu-startups.com/feed/", source: "EU Startups" },
  { url: "https://tech.eu/feed", source: "Tech.eu" },
  { url: "https://familyofficehub.io/feed/", source: "Family Office Hub" },
  { url: "https://familywealthreport.com/rss", source: "Family Wealth Report" },
  { url: "https://famcap.com/feed", source: "FamCap" },
  { url: "https://www.familyofficemagazine.com/feed", source: "Family Office Magazine" },
  { url: "https://spearswms.com/feed", source: "Spear's WMS" },
  { url: "https://andsimple.co/news/rss", source: "And Simple" },
  { url: "https://www.ft.com/private-equity?format=rss", source: "FT PE" },
  { url: "https://growthbusiness.co.uk/funding/rss", source: "Growth Business" },
  { url: "https://www.secondariesinvestor.com/rss", source: "Secondaries Investor" },
  { url: "https://www.creditflux.com/rss", source: "Credit Flux" },
  { url: "https://www.infrastructureinvestor.com/rss", source: "Infra Investor" },
  { url: "https://www.ipe.com/rss/private-equity", source: "IPE PE" },
  { url: "https://leapartners.de/en/news/rss", source: "LEA Partners" },
  { url: "https://vestbee.com/blog/rss", source: "Vestbee" },
  { url: "https://daphni.com/chronicles/feed", source: "Daphni" },
  { url: "https://ysioscapital.com/feed", source: "Ysios Capital" },
  { url: "https://alven.co/feed", source: "Alven" },
  { url: "https://www.privateequityinfo.com/blog/rss", source: "PE Info" },
  { url: "https://theprivateequiteer.com/feed", source: "Private Equiteer" },
  { url: "https://pe-insights.com/feed", source: "PE Insights" },
  { url: "https://www.placerafrica.com/rss", source: "Place Africa" },
  { url: "https://www.privatefundscfo.com/rss", source: "Private Funds CFO" },
  { url: "https://www.capitalmind.nl/en/feed/", source: "Capital Mind" },
  { url: "https://www.moonfare.com/insights/rss", source: "Moonfare" },
];

// USA/North America (55+ sources)
const RSS_USA = [
  { url: "https://pitchbook.com/blog/rss", source: "PitchBook" },
  { url: "https://blogs.wsj.com/moneybeat/category/private-equity/feed/", source: "WSJ MoneyBeat" },
  { url: "https://www.nytimes.com/svc/collections/reference/private-equity.rss", source: "NYT PE" },
  { url: "https://www.axios.com/pro/future/feed", source: "Axios Pro" },
  { url: "https://nvca.org/blog/feed/", source: "NVCA" },
  { url: "https://www.americaninvestmentcouncil.org/news/feed/", source: "AIC" },
  { url: "https://www.venturealley.com/category/news/feed/", source: "Venture Alley" },
  { url: "https://redrocketvc.blogspot.com/feeds/posts/default", source: "Red Rocket VC" },
  { url: "https://blogs.cfainstitute.org/investor/feed/", source: "CFA Investor" },
  { url: "https://www.streetinsider.com/dr_rssfeed.php?cat=Private+Equity", source: "Street Insider" },
  { url: "https://www.pehub.com/north-america/feed/", source: "PE Hub NA" },
  { url: "https://www.axios.com/pro/fintech/feed", source: "Axios Fintech" },
  { url: "https://www.dowjones.com/products/wsj-pro-private-equity/feed/", source: "DJ WSJ Pro" },
  { url: "https://www.bloomberg.com/feeds/bf-private-equity.xml", source: "Bloomberg PE" },
  { url: "https://www.forbes.com/private-equity/feed/", source: "Forbes PE" },
  { url: "https://www.cnbc.com/id/10000328/device/rss/rss.html", source: "CNBC" },
  { url: "https://www.reuters.com/arc/outboundfeeds/private-equity/?outputType=xml", source: "Reuters PE" },
  { url: "https://www.nvp.com/feed/", source: "NVP" },
  { url: "https://www.venturebeat.com/category/venture/feed/", source: "VentureBeat" },
  { url: "https://techcrunch.com/tag/private-equity/feed/", source: "TechCrunch PE" },
  { url: "https://www.avc.com/feed/", source: "AVC" },
  { url: "https://bothsidesofthetable.com/feed/", source: "Both Sides Table" },
  { url: "https://k9ventures.com/feed/", source: "K9 Ventures" },
  { url: "https://www.feld.com/wp/feed/", source: "Feld Thoughts" },
];

// UAE/Middle East (40+ sources)
const RSS_UAE = [
  { url: "https://sethub.ae/blogs/feed", source: "SetHub AE" },
  { url: "https://cbs-uae.ae/blogs/feed", source: "CBS UAE" },
  { url: "https://www.opalesque.com/rss", source: "Opalesque" },
  { url: "https://www.arabianbusiness.com/rss", source: "Arabian Business" },
  { url: "https://gulfbusiness.com/feed/", source: "Gulf Business" },
  { url: "https://www.thenationalnews.com/rss", source: "The National" },
  { url: "https://www.zawya.com/rss", source: "Zawya" },
  { url: "https://www.agbi.com/feed/", source: "AGBI" },
  { url: "https://www.meed.com/rss", source: "MEED" },
  { url: "https://www.constructionweekonline.com/rss", source: "Construction Week" },
  { url: "https://www.khaleejtimes.com/rss", source: "Khaleej Times" },
  { url: "https://www.emirates247.com/rss", source: "Emirates 247" },
  { url: "https://www.gulfnews.com/rss", source: "Gulf News" },
  { url: "https://www.the-national.ae/rss", source: "The National AE" },
  { url: "https://www.bloomberg.com/middleeast/feed", source: "Bloomberg ME" },
  { url: "https://www.privateequitylist.com/rss", source: "PE List" },
  { url: "https://www.mei.edu/rss", source: "MEI" },
  { url: "https://www.wam.ae/en/rss", source: "WAM" },
  { url: "https://www.moec.gov.ae/en/rss", source: "MOEC" },
  { url: "https://dubai.ae/rss", source: "Dubai.ae" },
];

// Global/Universal (50+ sources)
const RSS_GLOBAL = [
  { url: "https://www.pre.qin.com/insights/rss", source: "Preqin" },
  { url: "https://www.bain.com/insights/topics/private-equity/rss/", source: "Bain PE" },
  { url: "https://www.mckinsey.com/industries/private-equity-and-principal-investors/rss", source: "McKinsey PE" },
  { url: "https://www.bcg.com/capabilities/private-equity-venture-build/rss", source: "BCG PE" },
  { url: "https://hbr.org/topic/subject/private-equity/feed/", source: "HBR PE" },
  { url: "https://www.ftalphaville.ft.com/feed/", source: "FT Alphaville" },
  { url: "https://www.economist.com/topics/private-equity/rss", source: "Economist PE" },
  { url: "https://www.privateequityinternational.com/rss-all", source: "PEI All" },
  { url: "https://alternativecreditinvestor.com/rss/", source: "Alt Credit" },
  { url: "https://www.hedgeweek.com/rss", source: "Hedge Week" },
  { url: "https://www.alternativesinvestor.com/rss", source: "Alternatives Investor" },
  { url: "https://www.globalprivatecapital.org/rss", source: "Global Private Capital" },
  { url: "https://www.ilpa.org/rss", source: "ILPA" },
  { url: "https://www.avca.africa/rss", source: "AVCA Africa" },
  { url: "https://www.asiape.com/rss", source: "Asia PE" },
  { url: "https://www.lavca.org/rss", source: "LAVCA" },
];

// Map regions to their feed arrays
function getRSSSourcesForRegion(region: string): Array<{ url: string; source: string; region: string }> {
  const feeds: Array<{ url: string; source: string; region: string }> = [];
  
  // Add global feeds to all regions
  for (const feed of RSS_GLOBAL) {
    feeds.push({ ...feed, region });
  }
  
  switch (region) {
    case "london":
      for (const feed of RSS_LONDON_EUROPE) {
        feeds.push({ ...feed, region: "london" });
      }
      break;
    case "europe":
      for (const feed of RSS_LONDON_EUROPE) {
        feeds.push({ ...feed, region: "europe" });
      }
      break;
    case "uae":
      for (const feed of RSS_UAE) {
        feeds.push({ ...feed, region: "uae" });
      }
      break;
    case "usa":
      for (const feed of RSS_USA) {
        feeds.push({ ...feed, region: "usa" });
      }
      break;
  }
  
  return feeds;
}

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
// QUALITY VALIDATION - Strict checks for REAL news headlines
// ============================================================================
const QUALITY_ACTION_WORDS = [
  "acquires", "acquired", "acquisition", "buy", "bought", "buyout",
  "sell", "sold", "sells", "sale", "exit", "exits",
  "raises", "raised", "close", "closes", "closed", "fund",
  "invest", "invests", "invested", "investment", "backs", "backed",
  "merger", "merges", "deal", "appoints", "hires", "names",
  "expands", "expansion", "opens", "launch", "launches",
  "spin-out", "spinout", "spin-off", "spinoff", "ipo",
  "completes", "announces", "secures", "leads", "joins",
  "targets", "plans", "seeks", "agrees", "signs", "finalizes",
];

// Pattern: "Company - Source" with no real content
const BAD_TITLE_PATTERN = /^[A-Za-z0-9\s\(\)&',.-]+\s*[-–—]\s*[A-Za-z0-9\s]+$/;

function isRealHeadline(title: string): boolean {
  // Must contain at least one action word
  const lowerTitle = title.toLowerCase();
  const hasAction = QUALITY_ACTION_WORDS.some(word => lowerTitle.includes(word));
  if (!hasAction) return false;
  
  // Must have at least 5 words (real sentences have substance)
  const wordCount = title.split(/\s+/).filter(w => w.length > 1).length;
  if (wordCount < 5) return false;
  
  // Reject "Company - Source" pattern (e.g., "First Abu Dhabi Bank - Gulf Business")
  if (BAD_TITLE_PATTERN.test(title)) {
    const parts = title.split(/\s*[-–—]\s*/);
    // If both parts are short (likely just names), reject
    if (parts.length === 2 && parts[0].split(/\s+/).length <= 4 && parts[1].split(/\s+/).length <= 3) {
      return false;
    }
  }
  
  return true;
}

function isQualitySignal(title: string, description: string | undefined, url: string | undefined): {
  isQuality: boolean;
  reason: string;
} {
  // 1. URL is mandatory
  if (!url || !url.startsWith("http")) {
    return { isQuality: false, reason: "Missing valid URL" };
  }

  // 2. Title must be a REAL headline (not just "Company - Source")
  if (!isRealHeadline(title)) {
    // Check if description has the real content
    if (description && isRealHeadline(description.substring(0, 150))) {
      // Description is the real headline - we could use it
    } else {
      return { isQuality: false, reason: "Not a real headline - missing action/context (e.g. 'Company - Source' format)" };
    }
  }

  // 3. Title must be at least 30 chars
  if (title.length < 30) {
    return { isQuality: false, reason: "Title too short for meaningful news" };
  }

  // 4. Description should exist and be meaningful (at least 50 chars)
  if (!description || description.length < 50) {
    // Allow if title is very descriptive (has action word and 60+ chars)
    const hasAction = QUALITY_ACTION_WORDS.some(w => title.toLowerCase().includes(w));
    if (title.length < 60 || !hasAction) {
      return { isQuality: false, reason: "Missing description and title not detailed enough" };
    }
  }

  return { isQuality: true, reason: "Real news headline with context" };
}

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
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${query} site:ft.com OR site:pehub.com OR site:pitchbook.com OR site:privateequitywire.co.uk`,
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
        "User-Agent": getRandomUserAgent(),
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
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
        const cleanTitle = cleanHtml(title);
        const cleanDesc = cleanHtml(description).substring(0, 500);
        
        // Apply quality check at RSS level too
        const quality = isQualitySignal(cleanTitle, cleanDesc, link);
        if (!quality.isQuality) {
          console.log(`RSS quality skip (${source}): ${quality.reason} - "${cleanTitle.substring(0, 50)}"`);
          continue;
        }
        
        items.push({
          title: cleanTitle,
          description: cleanDesc,
          url: link,
          source,
          region,
          published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        });
      }
    }
    
    console.log(`RSS ${source}: Found ${items.length} quality PE signals`);
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
// DIRECT HTML SCRAPER - Python scraper pattern (BeautifulSoup-like)
// ============================================================================
async function scrapeHTMLPage(pageUrl: string, source: string, region: string): Promise<any[]> {
  const items: any[] = [];
  
  try {
    const response = await fetch(pageUrl, {
      headers: { 
        "User-Agent": getRandomUserAgent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(10000), // 10s timeout like Python
    });
    
    if (!response.ok) {
      console.log(`HTML scrape failed for ${source}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    
    // Extract headlines from h1, h2, h3, and anchor tags (Python pattern)
    const headlinePatterns = [
      /<h1[^>]*>([\s\S]*?)<\/h1>/gi,
      /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
      /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
      /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    ];
    
    const baseUrl = new URL(pageUrl).origin;
    const foundLinks = new Set<string>();
    
    // Process heading tags (h1, h2, h3)
    for (let i = 0; i < 3; i++) {
      const pattern = headlinePatterns[i];
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const text = cleanHtml(match[1]).trim();
        if (text.length < 10 || text.split(/\s+/).length <= 3) continue;
        
        // Python filter: exclude privacy, sign in, terms, cookie
        const lowerText = text.toLowerCase();
        if (["privacy", "sign in", "terms", "cookie", "subscribe", "login"].some(kw => lowerText.includes(kw))) continue;
        
        // Python filter: must have PE keywords
        if (!PE_FILTER_KEYWORDS.some(kw => lowerText.includes(kw))) continue;
        if (EXCLUDED_TOPICS.some(topic => lowerText.includes(topic))) continue;
        
        // Quality check
        const quality = isQualitySignal(text, "", pageUrl);
        if (!quality.isQuality) continue;
        
        items.push({
          title: text,
          description: `Found on ${source}`,
          url: pageUrl,
          source,
          region,
          published_at: new Date().toISOString(),
        });
      }
    }
    
    // Process anchor tags with href
    const anchorPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let anchorMatch;
    while ((anchorMatch = anchorPattern.exec(html)) !== null) {
      let link = anchorMatch[1];
      const text = cleanHtml(anchorMatch[2]).trim();
      
      if (text.length < 10 || text.split(/\s+/).length <= 3) continue;
      
      // Resolve relative URLs
      if (link.startsWith("/")) {
        link = baseUrl + link;
      } else if (!link.startsWith("http")) {
        continue; // Skip invalid links
      }
      
      if (foundLinks.has(link)) continue;
      foundLinks.add(link);
      
      const lowerText = text.toLowerCase();
      if (["privacy", "sign in", "terms", "cookie", "subscribe", "login"].some(kw => lowerText.includes(kw))) continue;
      if (!PE_FILTER_KEYWORDS.some(kw => lowerText.includes(kw))) continue;
      if (EXCLUDED_TOPICS.some(topic => lowerText.includes(topic))) continue;
      
      const quality = isQualitySignal(text, "", link);
      if (!quality.isQuality) continue;
      
      items.push({
        title: text,
        description: `Found on ${source}`,
        url: link,
        source,
        region,
        published_at: new Date().toISOString(),
      });
    }
    
    console.log(`HTML scrape ${source}: Found ${items.length} PE signals`);
  } catch (error) {
    console.error(`HTML scrape error for ${source}:`, error);
  }
  
  return items.slice(0, 30); // Limit to 30 per source like Python
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

QUALITY RULES - IMPORTANT:
- Score 8-10: Clear deal/fund action with amount (e.g. "CVC to sell FineToday to Bain Capital for $1.29bn")
- Score 6-7: Clear deal/fund action without amount (e.g. "EQT backs healthcare platform expansion")
- Score 4-5: General hiring/office news with PE context
- Score 1-3: Vague or non-actionable (e.g. "Permira updates website", general market commentary)

REJECT (score 1-2) if:
- Just a company name with source (e.g. "Permira - FT Private Equity")
- Generic industry news without specific company action
- No clear hiring/deal/investment trigger

Your task:
1. Classify the signal into tier_1, tier_2, or tier_3
2. Assign a signal_type from the tier's types list
3. Rate your confidence 0-100
4. Score RELEVANCE 1-10 based on PE/FO hiring value
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
Source: ${signal.source}

Be STRICT - if this lacks actionable deal/hire context, score it LOW (1-3).` }
        ],
        temperature: 0.2,
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
  
  // Detect amounts for higher scoring
  const hasAmount = /€\d+|£\d+|\$\d+|\d+\s*(million|billion|m\b|bn\b)/i.test(text);
  
  // Tier 1 - Fund closes, acquisitions with clear context
  if ((text.includes("closes fund") || text.includes("final close") || text.includes("raises")) && hasAmount) {
    return { tier: "tier_1", signalType: "funding", confidence: 85, relevanceScore: 9, insight: "Fund close with disclosed amount indicates immediate team buildout", pitch: "Reach out about portfolio hiring needs" };
  }
  if ((text.includes("acquires") || text.includes("acquisition") || text.includes("buyout") || text.includes("sell") || text.includes("sale")) && hasAmount) {
    return { tier: "tier_1", signalType: "expansion", confidence: 80, relevanceScore: 9, insight: "Major transaction creates integration and expansion roles", pitch: "Discuss post-deal integration talent" };
  }
  if (text.includes("acquires") || text.includes("acquisition") || text.includes("buyout")) {
    return { tier: "tier_1", signalType: "expansion", confidence: 70, relevanceScore: 7, insight: "Acquisition creates integration roles", pitch: "Discuss post-merger integration talent" };
  }
  if (text.includes("new ceo") || text.includes("new cfo") || text.includes("appoints") || text.includes("names")) {
    return { tier: "tier_1", signalType: "c_suite", confidence: 75, relevanceScore: 7, insight: "C-suite change drives team restructuring", pitch: "Connect about building new leadership team" };
  }
  
  // Tier 2 - Office expansion, departures
  if (text.includes("opens office") || text.includes("expands to") || text.includes("expansion")) {
    return { tier: "tier_2", signalType: "expansion", confidence: 60, relevanceScore: 6, insight: "Office expansion requires local hiring", pitch: "Offer local market expertise" };
  }
  if (text.includes("departs") || text.includes("leaves") || text.includes("exits")) {
    return { tier: "tier_2", signalType: "c_suite", confidence: 55, relevanceScore: 6, insight: "Senior departure creates backfill need", pitch: "Present replacement candidates" };
  }
  if (text.includes("backs") || text.includes("invests") || text.includes("investment")) {
    return { tier: "tier_2", signalType: "funding", confidence: 60, relevanceScore: 6, insight: "Investment activity signals growth", pitch: "Discuss talent for portfolio growth" };
  }
  
  // Tier 3 - General (but only if has some context)
  if (QUALITY_ACTION_WORDS.some(w => text.includes(w))) {
    return { tier: "tier_3", signalType: "expansion", confidence: 45, relevanceScore: 5, insight: "General market activity worth monitoring", pitch: "Monitor for stronger signals" };
  }
  
  // Very low score for vague signals
  return { tier: "tier_3", signalType: "expansion", confidence: 20, relevanceScore: 2, insight: "Vague signal - needs verification", pitch: "Low priority" };
}

// ============================================================================
// COMPANY EXTRACTION
// ============================================================================
function extractCompany(text: string): string {
  const patterns = [
    /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+(?:closes|acquires|announces|launches|raises|completes|to\s+sell|to\s+buy)/i,
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
    const { region: targetRegion, includeRSS = true, includeFirecrawl = true, includeHTMLScrape = true } = body;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

    const regions = targetRegion ? [targetRegion] : ["london", "europe", "uae", "usa"];
    const allSignals: any[] = [];
    const stats = { rss: 0, firecrawl: 0, htmlScrape: 0, classified: 0, inserted: 0, skipped: 0, qualityRejected: 0 };

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

      // 1. RSS Feeds - use the new comprehensive feed system
      if (includeRSS) {
        const regionFeeds = getRSSSourcesForRegion(r);
        console.log(`Processing ${regionFeeds.length} RSS feeds for ${r}`);
        for (const feed of regionFeeds) {
          const items = await fetchRSSFeed(feed.url, feed.source, r);
          stats.rss += items.length;
          allSignals.push(...items);
        }
      }

      // 2. Direct HTML Scraping (Python scraper pattern) - for sources without RSS
      if (includeHTMLScrape) {
        const htmlSources = HTML_SCRAPE_SOURCES.filter(s => s.region === "global" || s.region === r);
        console.log(`Processing ${htmlSources.length} HTML scrape sources for ${r}`);
        for (const source of htmlSources) {
          const items = await scrapeHTMLPage(source.url, source.source, r);
          stats.htmlScrape += items.length;
          allSignals.push(...items);
        }
      }

      // 3. Firecrawl Deep Search with FT cookies
      if (includeFirecrawl && firecrawlApiKey) {
        const queries = FT_SEARCH_QUERIES[r as keyof typeof FT_SEARCH_QUERIES] || [];
        for (const query of queries.slice(0, 4)) {
          const results = await firecrawlDeepSearch(query, firecrawlApiKey, r);
          
          // Filter for valid URLs and PE relevance with quality check
          const validResults = results.filter(res => {
            if (!res.url || !res.url.startsWith("http")) return false;
            
            // Apply quality check
            const quality = isQualitySignal(res.title, res.description, res.url);
            if (!quality.isQuality) {
              console.log(`Firecrawl quality skip: ${quality.reason} - "${res.title?.substring(0, 50)}"`);
              stats.qualityRejected++;
              return false;
            }
            
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
    for (const signal of uniqueSignals.slice(0, 100)) {
      // STRICT: Skip signals without valid URL
      if (!signal.url || !signal.url.startsWith("http")) {
        stats.skipped++;
        continue;
      }

      // Final quality gate before classification
      const finalQuality = isQualitySignal(signal.title, signal.description, signal.url);
      if (!finalQuality.isQuality) {
        console.log(`Final quality skip: ${finalQuality.reason} - "${signal.title?.substring(0, 50)}"`);
        stats.qualityRejected++;
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
        score: classification.relevanceScore * 10,
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
          accuracy_percentage: 75,
        }, { onConflict: "date,region" });
    }

    const summary = {
      success: true,
      stats,
      message: `PE Scraper v2.3: RSS=${stats.rss}, HTML=${stats.htmlScrape}, Firecrawl=${stats.firecrawl}, Rejected=${stats.qualityRejected}, Inserted=${stats.inserted}, Skipped=${stats.skipped}`,
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
