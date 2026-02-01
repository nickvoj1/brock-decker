import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// RSS Feed configurations by region
const RSS_FEEDS = {
  europe: [
    { url: "https://techcrunch.com/tag/europe/feed/", source: "TechCrunch EU" },
    { url: "https://www.eu-startups.com/feed/", source: "EU-Startups" },
    { url: "https://sifted.eu/feed", source: "Sifted" },
  ],
  uae: [
    { url: "https://gulfbusiness.com/feed/", source: "Gulf Business" },
    { url: "https://www.arabianbusiness.com/rss", source: "Arabian Business" },
  ],
  east_usa: [
    { url: "https://techcrunch.com/tag/new-york/feed/", source: "TechCrunch NY" },
    { url: "https://www.pehub.com/feed/", source: "PE Hub" },
  ],
  west_usa: [
    { url: "https://techcrunch.com/feed/", source: "TechCrunch" },
    { url: "https://news.crunchbase.com/feed/", source: "Crunchbase News" },
  ],
};

// Keywords for signal type detection
const SIGNAL_KEYWORDS = {
  funding: ["funding", "raised", "series", "investment", "round", "seed", "venture", "capital", "million", "billion", "$", "€", "£"],
  hiring: ["hiring", "recruit", "talent", "job", "career", "team growth", "headcount", "workforce"],
  expansion: ["expansion", "expand", "new office", "new market", "launch", "opens", "enters"],
  c_suite: ["ceo", "cto", "cfo", "coo", "chief", "executive", "appoint", "names", "hires"],
  team_growth: ["team", "employees", "staff", "grow", "scaling"],
};

// Amount extraction patterns
const AMOUNT_PATTERNS = [
  /\$(\d+(?:\.\d+)?)\s*(million|m|billion|b)/i,
  /€(\d+(?:\.\d+)?)\s*(million|m|billion|b)/i,
  /£(\d+(?:\.\d+)?)\s*(million|m|billion|b)/i,
  /(\d+(?:\.\d+)?)\s*(million|m|billion|b)\s*(?:dollar|euro|pound|\$|€|£)/i,
];

function extractAmount(text: string): { amount: number; currency: string } | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      
      if (unit === "billion" || unit === "b") {
        value *= 1000;
      }
      
      // Determine currency
      let currency = "USD";
      if (text.includes("€")) currency = "EUR";
      else if (text.includes("£")) currency = "GBP";
      
      return { amount: value, currency };
    }
  }
  return null;
}

function detectSignalType(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  for (const [type, keywords] of Object.entries(SIGNAL_KEYWORDS)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return type;
    }
  }
  return null;
}

function extractCompany(title: string): string | null {
  // Try to extract company name from title
  // Common patterns: "CompanyName raises...", "CompanyName announces..."
  const patterns = [
    /^([A-Z][A-Za-z0-9\s&]+?)\s+(?:raises|secures|announces|closes|gets|lands|nabs|scores)/i,
    /^([A-Z][A-Za-z0-9\s&]+?),\s+/,
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

function isHighIntent(signalType: string | null, amount: number | null): boolean {
  // High intent: large funding rounds or C-suite moves
  if (signalType === "c_suite") return true;
  if (signalType === "funding" && amount && amount >= 50) return true;
  if (signalType === "expansion") return true;
  return false;
}

async function parseRSSFeed(url: string): Promise<any[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BrockDeckerBot/1.0)",
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
    const cutoffDate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago

    for (const reg of regionsToFetch) {
      const feeds = RSS_FEEDS[reg as keyof typeof RSS_FEEDS] || [];
      
      for (const feed of feeds) {
        console.log(`Fetching ${feed.source} for ${reg}...`);
        const items = await parseRSSFeed(feed.url);
        
        for (const item of items) {
          // Skip if too old
          if (item.published_at && new Date(item.published_at) < cutoffDate) {
            continue;
          }
          
          const fullText = `${item.title} ${item.description || ""}`;
          const signalType = detectSignalType(fullText);
          
          // Skip if no relevant signal type detected
          if (!signalType) continue;
          
          const amountData = extractAmount(fullText);
          const company = extractCompany(item.title);
          
          // For funding signals, require minimum amount
          if (signalType === "funding") {
            if (!amountData || amountData.amount < 5) continue; // Skip < €5M
          }
          
          allSignals.push({
            title: item.title.slice(0, 255),
            company: company,
            region: reg,
            amount: amountData?.amount || null,
            currency: amountData?.currency || "EUR",
            signal_type: signalType,
            description: item.description?.slice(0, 500) || null,
            url: item.url,
            source: feed.source,
            published_at: item.published_at || now.toISOString(),
            is_high_intent: isHighIntent(signalType, amountData?.amount || null),
          });
        }
      }
    }

    // Deduplicate by URL and insert
    const uniqueSignals = allSignals.filter((signal, index, self) =>
      index === self.findIndex(s => s.url === signal.url || s.title === signal.title)
    );

    if (uniqueSignals.length > 0) {
      // Upsert signals (avoid duplicates)
      for (const signal of uniqueSignals) {
        const { data: existing } = await supabase
          .from("signals")
          .select("id")
          .eq("url", signal.url)
          .maybeSingle();
        
        if (!existing) {
          await supabase.from("signals").insert(signal);
        }
      }
    }

    // Get counts by region
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
        fetched: uniqueSignals.length,
        regionCounts,
        message: `Processed ${uniqueSignals.length} new signals`
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
