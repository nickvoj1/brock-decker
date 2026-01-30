import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting for API abuse prevention
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 100;
const WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(profileName: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(profileName);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(profileName, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  
  if (entry.count >= MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, profileName, data } = await req.json();

    if (!profileName) {
      return new Response(
        JSON.stringify({ success: false, error: "Profile name is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Rate limit check
    if (!checkRateLimit(profileName)) {
      return new Response(
        JSON.stringify({ success: false, error: "Rate limit exceeded. Please wait." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    // === CANDIDATE PROFILES ===
    if (action === "get-candidate-profiles") {
      const { data: profiles, error } = await supabase
        .from("candidate_profiles")
        .select("*")
        .eq("profile_name", profileName)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: profiles }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "save-candidate-profile") {
      const { candidateData } = data;
      if (!candidateData) {
        return new Response(
          JSON.stringify({ success: false, error: "Candidate data required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Check if exists
      const { data: existing } = await supabase
        .from("candidate_profiles")
        .select("id")
        .eq("candidate_id", candidateData.candidate_id)
        .eq("profile_name", profileName)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("candidate_profiles")
          .update({
            name: candidateData.name,
            current_title: candidateData.current_title,
            location: candidateData.location,
            email: candidateData.email,
            phone: candidateData.phone,
            summary: candidateData.summary,
            skills: candidateData.skills,
            work_history: candidateData.work_history,
            education: candidateData.education,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("candidate_profiles")
          .insert({
            ...candidateData,
            profile_name: profileName,
          });

        if (error) throw error;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-candidate-profile") {
      const { candidateId } = data;
      if (!candidateId) {
        return new Response(
          JSON.stringify({ success: false, error: "Candidate ID required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Delete by primary key 'id' (not candidate_id) and ensure profile ownership
      const { error } = await supabase
        .from("candidate_profiles")
        .delete()
        .eq("id", candidateId)
        .eq("profile_name", profileName);

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ENRICHMENT RUNS ===
    if (action === "get-enrichment-runs") {
      const { data: runs, error } = await supabase
        .from("enrichment_runs")
        .select("*")
        .eq("uploaded_by", profileName)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: runs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-enrichment-run") {
      const { runId } = data;
      if (!runId) {
        return new Response(
          JSON.stringify({ success: false, error: "Run ID required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { data: run, error } = await supabase
        .from("enrichment_runs")
        .select("*")
        .eq("id", runId)
        .eq("uploaded_by", profileName)
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: run }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create-enrichment-run") {
      const { runData } = data;
      const { data: newRun, error } = await supabase
        .from("enrichment_runs")
        .insert({
          ...runData,
          uploaded_by: profileName,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: newRun }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update-enrichment-run") {
      const { runId, updates } = data;
      if (!runId) {
        return new Response(
          JSON.stringify({ success: false, error: "Run ID required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { error } = await supabase
        .from("enrichment_runs")
        .update(updates)
        .eq("id", runId)
        .eq("uploaded_by", profileName);

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-enrichment-run") {
      const { runId } = data;
      if (!runId) {
        return new Response(
          JSON.stringify({ success: false, error: "Run ID required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { error } = await supabase
        .from("enrichment_runs")
        .delete()
        .eq("id", runId)
        .eq("uploaded_by", profileName);

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === PITCH TEMPLATES ===
    if (action === "get-pitch-templates") {
      const { data: templates, error } = await supabase
        .from("pitch_templates")
        .select("*")
        .eq("profile_name", profileName)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: templates }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "save-pitch-template") {
      const { template } = data;
      if (!template) {
        return new Response(
          JSON.stringify({ success: false, error: "Template data required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      if (template.id) {
        const { error } = await supabase
          .from("pitch_templates")
          .update({
            name: template.name,
            subject_template: template.subject_template,
            body_template: template.body_template,
            is_default: template.is_default,
          })
          .eq("id", template.id)
          .eq("profile_name", profileName);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pitch_templates")
          .insert({
            ...template,
            profile_name: profileName,
          });

        if (error) throw error;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-pitch-template") {
      const { templateId } = data;
      if (!templateId) {
        return new Response(
          JSON.stringify({ success: false, error: "Template ID required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { error } = await supabase
        .from("pitch_templates")
        .delete()
        .eq("id", templateId)
        .eq("profile_name", profileName);

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === GENERATED PITCHES ===
    if (action === "get-generated-pitches") {
      const { data: pitches, error } = await supabase
        .from("generated_pitches")
        .select("*")
        .eq("profile_name", profileName)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: pitches }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "save-generated-pitch") {
      const { pitch } = data;
      if (!pitch) {
        return new Response(
          JSON.stringify({ success: false, error: "Pitch data required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { error } = await supabase
        .from("generated_pitches")
        .insert({
          ...pitch,
          profile_name: profileName,
        });

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === API SETTINGS ===
    if (action === "get-api-settings") {
      const { data: settings, error } = await supabase
        .from("api_settings")
        .select("setting_key, is_configured");

      if (error) throw error;
      
      // Only return whether settings are configured, not the actual values
      const safeSettings = (settings || []).map(s => ({
        setting_key: s.setting_key,
        is_configured: s.is_configured,
      }));

      return new Response(
        JSON.stringify({ success: true, data: safeSettings }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "save-api-setting") {
      const { settingKey, settingValue } = data;
      if (!settingKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Setting key required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Check if exists
      const { data: existing } = await supabase
        .from("api_settings")
        .select("id")
        .eq("setting_key", settingKey)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("api_settings")
          .update({
            setting_value: settingValue,
            is_configured: !!settingValue,
          })
          .eq("setting_key", settingKey);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("api_settings")
          .insert({
            setting_key: settingKey,
            setting_value: settingValue,
            is_configured: !!settingValue,
          });

        if (error) throw error;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === BULLHORN TOKENS ===
    if (action === "get-bullhorn-status") {
      const { data: token, error } = await supabase
        .from("bullhorn_tokens")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (!token) {
        return new Response(
          JSON.stringify({ success: true, data: { connected: false, expired: false } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isExpired = token.expires_at ? new Date(token.expires_at) < new Date() : false;
      
      // Auto-refresh if expired
      if (isExpired) {
        console.log("Token expired, attempting auto-refresh...");
        
        const { data: settings } = await supabase
          .from("api_settings")
          .select("setting_key, setting_value")
          .in("setting_key", ["bullhorn_client_id", "bullhorn_client_secret", "bullhorn_username", "bullhorn_password"]);

        const creds: Record<string, string> = {};
        settings?.forEach((s: any) => {
          creds[s.setting_key] = s.setting_value;
        });

        if (creds.bullhorn_client_id && creds.bullhorn_client_secret) {
          let tokenData: any = null;

          // Try refresh token first
          if (token.refresh_token) {
            const tokenUrl = "https://auth.bullhornstaffing.com/oauth/token";
            const tokenParams = new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: token.refresh_token,
              client_id: creds.bullhorn_client_id,
              client_secret: creds.bullhorn_client_secret,
            });

            try {
              const tokenResponse = await fetch(tokenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: tokenParams.toString(),
              });

              if (tokenResponse.ok) {
                tokenData = await tokenResponse.json();
                if (!tokenData.access_token) tokenData = null;
              }
            } catch (e) {
              console.log("Refresh token failed:", e);
            }
          }

          // Fallback to password grant
          if (!tokenData?.access_token && creds.bullhorn_username && creds.bullhorn_password) {
            try {
              const authUrl = `https://auth.bullhornstaffing.com/oauth/authorize?client_id=${creds.bullhorn_client_id}&response_type=code&username=${encodeURIComponent(creds.bullhorn_username)}&password=${encodeURIComponent(creds.bullhorn_password)}&action=Login`;
              const authResponse = await fetch(authUrl, { redirect: "manual" });
              
              const location = authResponse.headers.get("location");
              const codeMatch = location?.match(/code=([^&]+)/);
              
              if (codeMatch) {
                const code = codeMatch[1];
                const tokenUrl = "https://auth.bullhornstaffing.com/oauth/token";
                const tokenParams = new URLSearchParams({
                  grant_type: "authorization_code",
                  code: code,
                  client_id: creds.bullhorn_client_id,
                  client_secret: creds.bullhorn_client_secret,
                });
                
                const tokenResponse = await fetch(tokenUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  body: tokenParams.toString(),
                });
                
                if (tokenResponse.ok) {
                  tokenData = await tokenResponse.json();
                }
              }
            } catch (e) {
              console.log("Password grant failed:", e);
            }
          }

          // If we got new tokens, get REST session and save
          if (tokenData?.access_token) {
            try {
              const loginUrl = `https://rest.bullhornstaffing.com/rest-services/login?version=*&access_token=${tokenData.access_token}`;
              const loginResponse = await fetch(loginUrl, { method: "GET" });

              if (loginResponse.ok) {
                const loginData = await loginResponse.json();
                const expiresAt = tokenData.expires_in 
                  ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
                  : null;

                await supabase.from("bullhorn_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
                
                await supabase.from("bullhorn_tokens").insert({
                  access_token: tokenData.access_token,
                  refresh_token: tokenData.refresh_token || token.refresh_token,
                  rest_url: loginData.restUrl,
                  bh_rest_token: loginData.BhRestToken,
                  expires_at: expiresAt,
                });

                console.log("Auto-refresh successful");
                return new Response(
                  JSON.stringify({ 
                    success: true, 
                    data: {
                      connected: true,
                      expired: false,
                      restUrl: loginData.restUrl,
                      expiresAt: expiresAt,
                    }
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            } catch (e) {
              console.log("REST login failed:", e);
            }
          }
        }
        
        // Auto-refresh failed, return expired status
        console.log("Auto-refresh failed, token remains expired");
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: {
              connected: false,
              expired: true,
              hasRefreshToken: !!token.refresh_token,
              restUrl: token.rest_url,
              expiresAt: token.expires_at,
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Token is valid
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            connected: true,
            expired: false,
            restUrl: token.rest_url,
            expiresAt: token.expires_at,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "refresh-bullhorn-tokens") {
      // Get current token with refresh_token
      const { data: token } = await supabase
        .from("bullhorn_tokens")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!token) {
        return new Response(
          JSON.stringify({ success: false, error: "No Bullhorn tokens found. Please connect first." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Get credentials for refresh
      const { data: settings } = await supabase
        .from("api_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["bullhorn_client_id", "bullhorn_client_secret", "bullhorn_username", "bullhorn_password"]);

      const creds: Record<string, string> = {};
      settings?.forEach((s: any) => {
        creds[s.setting_key] = s.setting_value;
      });

      if (!creds.bullhorn_client_id || !creds.bullhorn_client_secret) {
        return new Response(
          JSON.stringify({ success: false, error: "Bullhorn credentials not configured" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      let tokenData: any = null;

      // First try refresh token
      if (token.refresh_token) {
        console.log("Attempting refresh token flow...");
        const tokenUrl = "https://auth.bullhornstaffing.com/oauth/token";
        const tokenParams = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: token.refresh_token,
          client_id: creds.bullhorn_client_id,
          client_secret: creds.bullhorn_client_secret,
        });

        const tokenResponse = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenParams.toString(),
        });

        if (tokenResponse.ok) {
          tokenData = await tokenResponse.json();
          if (!tokenData.access_token) {
            console.log("Refresh token failed, will try password grant...");
            tokenData = null;
          }
        } else {
          const errorText = await tokenResponse.text();
          console.log("Refresh token failed:", errorText);
        }
      }

      // If refresh failed, try password grant as fallback
      if (!tokenData?.access_token && creds.bullhorn_username && creds.bullhorn_password) {
        console.log("Attempting password grant flow...");
        
        const authUrl = `https://auth.bullhornstaffing.com/oauth/authorize?client_id=${creds.bullhorn_client_id}&response_type=code&username=${encodeURIComponent(creds.bullhorn_username)}&password=${encodeURIComponent(creds.bullhorn_password)}&action=Login`;
        const authResponse = await fetch(authUrl, { redirect: "manual" });
        
        const location = authResponse.headers.get("location");
        const codeMatch = location?.match(/code=([^&]+)/);
        
        if (codeMatch) {
          const code = codeMatch[1];
          const tokenUrl = "https://auth.bullhornstaffing.com/oauth/token";
          const tokenParams = new URLSearchParams({
            grant_type: "authorization_code",
            code: code,
            client_id: creds.bullhorn_client_id,
            client_secret: creds.bullhorn_client_secret,
          });
          
          const tokenResponse = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenParams.toString(),
          });
          
          if (tokenResponse.ok) {
            tokenData = await tokenResponse.json();
          }
        }
      }

      if (!tokenData?.access_token) {
        return new Response(
          JSON.stringify({ success: false, error: "Token refresh failed. Please reconnect manually." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Get REST session
      const loginUrl = `https://rest.bullhornstaffing.com/rest-services/login?version=*&access_token=${tokenData.access_token}`;
      const loginResponse = await fetch(loginUrl, { method: "GET" });

      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        return new Response(
          JSON.stringify({ success: false, error: "REST login failed: " + errorText }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const loginData = await loginResponse.json();
      const expiresAt = tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;

      // Delete old and insert new tokens
      await supabase.from("bullhorn_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      
      const { error: insertError } = await supabase.from("bullhorn_tokens").insert({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || token.refresh_token,
        rest_url: loginData.restUrl,
        bh_rest_token: loginData.BhRestToken,
        expires_at: expiresAt,
      });

      if (insertError) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to save refreshed tokens" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      console.log("Bullhorn tokens refreshed successfully");
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            connected: true,
            restUrl: loginData.restUrl,
            expiresAt: expiresAt,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "clear-bullhorn-tokens") {
      const { error } = await supabase
        .from("bullhorn_tokens")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === PITCH TEMPLATES ===
    if (action === "get-pitch-templates") {
      const { data: templates, error } = await supabase
        .from("pitch_templates")
        .select("*")
        .eq("profile_name", profileName)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: templates }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "save-pitch-template") {
      const { template } = data;
      if (!template) {
        return new Response(
          JSON.stringify({ success: false, error: "Template data required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { data: newTemplate, error } = await supabase
        .from("pitch_templates")
        .insert({
          profile_name: profileName,
          name: template.name,
          subject_template: template.subject_template || null,
          body_template: template.body_template,
          is_default: template.is_default || false,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: newTemplate }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-pitch-template") {
      const { templateId } = data;
      if (!templateId) {
        return new Response(
          JSON.stringify({ success: false, error: "Template ID required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { error } = await supabase
        .from("pitch_templates")
        .delete()
        .eq("id", templateId)
        .eq("profile_name", profileName);

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "set-default-template") {
      const { templateId } = data;
      if (!templateId) {
        return new Response(
          JSON.stringify({ success: false, error: "Template ID required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Unset all defaults for this profile
      await supabase
        .from("pitch_templates")
        .update({ is_default: false })
        .eq("profile_name", profileName);

      // Set the new default
      const { error } = await supabase
        .from("pitch_templates")
        .update({ is_default: true })
        .eq("id", templateId)
        .eq("profile_name", profileName);

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === GENERATED PITCHES (History) ===
    if (action === "get-pitch-history") {
      const { data: pitches, error } = await supabase
        .from("generated_pitches")
        .select("*")
        .eq("profile_name", profileName)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, data: pitches }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "save-pitch") {
      const { pitch } = data;
      if (!pitch) {
        return new Response(
          JSON.stringify({ success: false, error: "Pitch data required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { error } = await supabase
        .from("generated_pitches")
        .insert({
          profile_name: profileName,
          template_id: pitch.template_id || null,
          candidate_name: pitch.candidate_name,
          candidate_title: pitch.candidate_title || null,
          subject: pitch.subject || null,
          body: pitch.body,
          industries: pitch.industries || [],
          locations: pitch.locations || [],
        });

      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ADMIN PANEL (Admin only) ===
    if (action === "admin-get-all-activity") {
      // Verify admin access - only Nikita Vojevoda can access
      if (profileName !== "Nikita Vojevoda") {
        return new Response(
          JSON.stringify({ success: false, error: "Access denied. Admin only." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }

      // Get all enrichment runs from all users
      const { data: runs, error: runsError } = await supabase
        .from("enrichment_runs")
        .select("id, uploaded_by, status, candidates_count, processed_count, created_at, updated_at, preferences_data")
        .order("created_at", { ascending: false })
        .limit(100);

      if (runsError) throw runsError;

      // Get all generated pitches from all users
      const { data: pitches, error: pitchesError } = await supabase
        .from("generated_pitches")
        .select("id, profile_name, candidate_name, candidate_title, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (pitchesError) throw pitchesError;

      // Get all candidate profiles from all users
      const { data: candidates, error: candidatesError } = await supabase
        .from("candidate_profiles")
        .select("id, profile_name, name, current_title, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (candidatesError) throw candidatesError;

      // Calculate stats per user
      const userStats: Record<string, { runs: number; pitches: number; candidates: number }> = {};
      
      runs?.forEach((r: any) => {
        const user = r.uploaded_by || "Unknown";
        if (!userStats[user]) userStats[user] = { runs: 0, pitches: 0, candidates: 0 };
        userStats[user].runs++;
      });

      pitches?.forEach((p: any) => {
        const user = p.profile_name || "Unknown";
        if (!userStats[user]) userStats[user] = { runs: 0, pitches: 0, candidates: 0 };
        userStats[user].pitches++;
      });

      candidates?.forEach((c: any) => {
        const user = c.profile_name || "Unknown";
        if (!userStats[user]) userStats[user] = { runs: 0, pitches: 0, candidates: 0 };
        userStats[user].candidates++;
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { 
            runs: runs || [], 
            pitches: pitches || [], 
            candidates: candidates || [],
            userStats 
          } 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === TEAM DASHBOARD STATS ===
    if (action === "get-team-dashboard-stats") {
      // Get stats from enrichment_runs (Apollo contacts found)
      const { data: runs, error: runsError } = await supabase
        .from("enrichment_runs")
        .select("uploaded_by, created_at, enriched_data, status, bullhorn_exported_at");

      if (runsError) throw runsError;

      // Aggregate by uploaded_by (profile_name)
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);

      const statsMap: Record<string, {
        profile_name: string;
        total_runs: number;
        runs_today: number;
        runs_week: number;
        total_contacts: number;
        contacts_today: number;
        contacts_week: number;
        successful_runs: number;
        bullhorn_exported: number;
      }> = {};

      (runs || []).forEach((r: any) => {
        const pn = r.uploaded_by || "Unknown";
        if (!statsMap[pn]) {
          statsMap[pn] = {
            profile_name: pn,
            total_runs: 0,
            runs_today: 0,
            runs_week: 0,
            total_contacts: 0,
            contacts_today: 0,
            contacts_week: 0,
            successful_runs: 0,
            bullhorn_exported: 0,
          };
        }

        const createdAt = new Date(r.created_at);
        const contacts = Array.isArray(r.enriched_data) ? r.enriched_data.length : 0;
        const isToday = createdAt >= todayStart;
        const isThisWeek = createdAt >= weekStart;

        statsMap[pn].total_runs++;
        statsMap[pn].total_contacts += contacts;

        if (isToday) {
          statsMap[pn].runs_today++;
          statsMap[pn].contacts_today += contacts;
        }
        if (isThisWeek) {
          statsMap[pn].runs_week++;
          statsMap[pn].contacts_week += contacts;
        }

        if (r.status === 'success' || r.status === 'partial') {
          statsMap[pn].successful_runs++;
        }

        if (r.bullhorn_exported_at) {
          statsMap[pn].bullhorn_exported++;
        }
      });

      // Calculate success rates and format stats
      const stats = Object.values(statsMap).map(s => ({
        profile_name: s.profile_name,
        total_runs: s.total_runs,
        runs_today: s.runs_today,
        runs_week: s.runs_week,
        total_contacts: s.total_contacts,
        contacts_today: s.contacts_today,
        contacts_week: s.contacts_week,
        success_rate: s.total_runs > 0 
          ? Math.round((s.successful_runs / s.total_runs) * 100)
          : 0,
        avg_contacts_per_run: s.total_runs > 0
          ? Math.round(s.total_contacts / s.total_runs)
          : 0,
        bullhorn_exported: s.bullhorn_exported,
      }));

      // Aggregate hourly data for the past 24 hours
      const hours24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const hourlyMap: Record<string, number> = {};

      // Initialize all 24 hours with 0
      for (let i = 0; i < 24; i++) {
        const hourDate = new Date(now);
        hourDate.setHours(now.getHours() - 23 + i, 0, 0, 0);
        const hourKey = hourDate.toISOString().slice(11, 13) + ":00";
        hourlyMap[hourKey] = 0;
      }

      // Aggregate contacts by hour
      (runs || []).forEach((r: any) => {
        const createdAt = new Date(r.created_at);
        if (createdAt >= hours24Ago) {
          const hourKey = createdAt.toISOString().slice(11, 13) + ":00";
          const contacts = Array.isArray(r.enriched_data) ? r.enriched_data.length : 0;
          if (hourlyMap[hourKey] !== undefined) {
            hourlyMap[hourKey] += contacts;
          }
        }
      });

      // Convert to array sorted by hour
      const hourlyData = Object.entries(hourlyMap)
        .map(([hour, contacts]) => ({ hour, contacts }))
        .sort((a, b) => {
          // Sort by hour, handling midnight wrap-around
          const aHour = parseInt(a.hour);
          const bHour = parseInt(b.hour);
          const currentHour = now.getHours();
          // Adjust hours relative to current hour for proper sorting
          const aOffset = (aHour - currentHour + 24 + 1) % 24;
          const bOffset = (bHour - currentHour + 24 + 1) % 24;
          return aOffset - bOffset;
        });

      return new Response(
        JSON.stringify({ success: true, data: { stats, hourlyData } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error) {
    console.error("Data API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
