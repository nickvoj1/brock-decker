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
export async function scrapeJobSignals(region?: string) {
  try {
    const { data: response, error } = await supabase.functions.invoke("fetch-job-signals", {
      body: { region },
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
