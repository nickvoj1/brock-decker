import { memo, useState } from "react";
import { 
  ExternalLink, 
  X, 
  UserSearch, 
  FileText, 
  TrendingUp,
  DollarSign,
  Users,
  Globe,
  MapPin,
  Loader2,
  Lightbulb,
  Target,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Sparkles,
  RotateCcw,
  Check,
  AlertCircle,
  XCircle,
  Trash2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Signal, submitSignalFeedback } from "@/lib/signalsApi";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProfileName } from "@/hooks/useProfileName";
import { SignalFeedbackModal } from "./SignalFeedbackModal";
import { SignalDismissModal } from "./SignalDismissModal";

interface SignalCardProps {
  signal: Signal;
  onDismiss: (id: string) => void;
  onTAContacts: (signal: Signal) => void;
  onCVMatches: (signal: Signal) => void;
  onRetrain?: (signal: Signal) => void;
  taSearchLoading: boolean;
  onSignalUpdated?: (signal: Signal) => void;
  onFeedback?: (signalId: string, action: 'APPROVE' | 'REJECT_NORDIC' | 'REJECT_WRONG_REGION') => void;
}

const TIER_CONFIG = {
  tier_1: { 
    label: "Tier 1", 
    color: "bg-primary/10 text-primary border-primary/30",
    dotColor: "bg-primary",
  },
  tier_2: { 
    label: "Tier 2", 
    color: "bg-muted/70 text-foreground/75 border-border/60",
    dotColor: "bg-foreground/45",
  },
  tier_3: { 
    label: "Tier 3", 
    color: "bg-muted/50 text-muted-foreground border-border/50",
    dotColor: "bg-foreground/25",
  },
};

const SIGNAL_TYPE_ICONS: Record<string, React.ReactNode> = {
  funding: <DollarSign className="h-3.5 w-3.5" />,
  hiring: <Users className="h-3.5 w-3.5" />,
  expansion: <Globe className="h-3.5 w-3.5" />,
  c_suite: <Users className="h-3.5 w-3.5" />,
  team_growth: <UserSearch className="h-3.5 w-3.5" />,
};

// Sector detection for badges
const SECTOR_KEYWORDS: Record<string, string[]> = {
  "PE": ["private equity", "pe fund", "buyout", "lbo", "leveraged buyout", "growth equity", "portco", "portfolio company", "mid-market"],
  "VC": ["venture capital", "vc fund", "seed fund", "series a", "series b", "series c", "early stage", "growth stage", "startup"],
  "Bank": ["investment bank", "merchant bank", "bulge bracket", "m&a advisory", "capital markets", "corporate finance", "goldman sachs", "morgan stanley", "jpmorgan", "jp morgan", "barclays", "hsbc", "deutsche bank", "ubs", "lazard", "rothschild", "evercore", "moelis", "centerview", "pjt partners"],
  "FinTech": ["fintech", "financial technology", "payments", "neobank", "digital bank", "insurtech", "wealthtech", "regtech", "proptech", "lending platform"],
  "Consultancy": ["mckinsey", "bain", "boston consulting", "bcg", "kearney", "oliver wyman", "roland berger", "strategy&", "pwc", "deloitte", "kpmg", "ey ", "ernst & young", "accenture", "alvarez & marsal", "fti consulting"],
  "Secondaries": ["secondaries", "secondary fund", "secondary market", "gp-led", "lp-led", "continuation fund", "continuation vehicle"],
  "Credit": ["credit fund", "debt fund", "direct lending", "mezzanine", "distressed debt", "leveraged finance"],
  "Infra": ["infrastructure fund", "infra fund", "real assets", "renewable energy fund"],
  "Hedge Fund": ["hedge fund", "macro fund", "quant fund", "multi-strategy"],
};

const SECTOR_BADGE_CLASS = "bg-muted/55 text-foreground/75 border border-border/60";

function detectSector(signal: { title: string; description?: string | null; company?: string | null }): string | null {
  const text = `${signal.title} ${signal.description || ""} ${signal.company || ""}`.toLowerCase();
  
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return sector;
    }
  }
  return null;
}

function formatAmount(amount: number | null, currency: string | null): string {
  if (!amount) return "";
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  if (amount >= 1000) {
    return `${symbol}${(amount / 1000).toFixed(1)}B`;
  }
  return `${symbol}${amount}M`;
}

function formatSignalType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, l => l.toUpperCase());
}

function inferCompanyFromTitle(title: string): string | null {
  const cleaned = title
    .replace(/^(breaking|exclusive|update|report|news|watch):\s*/i, "")
    .trim();

  const patterns = [
    /^([A-Z][A-Za-z0-9&'().,\-\s]{1,60}?)\s+(?:raises|raised|closes|closed|acquires|acquired|announces|announced|appoints|appointed|hires|hired|merges|merged|sells|sold|backs|backed|secures|secured|launches|launched)\b/i,
    /^([A-Z][A-Za-z0-9&'().,\-\s]{1,60}?)\s+(?:to|has|is)\b/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim().replace(/\s+/g, " ");
      if (candidate.length >= 2 && candidate.length <= 60) {
        return candidate;
      }
    }
  }

  return null;
}

function resolveFirmName(signal: Signal): string {
  const raw = (signal.company || "").trim();
  const lowered = raw.toLowerCase();
  const noisy =
    !raw ||
    lowered === "unknown" ||
    /\d/.test(raw) ||
    /\b(market|buyout|shop|latest|manager|debut|bn|million|billion)\b/i.test(raw) ||
    raw.length > 55;

  if (!noisy) return raw;
  return inferCompanyFromTitle(signal.title) || "Unknown";
}

export const SignalCard = memo(function SignalCard({
  signal,
  onDismiss,
  onTAContacts,
  onCVMatches,
  onRetrain,
  taSearchLoading,
  onSignalUpdated,
  onFeedback,
}: SignalCardProps) {
  const profileName = useProfileName();
  const [showInsight, setShowInsight] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  
  const tierConfig = TIER_CONFIG[signal.tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.tier_2;
  const signalIcon = SIGNAL_TYPE_ICONS[signal.signal_type || ""] || <Briefcase className="h-3.5 w-3.5" />;
  const hasAIInsight = Boolean(signal.ai_insight || signal.ai_pitch);
  const sector = detectSector(signal);
  const firmName = resolveFirmName(signal);
  
  // Determine if signal needs validation
  const isPending = !signal.user_feedback && !signal.validated_region;
  const isValidated = signal.validated_region && signal.validated_region !== 'REJECTED';
  
  // Extract location from details if available
  const location = (signal.details as Record<string, unknown>)?.location as string | undefined;
  const positions = (signal.details as Record<string, unknown>)?.positions as string | undefined;
  
  const handleEnrichAI = async () => {
    setEnriching(true);
    try {
      const { error } = await supabase.functions.invoke("enrich-signal-ai", {
        body: { signalIds: [signal.id] },
      });
      
      if (error) throw error;
      
      // Fetch updated signal
      const { data: updated } = await supabase
        .from("signals")
        .select("*")
        .eq("id", signal.id)
        .single();
      
      if (updated && onSignalUpdated) {
        onSignalUpdated(updated as Signal);
      }
    } catch (e) {
      console.error("Failed to enrich signal:", e);
    } finally {
      setEnriching(false);
    }
  };

  const handleFeedback = async (action: 'APPROVE' | 'REJECT_NORDIC' | 'REJECT_WRONG_REGION') => {
    if (!profileName) return;
    
    setFeedbackLoading(true);
    try {
      const result = await submitSignalFeedback(signal.id, action, profileName);
      if (result.success) {
        // Update local signal state
        const updatedSignal = {
          ...signal,
          user_feedback: action,
          validated_region: action === 'APPROVE' ? signal.region?.toUpperCase() : 'REJECTED',
        };
        if (onSignalUpdated) {
          onSignalUpdated(updatedSignal);
        }
        if (onFeedback) {
          onFeedback(signal.id, action);
        }
        toast.success(action === 'APPROVE' ? "Signal approved" : "Signal rejected - added to self-learning");
      }
    } catch (e) {
      console.error("Feedback error:", e);
      toast.error("Failed to submit feedback");
    } finally {
      setFeedbackLoading(false);
    }
  };
  
  return (
    <Card className="group overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-sm transition-all duration-200 hover:border-border/85 hover:shadow-md">
      <CardContent className="p-0">
        {/* Tier indicator bar */}
        <div className={`h-1 w-full ${tierConfig.dotColor}`} />
        
        <div className="p-5 space-y-4">
          {/* Top Row: Company + Badges + Dismiss */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {firmName && firmName !== "Unknown" && (
                  <h3 className="text-base font-semibold text-foreground truncate">
                    {firmName}
                  </h3>
                )}
                {signal.amount && (
                  <Badge className="bg-primary/10 text-primary border-0 font-medium">
                    {formatAmount(signal.amount, signal.currency)}
                  </Badge>
                )}
              </div>
              
              {/* Badge Row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Status Badge - Pending/Validated */}
                {isPending && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-600/35 text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                )}
                {isValidated && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-600/35 text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    Validated
                  </Badge>
                )}
                {sector && (
                  <Badge variant="secondary" className={`${SECTOR_BADGE_CLASS} text-xs font-medium`}>
                    {sector}
                  </Badge>
                )}
                <Badge variant="outline" className={`${tierConfig.color} text-xs`}>
                  {tierConfig.label}
                </Badge>
                {signal.signal_type && (
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                    {signalIcon}
                    <span>{formatSignalType(signal.signal_type)}</span>
                  </Badge>
                )}
                {/* AI Confidence */}
                {signal.ai_confidence !== undefined && signal.ai_confidence > 0 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground border-border/60 font-mono-ui">
                    {signal.ai_confidence}% conf
                  </Badge>
                )}
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              onClick={() => setDismissModalOpen(true)}
              title="Dismiss signal"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Title/Headline */}
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {signal.title}
          </p>
          
          {/* Location & Positions (if available from job scraping) */}
          {(location || positions) && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {location && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {location}
                </span>
              )}
              {positions && (
                <span className="text-muted-foreground truncate max-w-[300px]">
                  <strong>Roles:</strong> {positions}
                </span>
              )}
            </div>
          )}
          
          {/* AI Insight Toggle */}
          {hasAIInsight ? (
            <button
              className="w-full flex items-center justify-between text-left py-2 px-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
              onClick={() => setShowInsight(!showInsight)}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                AI Insight
              </span>
              {showInsight ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <button
              className="w-full flex items-center justify-between text-left py-2 px-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors disabled:opacity-50"
              onClick={handleEnrichAI}
              disabled={enriching}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                {enriching ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
                {enriching ? "Generating..." : "Generate AI Insight"}
              </span>
            </button>
          )}
          
          {/* AI Insight Content */}
          {showInsight && hasAIInsight && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              {signal.ai_insight && (
                <div className="rounded-lg border border-amber-300/45 bg-amber-50/70 p-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground leading-relaxed">
                      {signal.ai_insight}
                    </p>
                  </div>
                </div>
              )}
              
              {signal.ai_pitch && (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <div className="flex items-start gap-2">
                    <Target className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground leading-relaxed">
                      {signal.ai_pitch}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Pending Signal Action Row - Simple Approve/Reject */}
          {isPending && (
            <div className="flex items-center gap-2 p-2 rounded-lg border border-amber-300/40 bg-amber-50/55">
              <AlertCircle className="h-4 w-4 text-amber-700 flex-shrink-0" />
              <span className="text-xs text-foreground/85 flex-1">
                Is this a good signal for {signal.region?.toUpperCase()}?
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFeedback('APPROVE')}
                  disabled={feedbackLoading}
                  className="h-7 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                >
                  {feedbackLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                  Good ✓
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFeedbackModalOpen(true)}
                  disabled={feedbackLoading}
                  className="h-7 text-xs bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Bad ✗
                </Button>
              </div>
            </div>
          )}
          
          {/* Feedback Modal for Comments */}
          <SignalFeedbackModal
            open={feedbackModalOpen}
            onOpenChange={setFeedbackModalOpen}
            signal={signal}
            profileName={profileName || "Unknown"}
            onFeedbackSubmitted={(signalId, isApproved, newRegion) => {
              const updatedSignal = {
                ...signal,
                user_feedback: isApproved ? 'APPROVE' : 'REJECT',
                validated_region: isApproved ? signal.region?.toUpperCase() : (newRegion ? newRegion.toUpperCase() : 'REJECTED'),
                region: newRegion || signal.region,
              };
              if (onSignalUpdated) {
                onSignalUpdated(updatedSignal);
              }
            }}
          />
          
          {/* Dismiss Modal with Feedback */}
          <SignalDismissModal
            open={dismissModalOpen}
            onOpenChange={setDismissModalOpen}
            signal={signal}
            profileName={profileName || "Unknown"}
            onDismissed={(signalId) => {
              onDismiss(signalId);
            }}
          />
          
          {/* Meta & Source */}
          <div className="flex items-center justify-between pt-2 border-t border-border/20">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Signal</span>
              {signal.source && (
                <span className="truncate max-w-[120px]">{signal.source}</span>
              )}
              {signal.published_at && (
                <span>
                  {formatDistanceToNow(new Date(signal.published_at), { addSuffix: true })}
                </span>
              )}
              {signal.url && (
                <a
                  href={signal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Link
                </a>
              )}
            </div>
            
            {/* Action Buttons - consolidated */}
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="default"
                onClick={() => onTAContacts(signal)}
                disabled={taSearchLoading}
                className="h-7 text-xs"
              >
                {taSearchLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <UserSearch className="h-3 w-3 mr-1" />
                    TA {signal.contacts_found > 0 && `(${signal.contacts_found})`}
                  </>
                )}
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCVMatches(signal)}
                className="h-7 text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                CV {signal.cv_matches > 0 && `(${signal.cv_matches})` }
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
