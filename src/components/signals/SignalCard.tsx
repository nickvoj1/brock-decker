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
  Clock,
  Loader2,
  Lightbulb,
  Target,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Sparkles
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Signal } from "@/lib/signalsApi";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
interface SignalCardProps {
  signal: Signal;
  onDismiss: (id: string) => void;
  onTAContacts: (signal: Signal) => void;
  onCVMatches: (signal: Signal) => void;
  taSearchLoading: boolean;
  onSignalUpdated?: (signal: Signal) => void;
}

const TIER_CONFIG = {
  tier_1: { 
    label: "Tier 1", 
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    description: "Immediate Intent",
    bgGradient: "from-red-500/5 to-transparent"
  },
  tier_2: { 
    label: "Tier 2", 
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    description: "Medium Intent",
    bgGradient: "from-amber-500/5 to-transparent"
  },
  tier_3: { 
    label: "Tier 3", 
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    description: "Early Interest",
    bgGradient: "from-green-500/5 to-transparent"
  },
};

const SIGNAL_TYPE_ICONS: Record<string, React.ReactNode> = {
  funding: <DollarSign className="h-4 w-4" />,
  hiring: <Users className="h-4 w-4" />,
  expansion: <Globe className="h-4 w-4" />,
  c_suite: <Users className="h-4 w-4" />,
  team_growth: <UserSearch className="h-4 w-4" />,
  pe_vc_investment: <DollarSign className="h-4 w-4" />,
  fundraise_lbo: <TrendingUp className="h-4 w-4" />,
  acquisition: <Briefcase className="h-4 w-4" />,
  new_ceo_cfo_chro: <Users className="h-4 w-4" />,
  new_fund_launch: <TrendingUp className="h-4 w-4" />,
  portfolio_hiring: <Users className="h-4 w-4" />,
  rapid_job_postings: <Users className="h-4 w-4" />,
  new_recruiter: <UserSearch className="h-4 w-4" />,
  office_expansion: <Globe className="h-4 w-4" />,
  senior_churn: <Users className="h-4 w-4" />,
  product_launch: <Briefcase className="h-4 w-4" />,
  linkedin_hiring_posts: <Users className="h-4 w-4" />,
  careers_page_refresh: <FileText className="h-4 w-4" />,
  industry_events: <Globe className="h-4 w-4" />,
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
  "PE": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "VC": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "Bank": "bg-slate-500/10 text-slate-600 border-slate-500/20",
  "FinTech": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  "Consultancy": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "Secondaries": "bg-pink-500/10 text-pink-600 border-pink-500/20",
  "Credit": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  "Infra": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "Hedge Fund": "bg-violet-500/10 text-violet-600 border-violet-500/20",
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
  taSearchLoading,
  onSignalUpdated,
}: SignalCardProps) {
  const [showInsight, setShowInsight] = useState(false);
  const [enriching, setEnriching] = useState(false);
  
  const tierConfig = TIER_CONFIG[signal.tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.tier_2;
  const signalIcon = SIGNAL_TYPE_ICONS[signal.signal_type || ""] || <Briefcase className="h-4 w-4" />;
  const hasAIInsight = Boolean(signal.ai_insight || signal.ai_pitch);
  const sector = detectSector(signal);
  const sectorColor = sector ? SECTOR_COLORS[sector] : null;
  
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
  
  return (
    <Card className={`border-border/50 hover:border-border transition-all overflow-hidden`}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header row: Company + Tier + Amount + Dismiss */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {signal.company && (
                <span className="font-bold text-lg text-foreground">{signal.company}</span>
              )}
              {sector && sectorColor && (
                <Badge variant="outline" className={sectorColor}>
                  {sector}
                </Badge>
              )}
              <Badge variant="outline" className={tierConfig.color}>
                {tierConfig.label}
              </Badge>
              {signal.signal_type && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  {signalIcon}
                  <span className="text-xs">{formatSignalType(signal.signal_type)}</span>
                </Badge>
              )}
              {signal.amount && (
                <Badge variant="outline" className="bg-primary/5 font-semibold">
                  {formatAmount(signal.amount, signal.currency)}
                </Badge>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={() => onDismiss(signal.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Original headline */}
          <h3 className="text-sm text-muted-foreground line-clamp-2">
            {signal.title}
          </h3>
          
          {/* AI Insight Toggle Button - always show, either expand or trigger enrichment */}
          {hasAIInsight ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-left h-auto py-2 px-3 bg-muted/50 hover:bg-muted"
              onClick={() => setShowInsight(!showInsight)}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                AI Insight
              </span>
              {showInsight ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-left h-auto py-2 px-3 bg-muted/50 hover:bg-muted"
              onClick={handleEnrichAI}
              disabled={enriching}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {enriching ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                ) : (
                  <Sparkles className="h-4 w-4 text-amber-500" />
                )}
                {enriching ? "Generating AI Insight..." : "Generate AI Insight"}
              </span>
            </Button>
          )}
          
          {/* AI Insight Content - Only shown when expanded */}
          {showInsight && hasAIInsight && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              {signal.ai_insight && (
                <div className="bg-background/50 rounded-lg p-3 border border-border/50">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {signal.ai_insight}
                    </p>
                  </div>
                </div>
              )}
              
              {signal.ai_pitch && (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                  <div className="flex items-start gap-2">
                    <Target className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-primary font-medium leading-relaxed">
                      {signal.ai_pitch}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Meta info row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {signal.source && <span>{signal.source}</span>}
            {signal.published_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
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
                Source
              </a>
            )}
          </div>
          
          {/* Actions - Only Find TA Contacts and CV Matches */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Button
              size="sm"
              variant="default"
              onClick={() => onTAContacts(signal)}
              disabled={taSearchLoading}
              className="h-8"
            >
              {taSearchLoading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <UserSearch className="h-3 w-3 mr-1" />
              )}
              Find TA Contacts
              {signal.contacts_found > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {signal.contacts_found}
                </Badge>
              )}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCVMatches(signal)}
              className="h-8"
            >
              <FileText className="h-3 w-3 mr-1" />
              CV Matches
              {signal.cv_matches > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {signal.cv_matches}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
