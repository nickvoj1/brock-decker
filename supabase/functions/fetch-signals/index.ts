import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    cities: ["London", "City of London", "Canary Wharf", "Westminster"],
    locationFilter: "London",
  },
  europe: { 
    label: "Europe", 
    adzunaCountries: ["de", "fr", "nl", "be", "at", "ch", "it", "es", "se", "dk", "no", "pl"],
    cities: ["Berlin", "Paris", "Amsterdam", "Frankfurt", "Munich", "Zurich", "Milan", "Madrid", "Stockholm", "Copenhagen"],
    locationFilter: null,
  },
  uae: { 
    label: "UAE", 
    adzunaCountries: [],
    cities: ["Dubai", "Abu Dhabi", "Sharjah", "DIFC"],
    locationFilter: null,
  },
  usa: { 
    label: "USA", 
    adzunaCountries: ["us"],
    cities: ["New York", "Boston", "Chicago", "San Francisco", "Los Angeles", "Miami", "Dallas", "Houston", "Atlanta", "Denver"],
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
function detectTierAndType(text: string): { tier: string; signalType: string; score: number } | null {
  const lowerText = text.toLowerCase();
  
  // Check each tier in priority order
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
  
  return null;
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
  const keywords = "private equity OR venture capital OR recruiter OR talent acquisition OR investment OR fund OR portfolio OR M&A OR mergers";
  
  for (const country of regionConfig.adzunaCountries) {
    try {
      // Use location filter if specified (for London), otherwise use cities
      const locationQuery = regionConfig.locationFilter || regionConfig.cities.slice(0, 5).join(" OR ");
      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${adzunaAppId}&app_key=${adzunaAppKey}&what=${encodeURIComponent(keywords)}&where=${encodeURIComponent(locationQuery)}&results_per_page=100&max_days_old=30`;
      
      console.log(`Fetching Adzuna jobs for ${country}...`);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log(`Adzuna API error for ${country}: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const jobs = data.results || [];
      
      // Group by company and count
      const companyJobs: Record<string, any[]> = {};
      for (const job of jobs) {
        const company = job.company?.display_name || "Unknown";
        if (!companyJobs[company]) companyJobs[company] = [];
        companyJobs[company].push(job);
      }
      
      // Create signals for companies with multiple job postings
      for (const [company, companyJobList] of Object.entries(companyJobs)) {
        const jobCount = companyJobList.length;
        let tier = "tier_3";
        let score = 30;
        let signalType = "linkedin_hiring_posts";
        
        // Score based on job count (rapid_job_postings = 3+ roles in <30 days)
        if (jobCount >= 3) {
          tier = "tier_1";
          score = 90 + Math.min(jobCount, 10);
          signalType = "rapid_job_postings";
        } else if (jobCount >= 2) {
          tier = "tier_2";
          score = 60 + (jobCount * 5);
          signalType = "new_recruiter";
        } else {
          score = 30 + (jobCount * 10);
        }
        
        allJobs.push({
          title: `${company} has ${jobCount} open role${jobCount > 1 ? "s" : ""} in ${region.toUpperCase()}`,
          company: company,
          region: region,
          tier: tier,
          score: score,
          signal_type: signalType,
          description: `${company} is actively hiring with ${jobCount} open positions in the PE/VC/Recruitment space.`,
          source: "Adzuna Jobs",
          url: companyJobList[0]?.redirect_url || null,
          published_at: new Date().toISOString(),
          details: { 
            job_count: jobCount, 
            locations: [...new Set(companyJobList.map((j: any) => j.location?.display_name).filter(Boolean))],
            titles: companyJobList.slice(0, 5).map((j: any) => j.title),
          },
        });
      }
    } catch (error) {
      console.error(`Error fetching Adzuna jobs for ${country}:`, error);
    }
  }
  
  return allJobs;
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
    const cutoffDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days

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
            region: reg,
            tier: tierResult.tier,
            score: score,
            amount: amountData?.amount || null,
            currency: amountData?.currency || "EUR",
            signal_type: tierResult.signalType,
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

    // Deduplicate by URL and title
    const uniqueSignals = allSignals.filter((signal, index, self) =>
      index === self.findIndex(s => s.url === signal.url || s.title === signal.title)
    );

    console.log(`Unique signals after dedup: ${uniqueSignals.length}`);

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
