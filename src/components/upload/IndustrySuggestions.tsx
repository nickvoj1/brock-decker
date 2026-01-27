import { Lightbulb, Sparkles, Building2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IndustrySuggestionsProps {
  industrySuggestions: string[];
  sectorSuggestions: string[];
  selectedIndustries: string[];
  selectedSectors: string[];
  onAddIndustry: (industry: string) => void;
  onAddSector: (sector: string) => void;
  onAddAllIndustries: () => void;
  onAddAllSectors: () => void;
  confidence?: "high" | "medium" | "low";
  matchedCompanies?: string[];
}

export function IndustrySuggestions({
  industrySuggestions,
  sectorSuggestions,
  selectedIndustries,
  selectedSectors,
  onAddIndustry,
  onAddSector,
  onAddAllIndustries,
  onAddAllSectors,
  confidence = "medium",
  matchedCompanies = [],
}: IndustrySuggestionsProps) {
  // Filter out already selected items
  const availableIndustries = industrySuggestions.filter(
    (s) => !selectedIndustries.includes(s)
  );
  const availableSectors = sectorSuggestions.filter(
    (s) => !selectedSectors.includes(s)
  );

  if (availableIndustries.length === 0 && availableSectors.length === 0) {
    return null;
  }

  const confidenceConfig = {
    high: {
      icon: Sparkles,
      label: "High confidence match",
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-500/10 border-green-500/20",
    },
    medium: {
      icon: Lightbulb,
      label: "Suggested based on CV",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    low: {
      icon: AlertCircle,
      label: "Limited CV data - suggestions may be broad",
      color: "text-muted-foreground",
      bg: "bg-muted/50 border-muted",
    },
  };

  const config = confidenceConfig[confidence];
  const Icon = config.icon;

  return (
    <div className={cn("p-3 border rounded-lg space-y-3", config.bg)}>
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-2 text-sm font-medium", config.color)}>
          <Icon className="h-4 w-4" />
          {config.label}
        </div>
        {confidence === "high" && (
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30">
            Precise
          </Badge>
        )}
      </div>

      {matchedCompanies.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span>Matched: {matchedCompanies.slice(0, 3).join(", ")}{matchedCompanies.length > 3 ? ` +${matchedCompanies.length - 3} more` : ""}</span>
        </div>
      )}

      {availableIndustries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Industries</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddAllIndustries}
              className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
            >
              Add all
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableIndustries.map((industry) => (
              <Badge
                key={industry}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors text-xs"
                onClick={() => onAddIndustry(industry)}
              >
                + {industry}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {availableSectors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Sectors</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddAllSectors}
              className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
            >
              Add all
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableSectors.map((sector) => (
              <Badge
                key={sector}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors text-xs"
                onClick={() => onAddSector(sector)}
              >
                + {sector}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Click suggestions to add them to your search criteria.
      </p>
    </div>
  );
}
