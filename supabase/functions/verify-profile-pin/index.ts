import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert bytes to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Convert hex string to bytes
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Secure PIN hashing using PBKDF2 with per-user salt
async function hashPin(pin: string, existingSalt?: string): Promise<{ hash: string; salt: string }> {
  const salt = existingSalt 
    ? hexToBytes(existingSalt)
    : crypto.getRandomValues(new Uint8Array(16));
  
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt).buffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  return {
    hash: bytesToHex(new Uint8Array(hashBuffer)),
    salt: bytesToHex(salt)
  };
}

// Legacy hash function for migration
async function legacyHashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "enrich-flow-salt-2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Rate limiting tracker
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(profileName: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(profileName);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(profileName, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  
  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

function resetRateLimit(profileName: string): void {
  rateLimitMap.delete(profileName);
}

// Retry wrapper for transient connection errors
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 300): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes("connection reset") || msg.includes("connection error") || msg.includes("SendRequest");
      if (i < retries && isTransient) {
        console.warn(`Retry ${i + 1}/${retries} after transient error: ${msg}`);
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, profileName, pin, adminProfile } = await req.json();

    if (!profileName && action !== "list-reset-requests" && action !== "get-admins") {
      return new Response(
        JSON.stringify({ success: false, error: "Profile name is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check if profile has a PIN set
    if (action === "check") {
      const { data, error } = await withRetry(() =>
        supabase
          .from("profile_pins")
          .select("id, reset_requested_at")
          .eq("profile_name", profileName)
          .maybeSingle()
      );

      if (error) throw error;

      return new Response(
        JSON.stringify({ 
          success: true, 
          hasPin: !!data,
          resetRequested: data?.reset_requested_at ? true : false
        }),
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

      const { hash: pinHash, salt } = await hashPin(pin);

      const { data: existing } = await withRetry(() =>
        supabase
          .from("profile_pins")
          .select("id")
          .eq("profile_name", profileName)
          .maybeSingle()
      );

      if (existing) {
        const { error } = await withRetry(() =>
          supabase
            .from("profile_pins")
            .update({ pin_hash: pinHash, salt: salt, reset_requested_at: null })
            .eq("profile_name", profileName)
        );
        if (error) throw error;
      } else {
        const { error } = await withRetry(() =>
          supabase
            .from("profile_pins")
            .insert({ profile_name: profileName, pin_hash: pinHash, salt: salt })
        );
        if (error) throw error;
      }

      resetRateLimit(profileName);

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

      if (!checkRateLimit(profileName)) {
        return new Response(
          JSON.stringify({ success: false, error: "Too many attempts. Please wait 15 minutes." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }

      const { data, error } = await withRetry(() =>
        supabase
          .from("profile_pins")
          .select("pin_hash, salt")
          .eq("profile_name", profileName)
          .maybeSingle()
      );

      if (error) throw error;

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: "No PIN set for this profile" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      let isValid = false;

      if (data.salt) {
        const { hash: inputHash } = await hashPin(pin, data.salt);
        isValid = data.pin_hash === inputHash;
      } else {
        const legacyHash = await legacyHashPin(pin);
        isValid = data.pin_hash === legacyHash;
        
        if (isValid) {
          const { hash: newHash, salt: newSalt } = await hashPin(pin);
          await withRetry(() =>
            supabase
              .from("profile_pins")
              .update({ pin_hash: newHash, salt: newSalt })
              .eq("profile_name", profileName)
          );
          console.log(`Migrated PIN hash for ${profileName} to PBKDF2`);
        }
      }

      if (isValid) {
        resetRateLimit(profileName);
      }

      return new Response(
        JSON.stringify({ success: true, valid: isValid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Request PIN reset
    if (action === "request-reset") {
      const { error } = await withRetry(() =>
        supabase
          .from("profile_pins")
          .update({ reset_requested_at: new Date().toISOString() })
          .eq("profile_name", profileName)
      );

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: "Reset request submitted. An admin will process it." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    if (action === "check-admin") {
      const { data, error } = await withRetry(() =>
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profileName)
          .eq("role", "admin")
          .maybeSingle()
      );

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, isAdmin: !!data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List all reset requests (admin only)
    if (action === "list-reset-requests") {
      if (!adminProfile) {
        return new Response(
          JSON.stringify({ success: false, error: "Admin profile required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { data: adminData } = await withRetry(() =>
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", adminProfile)
          .eq("role", "admin")
          .maybeSingle()
      );

      if (!adminData) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized - admin access required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }

      const { data, error } = await withRetry(() =>
        supabase
          .from("profile_pins")
          .select("profile_name, reset_requested_at")
          .not("reset_requested_at", "is", null)
          .order("reset_requested_at", { ascending: false })
      );

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, requests: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset PIN (admin only)
    if (action === "admin-reset") {
      if (!adminProfile) {
        return new Response(
          JSON.stringify({ success: false, error: "Admin profile required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { data: adminData } = await withRetry(() =>
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", adminProfile)
          .eq("role", "admin")
          .maybeSingle()
      );

      if (!adminData) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized - admin access required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }

      const { error } = await withRetry(() =>
        supabase
          .from("profile_pins")
          .delete()
          .eq("profile_name", profileName)
      );

      if (error) throw error;

      resetRateLimit(profileName);

      return new Response(
        JSON.stringify({ success: true, message: `PIN reset for ${profileName}. They can now set a new PIN.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    let message = "Unknown error";
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "object" && error !== null) {
      message = JSON.stringify(error);
    } else if (typeof error === "string") {
      message = error;
    }
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
