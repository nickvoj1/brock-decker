const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WorkExperience {
  company: string;
  title: string;
  duration?: string;
}

interface CVData {
  name: string;
  current_title: string;
  location: string;
  skills: string[];
  work_history: WorkExperience[];
  summary?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY is not configured");
    }

    const { cvData } = (await req.json()) as { cvData: CVData };
    if (!cvData) {
      throw new Error("cvData is required");
    }

    const companies = (cvData.work_history || [])
      .map((w: WorkExperience) => w.company)
      .filter(Boolean)
      .slice(0, 5);
    const titles = (cvData.work_history || [])
      .map((w: WorkExperience) => `${w.title} at ${w.company}`)
      .filter(Boolean)
      .slice(0, 5);
    const skills = (cvData.skills || []).slice(0, 15).join(", ");

    const prompt = `You are a recruitment market intelligence analyst. Analyze this candidate profile and provide actionable research.

CANDIDATE PROFILE:
- Name: ${cvData.name}
- Current Title: ${cvData.current_title}
- Location: ${cvData.location}
- Skills: ${skills}
- Work History: ${titles.join("; ")}
${cvData.summary ? `- Summary: ${cvData.summary.slice(0, 300)}` : ""}

Provide a JSON response with exactly this structure (no markdown, no code fences, just raw JSON):

{
  "companyResearch": [
    {
      "company": "Company Name",
      "sector": "e.g. Private Equity, Investment Banking, Consulting",
      "size": "e.g. 500-1000 employees",
      "reputation": "Brief 1-line reputation summary",
      "relevance": "Why this matters for recruitment targeting"
    }
  ],
  "marketInsights": {
    "hotRoles": ["Role 1", "Role 2", "Role 3"],
    "trendingSkills": ["Skill 1", "Skill 2", "Skill 3"],
    "marketOutlook": "2-3 sentence outlook for this candidate's market segment",
    "salaryRange": "Estimated salary range for similar roles in their location",
    "demandLevel": "high" | "medium" | "low"
  },
  "skillsAnalysis": {
    "strengths": ["Strong skill 1", "Strong skill 2"],
    "gaps": ["Missing skill 1 that employers want", "Missing skill 2"],
    "recommendations": ["Actionable recommendation 1", "Recommendation 2"],
    "competitiveness": "high" | "medium" | "low"
  },
  "targetingSuggestions": {
    "industries": ["Industry 1", "Industry 2"],
    "locations": ["City 1", "City 2"],
    "roles": ["Target Role 1", "Target Role 2"],
    "reasoning": "Brief explanation of why these targets were chosen"
  }
}

Research each company in the work history. Focus on the European and global financial services / professional services market. Be specific and data-driven.`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content:
              "You are a recruitment market intelligence analyst. Return only valid JSON, no markdown formatting.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        search_recency_filter: "month",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    // deno-lint-ignore no-explicit-any
    const citations = (data as any).citations || [];

    // Parse JSON from response (handle potential markdown fences)
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      console.error("Failed to parse Perplexity response:", content.slice(0, 500));
      parsed = {
        companyResearch: [],
        marketInsights: {
          hotRoles: [],
          trendingSkills: [],
          marketOutlook: content.slice(0, 300),
          salaryRange: "Unknown",
          demandLevel: "medium",
        },
        skillsAnalysis: {
          strengths: [],
          gaps: [],
          recommendations: [],
          competitiveness: "medium",
        },
        targetingSuggestions: {
          industries: [],
          locations: [],
          roles: [],
          reasoning: "",
        },
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        research: parsed,
        citations,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("perplexity-cv-research error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
