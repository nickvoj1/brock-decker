import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// VALID SIGNAL TYPES (must match database constraint)
// Valid values: 'funding', 'hiring', 'expansion', 'c_suite', 'team_growth'
// ============================================================================
const SIGNAL_TYPE_MAP: Record<string, string> = {
  // Tier 1 internal types -> DB types
  pe_vc_investment: "funding",
  fundraise_lbo: "funding",
  acquisition: "expansion",
  new_ceo_cfo_chro: "c_suite",
  new_fund_launch: "funding",
  portfolio_hiring: "hiring",
  rapid_job_postings: "hiring",
  // Tier 2 internal types -> DB types
  new_recruiter: "team_growth",
  office_expansion: "expansion",
  senior_churn: "c_suite",
  product_launch: "expansion",
  // Tier 3 internal types -> DB types
  linkedin_hiring_posts: "hiring",
  careers_page_refresh: "hiring",
  industry_events: "expansion",
};

function mapToValidSignalType(internalType: string): string {
  return SIGNAL_TYPE_MAP[internalType] || "expansion";
}

// ============================================================================
// TIER TAXONOMY - Hardcoded signal classification
// ============================================================================
const TIER_TAXONOMY = {
  tier_1: {
    name: "Tier 1 – Immediate Hiring Intent",
    color: "#ef4444", // red
    types: [
      "pe_vc_investment",
      "fundraise_lbo",
      "acquisition",
      "new_ceo_cfo_chro",
      "new_fund_launch",
      "portfolio_hiring",
      "rapid_job_postings",
    ],
    keywords: {
      pe_vc_investment: ["private equity", "pe investment", "vc investment", "venture capital investment", "growth equity", "buyout"],
      fundraise_lbo: ["closes fund", "closed fund", "final close", "first close", "lbo", "leveraged buyout", "fundraise", "raises fund", "closes €", "closes $", "closes £"],
      acquisition: ["acquires", "acquisition", "acquired", "buys", "bought", "takes over", "takeover", "merger"],
      new_ceo_cfo_chro: ["new ceo", "new cfo", "new chro", "appoints ceo", "names ceo", "hires ceo", "appoints cfo", "chief executive", "chief financial"],
      new_fund_launch: ["launches fund", "new fund", "debut fund", "inaugural fund", "fund launch", "first-time fund"],
      portfolio_hiring: ["portfolio company hiring", "portfolio expansion", "portco hiring", "portfolio talent"],
      rapid_job_postings: ["hiring spree", "multiple roles", "rapid hiring", "expanding team"],
    },
    minScore: 80,
  },
  tier_2: {
    name: "Tier 2 – Medium Intent",
    color: "#f59e0b", // amber
    types: [
      "new_recruiter",
      "office_expansion",
      "senior_churn",
      "product_launch",
    ],
    keywords: {
      new_recruiter: ["hires recruiter", "talent acquisition", "recruiting team", "hr hire", "people team"],
      office_expansion: ["opens office", "new office", "expands to", "expansion into", "establishes presence", "enters market"],
      senior_churn: ["senior departure", "executive leaves", "partner departs", "md exits", "leadership change"],
      product_launch: ["launches product", "new product", "product announcement", "service launch"],
    },
    minScore: 50,
  },
  tier_3: {
    name: "Tier 3 – Early Interest",
    color: "#22c55e", // green
    types: [
      "linkedin_hiring_posts",
      "careers_page_refresh",
      "industry_events",
    ],
    keywords: {
      linkedin_hiring_posts: ["hiring post", "we're hiring", "join our team", "looking for candidates", "open positions"],
      careers_page_refresh: ["careers page", "job portal", "new careers", "updated jobs"],
      industry_events: ["conference", "summit", "event", "webinar", "panel", "speaking at"],
    },
    minScore: 30,
  },
};

// ============================================================================
// REGION CONFIGURATION
// ============================================================================
const REGIONS = {
  london: { 
    label: "London", 
    adzunaCountries: ["gb"],
    cities: ["London", "City of London", "Canary Wharf", "Westminster", "Mayfair", "Bank"],
    locationFilter: "London",
  },
  europe: { 
    label: "Europe", 
    // Streamlined to key financial hubs (fewer countries = faster)
    adzunaCountries: ["de", "fr", "nl", "ch"],
    cities: ["Berlin", "Paris", "Amsterdam", "Frankfurt", "Munich", "Zurich"],
    locationFilter: null,
  },
  uae: { 
    label: "UAE", 
    // UAE not covered by Adzuna - relies on RSS feeds only
    adzunaCountries: [],
    cities: ["Dubai", "Abu Dhabi", "Sharjah", "DIFC", "ADGM"],
    locationFilter: null,
  },
  usa: { 
    label: "USA", 
    adzunaCountries: ["us"],
    cities: ["New York", "Boston", "Chicago", "San Francisco", "Los Angeles", "Miami", "Dallas", "Houston", "Atlanta", "Denver", "Seattle", "Washington DC", "Charlotte", "Philadelphia"],
    locationFilter: null,
  },
};

// ============================================================================
// RSS FEEDS BY REGION
// ============================================================================
const RSS_FEEDS = {
  london: [
    { url: "https://www.privateequitywire.co.uk/feed/", source: "PE Wire UK" },
    { url: "https://www.cityam.com/feed/", source: "City AM" },
    { url: "https://feeds.reuters.com/reuters/UKBusinessNews", source: "Reuters UK" },
    { url: "https://www.ft.com/rss/home/uk", source: "FT UK" },
    { url: "https://www.theguardian.com/business/rss", source: "Guardian Business" },
    { url: "https://www.standard.co.uk/business/rss", source: "Evening Standard" },
    { url: "https://realdeals.eu.com/feed/", source: "Real Deals" },
    { url: "https://www.altassets.net/feed", source: "AltAssets" },
    { url: "https://www.investmentweek.co.uk/rss", source: "Investment Week" },
    { url: "https://www.penews.com/rss", source: "PE News" },
  ],
  europe: [
    { url: "https://sifted.eu/feed", source: "Sifted" },
    { url: "https://www.eu-startups.com/feed/", source: "EU-Startups" },
    { url: "https://tech.eu/feed", source: "Tech.eu" },
    { url: "https://www.dealroom.co/blog/feed", source: "Dealroom" },
    { url: "https://www.handelsblatt.com/rss/finance", source: "Handelsblatt" },
    { url: "https://www.manager-magazin.de/rss/", source: "Manager Magazin" },
    { url: "https://www.lesechos.fr/rss/finance.xml", source: "Les Echos" },
    { url: "https://fd.nl/rss/financien", source: "FD Netherlands" },
    { url: "https://www.swissinfo.ch/eng/business/rss", source: "SwissInfo" },
    { url: "https://www.thelocal.de/rss/business", source: "The Local DE" },
  ],
  uae: [
    { url: "https://gulfbusiness.com/feed/", source: "Gulf Business" },
    { url: "https://www.arabianbusiness.com/feed/", source: "Arabian Business" },
    { url: "https://gulfnews.com/rss/business", source: "Gulf News" },
    { url: "https://www.thenationalnews.com/business/rss", source: "The National" },
    { url: "https://www.zawya.com/rss/", source: "Zawya" },
    { url: "https://www.khaleejtimes.com/rss/business", source: "Khaleej Times" },
    { url: "https://www.middleeastmonitor.com/feed/", source: "ME Monitor" },
    { url: "https://wam.ae/en/rss/economy", source: "WAM Economy" },
  ],
  usa: [
    { url: "https://www.pehub.com/feed/", source: "PE Hub" },
    { url: "https://www.buyoutsinsider.com/feed/", source: "Buyouts Insider" },
    { url: "https://feeds.bloomberg.com/markets/news.rss", source: "Bloomberg" },
    { url: "https://news.crunchbase.com/feed/", source: "Crunchbase News" },
    { url: "https://techcrunch.com/category/venture/feed/", source: "TechCrunch VC" },
    { url: "https://fortune.com/feed/fortune-feeds/?id=3230629", source: "Fortune" },
    { url: "https://pitchbook.com/rss/news", source: "PitchBook" },
    { url: "https://www.wsj.com/xml/rss/3_7014.xml", source: "WSJ PE" },
    { url: "https://www.axios.com/pro/deal-feed.rss", source: "Axios Pro Deals" },
    { url: "https://www.institutionalinvestor.com/rss", source: "Institutional Investor" },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Location keywords for region detection
const LONDON_KEYWORDS = [
  "london", "uk", "united kingdom", "britain", "british", "england", "city of london",
  "canary wharf", "mayfair", "westminster", "ftse", "lse", "bank of england"
];

const USA_KEYWORDS = [
  "us", "usa", "united states", "america", "american", "new york", "nyc", "boston",
  "san francisco", "silicon valley", "wall street", "nasdaq", "s&p", "california",
  "texas", "chicago", "los angeles", "miami", "seattle", "washington dc"
];

const UAE_KEYWORDS = [
  "dubai", "abu dhabi", "uae", "emirates", "gulf", "middle east", "difc", "adgm",
  "sharjah", "qatar", "saudi", "bahrain", "kuwait", "oman"
];

const EUROPE_KEYWORDS = [
  "berlin", "paris", "frankfurt", "amsterdam", "munich", "zurich", "milan", "madrid",
  "stockholm", "copenhagen", "vienna", "brussels", "luxembourg", "dublin", "germany",
  "france", "netherlands", "switzerland", "italy", "spain", "sweden", "norway", "denmark"
];

// STRICT region detection - must match feed region OR clearly match content region
// No cross-region pollution allowed (e.g., USA news cannot appear in London)
function detectRegionFromContent(text: string, feedRegion: string): string | null {
  const lowerText = text.toLowerCase();
  
  // Count matches for each region
  const londonMatches = LONDON_KEYWORDS.filter(kw => lowerText.includes(kw)).length;
  const usaMatches = USA_KEYWORDS.filter(kw => lowerText.includes(kw)).length;
  const uaeMatches = UAE_KEYWORDS.filter(kw => lowerText.includes(kw)).length;
  const europeMatches = EUROPE_KEYWORDS.filter(kw => lowerText.includes(kw)).length;
  
  // Find the dominant region in content
  const scores = [
    { region: "london", score: londonMatches * 2 }, // London is more specific, higher weight
    { region: "usa", score: usaMatches },
    { region: "uae", score: uaeMatches },
    { region: "europe", score: europeMatches },
  ];
  
  const maxScore = Math.max(...scores.map(s => s.score));
  const dominantRegion = maxScore > 0 ? scores.find(s => s.score === maxScore)!.region : null;
  
  // STRICT RULE: If content clearly mentions a different region, reject the signal
  // This prevents USA news appearing in London feed, etc.
  if (dominantRegion && dominantRegion !== feedRegion) {
    // Check if the non-matching region has strong enough signal
    if (maxScore >= 2) {
      console.log(`Region mismatch: feed=${feedRegion}, content=${dominantRegion}, rejecting`);
      return null; // Reject - wrong region
    }
  }
  
  // If content matches feed region or no strong region detected, use feed region
  return feedRegion;
}

// ============================================================================
// STRICT SECTOR WHITELIST - Only these financial sectors are relevant
// ============================================================================
const ALLOWED_SECTORS = [
  // Private Equity
  "private equity", "pe fund", "buyout", "lbo", "leveraged buyout", "growth equity",
  "portco", "portfolio company", "mid-market", "lower middle market", "upper middle market",
  // Venture Capital
  "venture capital", "vc fund", "seed fund", "series a", "series b", "series c", 
  "early stage", "growth stage", "startup fund", "tech investor",
  // Banks / Investment Banking
  "investment bank", "merchant bank", "bulge bracket", "boutique bank", 
  "m&a advisory", "capital markets", "corporate finance", "leveraged finance",
  "goldman sachs", "morgan stanley", "jpmorgan", "jp morgan", "barclays", "hsbc",
  "deutsche bank", "ubs", "credit suisse", "lazard", "rothschild", "evercore",
  "moelis", "centerview", "pjt partners", "perella weinberg", "greenhill",
  // FinTech
  "fintech", "financial technology", "payments", "neobank", "digital bank",
  "insurtech", "wealthtech", "regtech", "proptech", "lending platform",
  // Consultancies (Strategy/Big 4)
  "mckinsey", "bain", "boston consulting", "bcg", "kearney", "oliver wyman",
  "roland berger", "strategy&", "pwc", "deloitte", "kpmg", "ey ", "ernst & young",
  "accenture", "alvarez & marsal", "fti consulting",
  // Secondaries
  "secondaries", "secondary fund", "secondary market", "gp-led", "lp-led",
  "continuation fund", "continuation vehicle", "direct secondary", "preferred equity",
  // Related Financial Terms
  "fund close", "closes fund", "raises fund", "capital raise", "fund launch",
  "aum", "assets under management", "dry powder", "carried interest", "co-invest",
  "infrastructure fund", "credit fund", "debt fund", "real estate fund", "real assets",
  "hedge fund", "asset management", "wealth management", "family office",
];

// EXCLUDED: Companies/topics that are NOT relevant
const EXCLUDED_COMPANIES = [
  // Gaming/Entertainment
  "playstation", "xbox", "nintendo", "activision", "blizzard", "ea sports", "ubisoft",
  "netflix", "disney", "warner", "paramount", "sony pictures", "universal studios",
  "spotify", "tiktok", "snapchat", "twitter", "reddit",
  // Consumer tech giants (not PE/VC focused)
  "apple", "google", "meta", "facebook", "amazon", "microsoft", "tesla", "spacex",
  "uber", "lyft", "airbnb", "doordash", "instacart",
  // Retail/Consumer
  "nike", "adidas", "coca-cola", "pepsi", "mcdonalds", "starbucks", "walmart", "target",
  "ikea", "zara", "h&m", "uniqlo", "costco", "home depot", "lowes",
  // Automotive
  "ford", "gm", "general motors", "toyota", "honda", "bmw", "mercedes", "volkswagen",
  "rivian", "lucid", "nio", "ferrari", "porsche",
  // Pharma/Healthcare (unless PE-backed)
  "pfizer", "moderna", "johnson & johnson", "merck", "novartis", "roche", "astrazeneca",
  // Airlines/Travel
  "delta", "united airlines", "american airlines", "lufthansa", "ryanair", "easyjet",
  "marriott", "hilton", "hyatt",
  // Telecom/Media
  "at&t", "verizon", "t-mobile", "vodafone", "bt group", "comcast", "sky",
];

// EXCLUDED: News topics that are NOT relevant
const EXCLUDED_TOPICS = [
  // Politics
  "customs union", "brexit", "parliament", "election", "senate", "congress",
  "white house", "downing street", "european commission", "nato", "un ",
  "immigration", "border", "tariff", "sanctions", "trade war", "political",
  "trump", "biden", "starmer", "sunak", "macron", "scholz", "putin", "zelensky",
  // General news
  "weather", "climate crisis", "earthquake", "hurricane", "flood", "wildfire",
  "sports", "championship", "world cup", "olympics", "premier league", "nfl", "nba",
  "celebrity", "entertainment", "movie", "film release", "album", "concert",
  "royal family", "prince", "princess", "king charles",
  // Crime/Accidents
  "murder", "shooting", "crash", "accident", "arrested", "trial", "prison",
  "terror", "attack", "war ", "military",
];

function isRelevantToFinancialSectors(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Check for excluded companies
  for (const excluded of EXCLUDED_COMPANIES) {
    if (lowerText.includes(excluded)) {
      return false;
    }
  }
  
  // Check for excluded topics
  for (const excluded of EXCLUDED_TOPICS) {
    if (lowerText.includes(excluded)) {
      return false;
    }
  }
  
  // MUST match at least one allowed sector keyword
  const matchesSector = ALLOWED_SECTORS.some(sector => lowerText.includes(sector));
  return matchesSector;
}

function detectTierAndType(text: string): { tier: string; signalType: string; score: number } | null {
  const lowerText = text.toLowerCase();
  
  // FIRST: Check if relevant to financial sectors
  if (!isRelevantToFinancialSectors(lowerText)) {
    return null; // Skip entirely - not in allowed sectors
  }
  
  // Check each tier in priority order - strict matching
  for (const [tierKey, tierConfig] of Object.entries(TIER_TAXONOMY)) {
    for (const [signalType, keywords] of Object.entries(tierConfig.keywords)) {
      const matchCount = keywords.filter((kw: string) => lowerText.includes(kw)).length;
      if (matchCount > 0) {
        // Calculate score based on matches and tier
        let score = tierConfig.minScore + (matchCount * 5);
        score = Math.min(score, 100);
        return { tier: tierKey, signalType, score };
      }
    }
  }
  
  // If passed sector filter but no tier match, assign tier_3
  return { tier: "tier_3", signalType: "industry_events", score: 35 };
}

function extractAmount(text: string): { amount: number; currency: string } | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:billion|bn|b)\s*(?:dollar|usd|\$|euro|eur|€|pound|gbp|£)?/i,
    /\$(\d+(?:\.\d+)?)\s*(?:billion|bn|b)/i,
    /€(\d+(?:\.\d+)?)\s*(?:billion|bn|b)/i,
    /£(\d+(?:\.\d+)?)\s*(?:billion|bn|b)/i,
    /(\d+(?:\.\d+)?)\s*(?:million|mn|m)\s*(?:dollar|usd|\$|euro|eur|€|pound|gbp|£)?/i,
    /\$(\d+(?:\.\d+)?)\s*(?:million|mn|m)/i,
    /€(\d+(?:\.\d+)?)\s*(?:million|mn|m)/i,
    /£(\d+(?:\.\d+)?)\s*(?:million|mn|m)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let value = parseFloat(match[1]);
      const fullMatch = match[0].toLowerCase();
      
      const isBillion = fullMatch.includes("billion") || fullMatch.includes("bn") || 
        (fullMatch.includes("b") && !fullMatch.includes("m"));
      
      if (isBillion) value *= 1000;
      
      let currency = "USD";
      if (text.includes("€") || text.toLowerCase().includes("euro")) currency = "EUR";
      else if (text.includes("£") || text.toLowerCase().includes("pound")) currency = "GBP";
      
      return { amount: value, currency };
    }
  }
  return null;
}

function extractCompany(title: string, description: string = ""): string | null {
  const cleanTitle = title
    .replace(/^(breaking|exclusive|update|report|news|watch):\s*/i, "")
    .trim();
  
  const verbPattern = /^([A-Z][A-Za-z0-9''\-\.&\s]{1,40}?)\s+(?:raises|closes|secures|announces|completes|launches|acquires|enters|targets|opens|hires|appoints|names|promotes|backs|invests|exits|sells|buys|takes)/i;
  
  const match = cleanTitle.match(verbPattern);
  if (match) {
    let company = match[1].trim().replace(/['']s$/i, "");
    const skipPhrases = ["the", "a", "an", "new", "report", "update"];
    if (!skipPhrases.some(p => company.toLowerCase() === p)) {
      if (company.length >= 2 && company.length <= 50) {
        return company;
      }
    }
  }
  
  const fundPatterns = [
    /([A-Z][A-Za-z0-9\s&]{2,25}?(?:Capital|Partners|Ventures|Equity|Investment|Advisors|Management|Group))\s+(?:closes|raises|launches)/i,
    /:\s*([A-Z][A-Za-z0-9\-\.&\s]{2,30}?)\s+(?:raises|closes|announces)/i,
  ];
  
  for (const pattern of fundPatterns) {
    const fundMatch = title.match(pattern);
    if (fundMatch) return fundMatch[1].trim();
  }
  
  return null;
}

async function parseRSSFeed(url: string): Promise<any[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BrockDeckerBot/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
    });
    
    if (!response.ok) return [];
    
    const xml = await response.text();
    const items: any[] = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
    
    for (const match of itemMatches) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i);
      const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
      const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/i);
      
      if (titleMatch) {
        items.push({
          title: titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
          url: linkMatch ? linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : null,
          description: descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]*>/g, "").trim().slice(0, 500) : null,
          published_at: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : null,
        });
      }
    }
    
    return items;
  } catch (error) {
    console.error(`Error parsing RSS feed ${url}:`, error);
    return [];
  }
}

// ============================================================================
// ADZUNA JOB SIGNAL FETCHING - STREAMLINED FOR SPEED
// ============================================================================

// Consolidated search strategies (fewer API calls = faster response)
const ADZUNA_SEARCH_STRATEGIES = [
  // Combined PE/VC and leadership roles
  { keywords: "private equity OR venture capital OR investment manager", weight: 1.5 },
  { keywords: "CEO OR CFO OR managing director OR chief", weight: 1.6 },
  { keywords: "talent acquisition OR recruiter OR HR director", weight: 1.5 },
  { keywords: "M&A OR corporate development OR finance director", weight: 1.4 },
];

// Senior title keywords for scoring boost
const SENIOR_TITLE_KEYWORDS = [
  "director", "head of", "vp", "vice president", "chief", "ceo", "cfo", "coo", "chro",
  "partner", "managing director", "md", "principal", "senior", "lead", "manager"
];

// PE/VC company indicators for quality boost
const PE_VC_COMPANY_INDICATORS = [
  "capital", "partners", "ventures", "equity", "investment", "advisors", "management",
  "asset", "fund", "holdings", "private", "growth"
];

async function fetchAdzunaJobs(region: string): Promise<any[]> {
  const adzunaAppId = Deno.env.get("ADZUNA_APP_ID");
  const adzunaAppKey = Deno.env.get("ADZUNA_APP_KEY");
  
  if (!adzunaAppId || !adzunaAppKey) {
    console.log("Adzuna API keys not configured, skipping job signals");
    return [];
  }
  
  const regionConfig = REGIONS[region as keyof typeof REGIONS];
  if (!regionConfig || regionConfig.adzunaCountries.length === 0) {
    return [];
  }
  
  const allJobs: any[] = [];
  const seenJobIds = new Set<string>();
  
  for (const country of regionConfig.adzunaCountries) {
    // Run search strategies (streamlined for speed)
    for (const strategy of ADZUNA_SEARCH_STRATEGIES) {
      try {
        // Fetch only page 1 for speed (50 results per strategy)
        const locationQuery = regionConfig.locationFilter || regionConfig.cities.slice(0, 4).join(" OR ");
        const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${adzunaAppId}&app_key=${adzunaAppKey}&what=${encodeURIComponent(strategy.keywords)}&where=${encodeURIComponent(locationQuery)}&results_per_page=50&max_days_old=30&sort_by=date`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          if (response.status === 429) {
            console.log(`Adzuna rate limited for ${country}, skipping...`);
          }
          continue;
        }
        
        const data = await response.json();
        const jobs = data.results || [];
        
        // Add jobs avoiding duplicates
        for (const job of jobs) {
          const jobId = job.id || `${job.title}-${job.company?.display_name}`;
          if (!seenJobIds.has(jobId)) {
            seenJobIds.add(jobId);
            allJobs.push({ ...job, strategyWeight: strategy.weight });
          }
        }
        
      } catch (error) {
        console.error(`Error fetching Adzuna for ${country}:`, error);
      }
    }
  }
  
  console.log(`Adzuna collected ${allJobs.length} raw jobs for ${region}`);
  
  // Group by company and analyze
  const companyJobs: Record<string, any[]> = {};
  for (const job of allJobs) {
    const company = job.company?.display_name || "Unknown";
    if (company === "Unknown" || company.length < 2) continue;
    if (!companyJobs[company]) companyJobs[company] = [];
    companyJobs[company].push(job);
  }
  
  // Convert to signals with enhanced scoring
  const signals: any[] = [];
  
  for (const [company, companyJobList] of Object.entries(companyJobs)) {
    // FILTER: Skip excluded companies
    const lowerCompany = company.toLowerCase();
    const isExcluded = EXCLUDED_COMPANIES.some(exc => lowerCompany.includes(exc));
    if (isExcluded) {
      console.log(`Skipping excluded company: ${company}`);
      continue;
    }
    
    // FILTER: Must match at least one allowed sector
    const companyText = `${company} ${companyJobList.map((j: any) => j.title || "").join(" ")}`;
    if (!isRelevantToFinancialSectors(companyText)) {
      console.log(`Skipping non-financial company: ${company}`);
      continue;
    }
    
    const jobCount = companyJobList.length;
    
    // Calculate quality score based on multiple factors
    let baseScore = 30;
    let tier = "tier_3";
    let signalType = "linkedin_hiring_posts";
    
    // Factor 1: Job count (primary signal)
    if (jobCount >= 5) {
      baseScore = 95;
      tier = "tier_1";
      signalType = "rapid_job_postings";
    } else if (jobCount >= 3) {
      baseScore = 85;
      tier = "tier_1";
      signalType = "rapid_job_postings";
    } else if (jobCount >= 2) {
      baseScore = 65;
      tier = "tier_2";
      signalType = "new_recruiter";
    } else {
      baseScore = 40;
    }
    
    // Factor 2: Senior roles boost
    const seniorRoleCount = companyJobList.filter((j: any) => 
      SENIOR_TITLE_KEYWORDS.some(kw => j.title?.toLowerCase().includes(kw))
    ).length;
    if (seniorRoleCount >= 2) {
      baseScore = Math.min(baseScore + 15, 100);
      if (tier !== "tier_1") {
        tier = "tier_1";
        signalType = "new_ceo_cfo_chro";
      }
    } else if (seniorRoleCount >= 1) {
      baseScore = Math.min(baseScore + 8, 100);
    }
    
    // Factor 3: PE/VC company indicator boost
    const isPEVCCompany = PE_VC_COMPANY_INDICATORS.some(ind => 
      company.toLowerCase().includes(ind)
    );
    if (isPEVCCompany) {
      baseScore = Math.min(baseScore + 10, 100);
    }
    
    // Factor 4: Average strategy weight boost
    const avgWeight = companyJobList.reduce((sum: number, j: any) => sum + (j.strategyWeight || 1), 0) / jobCount;
    baseScore = Math.min(Math.round(baseScore * avgWeight), 100);
    
    // Build rich description
    const uniqueTitles = [...new Set(companyJobList.slice(0, 5).map((j: any) => j.title))];
    const uniqueLocations = [...new Set(companyJobList.map((j: any) => j.location?.display_name).filter(Boolean))];
    
    const roleTypeSummary = seniorRoleCount > 0 
      ? `including ${seniorRoleCount} senior/leadership role${seniorRoleCount > 1 ? "s" : ""}`
      : "across various levels";
    
    signals.push({
      title: `${company} is hiring: ${jobCount} open role${jobCount > 1 ? "s" : ""} ${roleTypeSummary}`,
      company: company,
      region: region,
      tier: tier,
      score: baseScore,
      signal_type: mapToValidSignalType(signalType),
      description: `${company} is actively expanding with ${jobCount} open positions. Roles include: ${uniqueTitles.join(", ")}. Locations: ${uniqueLocations.join(", ") || region.toUpperCase()}.`,
      source: "Adzuna Jobs",
      url: companyJobList[0]?.redirect_url || null,
      published_at: new Date().toISOString(),
      is_high_intent: tier === "tier_1",
      details: { 
        job_count: jobCount,
        senior_role_count: seniorRoleCount,
        is_pe_vc_company: isPEVCCompany,
        locations: uniqueLocations,
        titles: uniqueTitles,
        avg_strategy_weight: avgWeight,
      },
    });
  }
  
  console.log(`Adzuna generated ${signals.length} signals for ${region}`);
  return signals;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { region } = await req.json().catch(() => ({ region: null }));
    
    const regionsToFetch = region ? [region] : Object.keys(REGIONS);
    const allSignals: any[] = [];
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days lookback for more signals

    // Fetch from RSS feeds
    for (const reg of regionsToFetch) {
      const feeds = RSS_FEEDS[reg as keyof typeof RSS_FEEDS] || [];
      
      for (const feed of feeds) {
        console.log(`Fetching ${feed.source} for ${reg}...`);
        const items = await parseRSSFeed(feed.url);
        console.log(`  Found ${items.length} items from ${feed.source}`);
        
        for (const item of items) {
          if (item.published_at && new Date(item.published_at) < cutoffDate) continue;
          
          const fullText = `${item.title} ${item.description || ""}`;
          const tierResult = detectTierAndType(fullText);
          
          if (!tierResult) continue;
          
          const amountData = extractAmount(fullText);
          const company = extractCompany(item.title, item.description);
          
          // STRICT: Detect region and reject if content belongs to different region
          const validatedRegion = detectRegionFromContent(fullText, reg);
          if (!validatedRegion) {
            console.log(`Skipping signal due to region mismatch: ${item.title.slice(0, 50)}...`);
            continue; // Skip - wrong region content
          }
          
          // Boost score for fund closes with large amounts
          let score = tierResult.score;
          if (amountData) {
            if (amountData.amount >= 1000) score = Math.min(score + 15, 100);
            else if (amountData.amount >= 500) score = Math.min(score + 10, 100);
            else if (amountData.amount >= 100) score = Math.min(score + 5, 100);
          }
          
          allSignals.push({
            title: item.title.slice(0, 255),
            company: company,
            region: validatedRegion,
            tier: tierResult.tier,
            score: score,
            amount: amountData?.amount || null,
            currency: amountData?.currency || "EUR",
            signal_type: mapToValidSignalType(tierResult.signalType),
            description: item.description?.slice(0, 500) || null,
            url: item.url,
            source: feed.source,
            published_at: item.published_at || now.toISOString(),
            is_high_intent: tierResult.tier === "tier_1",
            details: {},
          });
        }
      }
      
      // Fetch Adzuna jobs for the region
      const adzunaSignals = await fetchAdzunaJobs(reg);
      allSignals.push(...adzunaSignals);
    }

    console.log(`Total signals collected: ${allSignals.length}`);

    // ENHANCED DEDUPLICATION: By URL, exact title, and normalized company+type combo
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const seenCompanySignals = new Set<string>();
    
    const uniqueSignals = allSignals.filter((signal) => {
      // Skip if URL already seen
      if (signal.url && seenUrls.has(signal.url)) {
        return false;
      }
      
      // Skip if exact title already seen
      const normalizedTitle = signal.title.toLowerCase().trim();
      if (seenTitles.has(normalizedTitle)) {
        return false;
      }
      
      // Skip if same company + signal type already seen (prevents near-duplicates)
      if (signal.company) {
        const companyKey = `${signal.company.toLowerCase()}_${signal.signal_type}_${signal.region}`;
        if (seenCompanySignals.has(companyKey)) {
          return false;
        }
        seenCompanySignals.add(companyKey);
      }
      
      if (signal.url) seenUrls.add(signal.url);
      seenTitles.add(normalizedTitle);
      return true;
    });

    console.log(`Unique signals after enhanced dedup: ${uniqueSignals.length}`);

    let insertedCount = 0;
    if (uniqueSignals.length > 0) {
      for (const signal of uniqueSignals) {
        const { data: existing } = await supabase
          .from("signals")
          .select("id")
          .or(`url.eq.${signal.url},title.eq.${signal.title}`)
          .maybeSingle();
        
        if (!existing) {
          const { error } = await supabase.from("signals").insert(signal);
          if (!error) insertedCount++;
          else console.error("Insert error:", error);
        }
      }
    }

    console.log(`Inserted ${insertedCount} new signals`);

    // Get counts by region and tier
    const { data: counts } = await supabase
      .from("signals")
      .select("region, tier")
      .eq("is_dismissed", false)
      .gte("published_at", cutoffDate.toISOString());
    
    const regionCounts: Record<string, number> = {};
    const tierCounts: Record<string, number> = { tier_1: 0, tier_2: 0, tier_3: 0 };
    (counts || []).forEach((s: any) => {
      regionCounts[s.region] = (regionCounts[s.region] || 0) + 1;
      if (s.tier) tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1;
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        fetched: insertedCount,
        regionCounts,
        tierCounts,
        message: `Processed ${uniqueSignals.length} signals, inserted ${insertedCount} new`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Fetch signals error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
