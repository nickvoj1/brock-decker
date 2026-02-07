import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SignalData {
  id: string;
  title: string;
  company: string | null;
  description: string | null;
  signal_type: string | null;
  amount: number | null;
  currency: string | null;
  region: string;
  tier: string | null;
  details: Record<string, unknown> | null;
}

interface AIEnrichmentResult {
  tier: "tier_1" | "tier_2" | "tier_3";
  insight: string;
  pitch: string;
}

async function enrichSignalWithAI(signal: SignalData): Promise<AIEnrichmentResult> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  // Build context from signal
  const details = signal.details || {};
  const jobTitles = (details.titles as string[] || []).join(", ") || "Not specified";
  const jobCount = details.job_count || 0;
  const seniorRoleCount = details.senior_role_count || 0;
  const isPEVC = details.is_pe_vc_company || false;
  
  const amountStr = signal.amount 
    ? `${signal.currency === "EUR" ? "€" : signal.currency === "GBP" ? "£" : "$"}${signal.amount >= 1000 ? `${(signal.amount / 1000).toFixed(1)}B` : `${signal.amount}M`}`
    : "Not disclosed";

  const prompt = `You are a PE/VC recruitment intelligence analyst at Brock & Decker. Analyze this signal quickly and accurately.

SIGNAL:
Company: ${signal.company || "Unknown"} | Type: ${signal.signal_type?.replace(/_/g, " ") || "General"}
Headline: ${signal.title}
${signal.description ? `Details: ${signal.description.slice(0, 300)}` : ""}
Region: ${signal.region} | Deal Size: ${amountStr}
Jobs: ${jobCount} posted (${seniorRoleCount} senior) | PE/VC Firm: ${isPEVC ? "Yes" : "No"}
${jobTitles !== "Not specified" ? `Roles: ${jobTitles}` : ""}

CLASSIFY AND RESPOND WITH JSON ONLY:
{
  "tier": "tier_1|tier_2|tier_3",
  "insight": "1-2 sentences: WHY this company is hiring NOW (connect signal to recruitment need)",
  "pitch": "1 sentence: Specific outreach angle for Brock & Decker recruiter"
}

TIER RULES:
- tier_1: Fund close, acquisition, new CEO/CFO, confirmed expansion, immediate hiring intent
- tier_2: Office expansion, senior departures, growth signals, medium intent
- tier_3: General hiring, industry presence, early interest

Be concise. No markdown.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a PE/VC recruitment analyst. Always respond with valid JSON only, no markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Gateway error:", response.status, errorText);
    if (response.status === 429) {
      throw new Error("Rate limit exceeded");
    }
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  
  // Parse JSON from response (handle potential markdown wrapping)
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```\n?/, "").replace(/\n?```$/, "");
  }
  
  try {
    const result = JSON.parse(jsonStr);
    return {
      tier: result.tier || "tier_3",
      insight: result.insight || "Signal detected - further analysis recommended.",
      pitch: result.pitch || "Contact HR team for current hiring needs.",
    };
  } catch (e) {
    console.error("Failed to parse AI response:", content);
    return {
      tier: "tier_3",
      insight: "Signal detected - manual analysis recommended.",
      pitch: "Research company hiring needs and identify key HR contacts.",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signalIds, enrichAll } = await req.json();
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get signals to enrich
    let query = supabase
      .from("signals")
      .select("id, title, company, description, signal_type, amount, currency, region, tier, details")
      .eq("is_dismissed", false);
    
    if (signalIds && signalIds.length > 0) {
      query = query.in("id", signalIds);
    } else if (enrichAll) {
      // Only enrich signals that haven't been enriched yet
      query = query.is("ai_enriched_at", null).limit(20);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "No signals specified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { data: signals, error: fetchError } = await query;
    
    if (fetchError) {
      console.error("Error fetching signals:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    if (!signals || signals.length === 0) {
      return new Response(
        JSON.stringify({ success: true, enriched: 0, message: "No signals to enrich" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Enriching ${signals.length} signals with AI (parallel batches)...`);
    
    let enrichedCount = 0;
    const errors: string[] = [];
    
    // Process signals in parallel batches of 5 for speed
    const BATCH_SIZE = 5;
    const signalBatches: SignalData[][] = [];
    
    for (let i = 0; i < signals.length; i += BATCH_SIZE) {
      signalBatches.push(signals.slice(i, i + BATCH_SIZE) as SignalData[]);
    }
    
    for (const batch of signalBatches) {
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (signal) => {
          try {
            const enrichment = await enrichSignalWithAI(signal);
            
            const { error: updateError } = await supabase
              .from("signals")
              .update({
                tier: enrichment.tier,
                ai_insight: enrichment.insight,
                ai_pitch: enrichment.pitch,
                ai_enriched_at: new Date().toISOString(),
              })
              .eq("id", signal.id);
            
            if (updateError) {
              throw new Error(updateError.message);
            }
            
            console.log(`Enriched: ${signal.company || signal.title.slice(0, 30)}`);
            return { success: true, id: signal.id };
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "Unknown error";
            console.error(`Error enriching ${signal.id}:`, errorMsg);
            return { success: false, id: signal.id, error: errorMsg };
          }
        })
      );
      
      // Count results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            enrichedCount++;
          } else {
            errors.push(`${result.value.id}: ${result.value.error}`);
          }
        } else {
          errors.push(`Batch error: ${result.reason}`);
        }
      }
      
      // Small delay between batches to avoid rate limits
      if (signalBatches.indexOf(batch) < signalBatches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        enriched: enrichedCount,
        total: signals.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Enrich signal AI error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
