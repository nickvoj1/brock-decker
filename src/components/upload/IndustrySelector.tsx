import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

const INDUSTRIES = [
  { value: "sell-side", label: "Sell Side" },
  { value: "buy-side", label: "Buy Side" },
  { value: "m-and-a", label: "M&A" },
  { value: "private-equity", label: "Private Equity (PE)" },
  { value: "venture-capital", label: "Venture Capital (VC)" },
  { value: "hedge-fund", label: "Hedge Fund" },
  { value: "investment-banking", label: "Investment Banking" },
  { value: "asset-management", label: "Asset Management" },
  { value: "wealth-management", label: "Wealth Management" },
  { value: "equity-research", label: "Equity Research" },
  { value: "fixed-income", label: "Fixed Income" },
  { value: "restructuring", label: "Restructuring" },
  { value: "leveraged-finance", label: "Leveraged Finance" },
  { value: "capital-markets", label: "Capital Markets" },
  { value: "corporate-finance", label: "Corporate Finance" },
  { value: "real-estate", label: "Real Estate" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "credit", label: "Credit" },
];

interface IndustrySelectorProps {
  selectedIndustries: string[];
  onSelectionChange: (industries: string[]) => void;
}

export function IndustrySelector({
  selectedIndustries,
  onSelectionChange,
}: IndustrySelectorProps) {
  const [open, setOpen] = useState(false);

  const toggleIndustry = (value: string) => {
    if (selectedIndustries.includes(value)) {
      onSelectionChange(selectedIndustries.filter((i) => i !== value));
    } else {
      onSelectionChange([...selectedIndustries, value]);
    }
  };

  const removeIndustry = (value: string) => {
    onSelectionChange(selectedIndustries.filter((i) => i !== value));
  };

  const getLabel = (value: string) => {
    return INDUSTRIES.find((i) => i.value === value)?.label || value;
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        Target Industries
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 px-3 py-2"
          >
            <span className="text-muted-foreground">
              {selectedIndustries.length === 0
                ? "Search and select industries..."
                : `${selectedIndustries.length} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search industries..." />
            <CommandList>
              <CommandEmpty>No industry found.</CommandEmpty>
              <CommandGroup>
                {INDUSTRIES.map((industry) => (
                  <CommandItem
                    key={industry.value}
                    value={industry.label}
                    onSelect={() => toggleIndustry(industry.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedIndustries.includes(industry.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {industry.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedIndustries.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {selectedIndustries.map((value) => (
            <Badge
              key={value}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {getLabel(value)}
              <button
                onClick={() => removeIndustry(value)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Select target industries for candidate enrichment
      </p>
    </div>
  );
}
