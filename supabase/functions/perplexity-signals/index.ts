import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// deno-lint-ignore no-explicit-any
type AnyRecord = Record<string, any>;

/* ─── Perplexity helper ────────────────────────────────────────────── */

interface PerplexityResult {
  content: string;
  citations: string[];
}

async function queryPerplexity(
  query: string,
  systemPrompt: string,
  opts?: { recency?: string; domains?: string[] },
): Promise<PerplexityResult> {
  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY is not configured");

  // deno-lint-ignore no-explicit-any
  const body: AnyRecord = {
    model: "sonar-pro",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
  };

  if (opts?.recency) body.search_recency_filter = opts.recency;
  if (opts?.domains?.length) body.search_domain_filter = opts.domains;

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Perplexity error:", res.status, errText);
    if (res.status === 429) throw new Error("Rate limit exceeded");
    throw new Error(`Perplexity API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    citations: data.citations || [],
  };
}

/* ─── Action: discover ─────────────────────────────────────────────── */

async function discoverSignals(region: string, supabase: ReturnType<typeof createClient>) {
  const regionQueries: Record<string, string[]> = {
    london: [
      "UK private equity fund close this week",
      "London PE VC acquisition announcement latest",
      "City of London financial services executive appointments",
    ],
    europe: [
      "European private equity fund close latest news",
      "DACH Nordics PE VC deal announcement this week",
      "European financial services expansion hiring",
    ],
    uae: [
      "UAE DIFC private equity fund close latest",
      "Middle East sovereign wealth fund investments this week",
      "Dubai Abu Dhabi financial services expansion",
    ],
    usa: [
      "US private equity fund close announcement latest",
      "New York Boston PE VC deal this week",
      "American financial services executive hiring",
    ],
  };

  const queries = regionQueries[region] || regionQueries.london;

  const systemPrompt = `You are a PE/VC recruitment intelligence analyst at Brock & Decker, a leading executive search firm.
For each search result, extract actionable signals - fund closes, acquisitions, executive appointments, office expansions, and hiring surges.

Return a JSON array of signals. Each signal object:
{
  "title": "Headline describing the event (5-15 words)",
  "company": "Company or fund name",
  "signal_type": "funding|expansion|c_suite|hiring|acquisition",
  "amount": null or number in millions (e.g. 500 for $500M),
  "currency": "USD"|"EUR"|"GBP"|null,
  "description": "2-3 sentence summary with recruitment implications",
  "tier": "tier_1"|"tier_2"|"tier_3",
  "source_url": "URL of the source article if available"
}

TIER RULES:
- tier_1: Fund close, acquisition, C-suite appointment, confirmed expansion
- tier_2: Office expansion, senior departures, growth signals
- tier_3: General hiring, industry presence, early interest

Return ONLY a JSON array. No markdown, no explanation.`;

  const allSignals: AnyRecord[] = [];
  const allCitations: string[] = [];

  for (const query of queries) {
    try {
      const result = await queryPerplexity(query, systemPrompt, {
        recency: "week",
      });

      allCitations.push(...result.citations);

      let parsed: AnyRecord[] = [];
      let jsonStr = result.content.trim();
      if (jsonStr.startsWith("```json")) jsonStr = jsonStr.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      else if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```\n?/, "").replace(/\n?```$/, "");

      try {
        parsed = JSON.parse(jsonStr);
        if (!Array.isArray(parsed)) parsed = [parsed];
      } catch {
        console.error("Failed to parse Perplexity response for query:", query);
        continue;
      }

      allSignals.push(...parsed);
      // Small delay between queries
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.error(`Perplexity query failed: ${query}`, e);
    }
  }

  // Deduplicate by title similarity
  const seen = new Set<string>();
  const unique = allSignals.filter((s) => {
    const key = `${(s.company || "").toLowerCase().trim()}-${(s.title || "").toLowerCase().trim().slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Insert into signals table
  let inserted = 0;
  for (const sig of unique) {
    const title = String(sig.title || "").trim();
    const company = String(sig.company || "").trim();
    if (!title || title.length < 10) continue;

    // Check for duplicate by title
    const { data: existing } = await supabase
      .from("signals")
      .select("id")
      .ilike("title", `%${title.slice(0, 50)}%`)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const { error } = await supabase.from("signals").insert({
      title,
      company: company || null,
      region,
      signal_type: sig.signal_type || null,
      amount: sig.amount ? Number(sig.amount) : null,
      currency: sig.currency || null,
      description: sig.description || null,
      tier: sig.tier || "tier_3",
      source: "perplexity",
      source_urls: sig.source_url ? [sig.source_url] : allCitations.slice(0, 5),
      url: sig.source_url || allCitations[0] || null,
      published_at: new Date().toISOString(),
      ai_insight: sig.description || null,
      ai_enriched_at: new Date().toISOString(),
    });

    if (!error) inserted++;
    else console.error("Insert error:", error.message);
  }

  return { discovered: unique.length, inserted, citations: allCitations.slice(0, 10) };
}

/* ─── Action: deep-dive ────────────────────────────────────────────── */

async function companyDeepDive(signalId: string, supabase: ReturnType<typeof createClient>) {
  const { data: signal, error } = await supabase
    .from("signals")
    .select("id, title, company, region, signal_type, amount, currency, description, ai_insight")
    .eq("id", signalId)
    .single();

  if (error || !signal) throw new Error("Signal not found");

  const company = signal.company || "the company";
  const query = `${company}: recent news, funding history, key executive hires, competitors, office locations, and any private equity or venture capital activity in the last 3 months`;

  const systemPrompt = `You are a PE/VC recruitment intelligence analyst. Provide a comprehensive company deep dive for ${company}.

Structure your response as JSON:
{
  "company_overview": "2-3 sentences about the company",
  "recent_news": ["List of 3-5 recent news items"],
  "funding_history": "Summary of funding rounds or PE/VC activity",
  "key_executives": ["List of notable recent executive appointments or departures"],
  "competitors": ["3-5 key competitors"],
  "hiring_signals": "Assessment of current hiring activity and intent",
  "recruitment_angle": "Specific pitch angle for Brock & Decker recruiters",
  "risk_factors": "Any concerns or risks to note"
}

Return ONLY valid JSON. No markdown.`;

  const result = await queryPerplexity(query, systemPrompt, { recency: "month" });

  let parsed: AnyRecord = {};
  let jsonStr = result.content.trim();
  if (jsonStr.startsWith("```json")) jsonStr = jsonStr.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  else if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```\n?/, "").replace(/\n?```$/, "");

  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = { company_overview: result.content, raw: true };
  }

  // Update the signal with enriched data
  const insight = parsed.company_overview
    ? `${parsed.company_overview} ${parsed.hiring_signals || ""}`
    : result.content.slice(0, 500);

  const pitch = parsed.recruitment_angle || "Research company for tailored outreach.";

  await supabase
    .from("signals")
    .update({
      ai_insight: insight.trim().slice(0, 1000),
      ai_pitch: pitch.slice(0, 500),
      ai_enriched_at: new Date().toISOString(),
      details: {
        ...(signal as AnyRecord).details,
        perplexity_deep_dive: parsed,
        perplexity_citations: result.citations,
      },
    })
    .eq("id", signalId);

  return { ...parsed, citations: result.citations };
}

/* ─── Action: enrich ───────────────────────────────────────────────── */

async function enrichWithPerplexity(
  signalIds: string[],
  supabase: ReturnType<typeof createClient>,
) {
  const { data: signals, error } = await supabase
    .from("signals")
    .select("id, title, company, region, signal_type, description")
    .in("id", signalIds);

  if (error || !signals?.length) return { enriched: 0 };

  let enriched = 0;

  for (const signal of signals) {
    const sig = signal as AnyRecord;
    const company = sig.company || "the company mentioned";
    const query = `${sig.title}: What are the recruitment implications? Is ${company} hiring? Any recent leadership changes or expansion plans?`;

    const systemPrompt = `You are a PE/VC recruitment analyst. For this signal, provide:
1. A brief insight (2 sentences) explaining WHY this company would be hiring now
2. A specific pitch angle for a recruiter at Brock & Decker

Return JSON: { "insight": "...", "pitch": "...", "tier": "tier_1|tier_2|tier_3" }
No markdown.`;

    try {
      const result = await queryPerplexity(query, systemPrompt, { recency: "week" });

      let parsed: AnyRecord = {};
      let jsonStr = result.content.trim();
      if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```json?\n?/, "").replace(/\n?```$/, "");

      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = { insight: result.content.slice(0, 300), pitch: "Research further.", tier: "tier_3" };
      }

      await supabase
        .from("signals")
        .update({
          ai_insight: String(parsed.insight || "").slice(0, 1000),
          ai_pitch: String(parsed.pitch || "").slice(0, 500),
          tier: parsed.tier || "tier_3",
          ai_enriched_at: new Date().toISOString(),
          source_urls: result.citations.slice(0, 5),
        })
        .eq("id", sig.id);

      enriched++;
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      console.error(`Enrich failed for ${sig.id}:`, e);
    }
  }

  return { enriched, total: signals.length };
}

/* ─── Main handler ─────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, region, signalId, signalIds } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let result: AnyRecord;

    switch (action) {
      case "discover":
        if (!region) throw new Error("Region is required for discovery");
        console.log(`Perplexity discovery for ${region}...`);
        result = await discoverSignals(region, supabase);
        break;

      case "deep-dive":
        if (!signalId) throw new Error("Signal ID is required for deep dive");
        console.log(`Perplexity deep dive for signal ${signalId}...`);
        result = await companyDeepDive(signalId, supabase);
        break;

      case "enrich":
        if (!signalIds?.length) throw new Error("Signal IDs required for enrichment");
        console.log(`Perplexity enrichment for ${signalIds.length} signals...`);
        result = await enrichWithPerplexity(signalIds, supabase);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("perplexity-signals error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Rate limit") ? 429 : 500;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
