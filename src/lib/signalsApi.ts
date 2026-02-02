import { supabase } from "@/integrations/supabase/client";

export interface Signal {
  id: string;
  title: string;
  company: string | null;
  region: string;
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
  created_at: string;
}

export interface SignalsResponse {
  signals: Signal[];
  regionCounts: Record<string, number>;
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

    // The edge function returns { success, fetched, regionCounts, message } directly
    // Wrap it in a data property to match the expected DataApiResponse format
    if (response && response.success) {
      return { 
        success: true, 
        data: { 
          fetched: response.fetched || 0, 
          regionCounts: response.regionCounts || {} 
        } 
      };
    }

    return { success: false, error: response?.error || "Unknown error" };
  } catch (err) {
    console.error("Refresh signals failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Extract company name from signal title if company field is empty
function extractCompanyFromTitle(title: string): string {
  // Clean title - remove leading descriptors
  let cleanTitle = title
    .replace(/^(breaking|exclusive|update|report|news|watch):\s*/i, "")
    .replace(/^(french|german|uk|british|european|spanish|dutch|swiss|us|american)\s+/i, "")
    .replace(/^(fintech|proptech|healthtech|edtech|insurtech|legaltech|deeptech|biotech|cleantech)\s+/i, "")
    .replace(/^(it\s+)?scale-up\s+/i, "")
    .replace(/^startup\s+/i, "")
    .trim();
  
  // Extract company BEFORE common action verbs
  const verbPattern = /^([A-Z][A-Za-z0-9''\-\.&\s]{1,40}?)\s+(?:raises|closes|secures|announces|completes|launches|acquires|enters|targets|opens|hires|appoints|names|promotes|backs|invests|exits|sells|buys|takes|signs|expands|reaches|receives|lands|wins|gets|has|is|to|in|at|for|joins|adds|extends)/i;
  
  const match = cleanTitle.match(verbPattern);
  if (match) {
    let company = match[1]
      .trim()
      .replace(/['']s$/i, "") // Remove possessive
      .replace(/\s+/g, " "); // Normalize spaces
    
    // Skip if it's a generic phrase
    const skipPhrases = [
      "the", "a", "an", "new", "report", "update", "breaking", "exclusive",
      "bootstrapped for seven years", "backed by", "formerly known as",
      "sources say", "according to", "report says", "rumor has it"
    ];
    
    if (skipPhrases.some(phrase => company.toLowerCase() === phrase || company.toLowerCase().startsWith(phrase + " "))) {
      return "";
    }
    
    // Valid company name
    if (company.length >= 2 && company.length <= 50) {
      return company;
    }
  }
  
  // Fallback: Look for known PE/VC fund name patterns
  const fundPatterns = [
    /([A-Z][A-Za-z0-9\s&]{2,25}?(?:Capital|Partners|Ventures|Equity|Investment|Advisors|Management|Group|Holdings))\s+(?:closes|raises|launches|announces)/i,
    /:\s*([A-Z][A-Za-z0-9\-\.&\s]{2,30}?)\s+(?:raises|closes|announces|launches|acquires)/i,
    /(?:backed|acquired|led|funded)\s+by\s+([A-Z][A-Za-z0-9\-\.&\s]{2,30})/i,
  ];
  
  for (const pattern of fundPatterns) {
    const fundMatch = title.match(pattern);
    if (fundMatch) {
      return fundMatch[1].trim();
    }
  }
  
  return "";
}

// Build Apollo search URL for a signal
export function buildApolloSearchUrl(signal: Signal): string {
  const baseUrl = "https://app.apollo.io/";
  const companyName = signal.company || extractCompanyFromTitle(signal.title);
  
  // This creates a search query that would work in Apollo
  // In practice, we navigate to our own enrichment page
  const query = encodeURIComponent(companyName);
  return `${baseUrl}#/people?qKeywords=${query}`;
}

// Build Bullhorn note text for a signal
export function buildBullhornNote(signal: Signal): string {
  const parts: string[] = [];
  const companyName = signal.company || extractCompanyFromTitle(signal.title);
  
  if (companyName) {
    parts.push(`Company: ${companyName}`);
  }
  
  parts.push(`Signal: ${signal.title}`);
  
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

// Get enrichment preferences from signal
export function getSignalEnrichmentParams(signal: Signal): Record<string, string> {
  const params: Record<string, string> = {};
  
  // Extract company name from signal.company or parse from title
  const companyName = signal.company || extractCompanyFromTitle(signal.title);
  if (companyName) {
    params.company = companyName;
  }
  
  if (signal.region) {
    // Map signal region to location preferences
    const regionLocationMap: Record<string, string> = {
      europe: "London,Frankfurt,Paris",
      uae: "Dubai,Abu Dhabi",
      east_usa: "New York,Boston",
      west_usa: "San Francisco,Los Angeles",
    };
    params.locations = regionLocationMap[signal.region] || "";
  }
  
  // Map signal type to likely industries
  const signalTypeIndustryMap: Record<string, string> = {
    fund_close: "Private Equity,Venture Capital,Asset Management",
    new_fund: "Private Equity,Venture Capital,Asset Management",
    deal: "Private Equity,Investment Banking,Corporate Finance",
    exit: "Private Equity,Venture Capital",
    expansion: "Financial Services,Investment Management",
    senior_hire: "Financial Services,Private Equity",
  };
  
  if (signal.signal_type && signalTypeIndustryMap[signal.signal_type]) {
    params.industries = signalTypeIndustryMap[signal.signal_type];
  }
  
  // Add additional signal context for display
  params.signalId = signal.id;
  params.signalTitle = signal.title;
  params.signalRegion = signal.region;
  if (signal.signal_type) params.signalType = signal.signal_type;
  if (signal.amount) params.signalAmount = signal.amount.toString();
  if (signal.currency) params.signalCurrency = signal.currency;
  
  return params;
}
