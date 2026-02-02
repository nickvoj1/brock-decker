import { supabase } from "@/integrations/supabase/client";

export interface SignalSearchContact {
  name: string;
  title: string;
  location: string;
  email: string;
  company: string;
  category: string;
}

export interface SignalSearchResult {
  contacts: SignalSearchContact[];
  strategy: string;
  targetCompany: string;
  categoriesTried: string[];
  categoriesWithResults: string[];
}

export interface SignalAutoSearchResponse {
  success: boolean;
  data?: SignalSearchResult;
  error?: string;
}

/**
 * Run automatic Apollo search for a signal.
 * This function:
 * 1. Auto-detects the company from the signal
 * 2. Uses the signal's region for location targeting
 * 3. Tries ALL role categories (HR, Leadership, Finance, Legal, Strategy)
 * 4. Retries with different company name variants and location levels
 */
export async function runSignalAutoSearch(
  signalId: string,
  profileName: string
): Promise<SignalAutoSearchResponse> {
  try {
    const { data: response, error } = await supabase.functions.invoke("signal-auto-search", {
      body: {
        signalId,
        profileName,
      },
    });

    if (error) {
      console.error("Signal auto-search error:", error);
      return { success: false, error: error.message };
    }

    return response as SignalAutoSearchResponse;
  } catch (err) {
    console.error("Signal auto-search failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
