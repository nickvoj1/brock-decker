import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CompanyIntelRequest {
  companyName: string;
  contactTitle?: string;
  context?: string;
}

interface CompanyIntelResult {
  companyType: "buy_side" | "sell_side" | "consulting" | "corporate" | "other";
  industry: string;
  sectors: string[];
  description: string;
  keyFacts: string[];
  hiringSignals: string[];
  competitorContext: string[];
  pitchAngles: string[];
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName, contactTitle, context } = await req.json() as CompanyIntelRequest;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!companyName) {
      return new Response(
        JSON.stringify({ success: false, error: "Company name is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const systemPrompt = `You are an expert financial services industry analyst with deep knowledge of:
- Private Equity firms (Blackstone, KKR, Carlyle, Apollo, Warburg Pincus, etc.)
- Venture Capital firms (Sequoia, a16z, Accel, Benchmark, etc.)
- Hedge Funds (Citadel, Bridgewater, Two Sigma, DE Shaw, etc.)
- Investment Banks (Goldman Sachs, Morgan Stanley, JP Morgan, etc.)
- Boutique Advisory (Lazard, Evercore, Moelis, PJT Partners, etc.)
- Consulting firms (McKinsey, BCG, Bain & Company, Big 4: PwC, Deloitte, EY, KPMG)
- Asset Managers (BlackRock, Vanguard, Fidelity, etc.)
- Family Offices and Sovereign Wealth Funds

CRITICAL CLASSIFICATION RULES:
1. BUY SIDE = PE, VC, Hedge Funds, Asset Management, Credit Funds, Family Offices, SWFs
2. SELL SIDE = Investment Banks, M&A Advisory, Sales & Trading, Capital Markets
3. CONSULTING = Strategy consulting, Big 4, Professional Services (NEVER buy side)
4. CORPORATE = Operating companies, Tech companies, Industrial companies

IMPORTANT DISTINCTIONS:
- Bain Capital (PE) ≠ Bain & Company (Consulting)
- PwC, Deloitte, EY, KPMG = Consulting, NOT buy side (even if they advise PE clients)
- Goldman Sachs Asset Management = Buy Side, Goldman Sachs IBD = Sell Side

Provide actionable intelligence for recruitment outreach.`;

    const userPrompt = `Analyze this company for recruitment intelligence:

Company: ${companyName}
${contactTitle ? `Contact Title: ${contactTitle}` : ''}
${context ? `Additional Context: ${context}` : ''}

Provide detailed intelligence including:
1. Company classification (buy_side, sell_side, consulting, corporate, other)
2. Primary industry and sectors they operate in
3. Key facts about the company
4. Current hiring signals or growth indicators
5. Competitor context (similar firms to reference in outreach)
6. Pitch angles for recruiting outreach

Be specific and actionable. Focus on information useful for executive search/recruiting.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2", // Most advanced model for comprehensive analysis
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2, // Low temperature for factual accuracy
        tools: [
          {
            type: "function",
            function: {
              name: "provide_company_intel",
              description: "Provide structured company intelligence for recruitment",
              parameters: {
                type: "object",
                properties: {
                  companyType: { 
                    type: "string", 
                    enum: ["buy_side", "sell_side", "consulting", "corporate", "other"],
                    description: "Classification of the company"
                  },
                  industry: { 
                    type: "string",
                    description: "Primary industry (e.g., Private Equity, Investment Banking, Consulting)"
                  },
                  sectors: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Sectors they focus on (e.g., Technology, Healthcare, Real Estate)"
                  },
                  description: { 
                    type: "string",
                    description: "Brief company description"
                  },
                  keyFacts: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Key facts about the company (AUM, deals, reputation)"
                  },
                  hiringSignals: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Indicators of hiring activity or growth"
                  },
                  competitorContext: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Similar firms that could be mentioned in outreach"
                  },
                  pitchAngles: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Effective angles for recruitment outreach"
                  },
                  confidence: { 
                    type: "number",
                    description: "Confidence score 0-100"
                  }
                },
                required: ["companyType", "industry", "sectors", "description", "keyFacts", "hiringSignals", "competitorContext", "pitchAngles", "confidence"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_company_intel" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    
    try {
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const intel = JSON.parse(toolCall.function.arguments) as CompanyIntelResult;
        return new Response(
          JSON.stringify({ success: true, data: intel }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("No tool call in response");
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            companyType: "other",
            industry: "Unknown",
            sectors: [],
            description: `Information about ${companyName}`,
            keyFacts: [],
            hiringSignals: [],
            competitorContext: [],
            pitchAngles: ["Research this company further for better outreach angles"],
            confidence: 30
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("ai-company-intel error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
