// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// RapidAPI removed — Apify only
const REMOTE_TERMS = [
  "remote",
  "work from home",
  "wfh",
  "home based",
  "home-based",
  "anywhere",
  "virtual",
];

const RECRUITER_COMPANY_TERMS = [
  "recruitment",
  "recruiting",
  "staffing",
  "headhunt",
  "executive search",
  "talent solutions",
  "search partners",
];

const RECRUITER_LISTING_TERMS = [
  "for one of our clients",
  "on behalf of our client",
  "for our client",
  "our client is seeking",
];

const LOCATION_ALIAS_MAP: Record<string, string> = {
  loondon: "London",
  londonn: "London",
  londn: "London",
  nyc: "New York",
  "new-york": "New York",
  newyork: "New York",
  "san-francisco": "San Francisco",
  losangeles: "Los Angeles",
  "abu-dhabi": "Abu Dhabi",
  uae: "United Arab Emirates",
  uk: "United Kingdom",
};

function splitCsv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function selectActorsForSource(actorIds: string[], source: string): string[] {
  if (actorIds.length === 0) return [];
  const normalizedSource = String(source || "all").toLowerCase();
  if (normalizedSource === "linkedin") return [actorIds[0]];
  if (normalizedSource === "career") return [actorIds[1] || actorIds[0]];
  return actorIds;
}

function splitTerms(value: string): string[] {
  if (!value) return [];
  return value
    .split(/\s+OR\s+|,|\|/i)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function normalizeLocationToken(token: string): string {
  const trimmed = String(token || "").trim();
  if (!trimmed) return "";

  const compact = trimmed.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
  if (LOCATION_ALIAS_MAP[compact]) return LOCATION_ALIAS_MAP[compact];

  const normalizedCase = trimmed.replace(/\s+/g, " ");
  const lower = normalizedCase.toLowerCase();
  if (/^lo+ndon$/.test(lower) || /^london+$/.test(lower) || lower === "lndon") return "London";
  return normalizedCase;
}

function normalizeLocationExpression(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .split(/(\s+OR\s+|\|)/i)
    .map((chunk) => {
      if (/^\s*\|\s*$/.test(chunk)) return " | ";
      if (/^\s*or\s*$/i.test(chunk)) return " OR ";
      return chunk
        .split(",")
        .map((part) => normalizeLocationToken(part))
        .filter(Boolean)
        .join(", ");
    })
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function mapTimeRange(postedAfter: string): string {
  const v = String(postedAfter || "").toLowerCase();
  if (v === "1hour" || v === "1h") return "1h";
  if (v === "24hours" || v === "24h") return "24h";
  if (v === "14days" || v === "14d" || v === "2weeks") return "14d";
  if (v === "30days" || v === "30d") return "30d";
  if (v === "6m") return "6m";
  return "7d";
}

function postedAfterToMs(postedAfter: string): number | null {
  const v = String(postedAfter || "").toLowerCase();
  if (v === "1hour" || v === "1h") return 60 * 60 * 1000;
  if (v === "24hours" || v === "24h") return 24 * 60 * 60 * 1000;
  if (v === "14days" || v === "14d" || v === "2weeks") return 14 * 24 * 60 * 60 * 1000;
  if (v === "30days" || v === "30d") return 30 * 24 * 60 * 60 * 1000;
  if (v === "7days" || v === "7d") return 7 * 24 * 60 * 60 * 1000;
  return null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getParam(body: Record<string, unknown>, url: URL, key: string, fallback = ""): string {
  const fromBody = body[key];
  if (typeof fromBody === "string" && fromBody.trim().length > 0) return fromBody.trim();
  const fromQuery = url.searchParams.get(key);
  if (fromQuery && fromQuery.trim().length > 0) return fromQuery.trim();
  return fallback;
}

function normalizeUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeJobs(jobs: Record<string, unknown>[]): Record<string, unknown>[] {
  return jobs.map((job, index) => {
    const locations = (job.locations_derived as Array<{ city?: string; admin?: string; country?: string }>) || [];
    const locationsRawStrings = Array.isArray(job.locations_derived)
      ? (job.locations_derived as unknown[]).filter((v) => typeof v === "string") as string[]
      : [];
    const locationFromDerived =
      locations.length > 0
        ? locations.map((l) => [l.city, l.admin, l.country].filter(Boolean).join(", ")).join(" | ")
        : locationsRawStrings.length > 0
          ? locationsRawStrings.join(" | ")
          : "";

    const title =
      (job.title as string) ||
      (job.job_title as string) ||
      (job.positionName as string) ||
      (job.role as string) ||
      (job.position as string) ||
      "Untitled Position";

    const company =
      (job.organization as string) ||
      (job.company as string) ||
      (job.company_name as string) ||
      (job.companyName as string) ||
      (job.hiringOrganization as string) ||
      (job.employer_name as string) ||
      (job.employer as string) ||
      "Unknown Company";

    const description =
      (job.description_text as string) ||
      (job.description as string) ||
      (job.job_description as string) ||
      "";

    const postedAt =
      (job.date_posted as string) ||
      (job.posted_at as string) ||
      (job.publication_date as string) ||
      (job.publishedAt as string) ||
      (job.postedDate as string) ||
      new Date().toISOString();

    const applyUrl =
      (job.url as string) ||
      (job.apply_url as string) ||
      (job.job_url as string) ||
      (job.jobUrl as string) ||
      (job.applyUrl as string) ||
      (job.link as string) ||
      null;

    const location =
      locationFromDerived ||
      (job.location as string) ||
      (job.jobLocation as string) ||
      (job.locationName as string) ||
      (job.city as string) ||
      (job.country as string) ||
      "Remote";

    const salaryMin =
      toNumber(job.ai_salary_minvalue) ??
      toNumber(job.salary_min) ??
      toNumber(job.min_salary) ??
      toNumber((job.salary_range as Record<string, unknown> | undefined)?.min) ??
      toNumber(job.ai_salary_value);

    const salaryMax =
      toNumber(job.ai_salary_maxvalue) ??
      toNumber(job.salary_max) ??
      toNumber(job.max_salary) ??
      toNumber((job.salary_range as Record<string, unknown> | undefined)?.max);

    const salaryCurrency =
      (job.ai_salary_currency as string) ||
      (job.currency as string) ||
      "USD";

    const isRemote =
      job.location_type === "TELECOMMUTE" ||
      job.remote_derived === true ||
      (job.remote as boolean) === true ||
      (job.is_remote as boolean) === true ||
      String(job.workplace_type || "").toLowerCase().includes("remote");

    const employmentType = (job.employment_type as string[]) || (job.ai_employment_type as string[]) || [];
    const jobType = employmentType.length > 0 ? employmentType[0] : ((job.job_type as string) || "Full-time");

    const salary =
      salaryMin && salaryMax
        ? `${salaryCurrency} ${salaryMin.toLocaleString()} - ${salaryMax.toLocaleString()}`
        : salaryMin
          ? `${salaryCurrency} ${salaryMin.toLocaleString()}+`
          : null;

    return {
      id: job.id || `job-${index}`,
      title,
      company,
      company_url: (job.organization_url as string) || (job.company_url as string) || null,
      company_logo: (job.organization_logo as string) || (job.company_logo as string) || null,
      location,
      salary,
      salary_min: salaryMin,
      salary_max: salaryMax,
      currency: salaryCurrency,
      posted_at: postedAt,
      apply_url: normalizeUrl(applyUrl),
      description,
      remote: isRemote,
      job_type: jobType,
      source:
        (job.source as string) ||
        (job.provider as string) ||
        (job.sourceType as string) ||
        (job.portal as string) ||
        "fantastic.jobs",
      ai_skills: (job.ai_key_skills as string[]) || [],
      ai_experience: (job.ai_experience_level as string) || null,
    };
  });
}

function isRemoteLikeJob(job: Record<string, unknown>): boolean {
  if ((job.remote as boolean) === true) return true;
  const text = `${String(job.location || "")} ${String(job.title || "")} ${String(job.description || "")}`.toLowerCase();
  return REMOTE_TERMS.some((term) => text.includes(term));
}

function isRecruiterLikeJob(job: Record<string, unknown>): boolean {
  const company = String(job.company || "").toLowerCase();
  const titleDesc = `${String(job.title || "")} ${String(job.description || "")}`.toLowerCase();
  const companyMatch = RECRUITER_COMPANY_TERMS.some((term) => company.includes(term));
  const listingMatch = RECRUITER_LISTING_TERMS.some((term) => titleDesc.includes(term));
  return companyMatch || listingMatch;
}

function applyStrictResultFilters(jobs: Record<string, unknown>[]): Record<string, unknown>[] {
  return jobs.filter((job) => !isRemoteLikeJob(job) && !isRecruiterLikeJob(job));
}

function filterByPostedAfter(
  jobs: Record<string, unknown>[],
  postedAfter: string,
): Record<string, unknown>[] {
  const windowMs = postedAfterToMs(postedAfter);
  if (!windowMs) return jobs;

  const cutoff = Date.now() - windowMs;
  let validDates = 0;
  const filtered = jobs.filter((job) => {
    const postedAt = String(job.posted_at || "");
    const ts = new Date(postedAt).getTime();
    if (!Number.isFinite(ts)) return false;
    validDates += 1;
    return ts >= cutoff;
  });

  // Fail open if provider date formats are inconsistent and filtering would hide all jobs.
  if (jobs.length > 0 && (validDates === 0 || filtered.length === 0)) {
    console.warn("[fantastic-jobs] posted_after filter produced zero rows; returning unfiltered jobs");
    return jobs;
  }
  return filtered;
}

async function fetchWithRetry(
  fetchFn: () => Promise<Response>,
  maxRetries = 3,
  baseDelayMs = 2000,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetchFn();
    if (res.status === 429) {
      await res.text(); // consume body
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`[fantastic-jobs] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw new Error("Rate limit exceeded");
    }
    return res;
  }
  throw new Error("Rate limit exceeded");
}


async function fetchViaApify(
  apifyToken: string,
  actorId: string,
  body: Record<string, unknown>,
  url: URL,
): Promise<Record<string, unknown>[]> {
  const keyword = getParam(body, url, "keyword");
  const location = normalizeLocationExpression(getParam(body, url, "location"));
  const postedAfter = getParam(body, url, "posted_after", "7days");
  const salaryMin = getParam(body, url, "salary_min");
  const limit = getParam(body, url, "limit", "50");
  const offset = getParam(body, url, "offset", "0");

  const timeRange = mapTimeRange(postedAfter);
  const maxItems = Math.min(Math.max(Number(limit) || 50, 10), 5000);
  const titleSearch = splitTerms(keyword);
  const locationSearch = splitTerms(location);
  const actorLower = actorId.toLowerCase();
  const isCareerActor = actorLower.includes("s3dtstzszwftavln5") || actorLower.includes("career-site-job-listing-api");

  const actorInput: Record<string, unknown> = {
    timeRange,
    limit: maxItems,
    includeAi: true,
    descriptionType: "text",
    removeAgency: true,
    populateAiRemoteLocation: true,
    populateAiRemoteLocationDerived: true,
  };

  if (titleSearch.length > 0) actorInput.titleSearch = titleSearch;
  if (locationSearch.length > 0) actorInput.locationSearch = locationSearch;
  if (salaryMin) actorInput.aiHasSalary = true;
  if (isCareerActor) actorInput.includeLinkedIn = true;
  if (offset && Number(offset) > 0) actorInput.offset = Number(offset);

  const buildRunSyncUrl = (input: Record<string, unknown>) => {
    return (
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}` +
      `/run-sync-get-dataset-items?token=${encodeURIComponent(apifyToken)}&format=json&clean=true&maxItems=${maxItems}`
    );
  };

  console.log("[fantastic-jobs] Apify actor:", actorId);
  console.log(
    "[fantastic-jobs] Apify input keys:",
    Object.keys(actorInput).filter((k) => (actorInput as Record<string, unknown>)[k] !== undefined),
  );

  const parseApifyItems = (data: unknown): Record<string, unknown>[] => {
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    if (!data || typeof data !== "object") return [];

    const maybeObj = data as Record<string, unknown>;
    if (Array.isArray(maybeObj.items)) return maybeObj.items as Record<string, unknown>[];
    if (Array.isArray(maybeObj.results)) return maybeObj.results as Record<string, unknown>[];
    if (Array.isArray(maybeObj.data)) return maybeObj.data as Record<string, unknown>[];
    return [];
  };

  const syncUrl = buildRunSyncUrl(actorInput);
  const syncRes = await fetchWithRetry(() =>
    fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(actorInput),
    }),
  );

  if (!syncRes.ok) {
    const syncErr = await syncRes.text();
    throw new Error(`Apify request failed for ${actorId}: ${syncRes.status} - ${syncErr.slice(0, 220)}`);
  }

  const data = await syncRes.json();
  return parseApifyItems(data);
}

async function readApiSettings(): Promise<Record<string, string>> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return {};

  try {
    const supabase = createClient(supabaseUrl, serviceRole);
    const { data, error } = await supabase
      .from("api_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["apify_token", "apify_actor_id"]);

    if (error || !data) return {};
    return data.reduce((acc: Record<string, string>, row: any) => {
      acc[String(row.setting_key)] = String(row.setting_value || "");
      return acc;
    }, {});
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: Record<string, unknown> = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const savedSettings = await readApiSettings();

    const apifyToken =
      (body.apify_token as string) ||
      (body.apiKey as string) ||
      savedSettings.apify_token ||
      Deno.env.get("APIFY_TOKEN") ||
      Deno.env.get("APIFY_API_TOKEN") ||
      "";
    const sourceMode = getParam(body, url, "source", "all").toLowerCase();
    const bodyActorIds = splitCsv(body.actor_id as string);
    const savedActorIds = splitCsv(savedSettings.apify_actor_id);
    const envActorIds = uniqueStrings([
      ...splitCsv(Deno.env.get("APIFY_FANTASTIC_JOBS_ACTOR_IDS") || ""),
      ...splitCsv(Deno.env.get("APIFY_FANTASTIC_JOBS_ACTOR_ID") || ""),
      ...splitCsv(Deno.env.get("APIFY_ACTOR_ID") || ""),
    ]);

    let apifyActorIds: string[] = [];
    if (bodyActorIds.length > 0) {
      apifyActorIds = uniqueStrings(bodyActorIds);
    } else if (savedActorIds.length > 0) {
      apifyActorIds = uniqueStrings(selectActorsForSource(savedActorIds, sourceMode));
    } else {
      apifyActorIds = uniqueStrings(selectActorsForSource(envActorIds, sourceMode));
    }
    let rawJobs: Record<string, unknown>[] = [];
    let provider = "";
    let providerError = "";
    const requestedLimit = Math.min(Math.max(Number(getParam(body, url, "limit", "50")) || 50, 1), 5000);
    const postedAfter = getParam(body, url, "posted_after", "7days");

    if (apifyToken && apifyActorIds.length > 0) {
      const providerParts: string[] = [];
      let collected: Record<string, unknown>[] = [];
      for (const actorId of apifyActorIds) {
        try {
          const actorJobs = await fetchViaApify(apifyToken, actorId, body, url);
          if (actorJobs.length > 0) {
            collected = collected.concat(actorJobs);
            providerParts.push(`apify:${actorId}`);
          }
        } catch (error) {
          const err = error instanceof Error ? error.message : `Apify failed for ${actorId}`;
          providerError = providerError ? `${providerError}; ${err}` : err;
          console.error("[fantastic-jobs] Apify error:", err);
        }
      }
      if (collected.length > 0) {
        rawJobs = collected;
        provider = providerParts.join(",");
      }
    }

    if (rawJobs.length === 0 && !provider) {
      throw new Error(
        providerError ||
          "No jobs provider available. Configure Apify token + actor IDs in Settings.",
      );
    }

    const normalizedJobs = normalizeJobs(rawJobs);
    const postedFilteredJobs = filterByPostedAfter(normalizedJobs, postedAfter);
    const strictFilteredJobs = applyStrictResultFilters(postedFilteredJobs);
    const dedupedJobs = Array.from(
      new Map(
        strictFilteredJobs.map((job) => {
          const applyUrl = String(job.apply_url || "").toLowerCase();
          const title = String(job.title || "").toLowerCase();
          const company = String(job.company || "").toLowerCase();
          return [`${applyUrl}|${title}|${company}`, job] as const;
        }),
      ).values(),
    );
    const jobs = dedupedJobs.slice(0, requestedLimit);
    const offset = Number(getParam(body, url, "offset", "0"));
    const limit = requestedLimit;

    return new Response(
      JSON.stringify({
        success: true,
        provider,
        jobs,
        total: jobs.length,
        offset,
        limit,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const isRateLimit = errMsg.toLowerCase().includes("rate limit");
    console.error("[fantastic-jobs] Error:", errMsg);
    return new Response(
      JSON.stringify({
        success: false,
        error: isRateLimit ? "Rate limit exceeded. Please wait a moment and try again." : errMsg,
        jobs: [],
        rateLimited: isRateLimit,
      }),
      {
        status: isRateLimit ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
