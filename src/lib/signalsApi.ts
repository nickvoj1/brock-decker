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

export async function refreshSignals(profileName: string, region?: string) {
  try {
    const { data: response, error } = await supabase.functions.invoke("fetch-signals", {
      body: { region },
    });

    if (error) {
      console.error("Refresh signals error:", error);
      return { success: false, error: error.message };
    }

    return response as DataApiResponse<{ fetched: number; regionCounts: Record<string, number> }>;
  } catch (err) {
    console.error("Refresh signals failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
