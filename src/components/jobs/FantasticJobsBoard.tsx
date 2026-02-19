 import { useState, useEffect, useCallback } from "react";
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
 import { Search, RefreshCw, Download, ExternalLink, MapPin, Building2, Calendar, Banknote, X, Filter } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
 
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
  location: string;
  salaryMin: string;
  remote: boolean;
  postedAfter: string;
}

type SearchMode = "all" | "linkedin" | "career";

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
 
 const DEFAULT_FILTERS: Filters = {
   keyword: "private equity OR internship OR VC OR family office",
   location: "Europe,Riga,London",
   salaryMin: "",
   remote: false,
   postedAfter: "7days",
 };

 const REGION_PRESETS: Array<{ label: string; value: string }> = [
   { label: "London", value: "London,UK" },
   { label: "Europe", value: "Europe,Berlin,Paris,Amsterdam,Frankfurt,Zurich" },
   { label: "UAE", value: "UAE,Dubai,Abu Dhabi" },
   { label: "USA", value: "USA,New York,Boston,San Francisco,Chicago,Los Angeles" },
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

const LINKEDIN_ACTOR_ID = "vIGxjRrHqDTPuE6M4";
const CAREER_ACTOR_ID = "s3dtSTZSZWFtAVLn5";

 export function FantasticJobsBoard() {
   const { toast } = useToast();
   const [jobs, setJobs] = useState<Job[]>([]);
   const [loading, setLoading] = useState(false);
   const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
   const [sortBy, setSortBy] = useState<"posted" | "salary">("posted");
   const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
   const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
   const [autoRefresh, setAutoRefresh] = useState(false);
   const [strictPEOnly, setStrictPEOnly] = useState(true);
   const [offset, setOffset] = useState(0);
   const [hasMore, setHasMore] = useState(false);
   const [total, setTotal] = useState(0);
   const [searchMode, setSearchMode] = useState<SearchMode>("all");
   const [useDirectApify, setUseDirectApify] = useState(true);
   const [apifyToken, setApifyToken] = useState("");
   const [linkedinActorId, setLinkedinActorId] = useState(LINKEDIN_ACTOR_ID);
   const [careerActorId, setCareerActorId] = useState(CAREER_ACTOR_ID);
   const PAGE_SIZE = 50;

  useEffect(() => {
    const savedToken = localStorage.getItem("jobs.apify_token") || "";
    const savedLinkedin = localStorage.getItem("jobs.apify_actor_linkedin") || LINKEDIN_ACTOR_ID;
    const savedCareer = localStorage.getItem("jobs.apify_actor_career") || CAREER_ACTOR_ID;
    const savedMode = localStorage.getItem("jobs.use_direct_apify");
    setApifyToken(savedToken);
    setLinkedinActorId(savedLinkedin);
    setCareerActorId(savedCareer);
    if (savedMode !== null) setUseDirectApify(savedMode === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("jobs.apify_token", apifyToken);
  }, [apifyToken]);

  useEffect(() => {
    localStorage.setItem("jobs.apify_actor_linkedin", linkedinActorId);
  }, [linkedinActorId]);

  useEffect(() => {
    localStorage.setItem("jobs.apify_actor_career", careerActorId);
  }, [careerActorId]);

  useEffect(() => {
    localStorage.setItem("jobs.use_direct_apify", String(useDirectApify));
  }, [useDirectApify]);

  const fetchJobsDirect = useCallback(async (mode: SearchMode): Promise<Job[]> => {
    if (!apifyToken) {
      throw new Error("Apify token is required for direct mode.");
    }

    const titleSearch = splitTerms(filters.keyword);
    const locationSearch = splitTerms(filters.location);
    const timeRange = mapTimeRange(filters.postedAfter);
    const limit = PAGE_SIZE;

    const actorIds =
      mode === "linkedin"
        ? [linkedinActorId]
        : mode === "career"
          ? [careerActorId]
          : [linkedinActorId, careerActorId];

    const normalized: Job[] = [];

    for (const actorId of actorIds) {
      const isLinkedin = actorId === linkedinActorId;
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
      if (locationSearch.length > 0) input.locationSearch = locationSearch;
      if (filters.salaryMin) input.aiHasSalary = true;
      if (isLinkedin && filters.remote) input.remote = true;
      if (!isLinkedin) {
        input.includeLinkedIn = true;
        if (filters.remote) input["remote only (legacy)"] = true;
      }

      const endpoint =
        `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}` +
        `/run-sync-get-dataset-items?token=${encodeURIComponent(apifyToken)}&format=json&clean=true&maxItems=${limit}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) continue;

      const data = await res.json();
      const items: Record<string, unknown>[] = Array.isArray(data) ? data : [];

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
    }

    return normalized;
  }, [apifyToken, filters, linkedinActorId, careerActorId]);

  const fetchJobs = useCallback(async (append = false, mode: SearchMode = searchMode) => {
     setLoading(true);
     try {
       let incoming: Job[] = [];
       let totalCount = 0;
       let hasMoreRows = false;

       if (!useDirectApify) {
         const params: Record<string, string> = {};
         if (filters.keyword) params.keyword = filters.keyword;
         if (filters.location) params.location = filters.location;
         if (filters.salaryMin) params.salary_min = filters.salaryMin;
         if (filters.remote) params.remote = "true";
         if (filters.postedAfter) params.posted_after = filters.postedAfter;
         if (mode === "linkedin") params.actor_id = LINKEDIN_ACTOR_ID;
         if (mode === "career") params.actor_id = CAREER_ACTOR_ID;
         params.limit = String(PAGE_SIZE);
         params.offset = String(append ? offset : 0);

         const { data, error } = await supabase.functions.invoke("fantastic-jobs", { body: params });
         if (!error && data?.success && Array.isArray(data.jobs) && data.jobs.length > 0) {
           incoming = data.jobs as Job[];
           totalCount = Number(data.total || incoming.length);
           hasMoreRows = incoming.length >= PAGE_SIZE;
         }
       }

       if (incoming.length === 0) {
         incoming = await fetchJobsDirect(mode);
         totalCount = incoming.length;
         hasMoreRows = false;
       }

       const merged = append ? [...jobs, ...incoming] : incoming;
       const deduped = Array.from(
         new Map(
           merged.map((job: Job) => [
             `${(job.apply_url || "").toLowerCase()}|${job.title.toLowerCase()}|${job.company.toLowerCase()}`,
             job,
           ]),
         ).values(),
       );

       setJobs(deduped);
       const nextOffset = append ? offset + PAGE_SIZE : PAGE_SIZE;
       setOffset(nextOffset);
       setTotal(totalCount || deduped.length);
       setHasMore(hasMoreRows);
       setLastRefresh(new Date());
       toast({
         title: "Jobs refreshed",
         description: append
           ? `Loaded ${incoming.length} more jobs (${mode})`
           : `Found ${deduped.length} jobs (${mode})`,
       });
     } catch (error) {
       console.error("Error fetching jobs:", error);
       toast({
         title: "Error fetching jobs",
         description: error instanceof Error ? error.message : "Unknown error",
         variant: "destructive",
       });
     } finally {
       setLoading(false);
     }
   }, [filters, toast, offset, jobs, searchMode, useDirectApify, fetchJobsDirect]);
 
   // Auto-refresh every 30 minutes
   useEffect(() => {
     if (!autoRefresh) return;
 
     const interval = setInterval(() => {
       fetchJobs(false, searchMode);
     }, 30 * 60 * 1000); // 30 minutes

     return () => clearInterval(interval);
   }, [autoRefresh, fetchJobs, searchMode]);

   const runSearch = (mode: SearchMode) => {
     setSearchMode(mode);
     setOffset(0);
     setHasMore(false);
     fetchJobs(false, mode);
   };
 
   const clearFilters = () => {
     setFilters({
       keyword: "",
       location: "",
       salaryMin: "",
       remote: false,
       postedAfter: "",
     });
   };
 
  const resetToDefaults = () => {
    setFilters(DEFAULT_FILTERS);
    setOffset(0);
    setHasMore(false);
  };

  const scopedJobs = strictPEOnly
    ? jobs.filter((job) => {
        const fullText = `${job.title} ${job.company} ${job.description || ""}`.toLowerCase();
        return PE_SIGNAL_TERMS.some((term) => fullText.includes(term));
      })
    : jobs;

  const visibleJobs = strictPEOnly && scopedJobs.length === 0 && jobs.length > 0 ? jobs : scopedJobs;

  const sortedJobs = [...visibleJobs].sort((a, b) => {
     if (sortBy === "posted") {
       const dateA = new Date(a.posted_at).getTime();
       const dateB = new Date(b.posted_at).getTime();
       return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
     } else {
       const salaryA = a.salary_min || 0;
       const salaryB = b.salary_min || 0;
       return sortOrder === "desc" ? salaryB - salaryA : salaryA - salaryB;
     }
   });
 
   const exportToCSV = () => {
     if (jobs.length === 0) {
       toast({
         title: "No jobs to export",
         description: "Fetch some jobs first",
         variant: "destructive",
       });
       return;
     }
 
     // Bullhorn-compatible CSV format
     const headers = [
       "Job Title",
       "Company",
       "Location",
       "Salary Min",
       "Salary Max",
       "Currency",
       "Posted Date",
       "Job Type",
       "Remote",
       "Apply URL",
       "Source",
     ];
 
     const rows = sortedJobs.slice(0, 50).map((job) => [
       job.title,
       job.company,
       job.location,
       job.salary_min || "",
       job.salary_max || "",
       job.currency,
       formatDate(job.posted_at),
       job.job_type,
       job.remote ? "Yes" : "No",
       job.apply_url || "",
       job.source,
     ]);
 
     const csvContent = [
       headers.join(","),
       ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
     ].join("\n");
 
     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.href = url;
     link.download = `pe-jobs-${format(new Date(), "yyyy-MM-dd")}.csv`;
     link.click();
     URL.revokeObjectURL(url);
 
     toast({
       title: "CSV exported",
       description: `Exported ${Math.min(50, jobs.length)} jobs for Bullhorn upload`,
     });
   };
 
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
     if (job.salary_min && job.salary_max) {
       return `${job.currency} ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`;
     }
     if (job.salary_min) {
       return `${job.currency} ${job.salary_min.toLocaleString()}+`;
     }
     return "—";
   };
 
   const toggleSort = (column: "posted" | "salary") => {
     if (sortBy === column) {
       setSortOrder(sortOrder === "asc" ? "desc" : "asc");
     } else {
       setSortBy(column);
       setSortOrder("desc");
     }
   };
 
   return (
     <div className="space-y-4">
       {/* Search & Filters */}
       <Card>
         <CardHeader className="pb-3">
           <div className="flex items-center justify-between">
             <CardTitle className="text-lg flex items-center gap-2">
               <Search className="h-5 w-5" />
               Job Search - fantastic.jobs
             </CardTitle>
             <div className="flex items-center gap-2">
               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                 <Checkbox
                   id="autoRefresh"
                   checked={autoRefresh}
                   onCheckedChange={(checked) => setAutoRefresh(!!checked)}
                 />
                 <label htmlFor="autoRefresh" className="cursor-pointer">
                   Auto-refresh (30min)
                 </label>
               </div>
               {lastRefresh && (
                 <span className="text-xs text-muted-foreground">
                   Last: {format(lastRefresh, "HH:mm")}
                 </span>
               )}
             </div>
           </div>
         </CardHeader>
         <CardContent className="space-y-4">
           {/* Search Row */}
           <div className="flex flex-col sm:flex-row gap-3">
             <div className="flex-1">
               <Input
                 placeholder="Keywords (e.g., private equity OR VC)"
                 value={filters.keyword}
                 onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                 className="w-full"
               />
             </div>
             <div className="w-full sm:w-48">
               <Input
                 placeholder="Location (e.g., London)"
                 value={filters.location}
                 onChange={(e) => setFilters({ ...filters, location: e.target.value })}
               />
             </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
             <Input
               type="password"
               placeholder="Apify token (direct mode)"
               value={apifyToken}
               onChange={(e) => setApifyToken(e.target.value)}
             />
             <Input
               placeholder="LinkedIn actor ID"
               value={linkedinActorId}
               onChange={(e) => setLinkedinActorId(e.target.value)}
             />
             <Input
               placeholder="Career actor ID"
               value={careerActorId}
               onChange={(e) => setCareerActorId(e.target.value)}
             />
           </div>
 
           {/* Filter Row */}
           <div className="flex flex-wrap gap-3 items-center">
             <div className="w-32">
               <Input
                 type="number"
                 placeholder="Min salary"
                 value={filters.salaryMin}
                 onChange={(e) => setFilters({ ...filters, salaryMin: e.target.value })}
               />
             </div>
 
             <Select
               value={filters.postedAfter}
               onValueChange={(value) => setFilters({ ...filters, postedAfter: value })}
             >
               <SelectTrigger className="w-36">
                 <SelectValue placeholder="Posted after" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="24hours">Last 24 hours</SelectItem>
                 <SelectItem value="7days">Last 7 days</SelectItem>
                 <SelectItem value="14days">Last 14 days</SelectItem>
                 <SelectItem value="30days">Last 30 days</SelectItem>
               </SelectContent>
             </Select>
 
             <div className="flex items-center gap-2">
               <Checkbox
                 id="remote"
                 checked={filters.remote}
                 onCheckedChange={(checked) => setFilters({ ...filters, remote: !!checked })}
               />
               <label htmlFor="remote" className="text-sm cursor-pointer">
                 Remote only
               </label>
             </div>
 
             <div className="flex items-center gap-2">
               <Checkbox
                 id="strictPEOnly"
                 checked={strictPEOnly}
                 onCheckedChange={(checked) => setStrictPEOnly(!!checked)}
               />
               <label htmlFor="strictPEOnly" className="text-sm cursor-pointer">
                 PE/VC/FO only
               </label>
             </div>

             <div className="flex items-center gap-2">
               <Checkbox
                 id="directApify"
                 checked={useDirectApify}
                 onCheckedChange={(checked) => setUseDirectApify(!!checked)}
               />
               <label htmlFor="directApify" className="text-sm cursor-pointer">
                 Direct Apify mode
               </label>
             </div>

             <div className="flex-1" />
 
             <Button variant="ghost" size="sm" onClick={clearFilters}>
               <X className="h-4 w-4 mr-1" />
               Clear all
             </Button>
 
             <Button variant="outline" size="sm" onClick={resetToDefaults}>
               <Filter className="h-4 w-4 mr-1" />
               PE/VC defaults
             </Button>
 
             <Button
               onClick={() => {
                 runSearch("all");
               }}
               disabled={loading}
             >
               <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
               {loading ? "Searching..." : "Search Jobs (All)"}
             </Button>

             <Button
               variant="outline"
               onClick={() => runSearch("linkedin")}
               disabled={loading}
             >
               {loading && searchMode === "linkedin" ? (
                 <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
               ) : null}
               LinkedIn Search
             </Button>

             <Button
               variant="outline"
               onClick={() => runSearch("career")}
               disabled={loading}
             >
               {loading && searchMode === "career" ? (
                 <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
               ) : null}
               Career Page Search
             </Button>
           </div>

           <div className="flex flex-wrap gap-2">
             {REGION_PRESETS.map((preset) => (
               <Button
                 key={preset.label}
                 variant="outline"
                 size="sm"
                 onClick={() => setFilters((prev) => ({ ...prev, location: preset.value }))}
               >
                 {preset.label}
               </Button>
             ))}
           </div>
         </CardContent>
       </Card>
 
       {/* Results Table */}
       <Card>
         <CardHeader className="pb-3">
           <div className="flex items-center justify-between">
             <CardTitle className="text-lg">
               {sortedJobs.length > 0 ? `${sortedJobs.length} Jobs Found` : "Job Results"}
             </CardTitle>
             <Button
               variant="outline"
               size="sm"
               onClick={exportToCSV}
               disabled={sortedJobs.length === 0}
             >
               <Download className="h-4 w-4 mr-2" />
               Export {Math.min(50, sortedJobs.length)} PE jobs → Bullhorn
             </Button>
           </div>
           {total > 0 && (
             <p className="text-xs text-muted-foreground">
               Loaded {jobs.length} of {total} available jobs
             </p>
           )}
           {strictPEOnly && scopedJobs.length === 0 && jobs.length > 0 && (
             <p className="text-xs text-amber-600">
               No PE-only matches in current batch, showing all fetched jobs.
             </p>
           )}
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
               <p>No jobs found. Click search to fetch positions.</p>
               <p className="text-sm mt-2">
                 Try adjusting filters or use "PE/VC defaults" for targeted results.
               </p>
             </div>
           ) : (
             <div className="overflow-x-auto">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead className="min-w-[200px]">Title</TableHead>
                     <TableHead className="min-w-[150px]">Company</TableHead>
                     <TableHead className="min-w-[120px]">Location</TableHead>
                     <TableHead
                       className="min-w-[120px] cursor-pointer hover:bg-muted/50"
                       onClick={() => toggleSort("salary")}
                     >
                       <div className="flex items-center gap-1">
                         Salary
                         {sortBy === "salary" && (
                           <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>
                         )}
                       </div>
                     </TableHead>
                     <TableHead
                       className="min-w-[100px] cursor-pointer hover:bg-muted/50"
                       onClick={() => toggleSort("posted")}
                     >
                       <div className="flex items-center gap-1">
                         Posted
                         {sortBy === "posted" && (
                           <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>
                         )}
                       </div>
                     </TableHead>
                     <TableHead className="w-[80px]">Apply</TableHead>
                   </TableRow>
                 </TableHeader>
                <TableBody>
                  {sortedJobs.map((job) => (
                     <TableRow key={job.id} className="hover:bg-muted/30">
                       <TableCell>
                         <div className="font-medium">{job.title}</div>
                         <div className="flex gap-1 mt-1">
                           {job.remote && (
                             <Badge variant="secondary" className="text-xs">
                               Remote
                             </Badge>
                           )}
                           <Badge variant="outline" className="text-xs">
                             {job.job_type}
                           </Badge>
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
                         {job.apply_url ? (
                           <Button
                             variant="ghost"
                             size="sm"
                             asChild
                             className="h-8 w-8 p-0"
                           >
                             <a
                               href={job.apply_url}
                               target="_blank"
                               rel="noopener noreferrer"
                             >
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
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  disabled={loading || !hasMore}
                  onClick={() => fetchJobs(true, searchMode)}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : hasMore ? (
                    "Load More"
                  ) : (
                    "No More Jobs"
                  )}
                </Button>
              </div>
             </div>
           )}
         </CardContent>
       </Card>
     </div>
   );
 }
