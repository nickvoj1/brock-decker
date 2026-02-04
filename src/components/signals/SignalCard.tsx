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
    color: "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400",
    dotColor: "bg-red-500",
  },
  tier_2: { 
    label: "Tier 2", 
    color: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400",
    dotColor: "bg-amber-500",
  },
  tier_3: { 
    label: "Tier 3", 
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
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

const SECTOR_COLORS: Record<string, string> = {
  "PE": "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  "VC": "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  "Bank": "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  "FinTech": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  "Consultancy": "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  "Secondaries": "bg-pink-500/10 text-pink-700 dark:text-pink-400",
  "Credit": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  "Infra": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "Hedge Fund": "bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

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
  const sectorColor = sector ? SECTOR_COLORS[sector] : null;
  
  // Determine if signal needs validation
  const isPending = !signal.user_feedback && !signal.validated_region;
  const isValidated = signal.validated_region && signal.validated_region !== 'REJECTED';
  const isRejected = signal.validated_region === 'REJECTED';
  
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
    <Card className="group border-border/40 hover:border-primary/30 transition-all duration-200 hover:shadow-md overflow-hidden">
      <CardContent className="p-0">
        {/* Tier indicator bar */}
        <div className={`h-1 w-full ${tierConfig.dotColor}`} />
        
        <div className="p-4 space-y-3">
          {/* Top Row: Company + Badges + Dismiss */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {signal.company && (
                  <h3 className="text-base font-semibold text-foreground truncate">
                    {signal.company}
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
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 dark:text-orange-400 text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                )}
                {isValidated && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400 text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    Validated
                  </Badge>
                )}
                {sector && sectorColor && (
                  <Badge variant="secondary" className={`${sectorColor} border-0 text-xs font-medium`}>
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
                  <Badge variant="outline" className="text-xs text-muted-foreground">
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
              className="w-full flex items-center justify-between text-left py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
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
              className="w-full flex items-center justify-between text-left py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
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
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3 border border-amber-200/50 dark:border-amber-800/30">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
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
            <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200/50 dark:border-orange-800/30">
              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              <span className="text-xs text-orange-800 dark:text-orange-200 flex-1">
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
          <div className="flex items-center justify-between pt-1 border-t border-border/30">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {onRetrain && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRetrain(signal)}
                  className="h-8 w-8 p-0"
                  title="Train AI on this signal"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              
              <Button
                size="sm"
                variant="default"
                onClick={() => onTAContacts(signal)}
                disabled={taSearchLoading}
                className="h-8 text-xs"
              >
                {taSearchLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <UserSearch className="h-3 w-3 mr-1" />
                    TA Contacts
                    {signal.contacts_found > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] bg-white/20">
                        {signal.contacts_found}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCVMatches(signal)}
                className="h-8 text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                CV Match
                {signal.cv_matches > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {signal.cv_matches}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
