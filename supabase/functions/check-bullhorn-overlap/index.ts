import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getStoredBullhornTokens(supabase: any) {
  const { data, error } = await supabase
    .from("bullhorn_tokens")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("No Bullhorn tokens found. Please reconnect to Bullhorn.");
  }

  // Check if token is expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    console.log("Token expired, refreshing...");
    return await refreshBullhornTokens(supabase, data.refresh_token);
  }

  return data;
}

async function refreshBullhornTokens(supabase: any, refreshToken: string) {
  // Get client credentials from api_settings
  const { data: settings } = await supabase
    .from("api_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["bullhorn_client_id", "bullhorn_client_secret"]);

  const clientId = settings?.find((s: any) => s.setting_key === "bullhorn_client_id")?.setting_value;
  const clientSecret = settings?.find((s: any) => s.setting_key === "bullhorn_client_secret")?.setting_value;

  if (!clientId || !clientSecret) {
    throw new Error("Bullhorn client credentials not configured");
  }

  // Exchange refresh token for new access token
  const tokenUrl = `https://auth.bullhornstaffing.com/oauth/token?grant_type=refresh_token&refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}`;
  const tokenResponse = await fetch(tokenUrl, { method: "POST" });
  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    throw new Error("Failed to refresh Bullhorn token");
  }

  // Get new REST token
  const loginUrl = `https://rest.bullhornstaffing.com/rest-services/login?version=*&access_token=${tokenData.access_token}`;
  const loginResponse = await fetch(loginUrl);
  const loginData = await loginResponse.json();

  if (!loginData.BhRestToken) {
    throw new Error("Failed to get Bullhorn REST token");
  }

  // Store new tokens
  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 600) * 1000).toISOString();
  await supabase
    .from("bullhorn_tokens")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refreshToken,
      bh_rest_token: loginData.BhRestToken,
      rest_url: loginData.restUrl,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("refresh_token", refreshToken);

  return {
    bh_rest_token: loginData.BhRestToken,
    rest_url: loginData.restUrl,
  };
}

async function checkContactExistsInBullhorn(
  restUrl: string,
  bhRestToken: string,
  email: string
): Promise<boolean> {
  try {
    const searchUrl = `${restUrl}search/ClientContact?BhRestToken=${bhRestToken}&query=email:"${email}"&fields=id&count=1`;
    const response = await fetch(searchUrl);
    
    if (response.status === 429) {
      // Rate limited, wait and retry
      await new Promise(resolve => setTimeout(resolve, 500));
      return checkContactExistsInBullhorn(restUrl, bhRestToken, email);
    }
    
    const data = await response.json();
    return data.count > 0;
  } catch (error) {
    console.error(`Error checking contact ${email}:`, error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { runId } = await req.json();

    if (!runId) {
      throw new Error("runId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the run's enriched contacts
    const { data: run, error: runError } = await supabase
      .from("enrichment_runs")
      .select("enriched_data")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      throw new Error("Run not found");
    }

    const contacts = (run.enriched_data as any[]) || [];
    if (contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, existingCount: 0, totalCount: 0, existingEmails: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Bullhorn tokens
    const tokens = await getStoredBullhornTokens(supabase);
    const { rest_url: restUrl, bh_rest_token: bhRestToken } = tokens;

    console.log(`Checking ${contacts.length} contacts against Bullhorn...`);

    // Check each contact in batches to avoid rate limits
    const existingEmails: string[] = [];
    const batchSize = 5;
    
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (contact: any) => {
          if (!contact.email) return { email: null, exists: false };
          const exists = await checkContactExistsInBullhorn(restUrl, bhRestToken, contact.email);
          return { email: contact.email, exists };
        })
      );
      
      for (const result of results) {
        if (result.exists && result.email) {
          existingEmails.push(result.email);
        }
      }
      
      // Small delay between batches
      if (i + batchSize < contacts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`Found ${existingEmails.length} contacts already in Bullhorn`);

    return new Response(
      JSON.stringify({
        success: true,
        existingCount: existingEmails.length,
        totalCount: contacts.length,
        existingEmails,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
