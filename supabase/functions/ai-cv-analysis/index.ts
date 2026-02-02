import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WorkExperience {
  company: string;
  title: string;
  duration?: string;
}

interface CVData {
  name: string;
  current_title: string;
  location?: string;
  summary?: string;
  skills?: string[];
  work_history?: WorkExperience[];
}

interface AnalysisResult {
  industries: {
    suggested: string[];
    confidence: number;
    reasoning: string;
  };
  sectors: {
    suggested: string[];
    confidence: number;
  };
  locations: {
    suggested: string[];
    nearby_hubs: string[];
    reasoning: string;
  };
  roles: {
    suggested: string[];
    seniority: string;
    reasoning: string;
  };
  skills: {
    extracted: string[];
    inferred: string[];
    market_demand: string;
  };
  job_fit: {
    score: number;
    strengths: string[];
    gaps: string[];
    recommendations: string[];
  };
  excluded_companies: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cv, targetIndustries, targetLocations } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!cv) {
      return new Response(
        JSON.stringify({ success: false, error: "No CV data provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const analysis = await analyzeCVWithAI(cv, targetIndustries, targetLocations, LOVABLE_API_KEY);

    return new Response(
      JSON.stringify({ success: true, data: analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-cv-analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function analyzeCVWithAI(
  cv: CVData,
  targetIndustries?: string[],
  targetLocations?: string[],
  apiKey?: string
): Promise<AnalysisResult> {
  const systemPrompt = `You are an expert recruitment analyst specializing in European financial services. Analyze CVs to provide deep insights for recruitment targeting.

YOUR EXPERTISE:
- European PE/VC landscape (Permira, CVC, EQT, KKR Europe, etc.)
- Investment banking (Goldman Sachs, Morgan Stanley, boutiques like Lazard)
- Consulting to finance transitions (McKinsey/BCG/Bain to PE is common)
- Asset management and hedge funds
- Corporate finance and M&A

ANALYSIS REQUIREMENTS:
1. **Industry Mapping**: Identify which financial sectors the candidate fits
   - Private Equity, Venture Capital, Hedge Fund, Asset Management
   - Investment Banking, M&A Advisory, Corporate Finance
   - Management Consulting, Strategy Consulting
   
2. **Sector Focus**: Infrastructure, Technology, Healthcare, Real Estate, Energy, Consumer, etc.

3. **Location Intelligence**: 
   - Current location → nearby financial hubs
   - London candidates → London, Dublin, Amsterdam
   - Frankfurt candidates → DACH region (Frankfurt, Munich, Zurich)
   
4. **Role Targeting**: Based on seniority, suggest appropriate target contact roles
   - Junior (Analyst/Associate) → HR, Recruiters, Talent teams
   - Mid (VP/Director) → HR Directors, Partners
   - Senior (MD/Partner) → C-suite, Managing Partners

5. **Skills Extraction**: Pull out hard skills (modeling, due diligence, valuation) and soft skills

6. **Job Fit Scoring**: 0-100 score based on experience relevance, skill depth, trajectory

7. **Excluded Companies**: List their previous employers (don't target where they worked)`;

  const workHistoryText = cv.work_history?.map((w, i) => 
    `${i + 1}. ${w.title} at ${w.company}${w.duration ? ` (${w.duration})` : ''}`
  ).join('\n') || 'No work history provided';

  const userPrompt = `Analyze this CV for recruitment targeting:

CANDIDATE:
- Name: ${cv.name}
- Current Title: ${cv.current_title}
- Location: ${cv.location || 'Not specified'}
- Summary: ${cv.summary || 'Not provided'}
- Skills: ${cv.skills?.join(', ') || 'Not listed'}

WORK HISTORY:
${workHistoryText}

${targetIndustries?.length ? `Target Industries (for context): ${targetIndustries.join(', ')}` : ''}
${targetLocations?.length ? `Target Locations (for context): ${targetLocations.join(', ')}` : ''}

Provide comprehensive analysis with specific, actionable recommendations.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro", // Top-tier for complex reasoning
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      tools: [
        {
          type: "function",
          function: {
            name: "provide_cv_analysis",
            description: "Provide structured CV analysis results",
            parameters: {
              type: "object",
              properties: {
                industries: {
                  type: "object",
                  properties: {
                    suggested: { type: "array", items: { type: "string" } },
                    confidence: { type: "number" },
                    reasoning: { type: "string" }
                  }
                },
                sectors: {
                  type: "object",
                  properties: {
                    suggested: { type: "array", items: { type: "string" } },
                    confidence: { type: "number" }
                  }
                },
                locations: {
                  type: "object",
                  properties: {
                    suggested: { type: "array", items: { type: "string" } },
                    nearby_hubs: { type: "array", items: { type: "string" } },
                    reasoning: { type: "string" }
                  }
                },
                roles: {
                  type: "object",
                  properties: {
                    suggested: { type: "array", items: { type: "string" } },
                    seniority: { type: "string" },
                    reasoning: { type: "string" }
                  }
                },
                skills: {
                  type: "object",
                  properties: {
                    extracted: { type: "array", items: { type: "string" } },
                    inferred: { type: "array", items: { type: "string" } },
                    market_demand: { type: "string" }
                  }
                },
                job_fit: {
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    strengths: { type: "array", items: { type: "string" } },
                    gaps: { type: "array", items: { type: "string" } },
                    recommendations: { type: "array", items: { type: "string" } }
                  }
                },
                excluded_companies: { type: "array", items: { type: "string" } }
              },
              required: ["industries", "sectors", "locations", "roles", "skills", "job_fit", "excluded_companies"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "provide_cv_analysis" } }
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limits exceeded, please try again later.");
    }
    if (response.status === 402) {
      throw new Error("Payment required, please add funds to your workspace.");
    }
    const text = await response.text();
    console.error("AI gateway error:", response.status, text);
    throw new Error("AI gateway error");
  }

  const result = await response.json();
  
  try {
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments);
    }
    throw new Error("No tool call in response");
  } catch (e) {
    console.error("Failed to parse AI response:", e);
    // Return sensible defaults
    return {
      industries: { suggested: [], confidence: 0, reasoning: "Analysis failed" },
      sectors: { suggested: [], confidence: 0 },
      locations: { suggested: [], nearby_hubs: [], reasoning: "" },
      roles: { suggested: [], seniority: "unknown", reasoning: "" },
      skills: { extracted: [], inferred: [], market_demand: "" },
      job_fit: { score: 0, strengths: [], gaps: [], recommendations: [] },
      excluded_companies: []
    };
  }
}
