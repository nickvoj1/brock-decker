const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CandidateProfile {
  id: string;
  name: string;
  current_title: string | null;
  location: string | null;
  skills: string[] | null;
  // deno-lint-ignore no-explicit-any
  work_history: any[] | null;
  summary: string | null;
}

interface Signal {
  id: string;
  title: string;
  company: string | null;
  region: string;
  signal_type: string | null;
  description: string | null;
  amount: number | null;
  currency: string | null;
  tier: string | null;
  ai_insight: string | null;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, signalId, signalIds, profileName } = await req.json();

    if (action === "ideal-profile") {
      // Enrich a signal with the ideal candidate profile using Perplexity
      if (!signalId) throw new Error("signalId is required");

      const { data: signal, error: sigErr } = await supabase
        .from("signals")
        .select("*")
        .eq("id", signalId)
        .single();

      if (sigErr || !signal) throw new Error("Signal not found");
      const s = signal as Signal;

      const prompt = `You are a recruitment market intelligence analyst specializing in Private Equity, Venture Capital, and Financial Services hiring.

SIGNAL:
- Company: ${s.company || "Unknown"}
- Event: ${s.title}
- Type: ${s.signal_type || "Unknown"}
- Region: ${s.region}
- Amount: ${s.amount ? `${s.currency || "$"}${s.amount}M` : "Unknown"}
- Description: ${s.description || "N/A"}
- AI Insight: ${s.ai_insight || "N/A"}

Based on this business signal, research what type of candidate this company would likely need to hire. Return JSON only (no markdown):

{
  "idealProfile": {
    "titles": ["Ideal Job Title 1", "Ideal Job Title 2"],
    "seniority": "junior" | "mid" | "senior" | "executive",
    "mustHaveSkills": ["Skill 1", "Skill 2"],
    "niceToHaveSkills": ["Skill 1", "Skill 2"],
    "experienceYears": "5-10",
    "industryBackground": ["PE", "Investment Banking"],
    "reasoning": "Brief explanation of why this profile fits the signal"
  },
  "companyHiringContext": {
    "recentHires": "What types of people this company has been hiring recently",
    "teamSize": "Estimated team size or growth indicators",
    "culture": "Brief culture/work style notes",
    "compensation": "Estimated compensation range for the ideal hire"
  },
  "matchCriteria": {
    "strongMatch": ["Criterion that makes a candidate a strong match"],
    "weakMatch": ["Criterion that makes a candidate only a weak match"],
    "dealbreakers": ["Things that would make a candidate unsuitable"]
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
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        parsed = { idealProfile: { titles: [], reasoning: content.slice(0, 300) }, companyHiringContext: {}, matchCriteria: {} };
      }

      return new Response(
        JSON.stringify({ success: true, idealProfile: parsed, citations }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "score-cvs") {
      // Score candidate CVs against a signal using Perplexity-enhanced criteria
      if (!signalId) throw new Error("signalId is required");
      if (!profileName) throw new Error("profileName is required");

      const { data: signal, error: sigErr } = await supabase
        .from("signals")
        .select("*")
        .eq("id", signalId)
        .single();

      if (sigErr || !signal) throw new Error("Signal not found");

      const { data: candidates, error: candErr } = await supabase
        .from("candidate_profiles")
        .select("id, name, current_title, location, skills, work_history, summary")
        .eq("profile_name", profileName);

      if (candErr) throw new Error("Failed to fetch candidates");
      if (!candidates || candidates.length === 0) {
        return new Response(
          JSON.stringify({ success: true, matches: [], message: "No candidates found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const s = signal as Signal;

      // Build a concise summary of each candidate for AI scoring
      // deno-lint-ignore no-explicit-any
      const candidateSummaries = (candidates as any[]).slice(0, 20).map((c: CandidateProfile, i: number) => {
        const skills = Array.isArray(c.skills) ? (c.skills as string[]).slice(0, 10).join(", ") : "";
        // deno-lint-ignore no-explicit-any
        const history = Array.isArray(c.work_history) ? (c.work_history as any[]).slice(0, 3).map((w: any) => `${w.title} at ${w.company}`).join("; ") : "";
        return `[${i}] ${c.name} | ${c.current_title || "N/A"} | ${c.location || "N/A"} | Skills: ${skills} | History: ${history}`;
      });

      const prompt = `Score these candidates against this hiring signal. Return JSON only.

SIGNAL:
- Company: ${s.company || "Unknown"}
- Event: ${s.title}
- Type: ${s.signal_type || "Unknown"}  
- Region: ${s.region}
- Amount: ${s.amount ? `${s.currency || "$"}${s.amount}M` : "Unknown"}
- Description: ${s.description || "N/A"}

CANDIDATES:
${candidateSummaries.join("\n")}

Return JSON array of scored candidates (only those scoring 4+/10):
{
  "scores": [
    {
      "index": 0,
      "score": 8,
      "reasons": ["Relevant PE experience", "Located in target region"],
      "fitSummary": "Strong fit due to direct PE background and London location"
    }
  ],
  "bestMatch": {
    "index": 0,
    "explanation": "Why this candidate is the best fit"
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
            { role: "system", content: "You are a recruitment matching AI. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        parsed = { scores: [], bestMatch: null };
      }

      // Map indices back to candidate data
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
        };
      }).filter(Boolean);

      const bestMatchData = parsed.bestMatch && candidateList[parsed.bestMatch.index]
        ? {
            candidateId: candidateList[parsed.bestMatch.index].id,
            name: candidateList[parsed.bestMatch.index].name,
            explanation: parsed.bestMatch.explanation,
          }
        : null;

      // Update cv_matches count on the signal
      await supabase
        .from("signals")
        .update({ cv_matches: matches.length })
        .eq("id", signalId);

      return new Response(
        JSON.stringify({ success: true, matches, bestMatch: bestMatchData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("perplexity-cv-match error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
