import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, X, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Industry {
  value: string;
  label: string;
}

interface IndustryCategory {
  name: string;
  industries: Industry[];
}

const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  {
    name: "Investment & Asset Management",
    industries: [
      { value: "private-equity", label: "Private Equity (PE)" },
      { value: "venture-capital", label: "Venture Capital (VC)" },
      { value: "hedge-fund", label: "Hedge Fund" },
      { value: "asset-management", label: "Asset Management" },
      { value: "wealth-management", label: "Wealth Management" },
      { value: "family-office", label: "Family Office" },
      { value: "fund-of-funds", label: "Fund of Funds" },
      { value: "sovereign-wealth", label: "Sovereign Wealth Fund" },
      { value: "pension-fund", label: "Pension Fund" },
      { value: "endowment", label: "Endowment" },
    ],
  },
  {
    name: "Investment Banking",
    industries: [
      { value: "investment-banking", label: "Investment Banking" },
      { value: "m-and-a", label: "Mergers & Acquisitions (M&A)" },
      { value: "sell-side", label: "Sell Side" },
      { value: "buy-side", label: "Buy Side" },
      { value: "capital-markets", label: "Capital Markets" },
      { value: "equity-capital-markets", label: "Equity Capital Markets (ECM)" },
      { value: "debt-capital-markets", label: "Debt Capital Markets (DCM)" },
      { value: "leveraged-finance", label: "Leveraged Finance" },
      { value: "restructuring", label: "Restructuring" },
      { value: "ipo-advisory", label: "IPO Advisory" },
    ],
  },
  {
    name: "Trading & Research",
    industries: [
      { value: "equity-research", label: "Equity Research" },
      { value: "fixed-income", label: "Fixed Income" },
      { value: "sales-trading", label: "Sales & Trading" },
      { value: "quantitative-trading", label: "Quantitative Trading" },
      { value: "derivatives", label: "Derivatives" },
      { value: "commodities", label: "Commodities" },
      { value: "foreign-exchange", label: "Foreign Exchange (FX)" },
    ],
  },
  {
    name: "Corporate & Advisory",
    industries: [
      { value: "corporate-finance", label: "Corporate Finance" },
      { value: "corporate-development", label: "Corporate Development" },
      { value: "strategy-consulting", label: "Strategy Consulting" },
      { value: "management-consulting", label: "Management Consulting" },
      { value: "financial-advisory", label: "Financial Advisory" },
      { value: "transaction-advisory", label: "Transaction Advisory" },
      { value: "valuation-advisory", label: "Valuation Advisory" },
    ],
  },
  {
    name: "Credit & Lending",
    industries: [
      { value: "credit", label: "Credit" },
      { value: "private-credit", label: "Private Credit" },
      { value: "direct-lending", label: "Direct Lending" },
      { value: "distressed-debt", label: "Distressed Debt" },
      { value: "mezzanine", label: "Mezzanine Finance" },
      { value: "commercial-banking", label: "Commercial Banking" },
    ],
  },
  {
    name: "Real Assets",
    industries: [
      { value: "real-estate", label: "Real Estate" },
      { value: "real-estate-pe", label: "Real Estate Private Equity" },
      { value: "infrastructure", label: "Infrastructure" },
      { value: "infrastructure-pe", label: "Infrastructure PE" },
      { value: "natural-resources", label: "Natural Resources" },
      { value: "energy", label: "Energy" },
    ],
  },
  {
    name: "FinTech & Technology",
    industries: [
      { value: "fintech", label: "FinTech" },
      { value: "payments", label: "Payments" },
      { value: "blockchain-crypto", label: "Blockchain & Crypto" },
      { value: "insurtech", label: "InsurTech" },
      { value: "regtech", label: "RegTech" },
      { value: "wealthtech", label: "WealthTech" },
    ],
  },
  {
    name: "Insurance & Risk",
    industries: [
      { value: "insurance", label: "Insurance" },
      { value: "reinsurance", label: "Reinsurance" },
      { value: "risk-management", label: "Risk Management" },
      { value: "actuarial", label: "Actuarial" },
    ],
  },
];

// Flatten all industries for easy lookup
const ALL_INDUSTRIES = INDUSTRY_CATEGORIES.flatMap((cat) => cat.industries);

interface IndustrySelectorProps {
  selectedIndustries: string[];
  onSelectionChange: (industries: string[]) => void;
}

export function IndustrySelector({
  selectedIndustries,
  onSelectionChange,
}: IndustrySelectorProps) {
  const [open, setOpen] = useState(false);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('apollo-search-industries', JSON.stringify(selectedIndustries));
  }, [selectedIndustries]);

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

  const selectAllInCategory = (category: IndustryCategory) => {
    const categoryValues = category.industries.map((i) => i.value);
    const newSelection = [...new Set([...selectedIndustries, ...categoryValues])];
    onSelectionChange(newSelection);
  };

  const clearAllInCategory = (category: IndustryCategory) => {
    const categoryValues = new Set(category.industries.map((i) => i.value));
    onSelectionChange(selectedIndustries.filter((v) => !categoryValues.has(v)));
  };

  const isCategoryFullySelected = (category: IndustryCategory) => {
    return category.industries.every((i) => selectedIndustries.includes(i.value));
  };

  const isCategoryPartiallySelected = (category: IndustryCategory) => {
    return category.industries.some((i) => selectedIndustries.includes(i.value)) && 
           !isCategoryFullySelected(category);
  };

  const getLabel = (value: string) => {
    return ALL_INDUSTRIES.find((i) => i.value === value)?.label || value;
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Target Industries
        </label>
        {selectedIndustries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        )}
      </div>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 px-3 py-2"
          >
            <span className={selectedIndustries.length === 0 ? "text-muted-foreground" : ""}>
              {selectedIndustries.length === 0
                ? "Search and select industries..."
                : `${selectedIndustries.length} industr${selectedIndustries.length === 1 ? 'y' : 'ies'} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[450px] p-0 bg-popover" align="start" sideOffset={4}>
          <Command>
            <CommandInput placeholder="Search industries..." />
            <CommandList>
              <ScrollArea className="h-[350px]">
                <CommandEmpty>No industry found.</CommandEmpty>
                {INDUSTRY_CATEGORIES.map((category, catIndex) => (
                  <div key={category.name}>
                    {catIndex > 0 && <CommandSeparator />}
                    <CommandGroup
                      heading={
                        <div className="flex items-center justify-between pr-2">
                          <span>{category.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isCategoryFullySelected(category)) {
                                clearAllInCategory(category);
                              } else {
                                selectAllInCategory(category);
                              }
                            }}
                            className={cn(
                              "text-xs px-2 py-0.5 rounded hover:bg-accent transition-colors",
                              isCategoryFullySelected(category) 
                                ? "text-primary" 
                                : "text-muted-foreground"
                            )}
                          >
                            {isCategoryFullySelected(category) ? "Clear" : "Select all"}
                          </button>
                        </div>
                      }
                    >
                      {category.industries.map((industry) => (
                        <CommandItem
                          key={industry.value}
                          value={industry.label}
                          onSelect={() => toggleIndustry(industry.value)}
                          className="cursor-pointer"
                        >
                          <div className={cn(
                            "mr-2 h-4 w-4 border rounded flex items-center justify-center",
                            selectedIndustries.includes(industry.value)
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          )}>
                            {selectedIndustries.includes(industry.value) && (
                              <Check className="h-3 w-3" />
                            )}
                          </div>
                          {industry.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </div>
                ))}
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedIndustries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {selectedIndustries.map((value) => (
            <Badge
              key={value}
              variant="secondary"
              className="gap-1 pr-1 text-xs"
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
        Select industries to find hiring contacts in
      </p>
    </div>
  );
}
