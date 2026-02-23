export type SignalRegion = "london" | "europe" | "uae" | "usa";
export type SignalCategory = "funding" | "hiring" | "expansion" | "c_suite" | "team_growth";

export interface SignalQualityInput {
  title?: string | null;
  description?: string | null;
  rawContent?: string | null;
  company?: string | null;
  source?: string | null;
  url?: string | null;
  expectedRegion?: string | null;
  signalType?: string | null;
  keyPeople?: string[] | null;
}

export interface SignalQualityResult {
  accepted: boolean;
  reason?: string;
  company: string;
  signalType: SignalCategory;
  expectedRegion: SignalRegion;
  detectedRegion: SignalRegion | null;
  amount: number | null; // stored in millions
  currency: "USD" | "EUR" | "GBP" | null;
  keyPeople: string[];
  dealSignature: string;
  dedupeKey: string;
  mustHave: boolean;
}

const REGION_ALIASES: Record<string, SignalRegion> = {
  london: "london",
  uk: "london",
  gb: "london",
  europe: "europe",
  eu: "europe",
  uae: "uae",
  usa: "usa",
  us: "usa",
  east_usa: "usa",
  west_usa: "usa",
};

const REGION_KEYWORDS: Record<SignalRegion, string[]> = {
  london: [
    "london", "uk", "united kingdom", "britain", "england", "city of london", "canary wharf",
    "ftse", "lse",
  ],
  europe: [
    "europe", "eu", "germany", "france", "netherlands", "spain", "italy", "switzerland", "austria",
    "berlin", "paris", "amsterdam", "frankfurt", "munich", "zurich", "madrid", "brussels", "milan",
  ],
  uae: [
    "uae", "united arab emirates", "dubai", "abu dhabi", "adgm", "difc", "emirates",
  ],
  usa: [
    "usa", "united states", "america", "new york", "nyc", "san francisco", "los angeles", "boston",
    "miami", "chicago", "nasdaq", "wall street",
  ],
};

const SECTOR_KEYWORDS = [
  "private equity", "pe fund", "buyout", "lbo", "growth equity", "venture capital", "vc fund",
  "family office", "credit fund", "infrastructure fund", "asset management", "fund close",
  "final close", "first close", "raises fund", "capital raise", "acquisition", "merger",
];

const MUST_REJECT_TOPICS = [
  "election", "parliament", "senate", "gdp", "inflation", "interest rate", "central bank",
  "weather", "sports", "championship", "movie", "celebrity", "murder", "shooting", "military strike",
];

const GENERIC_COMPANY_PATTERNS = [
  "market buyouts",
  "buyouts shop",
  "latest manager",
  "for debut",
  "bn for debut",
  "news update",
];

const COMPANY_ACTION_WORDS = [
  "raises", "raised", "closes", "closed", "launches", "launched", "acquires", "acquired",
  "appoints", "appointed", "names", "named", "hires", "hired", "merges", "merged", "combines",
  "announces", "targets", "seeks", "opens", "expands", "expansion",
];

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "at", "with", "by", "from",
  "is", "are", "was", "were", "as", "has", "have",
]);

function asText(value?: string | null): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeForKey(value?: string | null): string {
  return asText(value)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalRegion(region?: string | null): SignalRegion {
  const key = normalizeForKey(region).replace(/\s+/g, "_");
  return REGION_ALIASES[key] || "europe";
}

function newsFingerprint(title?: string | null, description?: string | null): string {
  const merged = normalizeForKey(`${title || ""} ${description || ""}`);
  const tokens = merged.split(" ").filter((t) => t && !STOP_WORDS.has(t)).slice(0, 18);
  return tokens.join(" ");
}

function scoreRegions(text: string): Record<SignalRegion, number> {
  const lower = normalizeForKey(text);
  const scores: Record<SignalRegion, number> = { london: 0, europe: 0, uae: 0, usa: 0 };
  (Object.keys(REGION_KEYWORDS) as SignalRegion[]).forEach((region) => {
    REGION_KEYWORDS[region].forEach((kw) => {
      if (lower.includes(kw)) scores[region] += 1;
    });
  });
  scores.london *= 1.25; // London source is often UK-specific.
  return scores;
}

function detectStrictRegion(text: string): SignalRegion | null {
  const scores = scoreRegions(text);
  const pairs = (Object.keys(scores) as SignalRegion[]).map((r) => ({ region: r, score: scores[r] }));
  pairs.sort((a, b) => b.score - a.score);
  if (!pairs[0] || pairs[0].score <= 0) return null;
  if (pairs[1] && pairs[0].score === pairs[1].score) return null;
  return pairs[0].region;
}

function hasSectorContext(text: string): boolean {
  const lower = normalizeForKey(text);
  return SECTOR_KEYWORDS.some((kw) => lower.includes(kw));
}

function detectMustHave(text: string): { hit: boolean; type?: SignalCategory } {
  const lower = normalizeForKey(text);

  const isFundClose = /\b(fund close|final close|first close|closes fund|closed fund|raises fund|hard cap)\b/i.test(lower);
  if (isFundClose) return { hit: true, type: "funding" };

  const hasPEContext = /\b(private equity|pe fund|buyout|family office|venture capital|vc fund)\b/i.test(lower);
  const isNewPECEO = /\b(appoints|appointed|names|named|hires|hired|joins)\b[\s\S]{0,80}\b(ceo|chief executive officer)\b/i.test(lower);
  if (hasPEContext && isNewPECEO) return { hit: true, type: "c_suite" };

  const isFamilyOfficeMerger = /\b(merger|merge|combines|combination|to merge)\b[\s\S]{0,100}\b(family office|private equity firm|pe firm)\b/i.test(lower);
  if (isFamilyOfficeMerger) return { hit: true, type: "expansion" };

  return { hit: false };
}

function classifySignalType(text: string): SignalCategory {
  const lower = normalizeForKey(text);
  const mustHave = detectMustHave(lower);
  if (mustHave.hit && mustHave.type) return mustHave.type;

  if (/\b(appoints|appointed|names|named|hires|hired|joins)\b[\s\S]{0,60}\b(ceo|cfo|coo|chro|chief executive|chief financial|managing partner)\b/i.test(lower)) {
    return "c_suite";
  }
  if (/\b(headcount|team growth|people team|talent team|workforce expansion|adds [0-9]+ professionals)\b/i.test(lower)) {
    return "team_growth";
  }
  if (/\b(hiring|open roles|job openings|recruiting|recruitment drive|talent acquisition)\b/i.test(lower)) {
    return "hiring";
  }
  if (/\b(fund close|final close|first close|closes fund|raises fund|fundraise|fundraising|capital raise|series [abcde])\b/i.test(lower)) {
    return "funding";
  }
  if (/\b(acquires|acquired|acquisition|merger|merge|combines|opens office|expands|expansion|launches)\b/i.test(lower)) {
    return "expansion";
  }
  return "expansion";
}

function parseNumeric(raw: string): number | null {
  const compact = raw.replace(/\s+/g, "");
  if (!compact) return null;
  if (compact.includes(",") && !compact.includes(".")) {
    const parts = compact.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      const v = Number(`${parts[0]}.${parts[1]}`);
      return Number.isFinite(v) ? v : null;
    }
  }
  const normalized = compact.replace(/,/g, "");
  const v = Number(normalized);
  return Number.isFinite(v) ? v : null;
}

function resolveCurrency(tokens: Array<string | undefined>, fullText: string): "USD" | "EUR" | "GBP" | null {
  const joined = `${tokens.filter(Boolean).join(" ")} ${fullText}`;
  if (/[€]|\beur\b|\beuro\b/i.test(joined)) return "EUR";
  if (/[£]|\bgbp\b|\bpound\b/i.test(joined)) return "GBP";
  if (/[$]|\busd\b|\bdollar\b|\bus\$/i.test(joined)) return "USD";
  return null;
}

function extractAmount(text: string): { amount: number; currency: "USD" | "EUR" | "GBP" | null } | null {
  const source = asText(text);
  if (!source) return null;

  const regex = /(?:\b(USD|EUR|GBP|US\$)\s*|([€£$])\s*)?([0-9]{1,3}(?:[,\s][0-9]{3})*(?:[.,][0-9]+)?|[0-9]+(?:[.,][0-9]+)?)\s*(bn|billion|b|mn|million|m)\b(?:\s*(USD|EUR|GBP)|\s*(dollars?|euros?|pounds?)|\s*([€£$]))?/gi;
  let best: { amount: number; currency: "USD" | "EUR" | "GBP" | null } | null = null;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    const rawNumber = String(match[3] || "");
    const value = parseNumeric(rawNumber);
    if (!value || value <= 0) continue;

    const unit = String(match[4] || "").toLowerCase();
    const amount = unit === "bn" || unit === "billion" || unit === "b" ? value * 1000 : value; // millions
    const currency = resolveCurrency([match[1], match[2], match[5], match[6], match[7]], source);

    if (!best || amount > best.amount) {
      best = { amount, currency };
    }
  }

  return best;
}

function extractCompanyCandidateFromText(title: string, description: string): string | null {
  const primary = asText(title);
  const secondary = asText(description);
  const corpus = `${primary} ${secondary}`;

  const patterns = [
    /^([A-Z][A-Za-z0-9&'`.\-\s]{1,70}?)\s+(?:raises|raised|closes|closed|launches|launched|acquires|acquired|appoints|appointed|names|named|hires|hired|merges|merged|combines|announces|targets|seeks|opens|expands)\b/,
    /\b(?:shop|firm|manager|investor|fund|group)\s+([A-Z][A-Za-z0-9&'`.\-\s]{1,40}?)\s+(?:raises|closes|launches|appoints|acquires|merges|combines|targets)\b/i,
    /^([A-Z][A-Za-z0-9&'`.\-\s]{1,40}?(?:Capital|Partners|Group|Holdings|Ventures|Management|Advisors))\b/,
    /^([A-Z][A-Za-z0-9&'`.\-\s]{1,30})\s*[:-]/,
  ];

  for (const pattern of patterns) {
    const m = corpus.match(pattern);
    if (m?.[1]) return m[1].trim();
  }

  return null;
}

function cleanupCompanyName(raw: string): string {
  let out = asText(raw)
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/\s*[-–—:|].*$/, "")
    .replace(/\s+(fund\s+[ivx0-9]+)\b.*$/i, "")
    .replace(/\s+(latest manager|for debut|debut)\b.*$/i, "")
    .trim();

  out = out.replace(/^(mid[-\s]?market|buyouts?|market|private equity|venture capital|family office|shop|firm)\s+/i, "").trim();
  out = out.replace(/\s+/g, " ");

  return out;
}

function isValidCompanyName(company: string): boolean {
  const value = asText(company);
  if (!value || value.length < 2 || value.length > 60) return false;
  if (!/[A-Za-z]/.test(value)) return false;
  if (/\b(bn|billion|million|debut|latest)\b/i.test(value)) return false;
  if (value.split(" ").length > 7) return false;

  const lower = value.toLowerCase();
  if (GENERIC_COMPANY_PATTERNS.some((p) => lower.includes(p))) return false;
  if (COMPANY_ACTION_WORDS.some((w) => lower.includes(` ${w}`))) return false;

  return true;
}

function resolveCompany(input: SignalQualityInput): string | null {
  const inputCompany = cleanupCompanyName(asText(input.company));
  if (isValidCompanyName(inputCompany)) return inputCompany;

  const fromText = cleanupCompanyName(extractCompanyCandidateFromText(asText(input.title), asText(input.description)) || "");
  if (isValidCompanyName(fromText)) return fromText;

  return null;
}

function extractKeyPeople(text: string, existing?: string[] | null): string[] {
  const people = new Set<string>();
  (existing || []).forEach((p) => {
    const cleaned = asText(p);
    if (cleaned) people.add(cleaned);
  });

  const patterns = [
    /\b(?:appoints|appointed|names|named|hires|hired)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:as|to)\b/gi,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:joins|appointed|named)\s+as\b/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) people.add(match[1].trim());
    }
  }

  return Array.from(people).slice(0, 5);
}

function buildDealSignature(text: string, signalType: SignalCategory, amount: number | null, currency: string | null): string {
  const lower = normalizeForKey(text);
  const action =
    /\b(fund close|final close|first close|raises fund|hard cap)\b/i.test(lower) ? "fund_close" :
    /\b(acquires|acquisition|buyout)\b/i.test(lower) ? "acquisition" :
    /\b(merger|merge|combines)\b/i.test(lower) ? "merger" :
    /\b(appoints|appointed|names|named|new ceo|new cfo)\b/i.test(lower) ? "c_suite" :
    /\b(hiring|hires|open roles|recruiting)\b/i.test(lower) ? "hiring" :
    signalType;

  const fundName = (lower.match(/\bfund\s+[a-z0-9ivx-]{1,20}\b/i)?.[0] || "").replace(/\s+/g, "_");
  const amountKey = amount ? `${currency || "na"}_${Math.round(amount)}` : "na";
  return `${action}|${fundName || "na"}|${amountKey}`;
}

function isMustReject(text: string, mustHave: boolean): boolean {
  const lower = normalizeForKey(text);
  if (MUST_REJECT_TOPICS.some((topic) => lower.includes(topic))) return true;
  if (!mustHave && !hasSectorContext(lower)) return true;
  return false;
}

export function evaluateSignalQuality(input: SignalQualityInput): SignalQualityResult {
  const expectedRegion = canonicalRegion(input.expectedRegion);
  const title = asText(input.title);
  const description = asText(input.description);
  const rawContent = asText(input.rawContent);
  const combined = `${title} ${description} ${rawContent}`.trim();

  if (!combined || combined.length < 24) {
    return {
      accepted: false,
      reason: "insufficient_content",
      company: "",
      signalType: "expansion",
      expectedRegion,
      detectedRegion: null,
      amount: null,
      currency: null,
      keyPeople: [],
      dealSignature: "na",
      dedupeKey: "",
      mustHave: false,
    };
  }

  const mustHave = detectMustHave(combined);
  if (isMustReject(combined, mustHave.hit)) {
    return {
      accepted: false,
      reason: "rejected_topic_or_sector",
      company: "",
      signalType: "expansion",
      expectedRegion,
      detectedRegion: null,
      amount: null,
      currency: null,
      keyPeople: [],
      dealSignature: "na",
      dedupeKey: "",
      mustHave: mustHave.hit,
    };
  }

  const detectedRegion = detectStrictRegion(combined);
  if (detectedRegion && detectedRegion !== expectedRegion) {
    return {
      accepted: false,
      reason: `region_mismatch:${detectedRegion}`,
      company: "",
      signalType: "expansion",
      expectedRegion,
      detectedRegion,
      amount: null,
      currency: null,
      keyPeople: [],
      dealSignature: "na",
      dedupeKey: "",
      mustHave: mustHave.hit,
    };
  }

  const company = resolveCompany(input);
  if (!company) {
    return {
      accepted: false,
      reason: "company_not_found",
      company: "",
      signalType: "expansion",
      expectedRegion,
      detectedRegion,
      amount: null,
      currency: null,
      keyPeople: [],
      dealSignature: "na",
      dedupeKey: "",
      mustHave: mustHave.hit,
    };
  }

  const category = mustHave.type || classifySignalType(combined) || "expansion";
  const amountData = extractAmount(combined);
  const isFundClose = category === "funding" && /\b(fund close|final close|first close|closes fund|closed fund|raises fund|hard cap)\b/i.test(combined);

  if (isFundClose && !amountData) {
    return {
      accepted: false,
      reason: "fund_close_missing_amount",
      company,
      signalType: category,
      expectedRegion,
      detectedRegion,
      amount: null,
      currency: null,
      keyPeople: [],
      dealSignature: "na",
      dedupeKey: "",
      mustHave: mustHave.hit,
    };
  }

  const keyPeople = extractKeyPeople(combined, input.keyPeople);
  const dealSignature = buildDealSignature(combined, category, amountData?.amount || null, amountData?.currency || null);
  const peopleKey = keyPeople.map((p) => normalizeForKey(p)).sort().join(",");
  const dedupeKey = [
    normalizeForKey(company),
    newsFingerprint(title, description || rawContent),
    peopleKey || "na",
    normalizeForKey(input.source) || "na",
    normalizeForKey(dealSignature),
  ].join("|");

  return {
    accepted: true,
    company,
    signalType: category,
    expectedRegion,
    detectedRegion,
    amount: amountData?.amount || null,
    currency: amountData?.currency || null,
    keyPeople,
    dealSignature,
    dedupeKey,
    mustHave: mustHave.hit,
  };
}
