import { supabase } from "@/integrations/supabase/client";

export interface Signal {
  id: string;
  title: string;
  company: string | null;
  region: string;
  tier: string | null;
  score: number;
  amount: number | null;
  currency: string | null;
  signal_type: string | null;
  description: string | null;
  url: string | null;
  source: string | null;
  published_at: string | null;
  is_high_intent: boolean;
  is_dismissed: boolean;
  contacts_found: number;
  cv_matches: number;
  bullhorn_note_added: boolean;
  contacts_url: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  // AI-powered qualitative fields
  ai_insight: string | null;
  ai_pitch: string | null;
  ai_enriched_at: string | null;
  // Training fields
  retrain_flag?: boolean;
  ai_confidence?: number;
  feedback_count?: number;
  // Surge scraper v2.1 fields
  detected_region?: string | null;
  validated_region?: string | null;
  keywords_count?: number;
  keywords?: string[];
  source_urls?: string[];
  raw_content?: string | null;
  user_feedback?: string | null;
}

export interface SignalsResponse {
  signals: Signal[];
  regionCounts: Record<string, number>;
  tierCounts: Record<string, number>;
}

interface DataApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function callDataApi<T>(action: string, profileName: string, data?: Record<string, unknown>): Promise<DataApiResponse<T>> {
  try {
    const { data: response, error } = await supabase.functions.invoke("data-api", {
      body: {
        action,
        profileName,
        data,
      },
    });

    if (error) {
      console.error("Signals API error:", error);
      return { success: false, error: error.message };
    }

    return response as DataApiResponse<T>;
  } catch (err) {
    console.error("Signals API call failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getSignals(profileName: string, region?: string) {
  return callDataApi<SignalsResponse>("get-signals", profileName, { region });
}

export async function dismissSignal(profileName: string, signalId: string) {
  return callDataApi("dismiss-signal", profileName, { signalId });
}

export async function updateSignal(profileName: string, signalId: string, updates: Partial<Signal>) {
  return callDataApi("update-signal", profileName, { signalId, updates });
}

export async function markSignalBullhornAdded(profileName: string, signalId: string) {
  return callDataApi("update-signal", profileName, { 
    signalId, 
    updates: { bullhorn_note_added: true } 
  });
}

export async function incrementSignalContacts(profileName: string, signalId: string, count: number) {
  return callDataApi("update-signal", profileName, { 
    signalId, 
    updates: { contacts_found: count } 
  });
}

export async function incrementSignalCVMatches(profileName: string, signalId: string, count: number) {
  return callDataApi("update-signal", profileName, { 
    signalId, 
    updates: { cv_matches: count } 
  });
}

export async function refreshSignals(profileName: string, region?: string) {
  try {
    const { data: response, error } = await supabase.functions.invoke("fetch-signals", {
      body: { region },
    });

    if (error) {
      console.error("Refresh signals error:", error);
      return { success: false, error: error.message };
    }

    if (response && response.success) {
      return { 
        success: true, 
        data: { 
          fetched: response.fetched || 0, 
          regionCounts: response.regionCounts || {},
          tierCounts: response.tierCounts || {},
        } 
      };
    }

    return { success: false, error: response?.error || "Unknown error" };
  } catch (err) {
    console.error("Refresh signals failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Scrape job postings from PE/VC career pages
export async function scrapeJobSignals(region?: string, mode: "both" | "career" | "apollo" = "both") {
  try {
    const { data: response, error } = await supabase.functions.invoke("fetch-job-signals", {
      body: { region, mode },
    });

    if (error) {
      console.error("Scrape job signals error:", error);
      return { success: false, error: error.message };
    }

    return response;
  } catch (err) {
    console.error("Scrape job signals failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Job signal contact interface
export interface JobSignalContact {
  name: string;
  title: string;
  email: string | null;
  linkedin_url: string | null;
}

// Job signal interface
export interface JobSignal {
  id: string;
  company: string;
  company_apollo_id?: string;
  job_title: string;
  job_description?: string;
  job_url?: string;
  location?: string;
  region: string;
  posted_at?: string;
  contacts: JobSignalContact[];
  contacts_count: number;
  score: number;
  tier: string;
  signal_type: string;
  source: string;
  is_dismissed: boolean;
  bullhorn_note_added: boolean;
  created_at: string;
}

// Fetch job signals from job_signals table
export async function getJobSignals(region?: string): Promise<{ success: boolean; error?: string; data: JobSignal[] }> {
  try {
    let query = supabase
      .from("job_signals")
      .select("*")
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (region) {
      query = query.eq("region", region);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Get job signals error:", error);
      return { success: false, error: error.message, data: [] };
    }
    
    // Map database records to JobSignal interface
    const jobSignals: JobSignal[] = (data || []).map((row: any) => ({
      id: row.id,
      company: row.company,
      company_apollo_id: row.company_apollo_id,
      job_title: row.job_title,
      job_description: row.job_description,
      job_url: row.job_url,
      location: row.location,
      region: row.region,
      posted_at: row.posted_at,
      contacts: (row.contacts || []) as JobSignalContact[],
      contacts_count: row.contacts_count || 0,
      score: row.score || 50,
      tier: row.tier || "tier_2",
      signal_type: row.signal_type || "hiring",
      source: row.source || "apollo_jobs",
      is_dismissed: row.is_dismissed || false,
      bullhorn_note_added: row.bullhorn_note_added || false,
      created_at: row.created_at,
    }));
    
    return { success: true, data: jobSignals };
  } catch (err) {
    console.error("Get job signals failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", data: [] };
  }
}

// Dismiss a job signal
export async function dismissJobSignal(jobId: string, profileName: string) {
  try {
    const { error } = await supabase
      .from("job_signals")
      .update({ is_dismissed: true, dismissed_by: profileName })
      .eq("id", jobId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Enrich signals with AI-powered qualitative insights
export async function enrichSignalsWithAI(signalIds?: string[]) {
  try {
    const { data: response, error } = await supabase.functions.invoke("enrich-signal-ai", {
      body: signalIds ? { signalIds } : { enrichAll: true },
    });

    if (error) {
      console.error("AI enrichment error:", error);
      return { success: false, error: error.message };
    }

    return response;
  } catch (err) {
    console.error("AI enrichment failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Unified scrape - combines Adzuna, Firecrawl, and RSS with AI classification
export async function scrapeAllSignals(region?: string, options?: { includeAdzuna?: boolean; includeRSS?: boolean; includeFirecrawl?: boolean }) {
  try {
    const { data: response, error } = await supabase.functions.invoke("scrape-signals", {
      body: { 
        region,
        includeAdzuna: options?.includeAdzuna ?? true,
        includeRSS: options?.includeRSS ?? true,
        includeFirecrawl: options?.includeFirecrawl ?? true,
      },
    });

    if (error) {
      console.error("Unified scrape error:", error);
      return { success: false, error: error.message };
    }

    return response;
  } catch (err) {
    console.error("Unified scrape failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Regional Surge Scraper v2.1 - with geo-validation and self-learning
export async function runRegionalSurge(region?: string) {
  try {
    const { data: response, error } = await supabase.functions.invoke("regional-surge", {
      body: { region },
    });

    if (error) {
      console.error("Regional surge error:", error);
      return { success: false, error: error.message };
    }

    return response;
  } catch (err) {
    console.error("Regional surge failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Submit feedback for signal (approve/reject)
export async function submitSignalFeedback(
  signalId: string, 
  action: 'APPROVE' | 'REJECT_NORDIC' | 'REJECT_WRONG_REGION',
  recruiter: string,
  reason?: string
) {
  try {
    // Update the signal's user_feedback
    const { error: updateError } = await supabase
      .from("signals")
      .update({
        user_feedback: action,
        validated_region: action === 'APPROVE' ? undefined : 'REJECTED',
      })
      .eq("id", signalId);

    if (updateError) throw updateError;

    // Log to feedback_log for self-learning
    const { error: logError } = await supabase
      .from("feedback_log")
      .insert({
        signal_id: signalId,
        recruiter,
        action,
        reason: reason || action,
      });

    if (logError) {
      console.error("Failed to log feedback:", logError);
    }

    return { success: true };
  } catch (err) {
    console.error("Submit feedback failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}



// Build Bullhorn note text for a signal
export function buildBullhornNote(signal: Signal): string {
  const parts: string[] = [];
  
  if (signal.company) {
    parts.push(`Company: ${signal.company}`);
  }
  
  parts.push(`Signal: ${signal.title}`);
  
  if (signal.tier) {
    const tierLabels: Record<string, string> = {
      tier_1: "Tier 1 – Immediate Hiring Intent",
      tier_2: "Tier 2 – Medium Intent",
      tier_3: "Tier 3 – Early Interest",
    };
    parts.push(`Priority: ${tierLabels[signal.tier] || signal.tier}`);
  }
  
  if (signal.score) {
    parts.push(`Score: ${signal.score}/100`);
  }
  
  if (signal.amount && signal.currency) {
    const symbol = signal.currency === "EUR" ? "€" : signal.currency === "GBP" ? "£" : "$";
    const amountStr = signal.amount >= 1000 
      ? `${symbol}${(signal.amount / 1000).toFixed(1)}B` 
      : `${symbol}${signal.amount}M`;
    parts.push(`Amount: ${amountStr}`);
  }
  
  if (signal.signal_type) {
    parts.push(`Type: ${signal.signal_type.replace(/_/g, " ").toUpperCase()}`);
  }
  
  if (signal.source) {
    parts.push(`Source: ${signal.source}`);
  }
  
  if (signal.url) {
    parts.push(`Link: ${signal.url}`);
  }
  
  parts.push(`Date: ${new Date().toLocaleDateString()}`);
  parts.push("— Added via Brock & Decker Signals");
  
  return parts.join("\n");
}

// Build Apollo search URL
export function buildApolloSearchUrl(signal: Signal): string {
  const baseUrl = "https://app.apollo.io/";
  const companyName = signal.company || "";
  const query = encodeURIComponent(companyName);
  return `${baseUrl}#/people?qKeywords=${query}`;
}

// Get enrichment preferences from signal
export function getSignalEnrichmentParams(signal: Signal): Record<string, string> {
  const params: Record<string, string> = {};
  
  if (signal.company) {
    params.company = signal.company;
  }
  
  if (signal.region) {
    const regionLocationMap: Record<string, string> = {
      europe: "London,Frankfurt,Paris,Amsterdam",
      uae: "Dubai,Abu Dhabi",
      usa: "New York,Boston,San Francisco,Los Angeles",
    };
    params.locations = regionLocationMap[signal.region] || "";
  }
  
  const signalTypeIndustryMap: Record<string, string> = {
    pe_vc_investment: "Private Equity,Venture Capital",
    fundraise_lbo: "Private Equity,Venture Capital",
    acquisition: "Private Equity,Investment Banking",
    new_ceo_cfo_chro: "Financial Services,Executive Leadership",
    new_fund_launch: "Private Equity,Venture Capital,Asset Management",
    rapid_job_postings: "Financial Services,Private Equity",
  };
  
  if (signal.signal_type && signalTypeIndustryMap[signal.signal_type]) {
    params.industries = signalTypeIndustryMap[signal.signal_type];
  }
  
  params.signalId = signal.id;
  params.signalTitle = signal.title;
  params.signalRegion = signal.region;
  if (signal.signal_type) params.signalType = signal.signal_type;
  if (signal.amount) params.signalAmount = signal.amount.toString();
  if (signal.currency) params.signalCurrency = signal.currency;
  if (signal.tier) params.signalTier = signal.tier;
  if (signal.score) params.signalScore = signal.score.toString();
  
  return params;
}

// Export signals to CSV
export function exportSignalsToCSV(signals: Signal[]): string {
  const headers = [
    "Company",
    "Tier",
    "Score",
    "Type",
    "Title",
    "Amount",
    "Currency",
    "Region",
    "Source",
    "Published",
    "URL",
  ];
  
  const rows = signals.map((s) => [
    s.company || "",
    s.tier || "",
    s.score?.toString() || "",
    s.signal_type || "",
    `"${(s.title || "").replace(/"/g, '""')}"`,
    s.amount?.toString() || "",
    s.currency || "",
    s.region || "",
    s.source || "",
    s.published_at ? new Date(s.published_at).toLocaleDateString() : "",
    s.url || "",
  ]);
  
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
