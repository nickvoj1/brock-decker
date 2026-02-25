import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Sparkles,
  RefreshCw,
  Filter,
  Download,
  Loader2,
  Briefcase,
  Check,
  Search,
  Zap,
  ChevronDown,
  LayoutGrid,
  Table2,
  Target,
  CalendarDays,
  CircleHelp
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useProfileName } from "@/hooks/useProfileName";
import { 
  getSignals, 
  dismissSignal, 
  refreshSignals, 
  markSignalBullhornAdded,
  buildBullhornNote,
  exportSignalsToCSV,
  enrichSignalsWithAI,
  scrapeJobSignals,
  runRegionalSurge,
  submitSignalFeedback,
  huntPEFunds,
  Signal,
} from "@/lib/signalsApi";
import { runSignalAutoSearch, SignalSearchResult } from "@/lib/signalAutoSearch";
import { createEnrichmentRun, updateEnrichmentRun } from "@/lib/dataApi";
import { CVMatchesModal } from "@/components/signals/CVMatchesModal";
import { SignalCard } from "@/components/signals/SignalCard";
import { SignalRetrainModal } from "@/components/signals/SignalRetrainModal";
import { SignalTableView } from "@/components/signals/SignalTableView";
import { FantasticJobsBoard } from "@/components/jobs/FantasticJobsBoard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";
import { endOfDay, format, startOfDay, subDays, subHours } from "date-fns";

type Region = "london" | "europe" | "uae" | "usa";
type TierFilter = "all" | "tier_1" | "tier_2" | "tier_3";
type SortOption = "newest" | "relevant" | "amount" | "fit";
type TabView = "signals" | "jobboard";
type ViewMode = "table" | "cards";
type DatePreset = "all" | "24h" | "7d" | "14d" | "30d" | "custom";

const REGION_CONFIG = {
  london: { label: "London", emoji: "🇬🇧", description: "City, Mayfair, Canary Wharf" },
  europe: { label: "Europe", emoji: "🇪🇺", description: "DACH, FR, NL, Nordics" },
  uae: { label: "UAE", emoji: "🇦🇪", description: "Dubai, Abu Dhabi, DIFC" },
  usa: { label: "USA", emoji: "🇺🇸", description: "NYC, Boston, SF, LA" },
};

const TIER_FILTERS: { value: TierFilter; label: string }[] = [
  { value: "all", label: "All Tiers" },
  { value: "tier_1", label: "Tier 1 – Immediate" },
  { value: "tier_2", label: "Tier 2 – Medium" },
  { value: "tier_3", label: "Tier 3 – Early" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "relevant", label: "Most Relevant" },
  { value: "amount", label: "Highest Amount" },
  { value: "fit", label: "Best Fit" },
];

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom Range" },
];

const TIER_GUIDE = [
  {
    key: "tier_1",
    label: "Tier 1 - Immediate",
    dotClass: "bg-primary",
    summary: "Highest urgency. Strong evidence of immediate hiring intent.",
    examples: "Fund close/raise, PE C-suite appointment, major acquisition/merger, rapid portfolio hiring.",
  },
  {
    key: "tier_2",
    label: "Tier 2 - Active",
    dotClass: "bg-foreground/45",
    summary: "Medium urgency. Strong expansion or team-shaping signals.",
    examples: "Office expansion, recruiter/team buildout, senior churn, product/service launch.",
  },
  {
    key: "tier_3",
    label: "Tier 3 - Watchlist",
    dotClass: "bg-foreground/25",
    summary: "Early indicators. Useful to monitor until stronger evidence appears.",
    examples: "General hiring posts, careers-page activity, broader industry/event signals.",
  },
];

const SIGNALS_PAGE_SIZE = 25;
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const AUTO_REFRESH_FOCUS_THROTTLE_MS = 60 * 1000;

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[,\s]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function buildSignalSearchText(signal: Signal): string {
  const details = signal.details as Record<string, unknown> | null;
  const detailStrings = details
    ? Object.values(details).filter(isString)
    : [];

  const parts = [
    signal.title,
    signal.company,
    signal.description,
    signal.signal_type,
    signal.source,
    signal.region,
    signal.ai_insight,
    signal.ai_pitch,
    ...(signal.keywords || []),
    ...detailStrings,
  ];

  return parts
    .filter((v): v is string => Boolean(v))
    .join(" ")
    .toLowerCase();
}

function computeFitScore(signal: Signal, includeTerms: string[]): number {
  if (includeTerms.length === 0) return Math.round(signal.score || 0);

  const titleText = `${signal.title || ""} ${signal.company || ""}`.toLowerCase();
  const descText = `${signal.description || ""} ${signal.ai_insight || ""} ${signal.ai_pitch || ""}`.toLowerCase();
  const keywordText = `${(signal.keywords || []).join(" ")} ${signal.signal_type || ""}`.toLowerCase();

  let points = 0;
  const maxPoints = includeTerms.length * 4;

  for (const term of includeTerms) {
    if (titleText.includes(term)) points += 2;
    if (descText.includes(term)) points += 1;
    if (keywordText.includes(term)) points += 1;
  }

  const matchRatio = points / maxPoints;
  const baseSignalScore = Math.min(100, Math.max(0, signal.score || 0));
  const blendedScore = Math.round(baseSignalScore * 0.4 + matchRatio * 100 * 0.6);
  return Math.min(100, Math.max(0, blendedScore));
}

function normalizeSignalType(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function formatSignalTypeLabel(value: string): string {
  const normalized = normalizeSignalType(value);
  const explicit: Record<string, string> = {
    funding: "Funding",
    hiring: "Hiring",
    expansion: "Expansion",
    c_suite: "C-Suite",
    team_growth: "Team Growth",
  };
  if (explicit[normalized]) return explicit[normalized];
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function SignalsDashboard() {
  const navigate = useNavigate();
  const profileName = useProfileName();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [regionCounts, setRegionCounts] = useState<Record<string, number>>({});
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [activeRegion, setActiveRegion] = useState<Region>("london");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [minScore, setMinScore] = useState<number>(0);
  const [isSurgeRunning, setIsSurgeRunning] = useState(false);
  const [isHunting, setIsHunting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>("signals");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [excludeQuery, setExcludeQuery] = useState("");
  const [fitOnly, setFitOnly] = useState(true);
  const [minFitScore, setMinFitScore] = useState(50);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [visibleSignalsCount, setVisibleSignalsCount] = useState(SIGNALS_PAGE_SIZE);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const lastAutoRefreshAtRef = useRef(0);
  
  // CV Matches modal
  const [cvModalOpen, setCvModalOpen] = useState(false);
  const [selectedSignalForCV, setSelectedSignalForCV] = useState<Signal | null>(null);
  
  // Loading states
  const [bullhornLoading, setBullhornLoading] = useState<Record<string, boolean>>({});
  const [taSearchLoading, setTaSearchLoading] = useState<Record<string, boolean>>({});
  
  // TA Contacts results
  const [taSearchResults, setTaSearchResults] = useState<SignalSearchResult | null>(null);
  const [taResultsModalOpen, setTaResultsModalOpen] = useState(false);
  const [taSearchSignal, setTaSearchSignal] = useState<Signal | null>(null);
  const [bullhornExportLoading, setBullhornExportLoading] = useState(false);
  const [bullhornExported, setBullhornExported] = useState(false);
  
  // Retrain modal state
  const [retrainModalOpen, setRetrainModalOpen] = useState(false);
  const [selectedSignalForRetrain, setSelectedSignalForRetrain] = useState<Signal | null>(null);

  const setupRealtimeSubscription = useCallback(() => {
    const channel = supabase
      .channel("signals-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "signals",
        },
        (payload) => {
          console.log("Realtime signal update:", payload);
          if (payload.eventType === "INSERT") {
            const newSignal = payload.new as Signal;
            setSignals((prev) => [newSignal, ...prev]);
            // Update counts
            setRegionCounts((prev) => ({
              ...prev,
              [newSignal.region]: (prev[newSignal.region] || 0) + 1,
            }));
            if (newSignal.tier) {
              setTierCounts((prev) => ({
                ...prev,
                [newSignal.tier!]: (prev[newSignal.tier!] || 0) + 1,
              }));
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedSignal = payload.new as Signal;
            setSignals((prev) =>
              prev.map((s) => (s.id === updatedSignal.id ? updatedSignal : s))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setSignals((prev) => prev.filter((s) => s.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch signals on mount and when profile changes
  const SIGNALS_PREFS_KEY = "signals-dashboard-preferences";

  useEffect(() => {
    const rawPrefs = localStorage.getItem(SIGNALS_PREFS_KEY);
    if (!rawPrefs) return;

    try {
      const prefs = JSON.parse(rawPrefs) as {
        activeRegion?: Region;
        tierFilter?: TierFilter;
        typeFilter?: string;
        sortBy?: SortOption;
        minScore?: number;
        activeTab?: TabView;
        viewMode?: ViewMode;
        searchQuery?: string;
        excludeQuery?: string;
        fitOnly?: boolean;
        minFitScore?: number;
        datePreset?: DatePreset;
        customDateRange?: { from?: string; to?: string };
      };

      if (prefs.activeRegion && prefs.activeRegion in REGION_CONFIG) setActiveRegion(prefs.activeRegion);
      if (prefs.tierFilter && TIER_FILTERS.some((f) => f.value === prefs.tierFilter)) setTierFilter(prefs.tierFilter);
      if (typeof prefs.typeFilter === "string" && prefs.typeFilter.trim().length > 0) setTypeFilter(prefs.typeFilter);
      if (prefs.sortBy && SORT_OPTIONS.some((s) => s.value === prefs.sortBy)) setSortBy(prefs.sortBy);
      if (typeof prefs.minScore === "number" && prefs.minScore >= 0 && prefs.minScore <= 100) setMinScore(prefs.minScore);
      if (prefs.activeTab && ["signals", "jobboard"].includes(prefs.activeTab)) setActiveTab(prefs.activeTab);
      if (prefs.viewMode && ["table", "cards"].includes(prefs.viewMode)) setViewMode(prefs.viewMode);
      if (typeof prefs.searchQuery === "string") setSearchQuery(prefs.searchQuery);
      if (typeof prefs.excludeQuery === "string") setExcludeQuery(prefs.excludeQuery);
      if (prefs.fitOnly === true) setFitOnly(true);
      if (typeof prefs.minFitScore === "number" && prefs.minFitScore >= 0 && prefs.minFitScore <= 100) setMinFitScore(prefs.minFitScore);
      if (prefs.datePreset && DATE_PRESETS.some((p) => p.value === prefs.datePreset)) setDatePreset(prefs.datePreset);
      if (prefs.customDateRange?.from || prefs.customDateRange?.to) {
        setCustomDateRange({
          from: prefs.customDateRange.from ? new Date(prefs.customDateRange.from) : undefined,
          to: prefs.customDateRange.to ? new Date(prefs.customDateRange.to) : undefined,
        });
      }
    } catch (error) {
      console.error("Failed to parse Signals dashboard preferences:", error);
    }
  }, []);

  useEffect(() => {
    const prefs = {
      activeRegion,
      tierFilter,
      typeFilter,
      sortBy,
      minScore,
      activeTab,
      viewMode,
      searchQuery,
      excludeQuery,
      fitOnly,
      minFitScore,
      datePreset,
      customDateRange: {
        from: customDateRange?.from?.toISOString(),
        to: customDateRange?.to?.toISOString(),
      },
    };
    localStorage.setItem(SIGNALS_PREFS_KEY, JSON.stringify(prefs));
  }, [activeRegion, tierFilter, typeFilter, sortBy, minScore, activeTab, viewMode, searchQuery, excludeQuery, fitOnly, minFitScore, datePreset, customDateRange]);

  const fetchSignals = useCallback(async (options?: { silent?: boolean; withLoading?: boolean }) => {
    if (!profileName) return;
    const { silent = false, withLoading = true } = options || {};

    if (withLoading) setIsLoading(true);
    try {
      const response = await getSignals(profileName);
      if (response.success && response.data) {
        setSignals(response.data.signals || []);
        setRegionCounts(response.data.regionCounts || {});
        setTierCounts(response.data.tierCounts || {});
      }
    } catch (error) {
      console.error("Error fetching signals:", error);
      if (!silent) toast.error("Failed to load signals");
    } finally {
      if (withLoading) setIsLoading(false);
    }
  }, [profileName]);

  useEffect(() => {
    if (!profileName) return;

    fetchSignals();

    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [profileName, setupRealtimeSubscription, fetchSignals]);

  useEffect(() => {
    if (!profileName) return;

    let cancelled = false;
    let inFlight = false;

    const runAutoRefresh = async () => {
      const now = Date.now();
      if (now - lastAutoRefreshAtRef.current < AUTO_REFRESH_FOCUS_THROTTLE_MS) return;
      if (inFlight || cancelled) return;
      if (document.hidden || activeTab !== "signals") return;
      if (isRefreshing || isScraping || isSurgeRunning || isHunting) return;

      inFlight = true;
      lastAutoRefreshAtRef.current = now;
      setIsAutoRefreshing(true);

      try {
        await refreshSignals(profileName);
        if (!cancelled) {
          await fetchSignals({ silent: true, withLoading: false });
        }
      } catch (error) {
        console.error("Auto-refresh signals failed:", error);
      } finally {
        if (!cancelled) setIsAutoRefreshing(false);
        inFlight = false;
      }
    };

    const onFocusOrVisible = () => {
      if (!document.hidden) void runAutoRefresh();
    };

    const intervalId = window.setInterval(() => {
      void runAutoRefresh();
    }, AUTO_REFRESH_INTERVAL_MS);

    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, [profileName, activeTab, fetchSignals, isRefreshing, isScraping, isSurgeRunning, isHunting]);
  
  const handleRefresh = async () => {
    if (!profileName) return;
    
    setIsRefreshing(true);
    try {
      const response = await refreshSignals(profileName);
      if (response.success && "data" in response && response.data) {
        toast.success(`Refreshed: ${response.data.fetched || 0} new signals found`);
        await fetchSignals({ withLoading: false, silent: true });
        
        // Trigger AI enrichment for new signals
        toast.info("Enriching signals with AI insights...", { duration: 5000 });
        const enrichResult = await enrichSignalsWithAI();
        if (enrichResult.success && enrichResult.enriched > 0) {
          toast.success(`AI enriched ${enrichResult.enriched} signals`);
          await fetchSignals({ withLoading: false, silent: true }); // Reload to show AI insights
        }
      } else {
        toast.error("Failed to refresh signals");
      }
    } catch (error) {
      console.error("Error refreshing signals:", error);
      toast.error("Failed to refresh signals");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleScrapeJobs = async () => {
    if (!profileName) return;
    
    setIsScraping(true);
    toast.info(`Scraping career pages for ${activeRegion.toUpperCase()} region...`, { duration: 15000 });
    
    try {
      const response = await scrapeJobSignals(activeRegion);
      if (response.success) {
        const { scrapedPages, signalsFound, signalsInserted } = response;
        toast.success(`Scraped ${scrapedPages} career pages: ${signalsInserted} new job signals added`);
        if (signalsInserted > 0) {
          await fetchSignals({ withLoading: false, silent: true });
        }
      } else {
        toast.error(response.error || "Failed to scrape job signals");
      }
    } catch (error) {
      console.error("Job scraping error:", error);
      toast.error("Failed to scrape career pages");
    } finally {
      setIsScraping(false);
    }
  };

  const handleEnrichWithAI = async () => {
    const unenrichedSignals = signals.filter(s => !s.ai_enriched_at && s.region === activeRegion);
    if (unenrichedSignals.length === 0) {
      toast.info("All signals already enriched");
      return;
    }
    
    setIsRefreshing(true);
    toast.info(`Enriching ${unenrichedSignals.length} signals with AI...`, { duration: 10000 });
    
    try {
      const result = await enrichSignalsWithAI(unenrichedSignals.map(s => s.id));
      if (result.success) {
        toast.success(`AI enriched ${result.enriched} signals`);
        await fetchSignals({ withLoading: false, silent: true });
      } else {
        toast.error(result.error || "AI enrichment failed");
      }
    } catch (error) {
      console.error("AI enrichment error:", error);
      toast.error("Failed to enrich signals");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Primary action: Fetch & Enrich signals (combines surge + AI enrichment)
  const handleRegionalSurge = async () => {
    if (!profileName) return;
    
    setIsSurgeRunning(true);
    toast.info(`Fetching signals for ${REGION_CONFIG[activeRegion].label}...`, { duration: 30000 });
    
    try {
      // Step 1: Run the surge scraper
      const response = await runRegionalSurge(activeRegion);
      if (response.success) {
        const { validated, rejected, pending } = response;
        toast.success(
          `Found ${validated} new signals (${pending} pending review)`,
          { duration: 3000 }
        );
        
        // Step 2: Auto-enrich any unenriched signals
        const enrichResult = await enrichSignalsWithAI();
        if (enrichResult.success && enrichResult.enriched > 0) {
          toast.success(`AI enriched ${enrichResult.enriched} signals with insights`, { duration: 3000 });
        }
        
        await fetchSignals();
      } else {
        toast.error(response.error || "Failed to fetch signals");
      }
    } catch (error) {
      console.error("Fetch signals error:", error);
      toast.error("Failed to fetch signals");
    } finally {
      setIsSurgeRunning(false);
    }
  };

  // Hunt PE Funds across all 4 regions
  const handleHuntPEFunds = async () => {
    setIsHunting(true);
    toast.info("🎯 Hunting PE fund news across London, EU, UAE, USA...", { duration: 30000, id: "pe-hunt" });
    
    try {
      const result = await huntPEFunds();
      if (result.success) {
        const regionSummary = result.regionResults 
          ? Object.entries(result.regionResults)
              .map(([r, v]) => `${r}: ${v.inserted} new`)
              .join(", ")
          : "";
        
        toast.success(
          `Found ${result.totalInserted} new PE signals! ${regionSummary}`,
          { id: "pe-hunt", duration: 5000 }
        );
        
        // Auto-enrich new signals with AI
        if (result.totalInserted && result.totalInserted > 0) {
          toast.info("Enriching new signals with AI insights...", { duration: 5000 });
          await enrichSignalsWithAI();
          await fetchSignals({ withLoading: false, silent: true });
        }
      } else {
        toast.error(result.error || "Hunt failed", { id: "pe-hunt" });
      }
    } catch (error) {
      console.error("PE Hunt error:", error);
      toast.error("Failed to hunt PE funds", { id: "pe-hunt" });
    } finally {
      setIsHunting(false);
    }
  };

  // Handle feedback for pending signals
  const handleSignalFeedback = async (signalId: string, action: 'APPROVE' | 'REJECT_NORDIC' | 'REJECT_WRONG_REGION') => {
    if (!profileName) return;
    
    try {
      const result = await submitSignalFeedback(signalId, action, profileName);
      if (result.success) {
        // Update local state
        setSignals((prev) =>
          prev.map((s) =>
            s.id === signalId
              ? { ...s, user_feedback: action, validated_region: action === 'APPROVE' ? s.region?.toUpperCase() : 'REJECTED' }
              : s
          )
        );
        
        if (action === 'APPROVE') {
          toast.success("Signal approved - region validated");
        } else {
          toast.success("Signal rejected - added to self-learning filter");
        }
      }
    } catch (error) {
      console.error("Feedback error:", error);
      toast.error("Failed to submit feedback");
    }
  };

  const handleDismiss = async (signalId: string) => {
    if (!profileName) return;
    
    try {
      const response = await dismissSignal(profileName, signalId);
      if (response.success) {
        setSignals((prev) => prev.filter((s) => s.id !== signalId));
        toast.success("Signal dismissed");
      }
    } catch (error) {
      console.error("Error dismissing signal:", error);
    }
  };

  const handleTAContacts = async (signal: Signal) => {
    if (!profileName) return;
    
    setTaSearchLoading((prev) => ({ ...prev, [signal.id]: true }));
    setTaSearchSignal(signal);
    setBullhornExported(signal.bullhorn_note_added); // Reset based on signal state
    
    // Pre-fetch Bullhorn emails to exclude existing CRM contacts
    let bullhornEmails: string[] = [];
    try {
      const { data: bhResult } = await supabase.functions.invoke('fetch-bullhorn-emails', {});
      if (bhResult?.success && bhResult?.emails) {
        bullhornEmails = bhResult.emails;
        if (bullhornEmails.length > 0) {
          toast.info(`Excluding ${bullhornEmails.length} existing CRM contacts from search`, {
            duration: 3000,
          });
        }
      }
    } catch (bhError) {
      console.log('Bullhorn pre-fetch skipped (not connected or error)');
    }
    
    toast.info(`Searching for TA contacts at ${signal.company || "company"}...`, {
      duration: 10000,
      id: `ta-search-${signal.id}`,
    });
    
    try {
      const response = await runSignalAutoSearch(signal.id, profileName, bullhornEmails);
      
      if (response.success && response.data) {
        const { contacts, targetCompany, categoriesWithResults } = response.data;
        
        setSignals((prev) =>
          prev.map((s) =>
            s.id === signal.id ? { ...s, contacts_found: contacts.length } : s
          )
        );
        
        if (contacts.length > 0) {
          toast.success(
            `Found ${contacts.length} contacts at ${targetCompany} (${categoriesWithResults.length} categories)`,
            { id: `ta-search-${signal.id}` }
          );
          setTaSearchResults(response.data);
          setTaResultsModalOpen(true);
        } else {
          toast.warning(`No contacts found at ${targetCompany}.`, {
            id: `ta-search-${signal.id}`,
          });
        }

        // Save signal TA search into Runs History (Additional tab).
        try {
          const runResult = await createEnrichmentRun(profileName, {
            search_counter: Math.max(contacts.length, 10),
            candidates_count: 1,
            preferences_count: 1,
            status: contacts.length > 0 ? "success" : "failed",
            bullhorn_enabled: false,
            candidates_data: [{
              candidate_id: `SIG-${signal.id}`,
              name: targetCompany || signal.company || "Signal Search",
              current_title: signal.title,
              location: signal.region || "",
              skills: [],
              work_history: [],
              education: [],
            }],
            preferences_data: [{
              type: "signal_ta",
              company: targetCompany || signal.company || "",
              country: signal.region || "",
              signalId: signal.id,
              signalTitle: signal.title,
              signalRegion: signal.region,
              categoriesTried: response.data.categoriesTried || [],
              categoriesWithResults: response.data.categoriesWithResults || [],
            }],
          });

          if (runResult.success && runResult.data?.id) {
            const historyContacts = contacts.map((c) => ({
              name: c.name,
              title: c.title,
              company: c.company,
              email: c.email,
              location: c.location,
              phone: "",
            }));

            await updateEnrichmentRun(profileName, runResult.data.id, {
              processed_count: 1,
              enriched_data: historyContacts,
              status: contacts.length > 0 ? "success" : "failed",
              error_message: contacts.length === 0 ? "No contacts found matching criteria" : null,
            });
          }
        } catch (historyError) {
          console.error("Failed to persist signal TA run:", historyError);
        }
      } else {
        toast.error(response.error || "Failed to search for contacts", {
          id: `ta-search-${signal.id}`,
        });
      }
    } catch (error) {
      console.error("TA Contacts search error:", error);
      toast.error("Failed to search for contacts", {
        id: `ta-search-${signal.id}`,
      });
    } finally {
      setTaSearchLoading((prev) => ({ ...prev, [signal.id]: false }));
    }
  };

  const handleCVMatches = (signal: Signal) => {
    setSelectedSignalForCV(signal);
    setCvModalOpen(true);
  };

  const handleSelectCV = (cv: { id: string; name: string }) => {
    setCvModalOpen(false);
    navigate(`/upload?savedProfileId=${cv.id}&signalId=${selectedSignalForCV?.id || ""}`);
    toast.success(`Using CV: ${cv.name}`);
  };

  const handleBullhornNote = async (signal: Signal) => {
    if (!profileName) return;
    
    const note = buildBullhornNote(signal);
    await navigator.clipboard.writeText(note);
    toast.success("Note copied to clipboard");
    
    setBullhornLoading((prev) => ({ ...prev, [signal.id]: true }));
    try {
      await markSignalBullhornAdded(profileName, signal.id);
      setSignals((prev) =>
        prev.map((s) =>
          s.id === signal.id ? { ...s, bullhorn_note_added: true } : s
        )
      );
      toast.success("Signal marked as added to Bullhorn");
    } catch (error) {
      console.error("Failed to mark Bullhorn:", error);
    } finally {
      setBullhornLoading((prev) => ({ ...prev, [signal.id]: false }));
    }
  };

  const handleAddToBullhorn = async () => {
    if (!taSearchSignal || !profileName) return;
    
    setBullhornExportLoading(true);
    const note = buildBullhornNote(taSearchSignal);
    await navigator.clipboard.writeText(note);
    
    try {
      await markSignalBullhornAdded(profileName, taSearchSignal.id);
      setSignals((prev) =>
        prev.map((s) =>
          s.id === taSearchSignal.id ? { ...s, bullhorn_note_added: true } : s
        )
      );
      setBullhornExported(true);
      toast.success("Signal note copied to clipboard & marked as added to Bullhorn");
    } catch (error) {
      console.error("Failed to mark Bullhorn:", error);
      toast.error("Failed to update Bullhorn status");
    } finally {
      setBullhornExportLoading(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent = exportSignalsToCSV(filteredSignals);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `signals-${activeRegion}-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully");
  };

  const handleRegionClick = (region: string) => {
    setActiveRegion(region as Region);
  };

  const handleDownloadContacts = () => {
    if (!taSearchResults) return;
    
    const headers = ["Name", "Title", "Company", "Email", "Category"];
    const rows = taSearchResults.contacts.map((c) => [
      c.name,
      c.title || "",
      c.company || "",
      c.email || "",
      c.category || "",
    ]);
    
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `contacts-${taSearchSignal?.company || "signal"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Contacts exported");
  };

  const handleRetrain = (signal: Signal) => {
    setSelectedSignalForRetrain(signal);
    setRetrainModalOpen(true);
  };

  const signalTypeOptions = useMemo(() => {
    const known = ["funding", "hiring", "expansion", "c_suite", "team_growth"];
    const dynamic = signals
      .map((s) => normalizeSignalType(s.signal_type))
      .filter((type) => type.length > 0);
    return Array.from(new Set([...known, ...dynamic]));
  }, [signals]);

  const filteredSignals = useMemo(() => {
    let filtered = signals.filter((s) => s.region === activeRegion && !s.is_dismissed);
    const includeTerms = tokenizeQuery(searchQuery);
    const excludeTerms = tokenizeQuery(excludeQuery);
    const fitById = new Map<string, number>();

    filtered = filtered.filter((s) => {
      const searchText = buildSignalSearchText(s);
      const publishedAt = s.published_at ? new Date(s.published_at) : null;

      if (datePreset !== "all") {
        if (!publishedAt || Number.isNaN(publishedAt.getTime())) return false;
        if (datePreset === "24h" && publishedAt < subHours(new Date(), 24)) return false;
        if (datePreset === "7d" && publishedAt < subDays(new Date(), 7)) return false;
        if (datePreset === "14d" && publishedAt < subDays(new Date(), 14)) return false;
        if (datePreset === "30d" && publishedAt < subDays(new Date(), 30)) return false;
        if (datePreset === "custom") {
          if (customDateRange?.from && publishedAt < startOfDay(customDateRange.from)) return false;
          if (customDateRange?.to && publishedAt > endOfDay(customDateRange.to)) return false;
        }
      }

      if (excludeTerms.some((term) => searchText.includes(term))) {
        return false;
      }

      if (includeTerms.length > 0 && !includeTerms.every((term) => searchText.includes(term))) {
        return false;
      }

      const fit = computeFitScore(s, includeTerms);
      fitById.set(s.id, fit);

      if (fitOnly && fit < minFitScore) {
        return false;
      }

      return true;
    });
    
    if (tierFilter !== "all") {
      filtered = filtered.filter((s) => s.tier === tierFilter);
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((s) => normalizeSignalType(s.signal_type) === typeFilter);
    }
    
    if (minScore > 0) {
      filtered = filtered.filter((s) => (s.score || 0) >= minScore);
    }
    
    filtered.sort((a, b) => {
      if (sortBy === "relevant") {
        return (b.score || 0) - (a.score || 0);
      }
      if (sortBy === "newest") {
        return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime();
      }
      if (sortBy === "amount") {
        return (b.amount || 0) - (a.amount || 0);
      }
      if (sortBy === "fit") {
        return (fitById.get(b.id) || 0) - (fitById.get(a.id) || 0);
      }
      return 0;
    });
    
    return filtered;
  }, [signals, activeRegion, tierFilter, typeFilter, minScore, sortBy, searchQuery, excludeQuery, fitOnly, minFitScore, datePreset, customDateRange]);

  const visibleSignals = useMemo(
    () => filteredSignals.slice(0, visibleSignalsCount),
    [filteredSignals, visibleSignalsCount]
  );

  const hasMoreSignals = visibleSignals.length < filteredSignals.length;

  useEffect(() => {
    setVisibleSignalsCount(SIGNALS_PAGE_SIZE);
  }, [activeRegion, tierFilter, typeFilter, sortBy, minScore, searchQuery, excludeQuery, fitOnly, minFitScore, datePreset, customDateRange, activeTab]);

  if (!profileName) {
    return (
      <AppLayout title="Signals Dashboard" description="Recruitment intel">
        <div className="flex flex-col items-center justify-center py-16">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Select a Profile</h3>
          <p className="text-sm text-muted-foreground">
            Please select your profile to view signals.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Signals Dashboard" description="Recruitment Intel">
      <div className="space-y-6 signals-page">
        {/* Header */}
        <div className="signals-hero space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Signals Workspace
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                Signals
              </h1>
              <p className="text-sm text-muted-foreground">
                PE/VC hiring intelligence across {Object.keys(REGION_CONFIG).length} regions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRegionalSurge}
                disabled={isSurgeRunning || isRefreshing || isScraping || isHunting}
                className="gap-2 h-10 px-5"
              >
                {isSurgeRunning || isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {isSurgeRunning ? "Fetching..." : "Fetch Signals"}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 control-surface">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleHuntPEFunds} disabled={isHunting || isSurgeRunning}>
                    <Target className="h-4 w-4 mr-2" />
                    Hunt All Regions
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleScrapeJobs} disabled={isScraping || isRefreshing}>
                    <Search className="h-4 w-4 mr-2" />
                    Scrape Job Pages
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportCSV} disabled={filteredSignals.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
        </div>

        {/* Region Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.entries(REGION_CONFIG) as [Region, typeof REGION_CONFIG.europe][]).map(
            ([key, config]) => {
              const count = regionCounts[key] || 0;
              const isActive = activeRegion === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveRegion(key)}
                  className={`signals-region-card ${isActive ? "is-active" : ""}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{config.emoji}</span>
                    <span className={`text-3xl font-semibold tabular-nums tracking-tight ${isActive ? "text-primary" : "text-foreground/85"}`}>
                      {count}
                    </span>
                  </div>
                  <p className={`text-sm font-semibold ${isActive ? "text-primary" : "text-foreground/90"}`}>
                    {config.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {config.description}
                  </p>
                </button>
              );
            }
          )}
        </div>

        {/* Tier summary */}
        <div className="signals-summary-strip flex flex-wrap items-center gap-4">
          <span className="font-semibold text-foreground tabular-nums">{signals.filter(s => !s.is_dismissed).length} signals</span>
          <div className="h-4 w-px bg-border" />
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" /> Tier 1: {tierCounts.tier_1 || 0}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground/45" /> Tier 2: {tierCounts.tier_2 || 0}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground/25" /> Tier 3: {tierCounts.tier_3 || 0}</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium gap-1.5">
                <CircleHelp className="h-3.5 w-3.5" />
                Tier Guide
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[380px] p-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Signal Tier Definitions</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tiers show urgency and hiring likelihood based on your signal rules.
                  </p>
                </div>

                <div className="space-y-2">
                  {TIER_GUIDE.map((tier) => (
                    <div key={tier.key} className="rounded-md border border-border/60 bg-background/80 p-2.5">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${tier.dotClass}`} />
                        {tier.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{tier.summary}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium text-foreground/80">Examples:</span> {tier.examples}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Tabs: Signals vs Jobs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabView)} className="w-full">
          <TabsList className="signals-tab-list">
            <TabsTrigger
              value="signals"
              className="gap-2 rounded-lg font-medium text-foreground/75 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
            >
              <Sparkles className="h-4 w-4" />
              Signals Feed
            </TabsTrigger>
            <TabsTrigger
              value="jobboard"
              className="gap-2 rounded-lg font-medium text-foreground/75 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
            >
              <Search className="h-4 w-4" />
              Job Board
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="signals" className="mt-6 space-y-5">
            {/* Filters Row */}
            <div className="signals-filter-card">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Filters</p>
                <span className="meta-chip">{REGION_CONFIG[activeRegion].label}</span>
                {fitOnly ? <span className="meta-chip">Best-fit enabled</span> : null}
                <span className="ml-auto text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Filter className="h-3.5 w-3.5" />
                  {filteredSignals.length} results • showing {visibleSignals.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isAutoRefreshing ? "Updating..." : "Auto-updates every 5 min"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center border border-border/60 rounded-lg overflow-hidden bg-muted/30">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-2 transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  title="Table view"
                >
                  <Table2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-2 transition-colors ${viewMode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as TierFilter)}>
                <SelectTrigger className="w-[160px] h-9 control-surface">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent className="bg-background border">
                  {TIER_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[170px] h-9 control-surface">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-background border">
                  <SelectItem value="all">All Types</SelectItem>
                  {signalTypeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatSignalTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[140px] h-9 control-surface">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="bg-background border">
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                <SelectTrigger className="w-[150px] h-9 control-surface">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent className="bg-background border">
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {datePreset === "custom" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 justify-start text-left font-normal w-[240px] control-surface">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {customDateRange?.from ? (
                        customDateRange.to ? (
                          `${format(customDateRange.from, "MMM d, yyyy")} - ${format(customDateRange.to, "MMM d, yyyy")}`
                        ) : (
                          format(customDateRange.from, "MMM d, yyyy")
                        )
                      ) : (
                        "Pick a date range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={customDateRange?.from}
                      selected={customDateRange}
                      onSelect={setCustomDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              )}

              <div className="relative w-full sm:w-[280px]">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Must-match terms (e.g. fintech growth)"
                  className="h-9 pl-8 control-surface"
                />
              </div>

              <Input
                value={excludeQuery}
                onChange={(e) => setExcludeQuery(e.target.value)}
                placeholder="Exclude terms (e.g. nordic, intern)"
                className="h-9 w-full sm:w-[260px] control-surface"
              />

              <Button
                variant={fitOnly ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => setFitOnly((prev) => !prev)}
              >
                Best-fit only
              </Button>

              {fitOnly && (
                <div className="flex items-center gap-2 control-surface px-3 py-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Fit ≥ {minFitScore}
                  </span>
                  <Slider
                    value={[minFitScore]}
                    onValueChange={(v) => setMinFitScore(v[0])}
                    max={100}
                    step={5}
                    className="w-24"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 control-surface px-3 py-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Score ≥ {minScore}
                </span>
                <Slider
                  value={[minScore]}
                  onValueChange={(v) => setMinScore(v[0])}
                  max={100}
                  step={10}
                  className="w-24"
                />
              </div>
              </div>
            </div>

            {/* Signal List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSignals.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Sparkles className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">No signals in {REGION_CONFIG[activeRegion].label}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Fetch new signals or adjust your filters
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleScrapeJobs} disabled={isScraping}>
                      <Search className="h-4 w-4 mr-1" />
                      Scrape Jobs
                    </Button>
                    <Button onClick={handleRefresh} disabled={isRefreshing}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Fetch News
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : viewMode === "table" ? (
              <SignalTableView
                signals={visibleSignals}
                onDismiss={handleDismiss}
                onTAContacts={handleTAContacts}
                onCVMatches={handleCVMatches}
                onRetrain={handleRetrain}
                taSearchLoading={taSearchLoading}
                onSignalUpdated={(updated) => {
                  setSignals((prev) =>
                    prev.map((s) => (s.id === updated.id ? updated : s))
                  );
                }}
              />
            ) : (
              <div className="space-y-3">
                {visibleSignals.map((signal) => (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    onDismiss={handleDismiss}
                    onTAContacts={handleTAContacts}
                    onCVMatches={handleCVMatches}
                    onRetrain={handleRetrain}
                    taSearchLoading={taSearchLoading[signal.id] || false}
                    onSignalUpdated={(updated) => {
                      setSignals((prev) =>
                        prev.map((s) => (s.id === updated.id ? updated : s))
                      );
                    }}
                  />
                ))}
              </div>
            )}

            {filteredSignals.length > SIGNALS_PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/80 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{visibleSignals.length}</span> of{" "}
                  <span className="font-medium text-foreground">{filteredSignals.length}</span> signals
                </p>
                <div className="flex items-center gap-2">
                  {visibleSignals.length > SIGNALS_PAGE_SIZE && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVisibleSignalsCount(SIGNALS_PAGE_SIZE)}
                    >
                      Show latest 25
                    </Button>
                  )}
                  {hasMoreSignals && (
                    <Button
                      size="sm"
                      onClick={() =>
                        setVisibleSignalsCount((prev) =>
                          Math.min(prev + SIGNALS_PAGE_SIZE, filteredSignals.length)
                        )
                      }
                    >
                      Load 25 more
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
          
          {/* Job Board Tab - fantastic.jobs */}
          <TabsContent value="jobboard" className="mt-4">
            <FantasticJobsBoard />
          </TabsContent>
        </Tabs>
      </div>

      {/* CV Matches Modal */}
      <CVMatchesModal
        open={cvModalOpen}
        onOpenChange={setCvModalOpen}
        signal={selectedSignalForCV}
        profileName={profileName || ""}
        onSelectCV={handleSelectCV}
      />

      {/* TA Search Results Modal */}
      <Dialog open={taResultsModalOpen} onOpenChange={setTaResultsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4">
              <span>TA Contacts at {taSearchSignal?.company}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleDownloadContacts}>
                  <Download className="h-4 w-4 mr-1" />
                  Download CSV
                </Button>
                <Button 
                  size="sm" 
                  variant={bullhornExported ? "secondary" : "default"}
                  onClick={handleAddToBullhorn}
                  disabled={bullhornExportLoading || bullhornExported}
                >
                  {bullhornExportLoading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : bullhornExported ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : (
                    <Briefcase className="h-4 w-4 mr-1" />
                  )}
                  {bullhornExported ? "Added to Bullhorn" : "Add to Bullhorn"}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {taSearchResults && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {taSearchResults.categoriesWithResults.map((cat) => (
                    <Badge key={cat} variant="secondary">
                      {cat}
                    </Badge>
                  ))}
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Title</th>
                        <th className="px-3 py-2 text-left">Company</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taSearchResults.contacts.slice(0, 50).map((contact, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{contact.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {contact.title}
                          </td>
                          <td className="px-3 py-2">{contact.company}</td>
                          <td className="px-3 py-2">
                            {contact.email || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-xs">
                              {contact.category}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {taSearchResults.contacts.length > 50 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Showing first 50 of {taSearchResults.contacts.length} contacts
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Signal Retrain Modal */}
      <SignalRetrainModal
        open={retrainModalOpen}
        onOpenChange={setRetrainModalOpen}
        signal={selectedSignalForRetrain}
        profileName={profileName || ""}
        onRetrained={() => {
          fetchSignals({ withLoading: false, silent: true });
        }}
      />
    </AppLayout>
  );
}
