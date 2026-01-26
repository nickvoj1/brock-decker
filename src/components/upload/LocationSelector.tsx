import { useState } from "react";
import { Check, ChevronsUpDown, X, MapPin } from "lucide-react";
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

const LOCATIONS = [
  // Major US Cities
  { value: "new-york", label: "New York, NY", country: "USA" },
  { value: "los-angeles", label: "Los Angeles, CA", country: "USA" },
  { value: "chicago", label: "Chicago, IL", country: "USA" },
  { value: "houston", label: "Houston, TX", country: "USA" },
  { value: "san-francisco", label: "San Francisco, CA", country: "USA" },
  { value: "boston", label: "Boston, MA", country: "USA" },
  { value: "miami", label: "Miami, FL", country: "USA" },
  { value: "dallas", label: "Dallas, TX", country: "USA" },
  { value: "seattle", label: "Seattle, WA", country: "USA" },
  { value: "denver", label: "Denver, CO", country: "USA" },
  { value: "atlanta", label: "Atlanta, GA", country: "USA" },
  { value: "austin", label: "Austin, TX", country: "USA" },
  // Major UK Cities
  { value: "london", label: "London", country: "UK" },
  { value: "manchester", label: "Manchester", country: "UK" },
  { value: "birmingham", label: "Birmingham", country: "UK" },
  { value: "edinburgh", label: "Edinburgh", country: "UK" },
  // Major European Cities
  { value: "paris", label: "Paris", country: "France" },
  { value: "berlin", label: "Berlin", country: "Germany" },
  { value: "frankfurt", label: "Frankfurt", country: "Germany" },
  { value: "amsterdam", label: "Amsterdam", country: "Netherlands" },
  { value: "zurich", label: "Zurich", country: "Switzerland" },
  { value: "dublin", label: "Dublin", country: "Ireland" },
  { value: "madrid", label: "Madrid", country: "Spain" },
  { value: "milan", label: "Milan", country: "Italy" },
  // Asia Pacific
  { value: "singapore", label: "Singapore", country: "Singapore" },
  { value: "hong-kong", label: "Hong Kong", country: "Hong Kong" },
  { value: "tokyo", label: "Tokyo", country: "Japan" },
  { value: "sydney", label: "Sydney", country: "Australia" },
  { value: "melbourne", label: "Melbourne", country: "Australia" },
  { value: "dubai", label: "Dubai", country: "UAE" },
  // Canada
  { value: "toronto", label: "Toronto", country: "Canada" },
  { value: "vancouver", label: "Vancouver", country: "Canada" },
  { value: "montreal", label: "Montreal", country: "Canada" },
];

interface LocationSelectorProps {
  selectedLocations: string[];
  onSelectionChange: (locations: string[]) => void;
}

export function LocationSelector({
  selectedLocations,
  onSelectionChange,
}: LocationSelectorProps) {
  const [open, setOpen] = useState(false);

  const toggleLocation = (value: string) => {
    if (selectedLocations.includes(value)) {
      onSelectionChange(selectedLocations.filter((l) => l !== value));
    } else {
      onSelectionChange([...selectedLocations, value]);
    }
  };

  const removeLocation = (value: string) => {
    onSelectionChange(selectedLocations.filter((l) => l !== value));
  };

  const getLabel = (value: string) => {
    return LOCATIONS.find((l) => l.value === value)?.label || value;
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        Target Locations
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
              {selectedLocations.length === 0
                ? "Search and select locations..."
                : `${selectedLocations.length} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search locations..." />
            <CommandList>
              <CommandEmpty>No location found.</CommandEmpty>
              <CommandGroup heading="USA">
                {LOCATIONS.filter(l => l.country === "USA").map((location) => (
                  <CommandItem
                    key={location.value}
                    value={location.label}
                    onSelect={() => toggleLocation(location.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedLocations.includes(location.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {location.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="UK">
                {LOCATIONS.filter(l => l.country === "UK").map((location) => (
                  <CommandItem
                    key={location.value}
                    value={location.label}
                    onSelect={() => toggleLocation(location.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedLocations.includes(location.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {location.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Europe">
                {LOCATIONS.filter(l => ["France", "Germany", "Netherlands", "Switzerland", "Ireland", "Spain", "Italy"].includes(l.country)).map((location) => (
                  <CommandItem
                    key={location.value}
                    value={location.label}
                    onSelect={() => toggleLocation(location.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedLocations.includes(location.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {location.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Asia Pacific">
                {LOCATIONS.filter(l => ["Singapore", "Hong Kong", "Japan", "Australia", "UAE"].includes(l.country)).map((location) => (
                  <CommandItem
                    key={location.value}
                    value={location.label}
                    onSelect={() => toggleLocation(location.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedLocations.includes(location.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {location.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Canada">
                {LOCATIONS.filter(l => l.country === "Canada").map((location) => (
                  <CommandItem
                    key={location.value}
                    value={location.label}
                    onSelect={() => toggleLocation(location.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedLocations.includes(location.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {location.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedLocations.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {selectedLocations.map((value) => (
            <Badge
              key={value}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {getLabel(value)}
              <button
                onClick={() => removeLocation(value)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Select locations where you want to find hiring contacts
      </p>
    </div>
  );
}
