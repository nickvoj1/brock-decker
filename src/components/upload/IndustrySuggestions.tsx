import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface IndustrySuggestionsProps {
  industrySuggestions: string[];
  sectorSuggestions: string[];
  selectedIndustries: string[];
  selectedSectors: string[];
  onAddIndustry: (industry: string) => void;
  onAddSector: (sector: string) => void;
  onAddAllIndustries: () => void;
  onAddAllSectors: () => void;
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

  return (
    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Lightbulb className="h-4 w-4" />
        Suggested based on CV
      </div>

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
