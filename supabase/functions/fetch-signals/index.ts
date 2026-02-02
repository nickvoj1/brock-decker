import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// RSS Feed configurations by region - Focused on PE/VC/Fund news
const RSS_FEEDS = {
  europe: [
    // PE-specific sources
    { url: "https://www.privateequitywire.co.uk/feed/", source: "PE Wire EU" },
    { url: "https://www.altassets.net/feed", source: "AltAssets" },
    { url: "https://sifted.eu/feed", source: "Sifted" },
    { url: "https://www.eu-startups.com/feed/", source: "EU-Startups" },
    { url: "https://www.fintechfutures.com/feed/", source: "FinTech Futures" },
  ],
  uae: [
    { url: "https://gulfbusiness.com/feed/", source: "Gulf Business" },
    { url: "https://www.arabianbusiness.com/rss", source: "Arabian Business" },
    { url: "https://www.zawya.com/mena/en/rss/", source: "Zawya" },
  ],
  east_usa: [
    { url: "https://www.pehub.com/feed/", source: "PE Hub" },
    { url: "https://pitchbook.com/rss/news", source: "PitchBook" },
    { url: "https://www.buyoutsinsider.com/feed/", source: "Buyouts Insider" },
    { url: "https://www.institutionalinvestor.com/Feed/Index/", source: "Institutional Investor" },
  ],
  west_usa: [
    { url: "https://news.crunchbase.com/feed/", source: "Crunchbase News" },
    { url: "https://techcrunch.com/category/venture/feed/", source: "TechCrunch VC" },
    { url: "https://www.pehub.com/feed/", source: "PE Hub" },
  ],
};

// Fund types we care about (for classification)
const FUND_TYPES = {
  private_equity: ["private equity", "pe fund", "buyout", "lbo", "leveraged buyout", "growth equity", "mid-market"],
  venture_capital: ["venture capital", "vc fund", "seed fund", "early stage", "series a", "series b", "series c", "growth stage"],
  infrastructure: ["infrastructure fund", "infra fund", "real assets", "renewable energy fund", "energy transition"],
  credit: ["private credit", "direct lending", "credit fund", "debt fund", "clo", "mezzanine", "distressed debt"],
  real_estate: ["real estate fund", "property fund", "reit"],
  secondaries: ["secondaries", "secondary fund", "gp-led", "continuation fund"],
};

// Keywords for PE/Fund-specific signal detection - prioritized order
const PE_SIGNAL_KEYWORDS = {
  // Fund closes - HIGHEST PRIORITY (signals deployment = hiring)
  fund_close: [
    "closes fund", "closed fund", "final close", "first close", "closes on",
    "raised fund", "reaches close", "completes fundraise", "fundraising close",
    "closes at", "closes oversubscribed", "hard cap", "exceeds target",
    "closes €", "closes $", "closes £", "committed capital",
    "fund iii", "fund iv", "fund v", "fund vi", "fund vii", "fund viii",
  ],
  // New fund launches
  new_fund: [
    "launches fund", "launching fund", "new fund", "debut fund", "inaugural fund",
    "announces fund", "raising fund", "begins fundraising", "seeks to raise",
    "targets €", "targets $", "targeting", "fundraising for",
  ],
  // Deal activity - indicates deployment = need for deal team
  deal: [
    "acquires", "acquisition", "acquired", "buys", "bought", "takes stake",
    "invests in", "investment in", "backs", "backed by", "leads round",
    "co-invest", "platform investment", "add-on", "bolt-on",
    "majority stake", "minority stake", "growth investment",
  ],
  // Exits - indicates capital return = new fund coming
  exit: [
    "exits", "exit from", "sells stake", "sale of", "divests", "divestiture",
    "ipo", "goes public", "secondary sale", "trade sale",
    "returns", "multiple", "realized", "distributions",
  ],
  // Office/Team expansion - direct hiring signal
  expansion: [
    "opens office", "new office", "expands to", "expands into", "enters market",
    "hires", "appoints", "names", "promotes", "joins as", "recruits",
    "builds team", "growing team", "headcount",
  ],
  // Senior hires at funds - indicates growth
  senior_hire: [
    "partner", "managing director", "md joins", "principal", "operating partner",
    "head of", "chief", "ceo", "cfo", "coo", "cio",
    "investment director", "portfolio director",
  ],
};

// Amount extraction patterns - improved for fund sizes
const AMOUNT_PATTERNS = [
  // Billions first (more specific)
  /(\d+(?:\.\d+)?)\s*(?:billion|bn|b)\s*(?:dollar|usd|\$|euro|eur|€|pound|gbp|£)?/i,
  /\$(\d+(?:\.\d+)?)\s*(?:billion|bn|b)/i,
  /€(\d+(?:\.\d+)?)\s*(?:billion|bn|b)/i,
  /£(\d+(?:\.\d+)?)\s*(?:billion|bn|b)/i,
  // Millions
  /(\d+(?:\.\d+)?)\s*(?:million|mn|m)\s*(?:dollar|usd|\$|euro|eur|€|pound|gbp|£)?/i,
  /\$(\d+(?:\.\d+)?)\s*(?:million|mn|m)/i,
  /€(\d+(?:\.\d+)?)\s*(?:million|mn|m)/i,
  /£(\d+(?:\.\d+)?)\s*(?:million|mn|m)/i,
  // Currency symbols with numbers
  /\$(\d+(?:\.\d+)?)\s*(million|m|billion|b)/i,
  /€(\d+(?:\.\d+)?)\s*(million|m|billion|b)/i,
  /£(\d+(?:\.\d+)?)\s*(million|m|billion|b)/i,
];

function extractAmount(text: string): { amount: number; currency: string } | null {
  const lowerText = text.toLowerCase();
  
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let value = parseFloat(match[1]);
      const unitPart = match[2]?.toLowerCase() || "";
      const fullMatch = match[0].toLowerCase();
      
      // Determine if billion or million
      const isBillion = fullMatch.includes("billion") || fullMatch.includes("bn") || 
        (unitPart === "b") || (fullMatch.includes("b") && !fullMatch.includes("m"));
      
      if (isBillion) {
        value *= 1000; // Convert to millions for consistency
      }
      
      // Determine currency
      let currency = "USD";
      if (text.includes("€") || lowerText.includes("euro") || lowerText.includes("eur")) currency = "EUR";
      else if (text.includes("£") || lowerText.includes("pound") || lowerText.includes("gbp")) currency = "GBP";
      
      return { amount: value, currency };
    }
  }
  return null;
}

function detectSignalType(text: string): { type: string; confidence: number } | null {
  const lowerText = text.toLowerCase();
  
  // Check PE-specific signals first (in priority order)
  for (const [type, keywords] of Object.entries(PE_SIGNAL_KEYWORDS)) {
    const matchCount = keywords.filter(keyword => lowerText.includes(keyword)).length;
    if (matchCount > 0) {
      // Higher confidence for more keyword matches
      const confidence = Math.min(matchCount * 0.3 + 0.4, 1.0);
      return { type, confidence };
    }
  }
  
  return null;
}

function detectFundType(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  for (const [fundType, keywords] of Object.entries(FUND_TYPES)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return fundType;
    }
  }
  return null;
}

function extractFundOrCompany(title: string, description: string = ""): string | null {
  const fullText = `${title} ${description}`;
  
  // PE/VC fund name patterns - look for "Capital", "Partners", "Ventures", etc.
  const fundPatterns = [
    // "XYZ Capital closes €500M fund"
    /^([A-Z][A-Za-z0-9\s&]+?(?:Capital|Partners|Ventures|Equity|Investment|Asset|Management|Advisors|Fund))\s+(?:closes|raises|launches|announces|completes|reaches)/i,
    // "Fund manager XYZ closes..."
    /(?:fund manager|pe firm|vc firm|investor)\s+([A-Z][A-Za-z0-9\s&]+?)\s+(?:closes|raises|launches)/i,
    // Generic: "CompanyName closes/raises/acquires..."
    /^([A-Z][A-Za-z0-9\s&]{2,30}?)\s+(?:closes|raises|acquires|backs|invests|launches|announces|exits|sells)/i,
  ];
  
  for (const pattern of fundPatterns) {
    const match = title.match(pattern);
    if (match) {
      const name = match[1].trim();
      // Filter out generic words that aren't fund names
      if (!["The", "A", "An", "New", "Report", "Update", "Breaking"].includes(name)) {
        return name;
      }
    }
  }
  
  return null;
}

function calculateHiringIntent(
  signalType: string | null, 
  amount: number | null,
  fundType: string | null
): { isHighIntent: boolean; intentScore: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  
  // Signal type scoring
  if (signalType === "fund_close") {
    score += 40;
    reasons.push("Fund close = deployment team hiring");
  } else if (signalType === "new_fund") {
    score += 30;
    reasons.push("New fund launch");
  } else if (signalType === "expansion") {
    score += 35;
    reasons.push("Office/team expansion");
  } else if (signalType === "senior_hire") {
    score += 25;
    reasons.push("Senior hire indicates growth");
  } else if (signalType === "deal") {
    score += 20;
    reasons.push("Active deal flow");
  } else if (signalType === "exit") {
    score += 15;
    reasons.push("Exit = capital to deploy");
  }
  
  // Amount scoring (in millions)
  if (amount) {
    if (amount >= 1000) {
      score += 30;
      reasons.push(`Large fund (${amount >= 1000 ? `€${(amount/1000).toFixed(1)}B` : `€${amount}M`})`);
    } else if (amount >= 500) {
      score += 25;
      reasons.push(`Mid-large fund (€${amount}M)`);
    } else if (amount >= 250) {
      score += 20;
      reasons.push(`Mid fund (€${amount}M)`);
    } else if (amount >= 100) {
      score += 15;
      reasons.push(`Growing fund (€${amount}M)`);
    } else if (amount >= 50) {
      score += 10;
      reasons.push(`Boutique fund (€${amount}M)`);
    }
  }
  
  // Fund type bonus
  if (fundType === "private_equity" || fundType === "infrastructure") {
    score += 10;
    reasons.push("PE/Infra = larger teams");
  } else if (fundType === "credit") {
    score += 8;
    reasons.push("Credit funds growing");
  }
  
  return {
    isHighIntent: score >= 50,
    intentScore: Math.min(score, 100),
    reason: reasons.join("; "),
  };
}

async function parseRSSFeed(url: string): Promise<any[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BrockDeckerBot/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch ${url}: ${response.status}`);
      return [];
    }
    
    const xml = await response.text();
    const items: any[] = [];
    
    // Simple XML parsing for RSS items
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { region } = await req.json().catch(() => ({ region: null }));
    
    const regionsToFetch = region ? [region] : Object.keys(RSS_FEEDS);
    const allSignals: any[] = [];
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 72 * 60 * 60 * 1000); // 72 hours ago (3 days)

    for (const reg of regionsToFetch) {
      const feeds = RSS_FEEDS[reg as keyof typeof RSS_FEEDS] || [];
      
      for (const feed of feeds) {
        console.log(`Fetching ${feed.source} for ${reg}...`);
        const items = await parseRSSFeed(feed.url);
        console.log(`  Found ${items.length} items from ${feed.source}`);
        
        for (const item of items) {
          // Skip if too old
          if (item.published_at && new Date(item.published_at) < cutoffDate) {
            continue;
          }
          
          const fullText = `${item.title} ${item.description || ""}`;
          const signalResult = detectSignalType(fullText);
          
          // Skip if no relevant PE/fund signal detected
          if (!signalResult) continue;
          
          const amountData = extractAmount(fullText);
          const fundType = detectFundType(fullText);
          const company = extractFundOrCompany(item.title, item.description);
          
          // Filter by minimum amount for fund_close and new_fund signals
          if ((signalResult.type === "fund_close" || signalResult.type === "new_fund")) {
            if (!amountData || amountData.amount < 50) continue; // Skip < €50M funds
          }
          
          // For deals, require some amount or clear company name
          if (signalResult.type === "deal") {
            if (!amountData && !company) continue;
          }
          
          const intentResult = calculateHiringIntent(signalResult.type, amountData?.amount || null, fundType);
          
          allSignals.push({
            title: item.title.slice(0, 255),
            company: company,
            region: reg,
            amount: amountData?.amount || null,
            currency: amountData?.currency || "EUR",
            signal_type: signalResult.type,
            description: item.description?.slice(0, 500) || null,
            url: item.url,
            source: feed.source,
            published_at: item.published_at || now.toISOString(),
            is_high_intent: intentResult.isHighIntent,
            // Store additional metadata in description if no description
            // intent_score and fund_type could be added as columns later
          });
        }
      }
    }

    console.log(`Total signals collected: ${allSignals.length}`);

    // Deduplicate by URL and title
    const uniqueSignals = allSignals.filter((signal, index, self) =>
      index === self.findIndex(s => s.url === signal.url || s.title === signal.title)
    );

    console.log(`Unique signals after dedup: ${uniqueSignals.length}`);

    let insertedCount = 0;
    if (uniqueSignals.length > 0) {
      // Upsert signals (avoid duplicates)
      for (const signal of uniqueSignals) {
        const { data: existing } = await supabase
          .from("signals")
          .select("id")
          .or(`url.eq.${signal.url},title.eq.${signal.title}`)
          .maybeSingle();
        
        if (!existing) {
          const { error } = await supabase.from("signals").insert(signal);
          if (!error) insertedCount++;
        }
      }
    }

    console.log(`Inserted ${insertedCount} new signals`);

    // Get counts by region (non-dismissed, recent)
    const { data: counts } = await supabase
      .from("signals")
      .select("region")
      .eq("is_dismissed", false)
      .gte("published_at", cutoffDate.toISOString());
    
    const regionCounts: Record<string, number> = {};
    (counts || []).forEach((s: any) => {
      regionCounts[s.region] = (regionCounts[s.region] || 0) + 1;
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        fetched: insertedCount,
        regionCounts,
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
