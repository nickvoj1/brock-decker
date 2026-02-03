import { memo } from "react";
import { 
  ExternalLink, 
  X, 
  UserSearch, 
  FileText, 
  Briefcase,
  TrendingUp,
  DollarSign,
  Users,
  Globe,
  Clock,
  Check,
  Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Signal } from "@/lib/signalsApi";
import { formatDistanceToNow } from "date-fns";

interface SignalCardProps {
  signal: Signal;
  onDismiss: (id: string) => void;
  onTAContacts: (signal: Signal) => void;
  onCVMatches: (signal: Signal) => void;
  onBullhornNote: (signal: Signal) => void;
  bullhornLoading: boolean;
  taSearchLoading: boolean;
}

const TIER_CONFIG = {
  tier_1: { 
    label: "Tier 1", 
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    description: "Immediate Intent"
  },
  tier_2: { 
    label: "Tier 2", 
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    description: "Medium Intent"
  },
  tier_3: { 
    label: "Tier 3", 
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    description: "Early Interest"
  },
};

const SIGNAL_TYPE_ICONS: Record<string, React.ReactNode> = {
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

function formatAmount(amount: number | null, currency: string | null): string {
  if (!amount) return "";
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  if (amount >= 1000) {
    return `${symbol}${(amount / 1000).toFixed(1)}B`;
  }
  return `${symbol}${amount}M`;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-red-600 bg-red-500/10";
  if (score >= 50) return "text-amber-600 bg-amber-500/10";
  return "text-green-600 bg-green-500/10";
}

export const SignalCard = memo(function SignalCard({
  signal,
  onDismiss,
  onTAContacts,
  onCVMatches,
  onBullhornNote,
  bullhornLoading,
  taSearchLoading,
}: SignalCardProps) {
  const tierConfig = TIER_CONFIG[signal.tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.tier_2;
  const signalIcon = SIGNAL_TYPE_ICONS[signal.signal_type || ""] || <Briefcase className="h-4 w-4" />;
  
  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Score indicator */}
          <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center ${getScoreColor(signal.score)}`}>
            <span className="text-lg font-bold">{signal.score}</span>
          </div>
          
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                {signal.company && (
                  <span className="font-semibold text-foreground">{signal.company}</span>
                )}
                <Badge variant="outline" className={tierConfig.color}>
                  {tierConfig.label}
                </Badge>
                {signal.signal_type && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {signalIcon}
                    <span className="text-xs">{signal.signal_type.replace(/_/g, " ")}</span>
                  </Badge>
                )}
                {signal.amount && (
                  <Badge variant="outline" className="bg-primary/5">
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
            
            <h3 className="text-sm font-medium text-foreground mb-1 line-clamp-2">
              {signal.title}
            </h3>
            
            {signal.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {signal.description}
              </p>
            )}
            
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
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
            
            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onTAContacts(signal)}
                disabled={taSearchLoading}
                className="h-7 text-xs"
              >
                {taSearchLoading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <UserSearch className="h-3 w-3 mr-1" />
                )}
                TA Contacts
                {signal.contacts_found > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {signal.contacts_found}
                  </Badge>
                )}
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCVMatches(signal)}
                className="h-7 text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                CV Matches
                {signal.cv_matches > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {signal.cv_matches}
                  </Badge>
                )}
              </Button>
              
              <Button
                size="sm"
                variant={signal.bullhorn_note_added ? "secondary" : "outline"}
                onClick={() => onBullhornNote(signal)}
                disabled={bullhornLoading || signal.bullhorn_note_added}
                className="h-7 text-xs"
              >
                {bullhornLoading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : signal.bullhorn_note_added ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <Briefcase className="h-3 w-3 mr-1" />
                )}
                Bullhorn
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
