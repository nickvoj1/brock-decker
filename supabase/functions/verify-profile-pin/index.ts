import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash function for PINs (not cryptographically strong, but sufficient for internal PIN)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "enrich-flow-salt-2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, profileName, pin } = await req.json();

    if (!profileName) {
      return new Response(
        JSON.stringify({ success: false, error: "Profile name is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check if profile has a PIN set
    if (action === "check") {
      const { data, error } = await supabase
        .from("profile_pins")
        .select("id")
        .eq("profile_name", profileName)
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, hasPin: !!data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set a new PIN
    if (action === "set") {
      if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        return new Response(
          JSON.stringify({ success: false, error: "PIN must be 4-6 digits" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const pinHash = await hashPin(pin);

      // Check if already exists
      const { data: existing } = await supabase
        .from("profile_pins")
        .select("id")
        .eq("profile_name", profileName)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("profile_pins")
          .update({ pin_hash: pinHash })
          .eq("profile_name", profileName);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("profile_pins")
          .insert({ profile_name: profileName, pin_hash: pinHash });

        if (error) throw error;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify PIN
    if (action === "verify") {
      if (!pin) {
        return new Response(
          JSON.stringify({ success: false, error: "PIN is required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("profile_pins")
        .select("pin_hash")
        .eq("profile_name", profileName)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: "No PIN set for this profile" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      const inputHash = await hashPin(pin);
      const isValid = data.pin_hash === inputHash;

      return new Response(
        JSON.stringify({ success: true, valid: isValid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
