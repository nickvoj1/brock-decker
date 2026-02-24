import { memo, useState } from "react";
import { 
  ExternalLink, 
  UserSearch, 
  FileText, 
  Lightbulb,
  Target,
  Sparkles,
  Loader2,
  Trash2,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Signal } from "@/lib/signalsApi";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SignalTableViewProps {
  signals: Signal[];
  onDismiss: (id: string) => void;
  onTAContacts: (signal: Signal) => void;
  onCVMatches: (signal: Signal) => void;
  onRetrain?: (signal: Signal) => void;
  taSearchLoading: Record<string, boolean>;
  onSignalUpdated?: (signal: Signal) => void;
}

const TIER_DOT: Record<string, string> = {
  tier_1: "bg-red-500",
  tier_2: "bg-amber-500",
  tier_3: "bg-emerald-500",
};

const TYPE_LABELS: Record<string, string> = {
  funding: "Fund Close / Raise",
  hiring: "Hiring",
  expansion: "Expansion",
  c_suite: "C-Suite Move",
  team_growth: "Team Growth",
};

function formatAmount(amount: number | null, currency: string | null): string {
  if (!amount) return "—";
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  if (amount >= 1000) return `${symbol}${(amount / 1000).toFixed(1)}B`;
  return `${symbol}${amount}M`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

// Extract fund name from description or title
function extractFundName(signal: Signal): string {
  const desc = signal.description || "";
  // If description contains "•" split and take first part (fund name before key people)
  if (desc.includes("•")) {
    return desc.split("•")[0].trim();
  }
  // Common patterns: "Fund VI", etc.
  const text = `${signal.title} ${desc}`;
  const fundMatch = text.match(/(?:Fund\s+[IVXLCDM]+|Fund\s+\d+|[A-Z][a-z]+\s+[IVXLCDM]+\s+(?:Fund|Capital|Partners))/i);
  if (fundMatch) return fundMatch[0];
  if (desc && desc.length < 80) return desc;
  return signal.title.length < 60 ? signal.title : signal.title.slice(0, 57) + "...";
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

function cleanFirmCandidate(value: string): string {
  return value
    .replace(/\b(?:market|buyouts?|shop|latest|manager|debut|bn|million|billion|fund|for)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeNoisyFirm(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (v.length > 55) return true;
  if (/\d/.test(v)) return true;

  const lower = v.toLowerCase();
  const banned = [
    "market",
    "buyout",
    "shop",
    "latest",
    "manager",
    "debut",
    "bn",
    "million",
    "billion",
    "for ",
  ];
  if (banned.some((w) => lower.includes(w))) return true;

  // Very low-quality values tend to be all lowercase phrase fragments.
  if (v === lower && v.split(" ").length >= 2) return true;

  return false;
}

function resolveFirmName(signal: Signal): string {
  const rawCompany = (signal.company || "").trim();
  const cleanedCompany = cleanFirmCandidate(rawCompany);

  if (
    cleanedCompany &&
    cleanedCompany.toLowerCase() !== "unknown" &&
    !looksLikeNoisyFirm(cleanedCompany)
  ) {
    return cleanedCompany;
  }

  const inferred = cleanFirmCandidate(inferCompanyFromTitle(signal.title) || "");
  if (inferred && !looksLikeNoisyFirm(inferred)) return inferred;

  // Last fallback: first capitalized token group in title
  const fallbackMatch = signal.title.match(/\b([A-Z][A-Za-z0-9&'.-]{1,})(?:\s+[A-Z][A-Za-z0-9&'.-]{1,}){0,2}\b/);
  if (fallbackMatch?.[0]) return fallbackMatch[0];

  return "Unknown";
}

function SignalRow({ signal, onDismiss, onTAContacts, onCVMatches, taSearchLoading, onSignalUpdated }: {
  signal: Signal;
  onDismiss: (id: string) => void;
  onTAContacts: (signal: Signal) => void;
  onCVMatches: (signal: Signal) => void;
  taSearchLoading: boolean;
  onSignalUpdated?: (signal: Signal) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const tierDot = TIER_DOT[signal.tier || "tier_2"] || TIER_DOT.tier_2;
  const typeLabel = TYPE_LABELS[signal.signal_type || ""] || signal.signal_type || "Signal";
  const hasInsight = Boolean(signal.ai_insight || signal.ai_pitch);
  const firmName = resolveFirmName(signal);

  const handleEnrichAI = async () => {
    setEnriching(true);
    try {
      const { error } = await supabase.functions.invoke("enrich-signal-ai", {
        body: { signalIds: [signal.id] },
      });
      if (error) throw error;
      const { data: updated } = await supabase
        .from("signals")
        .select("*")
        .eq("id", signal.id)
        .single();
      if (updated && onSignalUpdated) onSignalUpdated(updated as Signal);
    } catch (e) {
      console.error("Failed to enrich:", e);
    } finally {
      setEnriching(false);
    }
  };

  const copyRow = () => {
    const text = [
      formatDate(signal.published_at),
      firmName,
      typeLabel,
      formatAmount(signal.amount, signal.currency),
      extractFundName(signal),
      signal.region?.toUpperCase() || "",
      signal.source || "",
    ].join("\t");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <tr 
        className="bg-white border-b border-[#d9d9dc] hover:bg-[#f7f7f8] transition-colors cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Tier Dot */}
        <td className="py-3 px-3 w-8">
          <div className={`h-2.5 w-2.5 rounded-full ${tierDot}`} title={signal.tier || "Unknown"} />
        </td>
        {/* Date */}
        <td className="py-3 px-3 text-xs text-[#4b5563] whitespace-nowrap tabular-nums font-mono-ui">
          {formatDate(signal.published_at)}
        </td>
        {/* Firm */}
        <td className="py-3 px-3">
          <span className="text-sm font-semibold text-[#1f2937]">
            {firmName}
          </span>
        </td>
        {/* Type */}
        <td className="py-3 px-3">
          <Badge variant="outline" className="text-xs font-medium text-[#374151] border-[#d9d9dc] bg-[#f8f8f9]">
            {typeLabel}
          </Badge>
        </td>
        {/* Amount */}
        <td className="py-3 px-3 text-sm font-semibold text-[#1f2937] whitespace-nowrap tabular-nums">
          {formatAmount(signal.amount, signal.currency)}
        </td>
        {/* Fund / Key Detail */}
        <td className="py-3 px-3 text-sm text-[#4b5563] max-w-[220px] truncate" title={signal.title}>
          {extractFundName(signal)}
        </td>
        {/* Region */}
        <td className="py-3 px-3 text-xs font-medium text-[#4b5563] whitespace-nowrap font-mono-ui">
          {signal.region?.toUpperCase() || "—"}
        </td>
        {/* Source */}
        <td className="py-3 px-3 text-xs text-[#4b5563] truncate max-w-[100px]">
          {signal.source ? (
            signal.url ? (
              <a href={signal.url} target="_blank" rel="noopener noreferrer" className="text-[#4b5563] hover:text-primary flex items-center gap-1 transition-colors" onClick={e => e.stopPropagation()}>
                {signal.source}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : signal.source
          ) : "—"}
        </td>
        {/* Actions */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => onTAContacts(signal)} disabled={taSearchLoading}>
              {taSearchLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><UserSearch className="h-3 w-3" />TA</>}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={copyRow} title="Copy row">
              {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#6b7280] hover:text-destructive" onClick={() => onDismiss(signal.id)} title="Dismiss">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </td>
      </tr>
      {/* Expanded Detail Row */}
      {expanded && (
        <tr className="bg-white">
          <td colSpan={9} className="p-4">
            <div className="space-y-3 max-w-4xl">
              {/* Title / Headline */}
              <div>
                <p className="text-sm font-medium text-foreground">{signal.title}</p>
                {signal.description && signal.description !== signal.title && (
                  <p className="text-sm text-muted-foreground mt-1">{signal.description}</p>
                )}
              </div>
              
              {/* AI Insight */}
              {hasInsight ? (
                <div className="space-y-2">
                  {signal.ai_insight && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3 border border-amber-200/50 dark:border-amber-800/30">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-900 dark:text-amber-100">{signal.ai_insight}</p>
                      </div>
                    </div>
                  )}
                  {signal.ai_pitch && (
                    <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                      <div className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground">{signal.ai_pitch}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={handleEnrichAI} disabled={enriching} className="text-xs">
                  {enriching ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  Generate AI Insight
                </Button>
              )}
              
              {/* Action Row - only CV Match (TA is in hover row) */}
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => onCVMatches(signal)} className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  CV Match {signal.cv_matches > 0 && `(${signal.cv_matches})`}
                </Button>
                {signal.url && (
                  <a href={signal.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost" className="text-xs">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Source
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export const SignalTableView = memo(function SignalTableView({
  signals,
  onDismiss,
  onTAContacts,
  onCVMatches,
  onRetrain,
  taSearchLoading,
  onSignalUpdated,
}: SignalTableViewProps) {
  return (
    <div className="overflow-auto rounded-xl border border-[#d5d7db] bg-white">
      <table className="signals-flat-table w-full text-sm bg-white">
        <thead>
          <tr className="border-b border-[#d9d9dc] bg-white">
            <th className="py-3 px-3 w-8" />
            <th className="py-3 px-3 text-left text-[11px] font-mono-ui font-semibold tracking-[0.08em] uppercase text-[#4b5563]">Date</th>
            <th className="py-3 px-3 text-left text-[11px] font-mono-ui font-semibold tracking-[0.08em] uppercase text-[#4b5563]">Firm</th>
            <th className="py-3 px-3 text-left text-[11px] font-mono-ui font-semibold tracking-[0.08em] uppercase text-[#4b5563]">Type</th>
            <th className="py-3 px-3 text-left text-[11px] font-mono-ui font-semibold tracking-[0.08em] uppercase text-[#4b5563]">Amount</th>
            <th className="py-3 px-3 text-left text-[11px] font-mono-ui font-semibold tracking-[0.08em] uppercase text-[#4b5563]">Fund / Detail</th>
            <th className="py-3 px-3 text-left text-[11px] font-mono-ui font-semibold tracking-[0.08em] uppercase text-[#4b5563]">Region</th>
            <th className="py-3 px-3 text-left text-[11px] font-mono-ui font-semibold tracking-[0.08em] uppercase text-[#4b5563]">Source</th>
            <th className="py-3 px-3 w-32" />
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => (
            <SignalRow
              key={signal.id}
              signal={signal}
              onDismiss={onDismiss}
              onTAContacts={onTAContacts}
              onCVMatches={onCVMatches}
              taSearchLoading={taSearchLoading[signal.id] || false}
              onSignalUpdated={onSignalUpdated}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});
