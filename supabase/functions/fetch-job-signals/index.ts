import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PE/VC/Finance company career pages - curated list with accurate regions
const CAREER_PAGES: Record<string, { url: string; company: string; region: string; location: string }[]> = {
  london: [
    { url: "https://www.blackstone.com/careers/", company: "Blackstone", region: "london", location: "London" },
    { url: "https://www.kkr.com/careers", company: "KKR", region: "london", location: "London" },
    { url: "https://www.carlyle.com/careers", company: "The Carlyle Group", region: "london", location: "London" },
    { url: "https://www.bridgepoint.eu/careers", company: "Bridgepoint", region: "london", location: "London" },
    { url: "https://www.permira.com/careers", company: "Permira", region: "london", location: "London" },
    { url: "https://www.cvc.com/careers/", company: "CVC Capital Partners", region: "london", location: "London" },
    { url: "https://www.apax.com/careers/", company: "Apax Partners", region: "london", location: "London" },
    { url: "https://www.bcpartners.com/careers", company: "BC Partners", region: "london", location: "London" },
    { url: "https://www.3i.com/careers", company: "3i Group", region: "london", location: "London" },
    { url: "https://www.icgam.com/careers", company: "ICG", region: "london", location: "London" },
  ],
  europe: [
    { url: "https://www.eqtgroup.com/careers/", company: "EQT Partners", region: "europe", location: "Stockholm" },
    { url: "https://www.ardian.com/en/careers", company: "Ardian", region: "europe", location: "Paris" },
    { url: "https://www.partnersgroup.com/en/careers/", company: "Partners Group", region: "europe", location: "Zurich" },
    { url: "https://www.triton-partners.com/careers/", company: "Triton", region: "europe", location: "Frankfurt" },
    { url: "https://www.nordiccapital.com/careers/", company: "Nordic Capital", region: "europe", location: "Stockholm" },
    { url: "https://www.ikpartners.com/careers", company: "IK Partners", region: "europe", location: "Luxembourg" },
    { url: "https://www.cinven.com/careers/", company: "Cinven", region: "europe", location: "Luxembourg" },
    { url: "https://www.pai.com/careers", company: "PAI Partners", region: "europe", location: "Paris" },
    { url: "https://www.hgcapital.com/careers", company: "HgCapital", region: "europe", location: "London" },
  ],
  uae: [
    { url: "https://www.mubadala.com/en/careers", company: "Mubadala", region: "uae", location: "Abu Dhabi" },
    { url: "https://www.adia.ae/en/careers", company: "ADIA", region: "uae", location: "Abu Dhabi" },
    { url: "https://www.adq.ae/careers/", company: "ADQ", region: "uae", location: "Abu Dhabi" },
    { url: "https://www.investcorp.com/careers", company: "Investcorp", region: "uae", location: "Bahrain" },
  ],
  usa: [
    { url: "https://www.blackstone.com/careers/", company: "Blackstone", region: "usa", location: "New York" },
    { url: "https://www.kkr.com/careers", company: "KKR", region: "usa", location: "New York" },
    { url: "https://www.carlyle.com/careers", company: "The Carlyle Group", region: "usa", location: "Washington DC" },
    { url: "https://www.apolloglobal.com/careers/", company: "Apollo Global", region: "usa", location: "New York" },
    { url: "https://www.tpg.com/careers", company: "TPG", region: "usa", location: "San Francisco" },
    { url: "https://www.warburgpincus.com/careers/", company: "Warburg Pincus", region: "usa", location: "New York" },
    { url: "https://www.generalatlantic.com/careers/", company: "General Atlantic", region: "usa", location: "New York" },
    { url: "https://www.silverlake.com/careers", company: "Silver Lake", region: "usa", location: "Menlo Park" },
    { url: "https://www.thomabravo.com/careers", company: "Thoma Bravo", region: "usa", location: "Chicago" },
    { url: "https://www.vistaequitypartners.com/careers/", company: "Vista Equity Partners", region: "usa", location: "Austin" },
  ],
};

// Region location keywords for strict filtering
const REGION_LOCATIONS: Record<string, string[]> = {
  london: [
    "london", "uk", "united kingdom", "britain", "england", "manchester", "birmingham",
    "edinburgh", "glasgow", "leeds", "bristol", "cambridge", "oxford"
  ],
  europe: [
    "paris", "france", "germany", "berlin", "frankfurt", "munich", "amsterdam", "netherlands",
    "switzerland", "zurich", "geneva", "milan", "italy", "rome", "spain", "madrid", "barcelona",
    "stockholm", "sweden", "norway", "oslo", "denmark", "copenhagen", "finland", "helsinki",
    "belgium", "brussels", "luxembourg", "austria", "vienna", "portugal", "lisbon", "dublin", "ireland",
    "poland", "warsaw", "czech", "prague", "hungary", "budapest"
  ],
  uae: [
    "dubai", "abu dhabi", "uae", "united arab emirates", "saudi", "riyadh", "qatar", "doha",
    "bahrain", "kuwait", "oman", "middle east", "gcc", "mena"
  ],
  usa: [
    "new york", "nyc", "manhattan", "boston", "chicago", "san francisco", "los angeles",
    "california", "texas", "dallas", "houston", "atlanta", "miami", "washington dc", "dc",
    "seattle", "denver", "philadelphia", "united states", "usa", "america", "connecticut",
    "greenwich", "stamford"
  ],
};

// EXCLUDED: Junior/entry-level positions
const JUNIOR_KEYWORDS = [
  "junior", "entry level", "entry-level", "graduate", "intern", "internship",
  "trainee", "apprentice", "assistant", "coordinator", "administrator", "receptionist",
  "clerk", "support", "summer analyst", "summer associate", "off-cycle", "spring week",
  "insight week", "placement", "industrial placement", "year in industry"
];

// INCLUDED: Senior/mid-level positions we want
const SENIOR_ROLE_PATTERNS = [
  "partner", "managing director", "md", "principal", "director", "head of",
  "chief", "vp", "vice president", "senior", "svp", "evp", "cfo", "coo", "ceo",
  "investment professional", "deal partner", "portfolio manager", "fund manager",
  "origination", "investor relations", "ir manager", "capital markets",
  "talent acquisition", "recruitment manager", "hr director", "people director",
  "hr business partner", "talent partner"
];

// Job titles we're looking for
const TARGET_POSITIONS = [
  "associate", "senior associate", "vice president", "vp", "principal", "director",
  "managing director", "partner", "head of", "manager", "lead", "analyst",
  "investment professional", "deal team", "origination", "portfolio",
  "investor relations", "capital markets", "m&a", "private equity", "venture",
  "talent acquisition", "recruiter", "recruitment", "hr business partner"
];

interface JobSignal {
  title: string;
  company: string;
  description: string;
  url: string;
  region: string;
  signalType: string;
  tier: string;
  score: number;
  location: string;
  position: string | null;
}

interface ExtractedJob {
  position: string;
  location: string | null;
  isJunior: boolean;
  isSenior: boolean;
}

interface CareerPageConfig {
  url: string;
  company: string;
  region: string;
  location: string;
}

/**
 * Extract location from text content
 */
function extractLocation(text: string, expectedRegion: string): string | null {
  const lowerText = text.toLowerCase();
  const regionLocations = REGION_LOCATIONS[expectedRegion] || [];
  
  // Check for location matches in expected region
  for (const loc of regionLocations) {
    if (lowerText.includes(loc)) {
      // Capitalize first letter of each word
      return loc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  
  return null;
}

/**
 * Check if job matches the expected region strictly
 */
function matchesRegion(text: string, expectedRegion: string): boolean {
  const lowerText = text.toLowerCase();
  const expectedLocations = REGION_LOCATIONS[expectedRegion] || [];
  
  // Check if any expected region location is mentioned
  const hasExpectedRegion = expectedLocations.some(loc => lowerText.includes(loc));
  
  // Check if OTHER region locations are mentioned (region mismatch)
  const otherRegions = Object.keys(REGION_LOCATIONS).filter(r => r !== expectedRegion);
  const hasOtherRegion = otherRegions.some(region => {
    const otherLocs = REGION_LOCATIONS[region];
    // Only flag as mismatch if it's a strong location indicator
    return otherLocs.some(loc => {
      // Skip generic terms that could apply to multiple regions
      if (["uk", "united kingdom", "europe", "america", "united states"].includes(loc)) return false;
      return lowerText.includes(loc);
    });
  });
  
  // If we find a specific OTHER region location but NOT expected region, reject
  if (hasOtherRegion && !hasExpectedRegion) {
    return false;
  }
  
  return true;
}

/**
 * Check if job title is junior/entry-level
 */
function isJuniorRole(text: string): boolean {
  const lowerText = text.toLowerCase();
  return JUNIOR_KEYWORDS.some(kw => lowerText.includes(kw));
}

/**
 * Check if job title is senior/experienced
 */
function isSeniorRole(text: string): boolean {
  const lowerText = text.toLowerCase();
  return SENIOR_ROLE_PATTERNS.some(pattern => lowerText.includes(pattern));
}

/**
 * Extract actual job posting URLs from page links
 */
function extractJobUrls(links: string[], baseUrl: string): string[] {
  const jobUrlPatterns = [
    /\/job[s]?\//i,
    /\/career[s]?\//i,
    /\/position[s]?\//i,
    /\/opening[s]?\//i,
    /\/vacancies\//i,
    /\/opportunity\//i,
    /\/apply\//i,
    /\/role[s]?\//i,
    /jobid=/i,
    /posting_id=/i,
    /\/jid\//i,
    /greenhouse\.io\/.*\/jobs\//i,
    /lever\.co\/.*\//i,
    /workday\.com\/.*\/job\//i,
    /smartrecruiters\.com\/.*\//i,
    /boards\.greenhouse\.io\//i,
    /jobs\.lever\.co\//i,
  ];
  
  const jobUrls: string[] = [];
  
  for (const link of links) {
    // Skip generic pages
    if (link.endsWith('/careers') || link.endsWith('/careers/') || 
        link.endsWith('/jobs') || link.endsWith('/jobs/') ||
        link.includes('#') || link.includes('?utm') ||
        link.includes('/about') || link.includes('/contact') ||
        link.includes('/login') || link.includes('/register')) {
      continue;
    }
    
    // Check if link looks like a job posting
    const isJobUrl = jobUrlPatterns.some(pattern => pattern.test(link));
    if (isJobUrl && !jobUrls.includes(link)) {
      jobUrls.push(link);
    }
  }
  
  return jobUrls.slice(0, 10); // Max 10 job URLs
}

/**
 * Extract job positions from markdown content
 */
function extractJobPositions(markdown: string): ExtractedJob[] {
  const jobs: ExtractedJob[] = [];
  const lines = markdown.split('\n');
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();
    if (lowerLine.length < 5 || lowerLine.length > 200) continue;
    
    // Check if line contains a job title
    const hasPosition = TARGET_POSITIONS.some(pos => lowerLine.includes(pos));
    if (!hasPosition) continue;
    
    // Skip if it's a junior role
    if (isJuniorRole(line)) continue;
    
    // Try to extract the position title
    let position = line.trim();
    
    // Clean up common prefixes/suffixes
    position = position
      .replace(/^[-•*]\s*/, '') // Remove bullet points
      .replace(/\s*\|.*$/, '') // Remove pipe-separated suffix
      .replace(/\s*-\s*apply.*$/i, '') // Remove "- Apply" suffix
      .replace(/\s*\(.*\)$/, '') // Remove parenthetical suffixes
      .trim();
    
    if (position.length > 5 && position.length < 100) {
      jobs.push({
        position,
        location: null, // Will be set from context
        isJunior: isJuniorRole(position),
        isSenior: isSeniorRole(position),
      });
    }
  }
  
  return jobs.filter(j => !j.isJunior);
}

function detectJobType(text: string, positions: ExtractedJob[]): { tier: string; signalType: string; score: number } {
  // Check for senior roles (Tier 1 - high intent)
  const hasSeniorRole = positions.some(p => p.isSenior);
  
  // Check for multiple openings (Tier 1 - rapid hiring)
  const hasMultipleRoles = positions.length >= 3;
  
  if (hasSeniorRole || hasMultipleRoles) {
    return { tier: "tier_1", signalType: "hiring", score: 85 };
  }
  
  // Standard job posting with mid-level roles (Tier 2)
  if (positions.length > 0) {
    return { tier: "tier_2", signalType: "hiring", score: 65 };
  }
  
  // Fallback (Tier 3)
  return { tier: "tier_3", signalType: "hiring", score: 40 };
}

async function scrapeCareerPage(
  firecrawlApiKey: string,
  pageConfig: CareerPageConfig
): Promise<JobSignal[]> {
  const signals: JobSignal[] = [];
  
  try {
    console.log(`Scraping: ${pageConfig.company} (${pageConfig.location})`);
    
    
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: pageConfig.url,
        formats: ["markdown", "links"],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl error for ${pageConfig.company}: ${response.status} - ${errorText}`);
      return signals;
    }
    
    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || "";
    const links = data.data?.links || data.links || [];
    
    if (!markdown && links.length === 0) {
      console.log(`No content found for ${pageConfig.company}`);
      return signals;
    }
    
    // STRICT REGION CHECK: Reject if content indicates wrong region
    if (!matchesRegion(markdown, pageConfig.region)) {
      console.log(`Region mismatch for ${pageConfig.company} - expected ${pageConfig.region}, skipping`);
      return signals;
    }
    
    // Extract actual job posting URLs from the page links
    const jobUrls = extractJobUrls(links, pageConfig.url);
    console.log(`Found ${jobUrls.length} job URLs from ${pageConfig.company}`);
    
    // If no specific job URLs found, skip this company (no real openings detected)
    if (jobUrls.length === 0) {
      console.log(`No specific job URLs found for ${pageConfig.company}, skipping (no verified openings)`);
      return signals;
    }
    
    // Extract job positions (excluding junior roles)
    const extractedPositions = extractJobPositions(markdown);
    console.log(`Extracted ${extractedPositions.length} non-junior positions from ${pageConfig.company}`);
    
    if (extractedPositions.length === 0) {
      console.log(`No qualifying positions found for ${pageConfig.company}`);
      return signals;
    }
    
    // Extract location from content - but prefer the configured location
    const detectedLocation = extractLocation(markdown, pageConfig.region);
    const finalLocation = detectedLocation || pageConfig.location;
    
    // Get top positions for the signal
    const topPositions = extractedPositions
      .filter(p => p.isSenior)
      .slice(0, 3)
      .map(p => p.position);
    
    // If no senior positions, get first few regular ones
    const positionsToShow = topPositions.length > 0 
      ? topPositions 
      : extractedPositions.slice(0, 3).map(p => p.position);
    
    const { tier, signalType, score } = detectJobType(markdown, extractedPositions);
    
    // Build descriptive title with position info
    const positionSummary = positionsToShow.length > 0
      ? positionsToShow.slice(0, 2).join(", ")
      : "multiple roles";
    
    const title = extractedPositions.length > 3
      ? `${pageConfig.company} hiring: ${positionSummary} (+${extractedPositions.length - 2} more)`
      : `${pageConfig.company} hiring: ${positionSummary}`;
    
    // Build description with location, positions, and job count
    const positionList = positionsToShow.join(" | ");
    const description = `📍 ${finalLocation}\n\n**Open Positions (${jobUrls.length} verified):** ${positionList}`;
    
    // Use the FIRST actual job URL instead of generic career page
    const primaryJobUrl = jobUrls[0];
    
    signals.push({
      title,
      company: pageConfig.company,
      description: description.substring(0, 500),
      url: primaryJobUrl, // Direct job posting URL, not career page
      region: pageConfig.region,
      signalType,
      tier,
      score: Math.min(score + (extractedPositions.length > 5 ? 10 : 0), 100),
      location: finalLocation,
      position: positionsToShow.join(", "),
    });
    
    console.log(`✓ ${pageConfig.company}: ${extractedPositions.length} roles at ${finalLocation}, URL: ${primaryJobUrl}`);
    return signals;
    
  } catch (error) {
    console.error(`Error scraping ${pageConfig.company}:`, error);
    return signals;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { region } = await req.json();
    
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get career pages for the requested region(s)
    const regions = region ? [region] : ["london", "europe", "uae", "usa"];
    const allPages: CareerPageConfig[] = [];
    
    for (const r of regions) {
      const pages = CAREER_PAGES[r] || [];
      allPages.push(...pages);
    }
    
    console.log(`Scraping ${allPages.length} career pages across ${regions.join(", ")}`);
    
    // Scrape in batches to avoid rate limiting
    const BATCH_SIZE = 3;
    const allSignals: JobSignal[] = [];
    
    for (let i = 0; i < allPages.length; i += BATCH_SIZE) {
      const batch = allPages.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.allSettled(
        batch.map(page => scrapeCareerPage(firecrawlApiKey, page))
      );
      
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          allSignals.push(...result.value);
        }
      }
      
      // Small delay between batches
      if (i + BATCH_SIZE < allPages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Found ${allSignals.length} qualified job signals total`);
    
    // Insert signals into database (upsert to avoid duplicates)
    let insertedCount = 0;
    const errors: string[] = [];
    
    for (const signal of allSignals) {
      try {
        // Check for existing signal with same company + region + type within 7 days
        const { data: existing } = await supabase
          .from("signals")
          .select("id")
          .eq("company", signal.company)
          .eq("region", signal.region)
          .eq("signal_type", "hiring")
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1);
        
        if (existing && existing.length > 0) {
          console.log(`Skipping duplicate: ${signal.company} (${signal.region})`);
          continue;
        }
        
        const { error: insertError } = await supabase.from("signals").insert({
          title: signal.title,
          company: signal.company,
          description: signal.description,
          url: signal.url,
          region: signal.region,
          signal_type: "hiring",
          tier: signal.tier,
          score: signal.score,
          source: "Career Page Scraper",
          is_high_intent: signal.tier === "tier_1",
          published_at: new Date().toISOString(),
          details: {
            location: signal.location,
            positions: signal.position,
            scraped_at: new Date().toISOString(),
          },
        });
        
        if (insertError) {
          console.error(`Error inserting signal for ${signal.company}:`, insertError);
          errors.push(`${signal.company}: ${insertError.message}`);
        } else {
          insertedCount++;
        }
      } catch (err) {
        console.error(`Error processing signal for ${signal.company}:`, err);
      }
    }
    
    console.log(`Inserted ${insertedCount} new job signals`);
    
    return new Response(
      JSON.stringify({
        success: true,
        scrapedPages: allPages.length,
        signalsFound: allSignals.length,
        signalsInserted: insertedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Job signals fetch error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
