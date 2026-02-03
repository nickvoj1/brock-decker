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

  const prompt = `You are a PE/VC recruitment intelligence analyst at Brock & Decker.

SIGNAL DATA:
- Company: ${signal.company || "Unknown"}
- Headline: ${signal.title}
- Description: ${signal.description || "No additional details"}
- Signal Type: ${signal.signal_type?.replace(/_/g, " ") || "General"}
- Deal Size: ${amountStr}
- Region: ${signal.region}
- Job Postings Found: ${jobCount}
- Senior Roles Found: ${seniorRoleCount}
- Is PE/VC Firm: ${isPEVC ? "Yes" : "Likely portfolio company or other"}
- Job Titles: ${jobTitles}

TASK: Analyze this signal for PE/VC recruitment opportunity. Provide:

1. TIER (tier_1, tier_2, or tier_3):
   - tier_1: Immediate hiring intent - fund close, acquisition, new CEO/CFO, confirmed expansion
   - tier_2: Medium intent - office expansion, senior departures, growth signals
   - tier_3: Early interest - general hiring, industry presence, networking opportunity

2. INSIGHT (1-2 sentences): Explain WHY this company is likely hiring. Connect the dots between the news/signal and recruitment needs. Be specific about the business driver (e.g., "Post-€500M fund close → expanding investment team", "New CHRO suggests talent strategy overhaul").

3. PITCH (1 sentence): Specific TA outreach recommendation for a Brock & Decker recruiter. Name the target role (VP Talent, CHRO, Head of HR) and suggest a specific angle (e.g., "Target VP Talent with Bullhorn spec for 3 senior analyst roles").

OUTPUT FORMAT (JSON only):
{
  "tier": "tier_1",
  "insight": "Post-€500M fund close signals portfolio expansion. 5 PE analyst roles posted indicate immediate need for investment professionals.",
  "pitch": "Target new CHRO with Bullhorn spec for 3 senior investment roles; position as specialized PE recruiter."
}`;

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
    
    console.log(`Enriching ${signals.length} signals with AI...`);
    
    let enrichedCount = 0;
    const errors: string[] = [];
    
    // Process signals sequentially to avoid rate limits
    for (const signal of signals) {
      try {
        const enrichment = await enrichSignalWithAI(signal as SignalData);
        
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
          console.error(`Error updating signal ${signal.id}:`, updateError);
          errors.push(`${signal.id}: ${updateError.message}`);
        } else {
          enrichedCount++;
          console.log(`Enriched signal: ${signal.company || signal.title.slice(0, 30)}`);
        }
        
        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (e) {
        console.error(`Error enriching signal ${signal.id}:`, e);
        errors.push(`${signal.id}: ${e instanceof Error ? e.message : "Unknown error"}`);
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
