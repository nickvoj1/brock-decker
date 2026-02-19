import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, Download, ExternalLink, MapPin, Building2, Calendar, Banknote, X } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import {
  DEFAULT_CAREER_ACTOR_ID,
  DEFAULT_LINKEDIN_ACTOR_ID,
  loadJobBoardSettings,
  type JobBoardSettings,
} from "@/lib/jobBoardSettings";

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
}

interface Filters {
  keyword: string;
  company: string;
  exclude: string;
  industry: string;
  location: string;
  salaryMin: string;
  remote: boolean;
  postedAfter: string;
}

type SearchMode = "all" | "linkedin" | "career";

const DEFAULT_FILTERS: Filters = {
  keyword: "private equity OR venture capital OR family office",
  company: "",
  exclude: "",
  industry: "all",
  location: "London,United States,United Arab Emirates",
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

function splitTerms(value: string): string[] {
  if (!value) return [];
  return value
    .split(/\s+OR\s+|,|\|/i)
    .map((v) => v.trim())
    .filter(Boolean);
}

function mapTimeRange(postedAfter: string): string {
  const v = postedAfter.toLowerCase();
  if (v === "24hours" || v === "24h") return "24h";
  if (v === "1hour" || v === "1h") return "1h";
  if (v === "30days" || v === "30d") return "6m";
  return "7d";
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
      apply_url: (item.url as string) || (item.apply_url as string) || null,
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
    });
  }

  return normalized;
}

export function FantasticJobsBoard() {
  const { toast } = useToast();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [searchMode, setSearchMode] = useState<SearchMode>("all");
  const [sortBy, setSortBy] = useState<"posted" | "salary">("posted");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [strictPEOnly, setStrictPEOnly] = useState(true);
  const [settings, setSettings] = useState<JobBoardSettings>(() => loadJobBoardSettings());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setSettings(loadJobBoardSettings());
    const onFocus = () => setSettings(loadJobBoardSettings());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const fetchDirect = useCallback(
    async (mode: SearchMode): Promise<Job[]> => {
      if (!settings.apifyToken.trim()) throw new Error("Apify token missing. Add it in Settings -> Fantastic.jobs.");

      const actorIds =
        mode === "linkedin"
          ? [settings.linkedinActorId || DEFAULT_LINKEDIN_ACTOR_ID]
          : mode === "career"
            ? [settings.careerActorId || DEFAULT_CAREER_ACTOR_ID]
            : [
                settings.linkedinActorId || DEFAULT_LINKEDIN_ACTOR_ID,
                settings.careerActorId || DEFAULT_CAREER_ACTOR_ID,
              ];

      const titleSearch = splitTerms(filters.keyword);
      const titleExclusionSearch = splitTerms(filters.exclude);
      const locationSearch = splitTerms(filters.location);
      const organizationSearch = splitTerms(filters.company);
      const timeRange = mapTimeRange(filters.postedAfter);
      const limit = 100;

      let merged: Job[] = [];
      for (const actorId of actorIds) {
        const isLinkedinActor = actorId === (settings.linkedinActorId || DEFAULT_LINKEDIN_ACTOR_ID);
        const input: Record<string, unknown> = {
          timeRange,
          limit,
          includeAi: true,
          descriptionType: "text",
          removeAgency: true,
          populateAiRemoteLocation: true,
          populateAiRemoteLocationDerived: true,
        };

        if (titleSearch.length > 0) input.titleSearch = titleSearch;
        if (titleExclusionSearch.length > 0) input.titleExclusionSearch = titleExclusionSearch;
        if (locationSearch.length > 0) input.locationSearch = locationSearch;
        if (organizationSearch.length > 0) input.organizationSearch = organizationSearch;
        if (filters.salaryMin) input.aiHasSalary = true;
        if (filters.industry !== "all") input.aiTaxonomiesFilter = [filters.industry];

        if (isLinkedinActor) {
          if (filters.remote) input.remote = true;
          if (filters.industry !== "all") input.industryFilter = [filters.industry];
        } else {
          input.includeLinkedIn = true;
          if (filters.remote) input["remote only (legacy)"] = true;
          if (filters.industry !== "all") input.liIndustryFilter = [filters.industry];
        }

        const endpoint =
          `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}` +
          `/run-sync-get-dataset-items?token=${encodeURIComponent(settings.apifyToken)}&format=json&clean=true&maxItems=${limit}`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) continue;

        const data = await res.json();
        const items: Record<string, unknown>[] = Array.isArray(data) ? data : [];
        merged = merged.concat(normalizeJobs(items, actorId));
      }
      return merged;
    },
    [settings, filters],
  );

  const fetchViaBackend = useCallback(
    async (mode: SearchMode): Promise<Job[]> => {
      const params: Record<string, string> = {};
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.location) params.location = filters.location;
      if (filters.salaryMin) params.salary_min = filters.salaryMin;
      if (filters.industry && filters.industry !== "all") params.industry = filters.industry;
      if (filters.remote) params.remote = "true";
      if (filters.postedAfter) params.posted_after = filters.postedAfter;
      if (mode === "linkedin") params.actor_id = settings.linkedinActorId || DEFAULT_LINKEDIN_ACTOR_ID;
      if (mode === "career") params.actor_id = settings.careerActorId || DEFAULT_CAREER_ACTOR_ID;
      params.limit = "100";
      params.offset = "0";

      const { data, error } = await supabase.functions.invoke("fantastic-jobs", { body: params });
      if (error) throw error;
      if (!data?.success || !Array.isArray(data.jobs)) throw new Error(data?.error || "Backend search failed");
      return data.jobs as Job[];
    },
    [settings, filters],
  );

  const runSearch = useCallback(
    async (mode: SearchMode) => {
      setSearchMode(mode);
      setLoading(true);
      try {
        let incoming: Job[] = [];
        if (!settings.useDirectApify) {
          try {
            incoming = await fetchViaBackend(mode);
          } catch {
            if (settings.apifyToken) incoming = await fetchDirect(mode);
          }
        } else {
          incoming = await fetchDirect(mode);
        }

        const deduped = Array.from(
          new Map(
            incoming.map((job) => [
              `${(job.apply_url || "").toLowerCase()}|${job.title.toLowerCase()}|${job.company.toLowerCase()}`,
              job,
            ]),
          ).values(),
        );

        setJobs(deduped);
        setTotal(deduped.length);
        setLastRefresh(new Date());
        toast({
          title: "Jobs refreshed",
          description: `Found ${deduped.length} jobs (${mode})`,
        });
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
    [settings, fetchDirect, fetchViaBackend, toast],
  );

  const scopedJobs = useMemo(() => {
    let out = jobs;
    if (strictPEOnly) {
      out = out.filter((job) => {
        const fullText = `${job.title} ${job.company} ${job.description || ""}`.toLowerCase();
        return PE_SIGNAL_TERMS.some((term) => fullText.includes(term));
      });
    }
    return out;
  }, [jobs, strictPEOnly]);

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

  const clearFilters = () => setFilters({ ...DEFAULT_FILTERS, keyword: "", location: "", industry: "all" });
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
              <Badge variant="secondary">{settings.useDirectApify ? "Direct Apify" : "Supabase API"}</Badge>
              {lastRefresh ? <span className="text-xs text-muted-foreground">Last: {format(lastRefresh, "HH:mm")}</span> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="Keywords (private equity OR VC)"
              value={filters.keyword}
              onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
            />
            <Input
              placeholder="Company include (optional)"
              value={filters.company}
              onChange={(e) => setFilters((f) => ({ ...f, company: e.target.value }))}
            />
            <Input
              placeholder="Location (London, New York)"
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
            />
          </div>

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
                <Checkbox checked={filters.remote} onCheckedChange={(v) => setFilters((f) => ({ ...f, remote: Boolean(v) }))} />
                Remote
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={strictPEOnly} onCheckedChange={(v) => setStrictPEOnly(Boolean(v))} />
                PE-only
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant={searchMode === "all" ? "default" : "outline"} disabled={loading} onClick={() => runSearch("all")}>
              {loading && searchMode === "all" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              All Sources
            </Button>
            <Button variant={searchMode === "linkedin" ? "default" : "outline"} disabled={loading} onClick={() => runSearch("linkedin")}>
              {loading && searchMode === "linkedin" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              LinkedIn
            </Button>
            <Button variant={searchMode === "career" ? "default" : "outline"} disabled={loading} onClick={() => runSearch("career")}>
              {loading && searchMode === "career" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              Career Sites
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{sortedJobs.length > 0 ? `${sortedJobs.length} Jobs Found` : "Job Results"}</CardTitle>
            {total > 0 ? <p className="text-xs text-muted-foreground">{total} rows fetched</p> : null}
          </div>
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
                    <TableHead className="w-[80px]">Apply</TableHead>
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
                        <Badge variant="outline">{job.source || "source"}</Badge>
                      </TableCell>
                      <TableCell>
                        {job.apply_url ? (
                          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                            <a href={job.apply_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
