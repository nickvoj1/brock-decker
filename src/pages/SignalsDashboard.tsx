import { useEffect, useState, useMemo, useCallback } from "react";
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
  Target
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  getJobSignals,
  dismissJobSignal,
  huntPEFunds,
  Signal,
  JobSignal 
} from "@/lib/signalsApi";
import { runSignalAutoSearch, SignalSearchResult } from "@/lib/signalAutoSearch";
import { CVMatchesModal } from "@/components/signals/CVMatchesModal";
import { SignalCard } from "@/components/signals/SignalCard";
import { SignalRetrainModal } from "@/components/signals/SignalRetrainModal";
import { JobSignalCard } from "@/components/signals/JobSignalCard";
import { SignalTableView } from "@/components/signals/SignalTableView";
import { FantasticJobsBoard } from "@/components/jobs/FantasticJobsBoard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Region = "london" | "europe" | "uae" | "usa";
type TierFilter = "all" | "tier_1" | "tier_2" | "tier_3";
type SortOption = "newest" | "relevant" | "amount";
type TabView = "signals" | "jobs" | "jobboard";

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
];

export default function SignalsDashboard() {
  const navigate = useNavigate();
  const profileName = useProfileName();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [jobSignals, setJobSignals] = useState<JobSignal[]>([]);
  const [regionCounts, setRegionCounts] = useState<Record<string, number>>({});
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [activeRegion, setActiveRegion] = useState<Region>("london");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [minScore, setMinScore] = useState<number>(0);
  const [isSurgeRunning, setIsSurgeRunning] = useState(false);
  const [isHunting, setIsHunting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>("signals");
  const [isJobsLoading, setIsJobsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  
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

  // Fetch signals on mount and when profile changes
  useEffect(() => {
    if (profileName) {
      fetchSignals();
      fetchJobSignals();
      setupRealtimeSubscription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileName]);
  
  // Fetch job signals when region changes
  useEffect(() => {
    if (activeTab === "jobs" && profileName) {
      fetchJobSignals();
    }
  }, [activeRegion, activeTab, profileName]);

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

  const fetchSignals = async () => {
    if (!profileName) return;
    
    setIsLoading(true);
    try {
      const response = await getSignals(profileName);
      if (response.success && response.data) {
        setSignals(response.data.signals || []);
        setRegionCounts(response.data.regionCounts || {});
        setTierCounts(response.data.tierCounts || {});
      }
    } catch (error) {
      console.error("Error fetching signals:", error);
      toast.error("Failed to load signals");
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchJobSignals = async () => {
    if (!profileName) return;
    
    setIsJobsLoading(true);
    try {
      const response = await getJobSignals(activeRegion);
      if (response.success && response.data) {
        setJobSignals(response.data);
      }
    } catch (error) {
      console.error("Error fetching job signals:", error);
    } finally {
      setIsJobsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!profileName) return;
    
    setIsRefreshing(true);
    try {
      const response = await refreshSignals(profileName);
      if (response.success && "data" in response && response.data) {
        toast.success(`Refreshed: ${response.data.fetched || 0} new signals found`);
        await fetchSignals();
        
        // Trigger AI enrichment for new signals
        toast.info("Enriching signals with AI insights...", { duration: 5000 });
        const enrichResult = await enrichSignalsWithAI();
        if (enrichResult.success && enrichResult.enriched > 0) {
          toast.success(`AI enriched ${enrichResult.enriched} signals`);
          await fetchSignals(); // Reload to show AI insights
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
          await fetchSignals();
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
        await fetchSignals();
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
          await fetchSignals();
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

  const filteredSignals = useMemo(() => {
    let filtered = signals.filter((s) => s.region === activeRegion && !s.is_dismissed);
    
    if (tierFilter !== "all") {
      filtered = filtered.filter((s) => s.tier === tierFilter);
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
      return 0;
    });
    
    return filtered;
  }, [signals, activeRegion, tierFilter, minScore, sortBy]);

  // Count pending signals for badge
  const pendingCount = useMemo(() => {
    return signals.filter(s => s.region === activeRegion && !s.user_feedback && !s.validated_region && !s.is_dismissed).length;
  }, [signals, activeRegion]);

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
      <div className="space-y-6">
        {/* Header - Streamlined */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Signals
            </h1>
            <p className="text-sm text-muted-foreground">
              PE/VC hiring intelligence • {signals.filter(s => !s.is_dismissed).length} active signals
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Primary Action: Fetch Signals (combines surge + AI enrich) */}
            <Button
              size="sm"
              onClick={handleRegionalSurge}
              disabled={isSurgeRunning || isRefreshing || isScraping || isHunting}
              className="gap-1.5"
            >
              {isSurgeRunning || isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {isSurgeRunning ? "Fetching..." : "Fetch Signals"}
            </Button>
            
            {/* More Options Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
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

        {/* Region Selector with embedded counts */}
        <div className="grid grid-cols-4 gap-3">
          {(Object.entries(REGION_CONFIG) as [Region, typeof REGION_CONFIG.europe][]).map(
            ([key, config]) => {
              const count = regionCounts[key] || 0;
              const isActive = activeRegion === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveRegion(key)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border/40 hover:border-border hover:bg-muted/30 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg">{config.emoji}</span>
                    <span className={`text-2xl font-bold tabular-nums ${isActive ? "text-primary" : "text-foreground"}`}>
                      {count}
                    </span>
                  </div>
                  <p className={`text-sm font-medium ${isActive ? "text-primary" : "text-foreground"}`}>
                    {config.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {config.description}
                  </p>
                </button>
              );
            }
          )}
        </div>

        {/* Compact tier legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{signals.filter(s => !s.is_dismissed).length} total signals</span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-destructive" /> Tier 1: {tierCounts.tier_1 || 0}</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Tier 2: {tierCounts.tier_2 || 0}</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Tier 3: {tierCounts.tier_3 || 0}</span>
        </div>

        {/* Tabs: Signals vs Jobs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabView)} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="signals" className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              Signals
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-1.5">
              <Briefcase className="h-4 w-4" />
              Apollo Jobs
            </TabsTrigger>
            <TabsTrigger value="jobboard" className="gap-1.5">
              <Search className="h-4 w-4" />
              Job Board
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="signals" className="mt-4 space-y-4">
            {/* Filters Row - Signals */}
            <div className="flex flex-wrap items-center gap-3 py-2 px-1">
              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-md overflow-hidden">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 ${viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  title="Table view"
                >
                  <Table2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-1.5 ${viewMode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as TierFilter)}>
                <SelectTrigger className="w-[160px] h-9">
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

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[140px] h-9">
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

              <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5">
                <span className="text-xs text-muted-foreground">
                  Score ≥ {minScore}
                </span>
                <Slider
                  value={[minScore]}
                  onValueChange={(v) => setMinScore(v[0])}
                  max={100}
                  step={10}
                  className="w-20"
                />
              </div>

              <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" />
                {filteredSignals.length} results
              </span>
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
                signals={filteredSignals}
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
                {filteredSignals.map((signal) => (
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
          </TabsContent>
          
          {/* Jobs Tab */}
          <TabsContent value="jobs" className="mt-4 space-y-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">
                {jobSignals.length} job signals in {REGION_CONFIG[activeRegion].label}
              </span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={async () => {
                  setIsJobsLoading(true);
                  toast.info("Fetching job signals via Apollo...");
                  const result = await scrapeJobSignals(activeRegion, "apollo");
                  if (result.success) {
                    toast.success(`Found ${result.apolloJobsInserted || 0} new job signals`);
                    await fetchJobSignals();
                  } else {
                    toast.error(result.error || "Failed to fetch jobs");
                  }
                  setIsJobsLoading(false);
                }}
                disabled={isJobsLoading}
              >
                {isJobsLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Fetch Jobs
              </Button>
            </div>
            
            {isJobsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : jobSignals.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Briefcase className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">No job signals yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Fetch job postings from PE/VC companies
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {jobSignals.map((job) => (
                  <JobSignalCard 
                    key={job.id} 
                    job={job} 
                    onDismiss={async (id) => {
                      const result = await dismissJobSignal(id, profileName || "");
                      if (result.success) {
                        setJobSignals(prev => prev.filter(j => j.id !== id));
                        toast.success("Job signal dismissed");
                      }
                    }}
                  />
                ))}
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
          fetchSignals();
        }}
      />
    </AppLayout>
  );
}
