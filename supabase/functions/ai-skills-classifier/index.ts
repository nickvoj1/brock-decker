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
  side: "buy" | "sell" | "consulting" | "corporate" | "other";
  skills: string[];
  confidence: number;
  reasoning: string;
}

// Valid Bullhorn skills that the AI can use
const VALID_BULLHORN_SKILLS = [
  // Entity classification
  "BUY SIDE", "SELL SIDE", "CONSULT",
  // Buy Side subtypes
  "PE", "VC", "CORP VC", "ALT INVESTMENT", "ASS MAN", "CREDIT", "Debt", "DISTRESSED",
  // Sell Side subtypes  
  "CORPORATE BANKING", "CAPITAL MARKETS", "TIER 1", "BOUTIQUE", "DCM", "ECM",
  // Function areas
  "CORP M&A", "ADVISORY INVESMENT", "BUS DEV", "CORP DEV", "CORP STRATEGY", "CORP FIN",
  "Capital Formation", "IR", "ORIGINATION", "UNDERWRITING",
  // Sector/Industry
  "AREC", "CONSTRUCTION", "DATA", "AUTOMATION", "CLINICAL", "BIOTEC", "CLEANTECH",
  "CONSUMER GOOD", "B2C", "COMMUNICATION", "ADVERTISING",
  // Location - Europe
  "LONDON", "DACH", "FRANKFURT", "MUNICH", "BERLIN", "BASEL", "ZURICH", "GENEVA",
  "PARIS", "MILAN", "BARCELONA", "MADRID", "AMSTERDAM", "BENELUX", "BRUSSEL", "LUXEMBOURG",
  "DUBLIN", "EDINBURGH", "LISBON", "VIENNA", "COPENHAGEN", "STOCKHOLM", "OSLO", "HELSINKI",
  "WARSAW", "PRAGUE", "CEE", "BUDAPEST",
  // Location - Middle East
  "ABU DHABI", "DUBAI", "BAHRAIN", "QATAR", "DOHA", "RIYADH", "SAUDI",
  // Location - Americas
  "AMERICAS", "NEW YORK", "BOSTON", "CHICAGO", "California", "SAN FRANCISCO", "LOS ANGELES",
  "DALLAS", "HOUSTON", "ATLANTA", "MIAMI", "CHARLOTTE", "DENVER", "SEATTLE", "WASHINGTON DC",
  "CANADA", "TORONTO", "MONTREAL", "BRAZIL", "SAO PAULO", "MEXICO",
  // Location - APAC
  "APAC", "ASIA", "SINGAPORE", "HONG KONG", "TOKYO", "AUSTRALIA", "SYDNEY", "MELBOURNE",
  "CHINA", "BEIJING", "SHANGHAI", "BANGKOK", "MUMBAI", "INDIA", "SEOUL",
  // Location - Other
  "AFRICA", "JOHANNESBURG", "CAIRO", "GLOBAL", "EMEA",
  // Seniority/Role
  "BUSINESS", "C-SUITE", "SENIOR", "MID-LEVEL", "JUNIOR", "BOUTIQUE",
  // HR/Talent
  "C&B", "TALENT", "COMPENSATION",
  // Operations/Control
  "CONTROL", "BACK OFFICE", "MIDDLE OFFICE", "ACCOUNTING", "TREASURY",
  // Risk/Compliance
  "RISK", "CYBER RISK", "CONDUCT RISK", "COMPLIANCE", "CENTRAL COMPLIANCE", "AUDIT",
  // Legal
  "LEGAL", "ARBITRATION",
  // Technology
  "APPLICATION DEVELOPER", "DATASCIENCE", "BIG DATA", "QUANT", "CLOUD", "AWS", "AZURE",
  // Finance specific
  "BOND", "STRUCTURED PRODUCTS", "ABS", "ACQUISITION FINANCE", "SYNDICATION",
  "SOVEREIGN", "BANKRUPCY",
  // Analysis
  "ANALYSIS", "INVESTMENT",
];

// Skills that MUST NOT appear together (mutually exclusive)
const SKILL_CONFLICTS: Record<string, string[]> = {
  "BUY SIDE": ["SELL SIDE", "CONSULT", "CORPORATE BANKING", "TIER 1"],
  "SELL SIDE": ["BUY SIDE", "PE", "VC", "CORP VC", "ALT INVESTMENT", "ASS MAN"],
  "CONSULT": ["BUY SIDE", "SELL SIDE", "PE", "VC", "CORPORATE BANKING"],
  "PE": ["SELL SIDE", "CONSULT", "CORPORATE BANKING"],
  "VC": ["SELL SIDE", "CONSULT", "CORPORATE BANKING"],
  "CORP VC": ["SELL SIDE", "CONSULT", "CORPORATE BANKING"],
  "ALT INVESTMENT": ["SELL SIDE", "CONSULT"],
  "CORPORATE BANKING": ["BUY SIDE", "PE", "VC", "ALT INVESTMENT"],
  "TIER 1": ["BUY SIDE", "PE", "VC", "BOUTIQUE"],
  "BOUTIQUE": ["TIER 1"],
};

// Resolve skill conflicts - remove conflicting skills based on primary classification
function resolveSkillConflicts(skills: string[], primarySide: string): string[] {
  const result = new Set(skills);
  
  // Determine primary marker
  let primaryMarker = "";
  if (primarySide === "buy") primaryMarker = "BUY SIDE";
  else if (primarySide === "sell") primaryMarker = "SELL SIDE";
  else if (primarySide === "consulting") primaryMarker = "CONSULT";
  
  // Remove all skills that conflict with the primary classification
  if (primaryMarker && SKILL_CONFLICTS[primaryMarker]) {
    for (const conflicting of SKILL_CONFLICTS[primaryMarker]) {
      result.delete(conflicting);
    }
  }
  
  // Ensure primary marker is present
  if (primaryMarker) {
    result.add(primaryMarker);
  }
  
  // Additional conflict resolution for specific skill pairs
  for (const skill of Array.from(result)) {
    if (SKILL_CONFLICTS[skill]) {
      for (const conflicting of SKILL_CONFLICTS[skill]) {
        if (result.has(conflicting) && conflicting !== primaryMarker) {
          result.delete(conflicting);
        }
      }
    }
  }
  
  return Array.from(result);
}

// Validate skills against allowed list
function validateSkills(skills: string[]): string[] {
  return skills.filter(skill => VALID_BULLHORN_SKILLS.includes(skill));
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
  const systemPrompt = `You are an expert financial services industry classifier for a recruitment CRM (Bullhorn). 
Your task is to classify contacts into the correct category and generate appropriate Bullhorn skills tags.

## CRITICAL CLASSIFICATION RULES

### ENTITY TYPES (Mutually Exclusive - A contact can ONLY be ONE of these):

1. **BUY SIDE** - Organizations that INVEST/DEPLOY capital:
   - Private Equity (PE): Blackstone, KKR, Carlyle, Apollo, TPG, Warburg Pincus, Permira, CVC, Apax, EQT, Cinven, PAI Partners, Bridgepoint, Ardian, BC Partners, HG Capital, Montagu, Nordic Capital, Triton, etc.
   - Venture Capital (VC): Sequoia, Andreessen Horowitz, Benchmark, Accel, Index Ventures, General Catalyst, Balderton, Atomico, etc.
   - Hedge Funds: Citadel, Millennium, Point72, Bridgewater, Two Sigma, D.E. Shaw, Renaissance, Elliott, Brevan Howard, Capula, etc.
   - Asset Managers: BlackRock, Vanguard, Fidelity, Wellington, T. Rowe Price, Invesco, Schroders, etc.
   - Credit/Debt Funds: Ares, Blue Owl, Golub Capital, Oaktree, HPS, Sixth Street, etc.
   - Family Offices & Sovereign Wealth: QIA, GIC, Temasek, ADIA, CPPIB, etc.

2. **SELL SIDE** - Organizations that ADVISE on transactions or provide market services:
   - Investment Banks (Tier 1): Goldman Sachs, Morgan Stanley, JP Morgan, Bank of America, Citibank, Barclays, Deutsche Bank, UBS, HSBC
   - Boutique Banks: Lazard, Evercore, Moelis, Centerview, Perella Weinberg, Rothschild, Greenhill, PJT Partners, Guggenheim
   - Regional Banks: Jefferies, Nomura, Macquarie

3. **CONSULTING** - Advisory firms that are NOT buy-side or sell-side:
   - Strategy Consulting: McKinsey, Bain & Company, Boston Consulting Group (BCG), Oliver Wyman, Roland Berger, L.E.K., Strategy&
   - Big 4 Accounting/Advisory: PwC, Deloitte, EY (Ernst & Young), KPMG
   - Restructuring: Alvarez & Marsal, FTI Consulting
   - CRITICAL: "Bain & Company" is consulting, "Bain Capital" is PE (Buy Side)
   - CRITICAL: Big 4 firms are ALWAYS consulting, even if they have PE or M&A advisory practices

4. **CORPORATE** - Operating companies (non-financial):
   - Tech: Google, Amazon, Microsoft, Apple, Meta
   - Industrials: General Electric, Siemens, Boeing
   - Consumer: P&G, Unilever, Nike
   
5. **OTHER** - Law firms, recruiters, unknown

### SKILL CONFLICT RULES (STRICTLY ENFORCED):

These skills CANNOT appear together on the same contact:
- "BUY SIDE" conflicts with: "SELL SIDE", "CONSULT", "CORPORATE BANKING", "TIER 1"
- "SELL SIDE" conflicts with: "BUY SIDE", "PE", "VC", "CORP VC", "ALT INVESTMENT", "ASS MAN"
- "CONSULT" conflicts with: "BUY SIDE", "SELL SIDE", "PE", "VC", "CORPORATE BANKING"
- "PE" conflicts with: "SELL SIDE", "CONSULT", "CORPORATE BANKING"
- "TIER 1" conflicts with: "BOUTIQUE"

### SKILL GENERATION RULES:

Generate 4-8 skills from these categories:
1. **Primary Classification** (REQUIRED - exactly one): BUY SIDE, SELL SIDE, CONSULT, or leave empty for corporate/other
2. **Sub-type** (1-2): PE, VC, CORP VC, ALT INVESTMENT, ASS MAN, CREDIT, Debt, CORPORATE BANKING, TIER 1, BOUTIQUE
3. **Function** (1-2): CORP M&A, BUS DEV, CORP DEV, Capital Formation, C&B, COMPLIANCE, etc.
4. **Location** (1-2): Use the city/region where the person is based (LONDON, NEW YORK, DACH, etc.)
5. **Seniority** (1): SENIOR, MID-LEVEL, JUNIOR, or C-SUITE

### VALID SKILLS LIST:
${VALID_BULLHORN_SKILLS.join(", ")}

ONLY use skills from this list. Do not invent new skills.`;

  const contactsDescription = contacts.map((c, idx) => 
    `${idx + 1}. ${c.name || 'Unknown'} - ${c.title || 'Unknown Title'} at ${c.company || 'Unknown Company'} (${c.location || 'Unknown Location'})`
  ).join('\n');

  const userPrompt = `Classify these ${contacts.length} contacts and generate Bullhorn skills:

${contactsDescription}

Search context (use to add relevant industry/function skills):
- Target Industries: ${preferences?.industries?.join(', ') || 'Not specified'}
- Target Sectors: ${preferences?.sectors?.join(', ') || 'Not specified'}
- Target Locations: ${preferences?.locations?.join(', ') || 'Not specified'}
- Target Roles: ${preferences?.targetRoles?.join(', ') || 'Not specified'}

For each contact, return:
1. side: The primary classification ("buy", "sell", "consulting", "corporate", or "other")
2. skills: Array of 4-8 Bullhorn skill tags that DO NOT conflict with each other
3. confidence: 0-100 based on how certain you are
4. reasoning: Brief explanation of why this classification

Remember: 
- Each contact gets exactly ONE primary classification
- Skills must not conflict (no BUY SIDE + SELL SIDE, no PE + CONSULT, etc.)
- Always include a location skill based on the contact's location
- Always include a seniority skill based on title`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      tools: [
        {
          type: "function",
          function: {
            name: "classify_contacts",
            description: "Classify contacts into buy/sell/consulting side and generate non-conflicting skills",
            parameters: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      side: { 
                        type: "string", 
                        enum: ["buy", "sell", "consulting", "corporate", "other"],
                        description: "Primary classification - mutually exclusive"
                      },
                      skills: { 
                        type: "array", 
                        items: { type: "string" },
                        description: "4-8 Bullhorn skills that don't conflict with each other"
                      },
                      confidence: { 
                        type: "number",
                        description: "0-100 confidence score"
                      },
                      reasoning: { 
                        type: "string",
                        description: "Brief explanation for the classification"
                      }
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
      const classifications = parsed.classifications || [];
      
      // Post-process: validate skills and resolve conflicts
      return classifications.map((c: ClassificationResult) => {
        // First validate against allowed skills
        let validatedSkills = validateSkills(c.skills);
        
        // Then resolve any remaining conflicts
        validatedSkills = resolveSkillConflicts(validatedSkills, c.side);
        
        // Ensure minimum 4 skills
        if (validatedSkills.length < 4) {
          validatedSkills.push("BUSINESS");
          if (validatedSkills.length < 4) validatedSkills.push("GLOBAL");
          if (validatedSkills.length < 4) validatedSkills.push("SENIOR");
          if (validatedSkills.length < 4) validatedSkills.push("FINANCE");
        }
        
        return {
          ...c,
          skills: validatedSkills
        };
      });
    }
    
    return contacts.map(() => ({
      side: "other" as const,
      skills: ["BUSINESS", "GLOBAL", "SENIOR", "FINANCE"],
      confidence: 50,
      reasoning: "Fallback classification"
    }));
  } catch (e) {
    console.error("Failed to parse AI response:", e);
    return contacts.map(() => ({
      side: "other" as const,
      skills: ["BUSINESS", "GLOBAL", "SENIOR", "FINANCE"],
      confidence: 50,
      reasoning: "Parse error fallback"
    }));
  }
}
