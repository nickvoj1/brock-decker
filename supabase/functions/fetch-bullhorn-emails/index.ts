import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Pre-search Bullhorn email fetching
 * 
 * This function fetches ALL contact emails from Bullhorn CRM
 * so they can be excluded from Apollo searches to find NEW contacts only.
 * 
 * It uses Bullhorn's scroll API for efficient pagination through large datasets.
 */

async function getStoredBullhornTokens(supabase: any) {
  const { data, error } = await supabase
    .from("bullhorn_tokens")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null; // No tokens = Bullhorn not connected
  }

  // Check if token is expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    console.log("Token expired, refreshing...");
    return await refreshBullhornTokens(supabase, data.refresh_token);
  }

  return data;
}

async function refreshBullhornTokens(supabase: any, refreshToken: string) {
  // Get all credentials from api_settings
  const { data: settings } = await supabase
    .from("api_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["bullhorn_client_id", "bullhorn_client_secret", "bullhorn_username", "bullhorn_password"]);

  const clientId = settings?.find((s: any) => s.setting_key === "bullhorn_client_id")?.setting_value;
  const clientSecret = settings?.find((s: any) => s.setting_key === "bullhorn_client_secret")?.setting_value;
  const username = settings?.find((s: any) => s.setting_key === "bullhorn_username")?.setting_value;
  const password = settings?.find((s: any) => s.setting_key === "bullhorn_password")?.setting_value;

  if (!clientId || !clientSecret) {
    return null;
  }

  let tokenData: any = null;

  // First try refresh token
  if (refreshToken) {
    console.log("Attempting refresh token flow...");
    const tokenUrl = `https://auth.bullhornstaffing.com/oauth/token?grant_type=refresh_token&refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}`;
    const tokenResponse = await fetch(tokenUrl, { method: "POST" });
    tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      console.log("Refresh token failed, will try password grant...");
      tokenData = null;
    }
  }

  // If refresh failed, try password grant as fallback
  if (!tokenData?.access_token && username && password) {
    console.log("Attempting password grant flow for automatic reconnection...");
    
    const authUrl = `https://auth.bullhornstaffing.com/oauth/authorize?client_id=${clientId}&response_type=code&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=Login`;
    const authResponse = await fetch(authUrl, { redirect: "manual" });
    
    const location = authResponse.headers.get("location");
    const codeMatch = location?.match(/code=([^&]+)/);
    
    if (codeMatch) {
      const code = codeMatch[1];
      const tokenUrl = `https://auth.bullhornstaffing.com/oauth/token?grant_type=authorization_code&code=${code}&client_id=${clientId}&client_secret=${clientSecret}`;
      const tokenResponse = await fetch(tokenUrl, { method: "POST" });
      tokenData = await tokenResponse.json();
    }
  }

  if (!tokenData?.access_token) {
    return null;
  }

  // Get new REST token
  const loginUrl = `https://rest.bullhornstaffing.com/rest-services/login?version=*&access_token=${tokenData.access_token}`;
  const loginResponse = await fetch(loginUrl);
  const loginData = await loginResponse.json();

  if (!loginData.BhRestToken) {
    return null;
  }

  // Store new tokens
  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 600) * 1000).toISOString();
  
  await supabase.from("bullhorn_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("bullhorn_tokens").insert({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || refreshToken,
    bh_rest_token: loginData.BhRestToken,
    rest_url: loginData.restUrl,
    expires_at: expiresAt,
  });

  return {
    bh_rest_token: loginData.BhRestToken,
    rest_url: loginData.restUrl,
  };
}

async function fetchAllBullhornEmails(
  restUrl: string,
  bhRestToken: string
): Promise<string[]> {
  const allEmails: string[] = [];
  const BATCH_SIZE = 500;
  let start = 0;
  let hasMore = true;

  console.log("Starting Bullhorn email fetch...");

  while (hasMore) {
    try {
      // Use query endpoint to fetch emails in batches
      // Query all ClientContacts with a valid email
      const queryUrl = `${restUrl}query/ClientContact?BhRestToken=${bhRestToken}&fields=email&where=email IS NOT NULL AND isDeleted=false&count=${BATCH_SIZE}&start=${start}`;
      
      const response = await fetch(queryUrl);
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        console.log("Rate limited, waiting 1s...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      if (!response.ok) {
        console.error(`Bullhorn API error: ${response.status}`);
        break;
      }

      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const emails = data.data
          .map((c: any) => c.email?.toLowerCase())
          .filter((e: string | null | undefined) => e && e.includes('@'));
        
        allEmails.push(...emails);
        console.log(`Fetched ${emails.length} emails (total: ${allEmails.length})`);
        
        // Check if there are more results
        hasMore = data.data.length === BATCH_SIZE;
        start += BATCH_SIZE;
        
        // Small delay to avoid rate limits
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error("Error fetching Bullhorn emails:", error);
      break;
    }
  }

  console.log(`Total Bullhorn emails fetched: ${allEmails.length}`);
  return allEmails;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Bullhorn tokens (if connected)
    const tokens = await getStoredBullhornTokens(supabase);
    
    if (!tokens) {
      // Bullhorn not connected - return empty list (no exclusions)
      console.log("Bullhorn not connected, returning empty exclusion list");
      return new Response(
        JSON.stringify({ 
          success: true, 
          emails: [],
          connected: false,
          message: "Bullhorn not connected"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { rest_url: restUrl, bh_rest_token: bhRestToken } = tokens;

    // Fetch all emails from Bullhorn
    const emails = await fetchAllBullhornEmails(restUrl, bhRestToken);

    return new Response(
      JSON.stringify({
        success: true,
        emails,
        connected: true,
        count: emails.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        emails: [],
        connected: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
