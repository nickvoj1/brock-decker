import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ContactForClassification {
  name?: string;
  title?: string;
  company?: string;
  location?: string;
}

interface ClassificationResult {
  side: "buy" | "sell" | "neither";
  skills: string[];
  confidence: number;
  reasoning: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contacts, preferences } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No contacts provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Process in batches for efficiency
    const batchSize = 10;
    const results: ClassificationResult[] = [];

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const batchResults = await classifyBatch(batch, preferences, LOVABLE_API_KEY);
      results.push(...batchResults);
    }

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-skills-classifier error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function classifyBatch(
  contacts: ContactForClassification[],
  preferences: any,
  apiKey: string
): Promise<ClassificationResult[]> {
  const systemPrompt = `You are an expert financial services industry classifier. Your task is to classify contacts into BUY SIDE or SELL SIDE categories and generate appropriate Bullhorn CRM skills.

CLASSIFICATION RULES:
- **BUY SIDE**: Private Equity (PE), Venture Capital (VC), Hedge Funds, Asset Management, Credit Funds, Family Offices, Sovereign Wealth Funds
  - Examples: Blackstone, KKR, Carlyle, Apollo, Citadel, Bridgewater, Sequoia, Andreessen Horowitz
  
- **SELL SIDE**: Investment Banks, M&A Advisory, Corporate Banking, Sales & Trading
  - Examples: Goldman Sachs, Morgan Stanley, JP Morgan, Lazard, Evercore, Rothschild

- **NEITHER**: Consulting firms (McKinsey, BCG, Bain & Company, PwC, Deloitte, EY, KPMG), Corporates, Tech companies, Law firms
  - IMPORTANT: Consulting firms are NOT buy side even if they advise PE clients
  - IMPORTANT: Big 4 (PwC, Deloitte, EY, KPMG) are consultants, NOT buy side

SKILL GENERATION:
Generate Bullhorn-compatible skill tags based on:
1. Industry classification (BUY SIDE, SELL SIDE, CONSULT, etc.)
2. Sector focus (AREC, CORP M&A, CREDIT, etc.)
3. Location (LONDON, DACH, AMERICAS, APAC, etc.)
4. Role level (BUSINESS, SENIOR, JUNIOR, etc.)

Return JSON array with one object per contact.`;

  const contactsDescription = contacts.map((c, idx) => 
    `${idx + 1}. ${c.name || 'Unknown'} - ${c.title || 'Unknown Title'} at ${c.company || 'Unknown Company'} (${c.location || 'Unknown Location'})`
  ).join('\n');

  const userPrompt = `Classify these ${contacts.length} contacts:

${contactsDescription}

Search context:
- Target Industries: ${preferences?.industries?.join(', ') || 'Not specified'}
- Target Sectors: ${preferences?.sectors?.join(', ') || 'Not specified'}
- Target Locations: ${preferences?.locations?.join(', ') || 'Not specified'}

Return a JSON array with objects containing:
- side: "buy", "sell", or "neither"
- skills: array of Bullhorn skill tags (e.g., ["BUY SIDE", "PE", "LONDON", "SENIOR"])
- confidence: 0-100
- reasoning: brief explanation

Important: Each contact needs at least 4 skills. Use relevant location, role, and industry tags.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.2", // Most advanced model for precise classification
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1, // Low temperature for consistent classification
      tools: [
        {
          type: "function",
          function: {
            name: "classify_contacts",
            description: "Classify contacts into buy/sell side and generate skills",
            parameters: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      side: { type: "string", enum: ["buy", "sell", "neither"] },
                      skills: { type: "array", items: { type: "string" } },
                      confidence: { type: "number" },
                      reasoning: { type: "string" }
                    },
                    required: ["side", "skills", "confidence", "reasoning"]
                  }
                }
              },
              required: ["classifications"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "classify_contacts" } }
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
      const parsed = JSON.parse(toolCall.function.arguments);
      return parsed.classifications || [];
    }
    return contacts.map(() => ({
      side: "neither" as const,
      skills: ["BUSINESS", "GLOBAL", "SENIOR", "FINANCE"],
      confidence: 50,
      reasoning: "Fallback classification"
    }));
  } catch (e) {
    console.error("Failed to parse AI response:", e);
    return contacts.map(() => ({
      side: "neither" as const,
      skills: ["BUSINESS", "GLOBAL", "SENIOR", "FINANCE"],
      confidence: 50,
      reasoning: "Parse error fallback"
    }));
  }
}
