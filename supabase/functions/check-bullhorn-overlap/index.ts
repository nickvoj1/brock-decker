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
    throw new Error("Bullhorn client credentials not configured");
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
    
    // Step 1: Get authorization code using password grant
    const authUrl = `https://auth.bullhornstaffing.com/oauth/authorize?client_id=${clientId}&response_type=code&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=Login`;
    const authResponse = await fetch(authUrl, { redirect: "manual" });
    
    // Extract code from redirect location
    const location = authResponse.headers.get("location");
    const codeMatch = location?.match(/code=([^&]+)/);
    
    if (codeMatch) {
      const code = codeMatch[1];
      
      // Step 2: Exchange code for tokens
      const tokenUrl = `https://auth.bullhornstaffing.com/oauth/token?grant_type=authorization_code&code=${code}&client_id=${clientId}&client_secret=${clientSecret}`;
      const tokenResponse = await fetch(tokenUrl, { method: "POST" });
      tokenData = await tokenResponse.json();
      
      if (tokenData.access_token) {
        console.log("Password grant successful, obtained new tokens");
      }
    }
  }

  if (!tokenData?.access_token) {
    console.error("All Bullhorn authentication methods failed");
    throw new Error("Bullhorn session expired. Please reconnect to Bullhorn from Settings.");
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
  
  // Delete old tokens and insert new one
  await supabase.from("bullhorn_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("bullhorn_tokens").insert({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || refreshToken,
    bh_rest_token: loginData.BhRestToken,
    rest_url: loginData.restUrl,
    expires_at: expiresAt,
  });

  console.log("Bullhorn tokens refreshed and stored successfully");

  return {
    bh_rest_token: loginData.BhRestToken,
    rest_url: loginData.restUrl,
  };
}

interface ContactCheckResult {
  email: string;
  exists: boolean;
  recentNote: boolean;
  lastNoteDate?: string;
  lastNoteText?: string;
  lastNoteBy?: string;
}

async function checkContactInBullhorn(
  restUrl: string,
  bhRestToken: string,
  email: string
): Promise<ContactCheckResult> {
  try {
    // Search for the contact by email
    const searchUrl = `${restUrl}search/ClientContact?BhRestToken=${bhRestToken}&query=email:"${email}"&fields=id&count=1`;
    const response = await fetch(searchUrl);
    
    if (response.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return checkContactInBullhorn(restUrl, bhRestToken, email);
    }
    
    const data = await response.json();
    
    if (data.count === 0) {
      return { email, exists: false, recentNote: false };
    }
    
    const contactId = data.data[0].id;
    
    // Check for notes on this contact from the last 2 weeks AND get the most recent note
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoTimestamp = twoWeeksAgo.getTime();
    
    // Get notes for ClientContact using the association endpoint
    // This is the standard way to get notes linked to a ClientContact
    const notesUrl = `${restUrl}entity/ClientContact/${contactId}/notes?BhRestToken=${bhRestToken}&fields=id,dateAdded,comments,commentingPerson&orderBy=-dateAdded&count=1`;
    console.log(`Querying notes for ClientContact ${contactId}`);
    const notesResponse = await fetch(notesUrl);
    
    if (notesResponse.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return checkContactInBullhorn(restUrl, bhRestToken, email);
    }
    
    const notesData = await notesResponse.json();
    console.log(`Notes response for ${email}:`, JSON.stringify(notesData));
    
    let lastNoteDate: string | undefined;
    let lastNoteText: string | undefined;
    let lastNoteBy: string | undefined;
    let hasRecentNote = false;
    
    // The association endpoint returns { data: [...] } format
    if (notesData.data && notesData.data.length > 0) {
      const note = notesData.data[0];
      const noteTimestamp = note.dateAdded;
      lastNoteDate = new Date(noteTimestamp).toISOString();
      
      // Extract first 100 chars of note, strip HTML tags
      const rawText = (note.comments || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      lastNoteText = rawText.length > 100 ? rawText.substring(0, 100) + '...' : rawText;
      
      // Get commentingPerson name if available
      if (note.commentingPerson) {
        lastNoteBy = `${note.commentingPerson.firstName || ''} ${note.commentingPerson.lastName || ''}`.trim();
      }
      
      // Check if this note is within the last 2 weeks
      hasRecentNote = noteTimestamp > twoWeeksAgoTimestamp;
    }
    
    return { 
      email, 
      exists: true, 
      recentNote: hasRecentNote,
      lastNoteDate,
      lastNoteText,
      lastNoteBy,
    };
  } catch (error) {
    console.error(`Error checking contact ${email}:`, error);
    return { email, exists: false, recentNote: false };
  }
}

Deno.serve(async (req) => {
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
        JSON.stringify({ success: true, existingCount: 0, totalCount: 0, existingEmails: [], contactDetails: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Bullhorn tokens
    const tokens = await getStoredBullhornTokens(supabase);
    const { rest_url: restUrl, bh_rest_token: bhRestToken } = tokens;

    console.log(`Checking ${contacts.length} contacts against Bullhorn...`);

    // Check each contact in batches to avoid rate limits
    const existingEmails: string[] = [];
    const recentNoteEmails: string[] = [];
    const contactDetails: Record<string, { lastNoteDate?: string; lastNoteText?: string; lastNoteBy?: string }> = {};
    const batchSize = 5;
    
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (contact: any) => {
          if (!contact.email) return null;
          return await checkContactInBullhorn(restUrl, bhRestToken, contact.email);
        })
      );
      
      for (const result of results) {
        if (result && result.email) {
          if (result.exists) {
            existingEmails.push(result.email);
            // Store contact details for UI
            contactDetails[result.email] = {
              lastNoteDate: result.lastNoteDate,
              lastNoteText: result.lastNoteText,
              lastNoteBy: result.lastNoteBy,
            };
          }
          if (result.recentNote) {
            recentNoteEmails.push(result.email);
          }
        }
      }
      
      // Small delay between batches
      if (i + batchSize < contacts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`Found ${existingEmails.length} contacts already in Bullhorn, ${recentNoteEmails.length} with recent notes`);

    return new Response(
      JSON.stringify({
        success: true,
        existingCount: existingEmails.length,
        recentNoteCount: recentNoteEmails.length,
        totalCount: contacts.length,
        existingEmails,
        recentNoteEmails,
        contactDetails,
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
