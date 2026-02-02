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
  // Common patterns in PE/VC news titles:
  // "[Company] raises €X", "[Company] closes fund", "[Company] acquires..."
  // "French IT scale-up Fleet enters first LBO..."
  
  const patterns = [
    // "Company raises/closes/secures/announces..."
    /^([A-Z][A-Za-z0-9\s&\-\.]+?)\s+(raises|closes|secures|announces|completes|launches|acquires|enters|targets)/i,
    // "scale-up/startup Company..."
    /(?:scale-up|startup|fintech|proptech|healthtech|edtech|insurtech|legaltech)\s+([A-Z][A-Za-z0-9\s&\-\.]+?)\s+(enters|raises|closes|secures|announces)/i,
    // "Company's fund/deal..."
    /^([A-Z][A-Za-z0-9\s&\-\.]+?)(?:'s|')\s+(fund|first|new|latest)/i,
    // After colon pattern: "Type: Company announces..."
    /:\s*([A-Z][A-Za-z0-9\s&\-\.]+?)\s+(raises|closes|announces|launches)/i,
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      // Clean up the extracted company name
      let company = match[1].trim();
      // Remove common prefixes
      company = company.replace(/^(the|a|an)\s+/i, "");
      // Don't return if it's too generic
      if (company.length > 2 && company.length < 50) {
        return company;
      }
    }
  }
  
  // Fallback: look for capitalized proper nouns at the start
  const words = title.split(/\s+/);
  const properNouns: string[] = [];
  for (const word of words) {
    // Stop at common verbs/articles
    if (/^(raises|closes|secures|announces|is|has|have|the|a|an|and|or|in|at|for|to|of|with)$/i.test(word)) {
      break;
    }
    if (/^[A-Z]/.test(word) || /^[a-z]+tech$/i.test(word)) {
      properNouns.push(word);
    }
  }
  
  if (properNouns.length > 0 && properNouns.length <= 4) {
    return properNouns.join(" ");
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
