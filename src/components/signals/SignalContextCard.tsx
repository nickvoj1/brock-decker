import { ExternalLink, Building2, MapPin, TrendingUp, Sparkles, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SignalContextProps {
  signalTitle: string;
  company: string;
  region: string;
  amount?: number;
  currency?: string;
  signalType?: string;
  onClear?: () => void;
}

export function SignalContextCard({
  signalTitle,
  company,
  region,
  amount,
  currency,
  signalType,
  onClear,
}: SignalContextProps) {
  const formatAmount = () => {
    if (!amount || !currency) return null;
    const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
    return amount >= 1000 
      ? `${symbol}${(amount / 1000).toFixed(1)}B` 
      : `${symbol}${amount}M`;
  };

  const formatSignalType = (type: string) => {
    const typeLabels: Record<string, string> = {
      fund_close: "Fund Close",
      new_fund: "New Fund",
      deal: "Deal/Acquisition",
      exit: "Exit",
      expansion: "Expansion",
      senior_hire: "Senior Hire",
    };
    return typeLabels[type] || type.replace(/_/g, " ");
  };

  const regionLabels: Record<string, string> = {
    europe: "Europe",
    uae: "UAE/Middle East",
    east_usa: "East Coast USA",
    west_usa: "West Coast USA",
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Signal-Based Search</CardTitle>
          </div>
          {onClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CardDescription className="text-sm leading-snug">
          Finding contacts at this company based on the signal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Company */}
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">{company}</span>
        </div>

        {/* Signal Title */}
        <p className="text-sm text-muted-foreground leading-snug">{signalTitle}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {signalType && (
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              {formatSignalType(signalType)}
            </Badge>
          )}
          <Badge variant="outline" className="gap-1">
            <MapPin className="h-3 w-3" />
            {regionLabels[region] || region}
          </Badge>
          {formatAmount() && (
            <Badge className="bg-success/20 text-success hover:bg-success/30">
              {formatAmount()}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
