import { supabase } from "@/integrations/supabase/client";

export interface SignalSearchContact {
  name: string;
  title: string;
  location: string;
  email: string;
  company: string;
}

export interface SignalSearchResult {
  contacts: SignalSearchContact[];
  strategy: string;
  targetCompany: string;
  industries: string[];
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
 * 2. Auto-detects the industry based on signal type and company name
 * 3. Uses the signal's region for location targeting
 * 4. Retries with different strategies until contacts are found
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
