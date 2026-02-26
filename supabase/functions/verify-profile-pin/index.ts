import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  // Generate unique salt per user if not provided (16 bytes = 128 bits)
  const salt = existingSalt 
    ? hexToBytes(existingSalt)
    : crypto.getRandomValues(new Uint8Array(16));
  
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  
  // Import key for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  // Derive key with 100,000 iterations (OWASP recommended minimum)
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

// Legacy hash function for migration (will be removed after all PINs migrated)
async function legacyHashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "enrich-flow-salt-2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Rate limiting tracker (in-memory, resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

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

const RETRY_DELAYS_MS = [150, 450, 1000];

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const maybe = error as { message?: unknown; details?: unknown; error?: unknown };
    if (typeof maybe.message === "string" && maybe.message.trim().length > 0) return maybe.message;
    if (typeof maybe.error === "string" && maybe.error.trim().length > 0) return maybe.error;
    if (typeof maybe.details === "string" && maybe.details.trim().length > 0) return maybe.details;
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }
  return "Unknown error";
}

function isTransientNetworkError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return (
    message.includes("connection reset") ||
    message.includes("sendrequest") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("timed out") ||
    message.includes("temporarily unavailable") ||
    message.includes("econnreset") ||
    message.includes("socket") ||
    message.includes("tls")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQueryWithRetry<T>(
  label: string,
  queryFn: () => Promise<{ data: T; error: unknown }>,
): Promise<{ data: T; error: unknown }> {
  let lastTransientError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const result = await queryFn();
      if (!result.error) return result;

      if (!isTransientNetworkError(result.error)) return result;
      lastTransientError = result.error;
    } catch (error) {
      if (!isTransientNetworkError(error)) throw error;
      lastTransientError = error;
    }

    if (attempt >= RETRY_DELAYS_MS.length) break;
    const delay = RETRY_DELAYS_MS[attempt];
    console.warn(`[verify-profile-pin] transient error on ${label}; retrying in ${delay}ms`);
    await sleep(delay);
  }

  throw lastTransientError ?? new Error(`Transient error in ${label}`);
}

serve(async (req) => {
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
      const { data, error } = await runQueryWithRetry("check-pin", () =>
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

      // Generate new hash with per-user salt
      const { hash: pinHash, salt } = await hashPin(pin);

      // Check if already exists
      const { data: existing, error: existingError } = await runQueryWithRetry("get-existing-pin", () =>
        supabase
          .from("profile_pins")
          .select("id")
          .eq("profile_name", profileName)
          .maybeSingle()
      );
      if (existingError) throw existingError;

      if (existing) {
        // Update existing with new hash and salt
        const { error } = await runQueryWithRetry("update-pin", () =>
          supabase
            .from("profile_pins")
            .update({ pin_hash: pinHash, salt: salt, reset_requested_at: null })
            .eq("profile_name", profileName)
        );

        if (error) throw error;
      } else {
        // Insert new with hash and salt
        const { error } = await runQueryWithRetry("insert-pin", () =>
          supabase
            .from("profile_pins")
            .insert({ profile_name: profileName, pin_hash: pinHash, salt: salt })
        );

        if (error) throw error;
      }

      // Clear rate limit on successful PIN set
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

      // Check rate limit
      if (!checkRateLimit(profileName)) {
        return new Response(
          JSON.stringify({ success: false, error: "Too many attempts. Please wait 15 minutes." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }

      const { data, error } = await runQueryWithRetry("verify-pin-load", () =>
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

      // Check if using new PBKDF2 hash (has salt) or legacy SHA-256
      if (data.salt) {
        // New secure hashing with per-user salt
        const { hash: inputHash } = await hashPin(pin, data.salt);
        isValid = data.pin_hash === inputHash;
      } else {
        // Legacy hash - verify and migrate to new format
        const legacyHash = await legacyHashPin(pin);
        isValid = data.pin_hash === legacyHash;
        
        // If valid legacy hash, migrate to new secure hash
        if (isValid) {
          const { hash: newHash, salt: newSalt } = await hashPin(pin);
          const { error: migrationError } = await runQueryWithRetry("migrate-legacy-pin", () =>
            supabase
              .from("profile_pins")
              .update({ pin_hash: newHash, salt: newSalt })
              .eq("profile_name", profileName)
          );
          if (migrationError) throw migrationError;
          console.log(`Migrated PIN hash for ${profileName} to PBKDF2`);
        }
      }

      // Clear rate limit on successful verification
      if (isValid) {
        resetRateLimit(profileName);
      }

      return new Response(
        JSON.stringify({ success: true, valid: isValid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Request PIN reset (by user who forgot their PIN)
    if (action === "request-reset") {
      const { error } = await runQueryWithRetry("request-pin-reset", () =>
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
      const { data, error } = await runQueryWithRetry("check-admin", () =>
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

      // Verify admin status
      const { data: adminData, error: adminError } = await runQueryWithRetry("list-reset-requests-admin-check", () =>
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", adminProfile)
          .eq("role", "admin")
          .maybeSingle()
      );
      if (adminError) throw adminError;

      if (!adminData) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized - admin access required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }

      const { data, error } = await runQueryWithRetry("list-reset-requests", () =>
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

      // Verify admin status
      const { data: adminData, error: adminError } = await runQueryWithRetry("admin-reset-admin-check", () =>
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", adminProfile)
          .eq("role", "admin")
          .maybeSingle()
      );
      if (adminError) throw adminError;

      if (!adminData) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized - admin access required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }

      // Delete the PIN so user can set a new one
      const { error } = await runQueryWithRetry("admin-reset-delete-pin", () =>
        supabase
          .from("profile_pins")
          .delete()
          .eq("profile_name", profileName)
      );

      if (error) throw error;

      // Clear rate limit for the reset profile
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
    const rawMessage = extractErrorMessage(error);
    const transientNetworkError = isTransientNetworkError(error);
    const message = transientNetworkError
      ? "Temporary connection issue. Please try again."
      : rawMessage;
    console.error("verify-profile-pin error:", rawMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        code: transientNetworkError ? "TEMPORARY_NETWORK_ERROR" : undefined,
        retryable: transientNetworkError ? true : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: transientNetworkError ? 503 : 500,
      }
    );
  }
});
