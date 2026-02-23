import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useProfileName } from "@/hooks/useProfileName";
import { supabase } from "@/integrations/supabase/client";
import { createEnrichmentRun } from "@/lib/dataApi";
import { Search, RefreshCw, Download, ExternalLink, MapPin, Building2, Calendar, Banknote, X, Users } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  posted_at: string;
  apply_url: string | null;
  description: string;
  remote: boolean;
  job_type: string;
  source: string;
  ai_taxonomies?: string[];
  is_pe_match?: boolean;
}

interface Filters {
  title: string;
  industryKeywords: string;
  company: string;
  exclude: string;
  industry: string;
  jobsPerSearch: string;
  location: string;
  salaryMin: string;
  remote: boolean;
  postedAfter: string;
}

interface ApolloJobContact {
  name: string;
  title: string;
  company: string;
  email: string;
  location: string;
}

type SearchMode = "all" | "linkedin" | "career";
type SourceTab = "all" | "linkedin" | "career";
type SearchHistoryItem = {
  id: string;
  createdAt: string;
  mode: SearchMode;
  filters: Filters;
  strictPEOnly: boolean;
  resultCount: number;
  topResults: string[];
  results: Job[];
};

type JobsDiagnostics = {
  raw?: number;
  normalized?: number;
  returned?: number;
  requested?: number;
  effective_limit?: number;
  mixed?: number;
};

type FetchJobsResult = {
  jobs: Job[];
  diagnostics?: JobsDiagnostics;
};

type RunSearchOptions = {
  force?: boolean;
  append?: boolean;
  offset?: number;
};

const SEARCH_HISTORY_KEY = "jobs.search_history.v1";
const SEARCH_CACHE_WINDOW_MS = 10 * 60 * 1000;
const MAX_SEARCH_HISTORY_ITEMS = 12;
const MAX_SUGGESTIONS_PER_FIELD = 24;

const DEFAULT_FILTERS: Filters = {
  title: "",
  industryKeywords: "",
  company: "",
  exclude: "",
  industry: "all",
  jobsPerSearch: "10",
  location: "",
  salaryMin: "",
  remote: false,
  postedAfter: "7days",
};

const INDUSTRY_OPTIONS = [
  "all",
  "Finance & Accounting",
  "Management & Leadership",
  "Consulting",
  "Technology",
  "Healthcare",
  "Software",
  "Data & Analytics",
  "Legal",
  "Sales",
  "Marketing",
];

const DEFAULT_POSITION_SUGGESTIONS = [
  "Analyst",
  "Associate",
  "Senior Associate",
  "Vice President",
  "Principal",
  "Director",
  "Managing Director",
  "Partner",
  "Investment Associate",
  "Investment Analyst",
  "Operating Partner",
  "Portfolio Operations",
  "Finance Director",
  "CFO",
  "Head of Talent",
  "Talent Acquisition",
];

const DEFAULT_INDUSTRY_KEYWORD_SUGGESTIONS = [
  "private equity",
  "buyout",
  "growth equity",
  "venture capital",
  "family office",
  "secondaries",
  "infrastructure",
  "credit",
  "real assets",
  "portfolio company",
  "fundraising",
  "capital markets",
  "M&A",
  "deal team",
  "investment banking",
  "asset management",
];

const DEFAULT_LOCATION_SUGGESTIONS = [
  "London",
  "United Kingdom",
  "New York",
  "San Francisco",
  "Los Angeles",
  "Chicago",
  "Boston",
  "Miami",
  "Paris",
  "Munich",
  "Frankfurt",
  "Zurich",
  "Amsterdam",
  "Dubai",
  "Abu Dhabi",
];

const PE_SIGNAL_TERMS = [
  "private equity",
  "venture capital",
  "family office",
  "buyout",
  "fund",
  "portfolio",
  "investor",
  "capital partners",
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

function normalizeLocationToken(token: string): string {
  const trimmed = String(token || "").trim();
  if (!trimmed) return "";

  const compact = trimmed.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
  if (LOCATION_ALIAS_MAP[compact]) return LOCATION_ALIAS_MAP[compact];

  const normalizedCase = trimmed.replace(/\s+/g, " ");
  const lower = normalizedCase.toLowerCase();

  if (/^lo+ndon$/.test(lower) || /^london+$/.test(lower) || lower === "lndon") {
    return "London";
  }

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

function isInvalidLocation(value: string): boolean {
  const normalized = String(value || "").trim();
  if (!normalized) return true;
  if (/^[|,\s-]+$/.test(normalized)) return true;
  return normalized.toLowerCase() === "remote";
}

function withLocationFallback(location: string, fallbackLocation: string): string {
  const normalizedLocation = String(location || "").trim();
  const fallback = String(fallbackLocation || "").trim();
  if (!fallback) return normalizedLocation || "Remote";
  if (isInvalidLocation(normalizedLocation)) return fallback;
  return normalizedLocation;
}

function classifyJobSource(source: string): "linkedin" | "career" | "other" {
  const s = String(source || "").toLowerCase();
  if (s.includes("linkedin") || s.includes("vigxjrrhqdtpue6m4")) return "linkedin";
  if (s.includes("career") || s.includes("s3dtstzszwftavln5")) return "career";
  return "other";
}

function formatSourceLabel(source: string): string {
  const bucket = classifyJobSource(source);
  if (bucket === "linkedin") return "LinkedIn";
  if (bucket === "career") return "Career Site";
  return source || "source";
}

function dedupeJobs(rows: Job[]): Job[] {
  const seen = new Set<string>();
  const out: Job[] = [];
  for (const row of rows) {
    const key = `${(row.apply_url || "").toLowerCase()}|${row.title.toLowerCase()}|${row.company.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function normalizeJobs(items: Record<string, unknown>[], actorId: string): Job[] {
  const normalized: Job[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const location =
      Array.isArray(item.locations_derived) && item.locations_derived.length > 0
        ? item.locations_derived
            .map((v: unknown) => {
              if (typeof v === "string") return v;
              if (typeof v === "object" && v) {
                const x = v as Record<string, string>;
                return [x.city, x.admin, x.country].filter(Boolean).join(", ");
              }
              return "";
            })
            .filter(Boolean)
            .join(" | ")
        : String(item.location || "");

    const salaryMin = toNumber(item.ai_salary_minvalue) ?? toNumber(item.salary_min);
    const salaryMax = toNumber(item.ai_salary_maxvalue) ?? toNumber(item.salary_max);
    const currency = String(item.ai_salary_currency || item.currency || "USD");
    const salary =
      salaryMin && salaryMax
        ? `${currency} ${salaryMin.toLocaleString()} - ${salaryMax.toLocaleString()}`
        : salaryMin
          ? `${currency} ${salaryMin.toLocaleString()}+`
          : null;

    normalized.push({
      id: String(item.id || `${actorId}-${i}`),
      title: String(item.title || item.job_title || "Untitled Position"),
      company: String(item.organization || item.company || item.company_name || "Unknown Company"),
      location: location || "Remote",
      salary,
      salary_min: salaryMin,
      salary_max: salaryMax,
      currency,
      posted_at: String(item.date_posted || item.posted_at || new Date().toISOString()),
      apply_url: normalizeUrl(item.url) || normalizeUrl(item.apply_url),
      description: String(item.description_text || item.description || ""),
      remote:
        item.location_type === "TELECOMMUTE" ||
        item.remote_derived === true ||
        item.remote === true ||
        item.is_remote === true,
      job_type:
        Array.isArray(item.employment_type) && item.employment_type.length > 0
          ? String(item.employment_type[0])
          : String(item.job_type || "Full-time"),
      source: String(item.source || item.provider || "fantastic.jobs"),
      ai_taxonomies: Array.isArray(item.ai_taxonomies) ? (item.ai_taxonomies as string[]) : [],
    });
  }

  return normalized;
}

function toHistoryJob(job: Job): Job {
  return {
    ...job,
    // Keep history payload compact but preserve enough text for stable filtering.
    description: (job.description || "").slice(0, 1200),
  };
}

function hasHistoryResults(item: SearchHistoryItem): boolean {
  const resultCount = Number(item.resultCount || 0);
  const rowCount = Array.isArray(item.results) ? item.results.length : 0;
  return Math.max(resultCount, rowCount) > 0;
}

function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function buildSuggestions(
  defaults: string[],
  historyValues: string[],
  mode: "position" | "industry" | "location",
): string[] {
  const splitHistoryValues = historyValues.flatMap((raw) => {
    const source = mode === "location" ? normalizeLocationExpression(String(raw || "")) : String(raw || "");
    const v = source.trim();
    if (!v) return [];
    const base = [v];
    if (mode === "location") {
      return base.concat(v.split(/\s+OR\s+|\|/i).map((x) => x.trim()));
    }
    return base.concat(v.split(/\s+OR\s+|,|\|/i).map((x) => x.trim()));
  });

  return uniqueCaseInsensitive([...splitHistoryValues, ...defaults]).slice(0, MAX_SUGGESTIONS_PER_FIELD);
}

function matchesPESignal(job: Job): boolean {
  if (typeof job.is_pe_match === "boolean") return job.is_pe_match;
  const fullText = `${job.title} ${job.company} ${job.description || ""}`.toLowerCase();
  return PE_SIGNAL_TERMS.some((term) => fullText.includes(term));
}

function inferDepartmentsFromJobTitle(title: string): string[] {
  const t = title.toLowerCase();
  const departments = new Set<string>(["HR / Talent Acquisition", "Leadership / C-Suite"]);

  if (/(cfo|finance|fp&a|controller|treasury)/i.test(t)) departments.add("Finance");
  if (/(general counsel|legal|compliance)/i.test(t)) departments.add("Legal");
  if (/(cto|engineer|software|data|it)/i.test(t)) departments.add("Engineering / IT");
  if (/(sales|business development|partnerships|revenue)/i.test(t)) departments.add("Sales / Business Development");
  if (/(marketing|brand|growth)/i.test(t)) departments.add("Marketing");
  if (/(operations|coo|operational)/i.test(t)) departments.add("Operations");

  return Array.from(departments);
}

function normalizeLocationSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function inferLocationsForEnrichment(location: string): string[] {
  const lower = (location || "").toLowerCase();
  const mapped: string[] = [];
  if (lower.includes("london")) mapped.push("london");
  if (lower.includes("new york") || lower.includes("nyc")) mapped.push("new-york");
  if (lower.includes("boston")) mapped.push("boston");
  if (lower.includes("san francisco")) mapped.push("san-francisco");
  if (lower.includes("los angeles")) mapped.push("los-angeles");
  if (lower.includes("chicago")) mapped.push("chicago");
  if (lower.includes("miami")) mapped.push("miami");
  if (lower.includes("dubai")) mapped.push("dubai");
  if (lower.includes("abu dhabi")) mapped.push("abu-dhabi");

  const rawParts = (location || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => part.split(",").map((s) => s.trim()).filter(Boolean))
    .slice(0, 4);

  const normalizedRaw = rawParts
    .map((part) => normalizeLocationSlug(part))
    .filter((part) => part.length > 1);

  const merged = Array.from(new Set([...mapped, ...normalizedRaw]));
  if (merged.length > 0) return merged;
  return ["new-york"];
}

function inferSignalRegionFromLocation(location: string): "london" | "europe" | "uae" | "usa" {
  const lower = (location || "").toLowerCase();
  if (lower.includes("dubai") || lower.includes("abu dhabi") || lower.includes("uae")) return "uae";
  if (lower.includes("london") || lower.includes("united kingdom") || lower.includes("uk")) return "london";
  if (
    lower.includes("new york") ||
    lower.includes("nyc") ||
    lower.includes("san francisco") ||
    lower.includes("los angeles") ||
    lower.includes("chicago") ||
    lower.includes("miami") ||
    lower.includes("usa") ||
    lower.includes("united states")
  ) return "usa";
  return "europe";
}

function inferTargetRolesForJob(jobTitle: string): string[] {
  const base = [
    "Recruiter",
    "Talent Acquisition",
    "HR Manager",
    "Head of Talent",
    "People Operations",
    "HR Director",
    "Hiring Manager",
  ];
  const t = (jobTitle || "").toLowerCase();
  if (/(partner|principal|director|vp|vice president|managing director)/i.test(t)) {
    base.push("Partner", "Principal", "Managing Director");
  }
  if (/(cfo|finance|controller|fund finance)/i.test(t)) {
    base.push("CFO", "Finance Director", "Head of Finance");
  }
  if (/(legal|counsel|compliance)/i.test(t)) {
    base.push("General Counsel", "Head of Legal");
  }
  return Array.from(new Set(base));
}

export function FantasticJobsBoard() {
  const { toast } = useToast();
  const profileName = useProfileName();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [searchMode, setSearchMode] = useState<SearchMode>("all");
  const [sourceTab, setSourceTab] = useState<SourceTab>("all");
  const [selectedSources, setSelectedSources] = useState({ linkedin: true, career: true });
  const [sortBy, setSortBy] = useState<"posted" | "salary">("posted");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [strictPEOnly, setStrictPEOnly] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [total, setTotal] = useState(0);
  const [apolloLoadingByJob, setApolloLoadingByJob] = useState<Record<string, boolean>>({});
  const [apolloContacts, setApolloContacts] = useState<ApolloJobContact[]>([]);
  const [apolloTargetJob, setApolloTargetJob] = useState<Job | null>(null);
  const [apolloModalOpen, setApolloModalOpen] = useState(false);
  const [warnedOutdatedBackend, setWarnedOutdatedBackend] = useState(false);
  const [baseOffset, setBaseOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => {
          if (!item || typeof item !== "object") return item;
          const row = item as SearchHistoryItem;
          return {
            ...row,
            filters: {
              ...row.filters,
              location: normalizeLocationExpression(row.filters?.location || ""),
              remote: false,
            },
          };
        })
        .filter((item): item is SearchHistoryItem => Boolean(item && hasHistoryResults(item)));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const cleaned = searchHistory.filter(hasHistoryResults).slice(0, MAX_SEARCH_HISTORY_ITEMS);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(cleaned));
    } catch (error) {
      console.error("Failed to persist search history:", error);
    }
  }, [searchHistory]);

  const requestedCount = useMemo(
    () => Math.max(10, Math.min(500, Number(filters.jobsPerSearch) || 100)),
    [filters.jobsPerSearch],
  );

  const positionSuggestions = useMemo(
    () => buildSuggestions(DEFAULT_POSITION_SUGGESTIONS, searchHistory.map((h) => h.filters.title || ""), "position"),
    [searchHistory],
  );

  const industryKeywordSuggestions = useMemo(
    () =>
      buildSuggestions(
        DEFAULT_INDUSTRY_KEYWORD_SUGGESTIONS,
        searchHistory.map((h) => h.filters.industryKeywords || ""),
        "industry",
      ),
    [searchHistory],
  );

  const locationSuggestions = useMemo(
    () => buildSuggestions(DEFAULT_LOCATION_SUGGESTIONS, searchHistory.map((h) => h.filters.location || ""), "location"),
    [searchHistory],
  );

  const fetchViaBackend = useCallback(
    async (mode: SearchMode, offset = 0): Promise<FetchJobsResult> => {
      const params: Record<string, string> = {};
      if (filters.title) params.keyword = filters.title;
      if (filters.industryKeywords) params.industry_keywords = filters.industryKeywords;
      const normalizedLocation = normalizeLocationExpression(filters.location);
      if (normalizedLocation) params.location = normalizedLocation;
      if (filters.salaryMin) params.salary_min = filters.salaryMin;
      if (filters.industry && filters.industry !== "all") params.industry = filters.industry;
      if (filters.postedAfter) params.posted_after = filters.postedAfter;
      params.source = mode;
      params.limit = String(requestedCount);
      params.offset = String(Math.max(0, offset));

      const { data, error } = await supabase.functions.invoke("fantastic-jobs", { body: params });
      if (data?.rateLimited) {
        throw new Error("Rate limited by provider. Wait 1-2 minutes before searching again.");
      }
      if (error) throw error;
      if (!data?.success || !Array.isArray(data.jobs)) throw new Error(data?.error || "Backend search failed");
      return {
        jobs: data.jobs as Job[],
        diagnostics: (data.diagnostics || undefined) as JobsDiagnostics | undefined,
      };
    },
    [filters, requestedCount],
  );

  const runSearch = useCallback(
    async (mode: SearchMode, options?: RunSearchOptions) => {
      const force = Boolean(options?.force);
      const append = Boolean(options?.append);
      const offset = Math.max(0, options?.offset ?? 0);
      setSearchMode(mode);
      setSourceTab(mode === "all" ? "all" : mode);

      const cached = !force && !append ? searchHistory.find((item) => {
        if (item.mode !== mode) return false;
        if (item.strictPEOnly !== strictPEOnly) return false;
        if (JSON.stringify(item.filters) !== JSON.stringify(filters)) return false;
        const ts = new Date(item.createdAt).getTime();
        return Number.isFinite(ts) && Date.now() - ts <= SEARCH_CACHE_WINDOW_MS;
      }) : undefined;

      if (cached) {
        loadHistoryItem(cached);
        toast({
          title: "Loaded cached search",
          description: "Used recent results to avoid extra API credits.",
        });
        return;
      }

      setLoading(true);
      try {
        const backendResult = await fetchViaBackend(mode, offset);
        const incoming = backendResult.jobs;
        const diagnostics = backendResult.diagnostics;
        if (!warnedOutdatedBackend && (!diagnostics || typeof diagnostics.returned !== "number")) {
          toast({
            title: "Backend update required",
            description: "Job API is running an older function version that can filter out Apify rows. Deploy latest fantastic-jobs function.",
            variant: "destructive",
          });
          setWarnedOutdatedBackend(true);
        }
        const searchLocation = normalizeLocationExpression(filters.location);
        const normalizedIncoming = incoming.map((job) => ({
          ...job,
          location: withLocationFallback(job.location, searchLocation),
        }));
        const effectiveLimit = Number(diagnostics?.effective_limit) > 0
          ? Number(diagnostics?.effective_limit)
          : mode === "all"
            ? requestedCount * 2
            : requestedCount;
        const capped = normalizedIncoming.slice(0, effectiveLimit);
        const withPEFlags = capped.map((job) => ({ ...job, is_pe_match: matchesPESignal(job) }));
        const peMatches = withPEFlags.filter((job) => job.is_pe_match).length;
        const pageVisibleRows = strictPEOnly
          ? withPEFlags.filter((job) => job.is_pe_match)
          : withPEFlags;
        const visibleRows = append ? dedupeJobs([...jobs, ...pageVisibleRows]) : pageVisibleRows;
        const historyResults = visibleRows.map(toHistoryJob);

        setJobs(visibleRows);
        setTotal(visibleRows.length);
        setLastRefresh(new Date());
        setBaseOffset(offset);
        setHasMore(incoming.length >= effectiveLimit);
        setSearchHistory((prev) => {
          const cleaned = prev.filter(hasHistoryResults);
          const isSameQuery = (item: SearchHistoryItem) =>
            item.mode === mode &&
            item.strictPEOnly === strictPEOnly &&
            JSON.stringify(item.filters) === JSON.stringify(filters);

          if (!append && visibleRows.length === 0) {
            // If latest run has 0 results, remove matching recent entry from history.
            return cleaned.filter((item) => !isSameQuery(item));
          }

          const nextItem: SearchHistoryItem = {
            id: `${Date.now()}-${mode}`,
            createdAt: new Date().toISOString(),
            mode,
            filters: {
              ...filters,
              location: normalizeLocationExpression(filters.location),
              remote: false,
            },
            strictPEOnly,
            resultCount: visibleRows.length,
            topResults: visibleRows.slice(0, 3).map((j) => `${j.company} - ${j.title}`),
            results: historyResults,
          };

          return [nextItem, ...cleaned.filter((item) => !isSameQuery(item))].slice(0, MAX_SEARCH_HISTORY_ITEMS);
        });
        if (strictPEOnly && pageVisibleRows.length === 0 && withPEFlags.length > 0) {
          toast({
            title: "No PE matches in current result set",
            description: `Fetched ${incoming.length}, PE matches ${peMatches}. Disable PE-only to see all jobs.`,
          });
        } else if (pageVisibleRows.length === 0 && diagnostics) {
          toast({
            title: "0 results from provider",
            description: `Apify rows: ${diagnostics.raw ?? incoming.length}, normalized: ${diagnostics.normalized ?? incoming.length}, returned: ${diagnostics.returned ?? incoming.length}.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: append ? "Loaded more jobs" : "Jobs refreshed",
            description: append
              ? `Fetched ${incoming.length}, total visible ${visibleRows.length} (${mode}).`
              : `Fetched ${incoming.length}, showing ${visibleRows.length} (${mode}).`,
          });
        }
      } catch (error) {
        toast({
          title: "Search failed",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [fetchViaBackend, toast, filters, requestedCount, strictPEOnly, searchHistory, warnedOutdatedBackend, jobs],
  );

  const runSelectedSearch = () => {
    if (selectedSources.linkedin && selectedSources.career) {
      runSearch("all", { offset: 0 });
      return;
    }
    if (selectedSources.linkedin) {
      runSearch("linkedin", { offset: 0 });
      return;
    }
    if (selectedSources.career) {
      runSearch("career", { offset: 0 });
      return;
    }
    toast({
      title: "Select source first",
      description: "Tick LinkedIn and/or Career Sites before running search.",
      variant: "destructive",
    });
  };

  const scopedJobs = useMemo(() => {
    const sourceScoped =
      sourceTab === "all"
        ? jobs
        : jobs.filter((job) => classifyJobSource(job.source) === sourceTab);

    let out = sourceScoped;
    if (strictPEOnly) {
      out = out.filter((job) => matchesPESignal(job));
    }
    return out;
  }, [jobs, strictPEOnly, sourceTab]);

  const sourceCounts = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        const bucket = classifyJobSource(job.source);
        if (bucket === "linkedin") acc.linkedin += 1;
        if (bucket === "career") acc.career += 1;
        return acc;
      },
      { linkedin: 0, career: 0 },
    );
  }, [jobs]);

  const showSourceTabs = searchMode === "all";

  const sortedJobs = useMemo(() => {
    return [...scopedJobs].sort((a, b) => {
      if (sortBy === "posted") {
        const dateA = new Date(a.posted_at).getTime();
        const dateB = new Date(b.posted_at).getTime();
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      }
      const salaryA = a.salary_min || 0;
      const salaryB = b.salary_min || 0;
      return sortOrder === "desc" ? salaryB - salaryA : salaryA - salaryB;
    });
  }, [scopedJobs, sortBy, sortOrder]);

  const clearFilters = () =>
    setFilters({ ...DEFAULT_FILTERS, title: "", industryKeywords: "", location: "", industry: "all", jobsPerSearch: "10" });
  const resetToDefaults = () => setFilters(DEFAULT_FILTERS);

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return isValid(date) ? format(date, "MMM d, yyyy") : dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatSalary = (job: Job) => {
    if (job.salary) return job.salary;
    if (job.salary_min && job.salary_max) return `${job.currency} ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`;
    if (job.salary_min) return `${job.currency} ${job.salary_min.toLocaleString()}+`;
    return "—";
  };

  const exportToCSV = () => {
    if (sortedJobs.length === 0) return;
    const headers = ["Job Title", "Company", "Location", "Salary", "Posted Date", "Job Type", "Remote", "Apply URL", "Source"];
    const rows = sortedJobs.slice(0, 100).map((job) => [
      job.title,
      job.company,
      job.location,
      formatSalary(job),
      formatDate(job.posted_at),
      job.job_type,
      job.remote ? "Yes" : "No",
      job.apply_url || "",
      job.source,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pe-jobs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadHistoryItem = (item: SearchHistoryItem) => {
    setFilters({
      ...item.filters,
      location: normalizeLocationExpression(item.filters.location || ""),
      remote: false,
    });
    setSearchMode(item.mode);
    setSourceTab(item.mode === "all" ? "all" : item.mode);
    const restored = Array.isArray(item.results) ? item.results : [];
    if (restored.length === 0) {
      setSearchHistory((prev) => prev.filter((x) => x.id !== item.id && hasHistoryResults(x)));
      toast({
        title: "Search removed",
        description: "This history item had 0 results and was removed.",
      });
      return;
    }
    const searchLocation = normalizeLocationExpression(item.filters.location || "");
    const normalizedRestored = restored.map((job) => ({
      ...job,
      location: withLocationFallback(job.location, searchLocation),
    }));
    setJobs(normalizedRestored);
    setTotal(item.resultCount || normalizedRestored.length);
    setLastRefresh(new Date(item.createdAt));
    setBaseOffset(0);
    setHasMore(false);
    setLoading(false);
    setStrictPEOnly(typeof item.strictPEOnly === "boolean" ? item.strictPEOnly : false);
    setSelectedSources({
      linkedin: item.mode === "linkedin" || item.mode === "all",
      career: item.mode === "career" || item.mode === "all",
    });
    toast({
      title: "Loaded search",
      description: restored.length > 0
        ? `Restored ${restored.length} results from history.`
        : "No cached rows in this history item. Run search once to cache it.",
    });
  };

  const refreshCurrentResults = () => {
    runSearch(searchMode, { force: true, offset: 0 });
  };

  const loadMoreResults = () => {
    const nextOffset = baseOffset + requestedCount;
    runSearch(searchMode, { force: true, append: true, offset: nextOffset });
  };

  const runApolloForJob = async (job: Job) => {
    const company = (job.company || "").trim();
    if (!company) {
      toast({
        title: "Missing company",
        description: "This job has no company name, so Apollo contact search cannot run.",
        variant: "destructive",
      });
      return;
    }

    if (!profileName) {
      toast({
        title: "Profile required",
        description: "Select your profile first to run Apollo AI enrichment.",
        variant: "destructive",
      });
      return;
    }

    const departments = inferDepartmentsFromJobTitle(job.title);
    const locations = inferLocationsForEnrichment(job.location);
    const signalRegion = inferSignalRegionFromLocation(job.location);
    const targetRoles = inferTargetRolesForJob(job.title);
    const industry = filters.industry !== "all" ? filters.industry : "Private Equity";
    const maxContacts = 30;
    const effectiveProfile = profileName || "Unknown";

    setApolloLoadingByJob((prev) => ({ ...prev, [job.id]: true }));
    try {
      let bullhornEmails: string[] = [];
      try {
        const { data: bhResult } = await supabase.functions.invoke("fetch-bullhorn-emails", {});
        if (bhResult?.success && Array.isArray(bhResult.emails)) {
          bullhornEmails = bhResult.emails as string[];
        }
      } catch {
        // Non-fatal fallback.
      }

      const candidateData = {
        candidate_id: `JB-${Date.now()}`,
        name: `JobBoard ${company}`,
        current_title: job.title || "Job Board Search",
        location: job.location || "",
        skills: [],
        work_history: [],
        education: [],
      };

      const preferencesData = [{
        type: "jobboard_contact_search",
        industry,
        companies: "",
        exclusions: "",
        excludedIndustries: [],
        locations,
        country: job.location || "",
        targetRoles,
        sectors: departments,
        targetCompany: company,
        signalTitle: job.title || `${company} hiring`,
        signalRegion,
      }];

      const runResult = await createEnrichmentRun(effectiveProfile, {
        search_counter: maxContacts,
        candidates_count: 1,
        preferences_count: 1,
        status: "running",
        bullhorn_enabled: false,
        candidates_data: JSON.parse(JSON.stringify([candidateData])),
        preferences_data: JSON.parse(JSON.stringify(preferencesData)),
      });

      if (!runResult.success || !runResult.data?.id) {
        throw new Error(runResult.error || "Failed to create enrichment run");
      }

      const { data, error } = await supabase.functions.invoke("run-enrichment", {
        body: { runId: runResult.data.id, bullhornEmails },
      });

      if (error) throw error;

      const contacts = Array.isArray(data.contacts) ? (data.contacts as ApolloJobContact[]) : [];
      const emailContacts = contacts.filter((c) => (c.email || "").trim().length > 0);
      setApolloTargetJob(job);
      setApolloContacts(emailContacts);
      setApolloModalOpen(true);
      toast({
        title: "Apollo search complete",
        description: `Found ${emailContacts.length} contacts with email for ${company}.`,
      });
    } catch (err) {
      toast({
        title: "Apollo search failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setApolloLoadingByJob((prev) => ({ ...prev, [job.id]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Job Board
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Shared API</Badge>
              {lastRefresh ? <span className="text-xs text-muted-foreground">Last: {format(lastRefresh, "HH:mm")}</span> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input
              placeholder="Title / Position (e.g. VP, Principal, CFO)"
              list="job-position-suggestions"
              value={filters.title}
              onChange={(e) => setFilters((f) => ({ ...f, title: e.target.value }))}
            />
            <Input
              placeholder="Industry keywords (e.g. buyout, infra, secondaries)"
              list="job-industry-keyword-suggestions"
              value={filters.industryKeywords}
              onChange={(e) => setFilters((f) => ({ ...f, industryKeywords: e.target.value }))}
            />
            <Input
              placeholder="Company include (optional)"
              value={filters.company}
              onChange={(e) => setFilters((f) => ({ ...f, company: e.target.value }))}
            />
            <Input
              placeholder="Location (London, New York)"
              list="job-location-suggestions"
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
              onBlur={(e) =>
                setFilters((f) => ({
                  ...f,
                  location: normalizeLocationExpression(e.target.value),
                }))
              }
            />
          </div>

          <datalist id="job-position-suggestions">
            {positionSuggestions.map((value) => (
              <option key={`pos-${value}`} value={value} />
            ))}
          </datalist>
          <datalist id="job-industry-keyword-suggestions">
            {industryKeywordSuggestions.map((value) => (
              <option key={`ind-${value}`} value={value} />
            ))}
          </datalist>
          <datalist id="job-location-suggestions">
            {locationSuggestions.map((value) => (
              <option key={`loc-${value}`} value={value} />
            ))}
          </datalist>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input
              placeholder="Exclude keywords"
              value={filters.exclude}
              onChange={(e) => setFilters((f) => ({ ...f, exclude: e.target.value }))}
            />
            <Select
              value={filters.industry}
              onValueChange={(value) => setFilters((f) => ({ ...f, industry: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt === "all" ? "All industries" : opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Min salary"
              value={filters.salaryMin}
              onChange={(e) => setFilters((f) => ({ ...f, salaryMin: e.target.value }))}
            />
            <Select
              value={filters.jobsPerSearch}
              onValueChange={(value) => setFilters((f) => ({ ...f, jobsPerSearch: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Jobs per search" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 jobs</SelectItem>
                <SelectItem value="25">25 jobs</SelectItem>
                <SelectItem value="50">50 jobs</SelectItem>
                <SelectItem value="100">100 jobs</SelectItem>
                <SelectItem value="200">200 jobs</SelectItem>
                <SelectItem value="300">300 jobs</SelectItem>
                <SelectItem value="500">500 jobs</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.postedAfter} onValueChange={(value) => setFilters((f) => ({ ...f, postedAfter: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Posted after" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24hours">Last 24 hours</SelectItem>
                <SelectItem value="7days">Last 7 days</SelectItem>
                <SelectItem value="14days">Last 14 days</SelectItem>
                <SelectItem value="30days">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={strictPEOnly} onCheckedChange={(v) => setStrictPEOnly(Boolean(v))} />
                PE-only
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={selectedSources.linkedin}
                onCheckedChange={(v) => setSelectedSources((s) => ({ ...s, linkedin: Boolean(v) }))}
              />
              LinkedIn
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={selectedSources.career}
                onCheckedChange={(v) => setSelectedSources((s) => ({ ...s, career: Boolean(v) }))}
              />
              Career Sites
            </label>
            <Button
              variant="default"
              disabled={loading}
              onClick={runSelectedSearch}
            >
              {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              Search Selected Sources
            </Button>
            <Button variant="outline" size="sm" disabled={loading} onClick={refreshCurrentResults}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh Results
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || jobs.length === 0 || !hasMore}
              onClick={loadMoreResults}
            >
              Load More
            </Button>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={resetToDefaults}>Reset Defaults</Button>
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={exportToCSV} disabled={sortedJobs.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {searchHistory.length > 0 ? (
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Recent Searches</p>
              <div className="space-y-2 max-h-36 overflow-auto">
                {searchHistory.slice(0, 8).map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="truncate">
                      <span className="font-medium text-foreground">{formatDate(h.createdAt)}</span>
                      {" · "}
                      {h.mode}
                      {" · "}
                      {h.resultCount} results
                      {h.topResults.length > 0 ? ` · ${h.topResults[0]}` : ""}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => loadHistoryItem(h)}
                    >
                      Load
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{sortedJobs.length > 0 ? `${sortedJobs.length} Jobs Found` : "Job Results"}</CardTitle>
            {total > 0 ? <p className="text-xs text-muted-foreground">{total} rows fetched</p> : null}
          </div>
          {showSourceTabs ? (
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                variant={sourceTab === "all" ? "default" : "outline"}
                onClick={() => setSourceTab("all")}
              >
                All ({jobs.length})
              </Button>
              <Button
                size="sm"
                variant={sourceTab === "linkedin" ? "default" : "outline"}
                onClick={() => setSourceTab("linkedin")}
              >
                LinkedIn ({sourceCounts.linkedin})
              </Button>
              <Button
                size="sm"
                variant={sourceTab === "career" ? "default" : "outline"}
                onClick={() => setSourceTab("career")}
              >
                Career Sites ({sourceCounts.career})
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : sortedJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No jobs found with current filters.</p>
              <p className="text-sm mt-2">Adjust filters or check Settings / Fantastic.jobs configuration.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Title</TableHead>
                    <TableHead className="min-w-[140px]">Company</TableHead>
                    <TableHead className="min-w-[140px]">Location</TableHead>
                    <TableHead
                      className="min-w-[120px] cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        if (sortBy === "salary") setSortOrder((v) => (v === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("salary");
                          setSortOrder("desc");
                        }
                      }}
                    >
                      Salary {sortBy === "salary" ? (sortOrder === "desc" ? "↓" : "↑") : ""}
                    </TableHead>
                    <TableHead
                      className="min-w-[120px] cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        if (sortBy === "posted") setSortOrder((v) => (v === "asc" ? "desc" : "asc"));
                        else {
                          setSortBy("posted");
                          setSortOrder("desc");
                        }
                      }}
                    >
                      Posted {sortBy === "posted" ? (sortOrder === "desc" ? "↓" : "↑") : ""}
                    </TableHead>
                    <TableHead className="min-w-[110px]">Source</TableHead>
                    <TableHead className="w-[170px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedJobs.map((job) => (
                    <TableRow key={job.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-medium">{job.title}</div>
                        <div className="flex gap-1 mt-1">
                          {job.remote ? <Badge variant="secondary" className="text-xs">Remote</Badge> : null}
                          <Badge variant="outline" className="text-xs">{job.job_type}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {job.company}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {job.location}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Banknote className="h-3 w-3 text-muted-foreground" />
                          {formatSalary(job)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(job.posted_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatSourceLabel(job.source)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {job.apply_url ? (
                            <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0" title="Open job post">
                              <a href={job.apply_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs mr-1">—</span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            disabled={Boolean(apolloLoadingByJob[job.id])}
                            onClick={() => runApolloForJob(job)}
                          >
                            {apolloLoadingByJob[job.id] ? (
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Users className="h-3 w-3 mr-1" />
                            )}
                            {apolloLoadingByJob[job.id] ? "Enriching..." : "Apollo AI"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={apolloModalOpen} onOpenChange={setApolloModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Apollo Contacts{apolloTargetJob ? ` - ${apolloTargetJob.company}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apolloContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No contacts found for this job.
                    </TableCell>
                  </TableRow>
                ) : (
                  apolloContacts.map((contact, idx) => (
                    <TableRow key={`${contact.email}-${idx}`}>
                      <TableCell>{contact.name || "—"}</TableCell>
                      <TableCell>{contact.title || "—"}</TableCell>
                      <TableCell>{contact.company || "—"}</TableCell>
                      <TableCell>{contact.email || "—"}</TableCell>
                      <TableCell>{contact.location || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
