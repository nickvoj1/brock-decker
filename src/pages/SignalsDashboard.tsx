import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Sparkles,
  RefreshCw,
  Filter,
  Download,
  Loader2,
  Wand2,
  Briefcase,
  Check,
  Search
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
  Signal 
} from "@/lib/signalsApi";
import { runSignalAutoSearch, SignalSearchResult } from "@/lib/signalAutoSearch";
import { CVMatchesModal } from "@/components/signals/CVMatchesModal";
import { SignalCard } from "@/components/signals/SignalCard";
import { SignalsTierChart } from "@/components/signals/SignalsTierChart";
import { SignalsRegionMap } from "@/components/signals/SignalsRegionMap";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Region = "london" | "europe" | "uae" | "usa";
type TierFilter = "all" | "tier_1" | "tier_2" | "tier_3";
type SortOption = "score" | "newest" | "amount";

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
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [minScore, setMinScore] = useState<number>(0);
  
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

  // Fetch signals on mount and when profile changes
  useEffect(() => {
    if (profileName) {
      fetchSignals();
      setupRealtimeSubscription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileName]);

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
    
    toast.info(`Searching for TA contacts at ${signal.company || "company"}...`, {
      duration: 10000,
      id: `ta-search-${signal.id}`,
    });
    
    try {
      const response = await runSignalAutoSearch(signal.id, profileName);
      
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

  const filteredSignals = useMemo(() => {
    let filtered = signals.filter((s) => s.region === activeRegion && !s.is_dismissed);
    
    if (tierFilter !== "all") {
      filtered = filtered.filter((s) => s.tier === tierFilter);
    }
    
    if (minScore > 0) {
      filtered = filtered.filter((s) => (s.score || 0) >= minScore);
    }
    
    filtered.sort((a, b) => {
      if (sortBy === "score") {
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
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Signals Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time hiring intelligence across PE/VC markets
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredSignals.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={handleScrapeJobs}
              disabled={isScraping || isRefreshing}
            >
              <Search className={`h-4 w-4 mr-2 ${isScraping ? "animate-pulse" : ""}`} />
              {isScraping ? "Scraping..." : "Scrape Jobs"}
            </Button>
            <Button
              variant="outline"
              onClick={handleEnrichWithAI}
              disabled={isRefreshing || isScraping}
            >
              <Wand2 className="h-4 w-4 mr-2" />
              AI Enrich
            </Button>
            <Button onClick={handleRefresh} disabled={isRefreshing || isScraping}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SignalsTierChart tierCounts={tierCounts} />
          <SignalsRegionMap
            regionCounts={regionCounts}
            activeRegion={activeRegion}
            onRegionClick={handleRegionClick}
          />
        </div>

        {/* Region Tabs */}
        <Tabs value={activeRegion} onValueChange={(v) => setActiveRegion(v as Region)}>
          <TabsList className="grid w-full grid-cols-4 h-auto">
            {(Object.entries(REGION_CONFIG) as [Region, typeof REGION_CONFIG.europe][]).map(
              ([key, config]) => (
                <TabsTrigger key={key} value={key} className="flex items-center gap-2 py-3">
                  <span>{config.emoji}</span>
                  <span className="hidden sm:inline">{config.label}</span>
                  <Badge variant="secondary" className="ml-1">
                    {regionCounts[key] || 0}
                  </Badge>
                </TabsTrigger>
              )
            )}
          </TabsList>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as TierFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Tier" />
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
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-background border">
                <SelectItem value="score">Highest Score</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="amount">Largest Amount</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 min-w-[200px]">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Min Score: {minScore}
              </span>
              <Slider
                value={[minScore]}
                onValueChange={(v) => setMinScore(v[0])}
                max={100}
                step={10}
                className="w-24"
              />
            </div>

            <div className="ml-auto text-sm text-muted-foreground">
              <Filter className="h-4 w-4 inline mr-1" />
              {filteredSignals.length} signals
            </div>
          </div>

          {/* Signal Cards */}
          {(Object.keys(REGION_CONFIG) as Region[]).map((region) => (
            <TabsContent key={region} value={region} className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSignals.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No signals found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click refresh to fetch the latest signals
                    </p>
                    <Button onClick={handleRefresh} disabled={isRefreshing}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Fetch Signals
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {filteredSignals.map((signal) => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
                      onDismiss={handleDismiss}
                      onTAContacts={handleTAContacts}
                      onCVMatches={handleCVMatches}
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
          ))}
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
    </AppLayout>
  );
}
