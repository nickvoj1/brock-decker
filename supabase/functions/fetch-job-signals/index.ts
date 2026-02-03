import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PE/VC/Finance company career pages to scrape for job signals
const CAREER_PAGES: Record<string, { url: string; company: string; region: string }[]> = {
  london: [
    { url: "https://www.blackstone.com/careers/", company: "Blackstone", region: "london" },
    { url: "https://www.kkr.com/careers", company: "KKR", region: "london" },
    { url: "https://www.carlyle.com/careers", company: "The Carlyle Group", region: "london" },
    { url: "https://careers.goldmansachs.com/locations/emea", company: "Goldman Sachs", region: "london" },
    { url: "https://www.morganstanley.com/people-opportunities/students-graduates/programs", company: "Morgan Stanley", region: "london" },
    { url: "https://www.bridgepoint.eu/careers", company: "Bridgepoint", region: "london" },
    { url: "https://www.permira.com/careers", company: "Permira", region: "london" },
    { url: "https://www.cvc.com/careers/", company: "CVC Capital Partners", region: "london" },
    { url: "https://www.apax.com/careers/", company: "Apax Partners", region: "london" },
    { url: "https://www.bcpartners.com/careers", company: "BC Partners", region: "london" },
  ],
  europe: [
    { url: "https://www.eqtgroup.com/careers/", company: "EQT Partners", region: "europe" },
    { url: "https://www.ardian.com/en/careers", company: "Ardian", region: "europe" },
    { url: "https://www.partnersgroup.com/en/careers/", company: "Partners Group", region: "europe" },
    { url: "https://www.triton-partners.com/careers/", company: "Triton", region: "europe" },
    { url: "https://www.nordiccapital.com/careers/", company: "Nordic Capital", region: "europe" },
    { url: "https://www.ikpartners.com/careers", company: "IK Partners", region: "europe" },
    { url: "https://www.cinven.com/careers/", company: "Cinven", region: "europe" },
    { url: "https://www.pai.com/careers", company: "PAI Partners", region: "europe" },
  ],
  uae: [
    { url: "https://www.mubadala.com/en/careers", company: "Mubadala", region: "uae" },
    { url: "https://www.adia.ae/en/careers", company: "ADIA", region: "uae" },
    { url: "https://www.adq.ae/careers/", company: "ADQ", region: "uae" },
    { url: "https://www.emirates-nbd.com/en/about-us/careers/", company: "Emirates NBD", region: "uae" },
  ],
  usa: [
    { url: "https://www.blackstone.com/careers/", company: "Blackstone", region: "usa" },
    { url: "https://www.kkr.com/careers", company: "KKR", region: "usa" },
    { url: "https://www.carlyle.com/careers", company: "The Carlyle Group", region: "usa" },
    { url: "https://www.apolloglobal.com/careers/", company: "Apollo Global", region: "usa" },
    { url: "https://www.tpg.com/careers", company: "TPG", region: "usa" },
    { url: "https://www.warburgpincus.com/careers/", company: "Warburg Pincus", region: "usa" },
    { url: "https://www.generalatlantic.com/careers/", company: "General Atlantic", region: "usa" },
    { url: "https://www.silverlake.com/careers", company: "Silver Lake", region: "usa" },
    { url: "https://www.thomabravo.com/careers", company: "Thoma Bravo", region: "usa" },
    { url: "https://www.vistaequitypartners.com/careers/", company: "Vista Equity Partners", region: "usa" },
  ],
};

// Keywords to identify hiring-related content
const JOB_KEYWORDS = [
  "associate", "analyst", "vice president", "principal", "director", "partner",
  "managing director", "investment professional", "deal team", "portfolio",
  "origination", "investor relations", "capital markets", "m&a",
  "private equity", "venture capital", "credit", "infrastructure",
  "hiring", "open role", "join our team", "career opportunity",
  "recruitment", "talent acquisition", "hr ", "human resources",
];

// Role seniority detection for better signal quality
const SENIOR_ROLES = [
  "partner", "managing director", "md", "principal", "director",
  "head of", "chief", "vp", "vice president", "senior"
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
}

function detectJobType(text: string): { tier: string; signalType: string; score: number } {
  const lowerText = text.toLowerCase();
  
  // Check for senior roles (Tier 1 - high intent)
  const hasSeniorRole = SENIOR_ROLES.some(role => lowerText.includes(role));
  
  // Check for multiple openings (Tier 1 - rapid hiring)
  const multipleRoleKeywords = ["multiple", "several", "hiring spree", "expanding team", "roles"];
  const hasMultipleRoles = multipleRoleKeywords.some(kw => lowerText.includes(kw));
  
  if (hasSeniorRole || hasMultipleRoles) {
    return { tier: "tier_1", signalType: "rapid_job_postings", score: 85 };
  }
  
  // Standard job posting (Tier 2)
  const hasJobKeyword = JOB_KEYWORDS.some(kw => lowerText.includes(kw));
  if (hasJobKeyword) {
    return { tier: "tier_2", signalType: "new_recruiter", score: 60 };
  }
  
  // Fallback (Tier 3)
  return { tier: "tier_3", signalType: "careers_page_refresh", score: 40 };
}

async function scrapeCareerPage(
  firecrawlApiKey: string,
  pageConfig: { url: string; company: string; region: string }
): Promise<JobSignal[]> {
  const signals: JobSignal[] = [];
  
  try {
    console.log(`Scraping career page: ${pageConfig.company} (${pageConfig.url})`);
    
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
        waitFor: 3000, // Wait for dynamic content
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
    
    // Analyze content for job signals
    const lowerContent = markdown.toLowerCase();
    
    // Check if there are job-related keywords
    const hasJobContent = JOB_KEYWORDS.some(kw => lowerContent.includes(kw));
    
    if (hasJobContent) {
      const { tier, signalType, score } = detectJobType(markdown);
      
      // Extract job-related lines for better description
      const lines = markdown.split("\n").filter((line: string) => {
        const lower = line.toLowerCase();
        return JOB_KEYWORDS.some(kw => lower.includes(kw)) && line.trim().length > 10;
      });
      
      const description = lines.slice(0, 3).join(" | ") || `Career opportunities at ${pageConfig.company}`;
      
      // Count approximate job postings
      const jobLinks = links.filter((link: string) => {
        const lower = link.toLowerCase();
        return lower.includes("job") || lower.includes("career") || lower.includes("position") || lower.includes("apply");
      });
      
      const jobCount = jobLinks.length || 1;
      const title = jobCount > 3 
        ? `${pageConfig.company} hiring for ${jobCount}+ roles`
        : `${pageConfig.company} has open positions`;
      
      signals.push({
        title,
        company: pageConfig.company,
        description: description.substring(0, 500),
        url: pageConfig.url,
        region: pageConfig.region,
        signalType,
        tier,
        score: Math.min(score + (jobCount > 5 ? 10 : 0), 100),
      });
    }
    
    console.log(`Found ${signals.length} signals for ${pageConfig.company}`);
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
    const allPages: { url: string; company: string; region: string }[] = [];
    
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
    
    console.log(`Found ${allSignals.length} job signals total`);
    
    // Insert signals into database (upsert to avoid duplicates)
    let insertedCount = 0;
    const errors: string[] = [];
    
    for (const signal of allSignals) {
      try {
        // Check for existing signal with same company + region + type
        const { data: existing } = await supabase
          .from("signals")
          .select("id")
          .eq("company", signal.company)
          .eq("region", signal.region)
          .eq("signal_type", "hiring")
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
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
