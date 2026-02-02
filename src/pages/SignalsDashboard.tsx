import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Globe, 
  TrendingUp, 
  Users,
  Building2,
  DollarSign,
  Clock,
  Filter,
  RefreshCw,
  ExternalLink,
  X,
  UserSearch,
  FileText,
  Briefcase,
  Sparkles,
  MapPin,
  Check,
  Loader2
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
import { useProfileName } from "@/hooks/useProfileName";
import { 
  getSignals, 
  dismissSignal, 
  refreshSignals, 
  markSignalBullhornAdded,
  buildBullhornNote,
  getSignalEnrichmentParams,
  Signal 
} from "@/lib/signalsApi";
import { CVMatchesModal } from "@/components/signals/CVMatchesModal";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type Region = 'europe' | 'uae' | 'east_usa' | 'west_usa';
type SortOption = 'newest' | 'amount' | 'intent';
type SignalTypeFilter = 'all' | 'fund_close' | 'new_fund' | 'deal' | 'exit' | 'expansion' | 'senior_hire';

const REGION_CONFIG = {
  europe: { label: "Europe", emoji: "🇪🇺", priority: 1 },
  uae: { label: "UAE", emoji: "🇦🇪", priority: 2 },
  east_usa: { label: "East USA", emoji: "🇺🇸", priority: 3 },
  west_usa: { label: "West USA", emoji: "🇺🇸", priority: 4 },
};

const SIGNAL_TYPE_FILTERS: { value: SignalTypeFilter; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "fund_close", label: "Fund Close" },
  { value: "new_fund", label: "New Fund" },
  { value: "deal", label: "Deal/Investment" },
  { value: "exit", label: "Exit" },
  { value: "expansion", label: "Expansion" },
  { value: "senior_hire", label: "Senior Hire" },
];

const SIGNAL_TYPE_ICONS: Record<string, React.ReactNode> = {
  fund_close: <DollarSign className="h-4 w-4" />,
  new_fund: <TrendingUp className="h-4 w-4" />,
  deal: <Briefcase className="h-4 w-4" />,
  exit: <TrendingUp className="h-4 w-4" />,
  expansion: <Globe className="h-4 w-4" />,
  senior_hire: <Users className="h-4 w-4" />,
  // Legacy types for backward compatibility
  funding: <DollarSign className="h-4 w-4" />,
  hiring: <Users className="h-4 w-4" />,
  c_suite: <Briefcase className="h-4 w-4" />,
  team_growth: <TrendingUp className="h-4 w-4" />,
};

const SIGNAL_TYPE_COLORS: Record<string, string> = {
  fund_close: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  new_fund: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  deal: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  exit: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  expansion: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  senior_hire: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  // Legacy
  funding: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  hiring: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  c_suite: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  team_growth: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
};

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  fund_close: "Fund Close",
  new_fund: "New Fund",
  deal: "Deal/Investment",
  exit: "Exit",
  expansion: "Expansion",
  senior_hire: "Senior Hire",
  funding: "Funding",
  hiring: "Hiring",
  c_suite: "C-Suite",
  team_growth: "Team Growth",
};

function formatAmount(amount: number | null, currency: string | null): string {
  if (!amount) return "";
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  if (amount >= 1000) {
    return `${symbol}${(amount / 1000).toFixed(1)}B`;
  }
  return `${symbol}${amount}M`;
}

function getIntentStars(signal: Signal): number {
  let stars = 1;
  if (signal.is_high_intent) stars += 2;
  if (signal.amount && signal.amount >= 100) stars += 1;
  if (signal.amount && signal.amount >= 500) stars += 1;
  // Fund closes and new funds get extra star
  if (signal.signal_type === "fund_close" || signal.signal_type === "new_fund") stars += 1;
  if (signal.signal_type === "senior_hire" || signal.signal_type === "expansion") stars += 1;
  return Math.min(stars, 5);
}

export default function SignalsDashboard() {
  const navigate = useNavigate();
  const profileName = useProfileName();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [regionCounts, setRegionCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeRegion, setActiveRegion] = useState<Region>("europe");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showHighIntentOnly, setShowHighIntentOnly] = useState(false);
  const [signalTypeFilter, setSignalTypeFilter] = useState<SignalTypeFilter>("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // CV Matches modal
  const [cvModalOpen, setCvModalOpen] = useState(false);
  const [selectedSignalForCV, setSelectedSignalForCV] = useState<Signal | null>(null);
  
  // Bullhorn loading state per signal
  const [bullhornLoading, setBullhornLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (profileName) {
      fetchSignals();
    }
  }, [profileName]);

  const fetchSignals = async () => {
    if (!profileName) return;
    
    setIsLoading(true);
    try {
      const response = await getSignals(profileName);
      if (response.success && response.data) {
        setSignals(response.data.signals || []);
        setRegionCounts(response.data.regionCounts || {});
        setLastUpdated(new Date());
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

  const handleDismiss = async (signalId: string) => {
    if (!profileName) return;
    
    try {
      const response = await dismissSignal(profileName, signalId);
      if (response.success) {
        setSignals(prev => prev.filter(s => s.id !== signalId));
        toast.success("Signal dismissed");
      }
    } catch (error) {
      console.error("Error dismissing signal:", error);
    }
  };

  const handleTAContacts = (signal: Signal) => {
    // Navigate to Upload & Run page with signal context as query params
    const params = getSignalEnrichmentParams(signal);
    const queryString = new URLSearchParams(params).toString();
    navigate(`/upload?${queryString}`);
    toast.success(`Opening enrichment for ${signal.company || "signal"}`);
  };

  const handleCVMatches = (signal: Signal) => {
    setSelectedSignalForCV(signal);
    setCvModalOpen(true);
  };

  const handleSelectCV = (cv: { id: string; name: string }) => {
    setCvModalOpen(false);
    // Navigate to upload page with the selected CV pre-loaded
    navigate(`/upload?savedProfileId=${cv.id}&signalId=${selectedSignalForCV?.id || ""}`);
    toast.success(`Using CV: ${cv.name}`);
  };

  const handleBullhornNote = async (signal: Signal) => {
    if (!profileName) return;
    
    // Copy note to clipboard
    const note = buildBullhornNote(signal);
    await navigator.clipboard.writeText(note);
    toast.success("Note copied to clipboard");
    
    // Mark signal as processed in Bullhorn
    setBullhornLoading(prev => ({ ...prev, [signal.id]: true }));
    try {
      await markSignalBullhornAdded(profileName, signal.id);
      // Update local state
      setSignals(prev => prev.map(s => 
        s.id === signal.id ? { ...s, bullhorn_note_added: true } : s
      ));
      toast.success("Signal marked as added to Bullhorn");
    } catch (error) {
      console.error("Failed to mark Bullhorn:", error);
    } finally {
      setBullhornLoading(prev => ({ ...prev, [signal.id]: false }));
    }
  };

  const filteredSignals = useMemo(() => {
    let filtered = signals.filter(s => s.region === activeRegion && !s.is_dismissed);
    
    if (showHighIntentOnly) {
      filtered = filtered.filter(s => s.is_high_intent);
    }
    
    // Filter by signal type
    if (signalTypeFilter !== "all") {
      filtered = filtered.filter(s => s.signal_type === signalTypeFilter);
    }
    
    // Sort
    filtered.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime();
      }
      if (sortBy === "amount") {
        return (b.amount || 0) - (a.amount || 0);
      }
      if (sortBy === "intent") {
        return getIntentStars(b) - getIntentStars(a);
      }
      return 0;
    });
    
    return filtered;
  }, [signals, activeRegion, sortBy, showHighIntentOnly, signalTypeFilter]);

  if (!profileName) {
    return (
      <AppLayout title="Signals Dashboard" description="Recruitment intel">
        <div className="flex flex-col items-center justify-center py-16">
          <Globe className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Select a Profile</h3>
          <p className="text-sm text-muted-foreground">Please select your profile to view signals.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Signals Dashboard"
      description="BIG NEWS for Brock & Decker"
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Signals Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: {lastUpdated ? formatDistanceToNow(lastUpdated, { addSuffix: true }) : "Never"}
            </p>
          </div>
          <Button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh Signals
          </Button>
        </div>

        {/* Region Tabs */}
        <Tabs value={activeRegion} onValueChange={(v) => setActiveRegion(v as Region)}>
          <TabsList className="grid w-full grid-cols-4 h-auto">
            {(Object.entries(REGION_CONFIG) as [Region, typeof REGION_CONFIG.europe][]).map(([key, config]) => (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2 py-3">
                <span>{config.emoji}</span>
                <span className="hidden sm:inline">{config.label}</span>
                <Badge variant="secondary" className="ml-1">
                  {regionCounts[key] || 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Button
              variant={showHighIntentOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHighIntentOnly(!showHighIntentOnly)}
              className="gap-2"
            >
              <Sparkles className="h-3 w-3" />
              High Intent Only
            </Button>
            
            <Select value={signalTypeFilter} onValueChange={(v) => setSignalTypeFilter(v as SignalTypeFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Signal Type" />
              </SelectTrigger>
              <SelectContent className="bg-background border">
                {SIGNAL_TYPE_FILTERS.map((filter) => (
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
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="amount">Biggest Funding</SelectItem>
                <SelectItem value="intent">Highest Intent</SelectItem>
              </SelectContent>
            </Select>
            
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
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSignals.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Globe className="h-12 w-12 text-muted-foreground mb-4" />
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
                      onBullhornNote={handleBullhornNote}
                      bullhornLoading={bullhornLoading[signal.id] || false}
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
    </AppLayout>
  );
}

interface SignalCardProps {
  signal: Signal;
  onDismiss: (id: string) => void;
  onTAContacts: (signal: Signal) => void;
  onCVMatches: (signal: Signal) => void;
  onBullhornNote: (signal: Signal) => void;
  bullhornLoading?: boolean;
}

function SignalCard({ signal, onDismiss, onTAContacts, onCVMatches, onBullhornNote, bullhornLoading }: SignalCardProps) {
  const intentStars = getIntentStars(signal);
  const regionConfig = REGION_CONFIG[signal.region as Region];
  
  return (
    <Card className={`transition-all hover:shadow-md ${signal.is_high_intent ? "border-primary/50 bg-primary/5" : ""}`}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Left: Signal Icon */}
          <div className={`flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center ${SIGNAL_TYPE_COLORS[signal.signal_type || "funding"]}`}>
            {SIGNAL_TYPE_ICONS[signal.signal_type || "funding"] || <Building2 className="h-5 w-5" />}
          </div>
          
          {/* Middle: Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-base leading-tight line-clamp-2">
                  {signal.company && (
                    <span className="text-primary">{signal.company}</span>
                  )}
                  {signal.company && " — "}
                  {signal.title}
                </h3>
                
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {regionConfig?.emoji} {regionConfig?.label}
                  </Badge>
                  
                  {signal.signal_type && (
                    <Badge className={`text-xs ${SIGNAL_TYPE_COLORS[signal.signal_type]}`}>
                      {SIGNAL_TYPE_LABELS[signal.signal_type] || signal.signal_type.replace("_", " ")}
                    </Badge>
                  )}
                  
                  {signal.amount && (
                    <Badge variant="secondary" className="text-xs font-bold">
                      {formatAmount(signal.amount, signal.currency)}
                    </Badge>
                  )}
                  
                  {signal.is_high_intent && (
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      HIGH INTENT
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Intent Stars */}
              <div className="flex-shrink-0 text-warning">
                {"⭐".repeat(intentStars)}
              </div>
            </div>
            
            {signal.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                "{signal.description}"
              </p>
            )}
            
            {/* Meta & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {signal.published_at 
                    ? formatDistanceToNow(new Date(signal.published_at), { addSuffix: true })
                    : "Recently"
                  }
                </span>
                {signal.source && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {signal.source}
                  </span>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-xs gap-1"
                  onClick={() => onTAContacts(signal)}
                >
                  <UserSearch className="h-3 w-3" />
                  TA Contacts
                </Button>
                
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-xs gap-1"
                  onClick={() => onCVMatches(signal)}
                >
                  <FileText className="h-3 w-3" />
                  CV Matches
                </Button>
                
                <Button 
                  size="sm" 
                  variant={signal.bullhorn_note_added ? "default" : "outline"}
                  className={`h-8 text-xs gap-1 ${signal.bullhorn_note_added ? "bg-green-600 hover:bg-green-700" : ""}`}
                  onClick={() => onBullhornNote(signal)}
                  disabled={bullhornLoading}
                >
                  {bullhornLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : signal.bullhorn_note_added ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Briefcase className="h-3 w-3" />
                  )}
                  {signal.bullhorn_note_added ? "Added" : "Bullhorn"}
                </Button>
                
                {signal.url && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0"
                    asChild
                  >
                    <a href={signal.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
                
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => onDismiss(signal.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
