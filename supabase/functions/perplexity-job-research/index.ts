const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, job, profileName } = await req.json();

    if (action === "research-job") {
      // Deep-research a job posting's requirements, company context, and ideal candidate
      if (!job || !job.title || !job.company) {
        throw new Error("job object with title and company is required");
      }

      const prompt = `You are a recruitment market intelligence analyst specializing in Private Equity, Venture Capital, and Financial Services.

JOB POSTING:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location || "Not specified"}
- Salary: ${job.salary || "Not specified"}
- Description: ${(job.description || "").slice(0, 2000)}

Research this job posting and the hiring company thoroughly. Return JSON only (no markdown):

{
  "companyProfile": {
    "overview": "Brief company overview - what they do, size, AUM if applicable",
    "sector": "Primary sector (e.g., Growth Equity, Buyout, VC, Infrastructure)",
    "aum": "Assets under management if known",
    "recentDeals": ["Recent notable deals or investments"],
    "teamSize": "Estimated team size",
    "culture": "Work culture notes",
    "reputation": "Industry reputation and ranking"
  },
  "jobRequirements": {
    "mustHaveSkills": ["Critical skills for this role"],
    "niceToHaveSkills": ["Preferred but not essential skills"],
    "experienceLevel": "Years of experience typically required",
    "educationPreferences": ["Preferred educational background"],
    "certifications": ["Relevant certifications (CFA, ACCA, etc.)"],
    "keyResponsibilities": ["Top 5 responsibilities for this role"]
  },
  "candidateProfile": {
    "idealTitles": ["Current titles of ideal candidates"],
    "idealCompanies": ["Types of companies to source from"],
    "seniority": "junior | mid | senior | executive",
    "compensationRange": "Expected compensation range for this role",
    "relocationLikelihood": "Whether relocation is common for this type of role"
  },
  "competitiveContext": {
    "similarRoles": ["Companies hiring similar roles right now"],
    "marketDemand": "high | medium | low - how competitive is finding candidates",
    "timeToFill": "Typical time to fill this type of role",
    "talentPool": "Description of available talent pool size and quality"
  },
  "recruitmentAngle": {
    "pitchPoints": ["Key selling points to attract candidates to this role"],
    "redFlags": ["Potential concerns candidates might have"],
    "approachStrategy": "Best approach to engage passive candidates for this role"
  }
}`;

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            { role: "system", content: "You are a recruitment intelligence analyst. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
          search_recency_filter: "month",
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      // deno-lint-ignore no-explicit-any
      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const citations = data.citations || [];

      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
      } catch {
        parsed = {
          companyProfile: { overview: content.slice(0, 500) },
          jobRequirements: {},
          candidateProfile: {},
          competitiveContext: {},
          recruitmentAngle: {},
        };
      }

      return new Response(
        JSON.stringify({ success: true, research: parsed, citations }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "match-candidates") {
      // Score stored CVs against a job posting
      if (!job || !job.title || !job.company) {
        throw new Error("job object with title and company is required");
      }
      if (!profileName) throw new Error("profileName is required");

      const { data: candidates, error: candErr } = await supabase
        .from("candidate_profiles")
        .select("id, name, current_title, location, skills, work_history, summary")
        .eq("profile_name", profileName);

      if (candErr) throw new Error("Failed to fetch candidates");
      if (!candidates || candidates.length === 0) {
        return new Response(
          JSON.stringify({ success: true, matches: [], message: "No candidates found for this profile" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // deno-lint-ignore no-explicit-any
      const candidateSummaries = (candidates as any[]).slice(0, 20).map((c: any, i: number) => {
        const skills = Array.isArray(c.skills) ? (c.skills as string[]).slice(0, 10).join(", ") : "";
        // deno-lint-ignore no-explicit-any
        const history = Array.isArray(c.work_history) ? (c.work_history as any[]).slice(0, 3).map((w: any) => `${w.title} at ${w.company}`).join("; ") : "";
        return `[${i}] ${c.name} | ${c.current_title || "N/A"} | ${c.location || "N/A"} | Skills: ${skills} | History: ${history}`;
      });

      const prompt = `Score these candidates against this job posting. Return JSON only.

JOB:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location || "Not specified"}
- Description: ${(job.description || "").slice(0, 1500)}

CANDIDATES:
${candidateSummaries.join("\n")}

Return JSON with scored candidates (only those scoring 4+/10):
{
  "scores": [
    {
      "index": 0,
      "score": 8,
      "reasons": ["Relevant experience", "Located in target region"],
      "fitSummary": "Strong fit due to direct PE background",
      "submissionReady": true
    }
  ],
  "bestMatch": {
    "index": 0,
    "explanation": "Why this candidate is the best fit for submission"
  },
  "submissionNotes": "Overall notes about which candidates to prioritize for submission"
}`;

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            { role: "system", content: "You are a recruitment matching AI. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      // deno-lint-ignore no-explicit-any
      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content || "";

      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
      } catch {
        parsed = { scores: [], bestMatch: null, submissionNotes: "" };
      }

      // deno-lint-ignore no-explicit-any
      const candidateList = candidates as any[];
      // deno-lint-ignore no-explicit-any
      const matches = (parsed.scores || []).map((s: any) => {
        const candidate = candidateList[s.index];
        if (!candidate) return null;
        return {
          candidateId: candidate.id,
          name: candidate.name,
          currentTitle: candidate.current_title,
          location: candidate.location,
          score: s.score,
          reasons: s.reasons || [],
          fitSummary: s.fitSummary || "",
          submissionReady: s.submissionReady || false,
        };
      }).filter(Boolean);

      const bestMatchData = parsed.bestMatch && candidateList[parsed.bestMatch.index]
        ? {
            candidateId: candidateList[parsed.bestMatch.index].id,
            name: candidateList[parsed.bestMatch.index].name,
            explanation: parsed.bestMatch.explanation,
          }
        : null;

      return new Response(
        JSON.stringify({
          success: true,
          matches,
          bestMatch: bestMatchData,
          submissionNotes: parsed.submissionNotes || "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("perplexity-job-research error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
