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

interface Candidate {
  name: string;
  current_title: string;
  location?: string;
  summary?: string;
  skills: string[];
  work_history: WorkExperience[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidate, preferredPitch, subject, industries, sectors, locations } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build candidate context
    const candidateContext = buildCandidateContext(candidate);
    const targetContext = buildTargetContext(industries, sectors, locations);

    const systemPrompt = `You are an expert recruitment pitch writer. Your task is to generate a personalized pitch email for a candidate based on their CV and the recruiter's preferred pitch style.

IMPORTANT RULES:
1. Maintain the same tone, style, and structure as the provided template
2. Replace placeholder content with specific details from the candidate's background
3. Highlight the candidate's most relevant experience for the target industries
4. Keep the pitch concise and professional
5. If a subject line template is provided, generate a similar one; otherwise create an appropriate subject
6. Focus on the candidate's strengths and how they align with the target industries/locations`;

    const userPrompt = `Generate a personalized pitch email for this candidate:

CANDIDATE PROFILE:
${candidateContext}

TARGET CONTEXT:
${targetContext}

RECRUITER'S PREFERRED PITCH TEMPLATE:
${preferredPitch}

${subject ? `SUBJECT LINE TEMPLATE: ${subject}` : "Please also generate an appropriate subject line."}

Please generate:
1. A subject line (adapt from template if provided, or create a compelling one)
2. The full pitch email body (maintain the style and structure of the template but personalize for this candidate)

Format your response as:
SUBJECT: [your subject line]

BODY:
[your email body]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Parse the response
    const { parsedSubject, parsedPitch } = parseAIResponse(content, subject);

    return new Response(
      JSON.stringify({
        subject: parsedSubject,
        pitch: parsedPitch,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-pitch error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildCandidateContext(candidate: Candidate): string {
  const lines: string[] = [];
  
  lines.push(`Name: ${candidate.name}`);
  lines.push(`Current Title: ${candidate.current_title}`);
  
  if (candidate.location) {
    lines.push(`Location: ${candidate.location}`);
  }
  
  if (candidate.summary) {
    lines.push(`\nSummary:\n${candidate.summary}`);
  }
  
  if (candidate.skills?.length > 0) {
    lines.push(`\nKey Skills: ${candidate.skills.join(", ")}`);
  }
  
  if (candidate.work_history?.length > 0) {
    lines.push(`\nWork Experience:`);
    candidate.work_history.forEach((job, i) => {
      lines.push(`${i + 1}. ${job.title} at ${job.company}${job.duration ? ` (${job.duration})` : ""}`);
    });
  }
  
  return lines.join("\n");
}

function buildTargetContext(industries: string[], sectors: string[], locations: string[]): string {
  const lines: string[] = [];
  
  if (industries?.length > 0) {
    lines.push(`Target Industries: ${industries.join(", ")}`);
  }
  
  if (sectors?.length > 0) {
    lines.push(`Target Sectors: ${sectors.join(", ")}`);
  }
  
  if (locations?.length > 0) {
    lines.push(`Target Locations: ${locations.join(", ")}`);
  }
  
  return lines.join("\n");
}

function parseAIResponse(content: string, fallbackSubject: string): { parsedSubject: string; parsedPitch: string } {
  let parsedSubject = fallbackSubject || "";
  let parsedPitch = content;

  // Try to extract subject line
  const subjectMatch = content.match(/^SUBJECT:\s*(.+?)(?:\n|$)/im);
  if (subjectMatch) {
    parsedSubject = subjectMatch[1].trim();
  }

  // Try to extract body
  const bodyMatch = content.match(/BODY:\s*([\s\S]+)/im);
  if (bodyMatch) {
    parsedPitch = bodyMatch[1].trim();
  } else if (subjectMatch) {
    // Remove subject line from content if body marker not found
    parsedPitch = content.replace(/^SUBJECT:\s*.+?(?:\n|$)/im, "").trim();
  }

  return { parsedSubject, parsedPitch };
}
