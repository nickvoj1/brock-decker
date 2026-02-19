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
   const PAGE_SIZE = 50;

  const fetchJobs = useCallback(async (append = false) => {
     setLoading(true);
     try {
       const params: Record<string, string> = {};
       
       if (filters.keyword) params.keyword = filters.keyword;
       if (filters.location) params.location = filters.location;
       if (filters.salaryMin) params.salary_min = filters.salaryMin;
       if (filters.remote) params.remote = "true";
       if (filters.postedAfter) params.posted_after = filters.postedAfter;
       params.limit = String(PAGE_SIZE);
       params.offset = String(append ? offset : 0);

       const { data, error } = await supabase.functions.invoke("fantastic-jobs", {
         body: params,
       });
 
       if (error) throw error;

       if (data?.success && data?.jobs) {
         const incoming = Array.isArray(data.jobs) ? data.jobs : [];
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
         setTotal(Number(data.total || deduped.length));
         setHasMore(incoming.length >= PAGE_SIZE);
         setLastRefresh(new Date());
         toast({
           title: "Jobs refreshed",
           description: append
             ? `Loaded ${incoming.length} more jobs`
             : `Found ${deduped.length} jobs`,
         });
       } else {
         throw new Error(data?.error || "Failed to fetch jobs");
       }
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
   }, [filters, toast, offset, jobs]);
 
   // Auto-refresh every 30 minutes
   useEffect(() => {
     if (!autoRefresh) return;
 
     const interval = setInterval(() => {
       fetchJobs(false);
     }, 30 * 60 * 1000); // 30 minutes

     return () => clearInterval(interval);
   }, [autoRefresh, fetchJobs]);
 
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

  const sortedJobs = [...scopedJobs].sort((a, b) => {
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
                 setOffset(0);
                 setHasMore(false);
                 fetchJobs(false);
               }}
               disabled={loading}
             >
               <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
               {loading ? "Searching..." : "Search Jobs"}
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
               <p>No jobs found. Click "Search Jobs" to fetch positions.</p>
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
                  onClick={() => fetchJobs(true)}
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
