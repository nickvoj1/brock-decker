import { useState } from "react";
import { Check, ChevronsUpDown, X, MapPin, Globe } from "lucide-react";
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

// Countries (for broader searches)
const COUNTRIES = [
  { value: "United Kingdom", label: "United Kingdom", region: "UK" },
  { value: "Ireland", label: "Ireland", region: "Europe" },
  { value: "Germany", label: "Germany", region: "Europe" },
  { value: "France", label: "France", region: "Europe" },
  { value: "Netherlands", label: "Netherlands", region: "Europe" },
  { value: "Switzerland", label: "Switzerland", region: "Europe" },
  { value: "Spain", label: "Spain", region: "Europe" },
  { value: "Italy", label: "Italy", region: "Europe" },
  { value: "Belgium", label: "Belgium", region: "Europe" },
  { value: "Austria", label: "Austria", region: "Europe" },
  { value: "Sweden", label: "Sweden", region: "Europe" },
  { value: "Norway", label: "Norway", region: "Europe" },
  { value: "Denmark", label: "Denmark", region: "Europe" },
  { value: "Finland", label: "Finland", region: "Europe" },
  { value: "Poland", label: "Poland", region: "Europe" },
  { value: "Portugal", label: "Portugal", region: "Europe" },
  { value: "Luxembourg", label: "Luxembourg", region: "Europe" },
  { value: "Singapore", label: "Singapore", region: "Asia Pacific" },
  { value: "Hong Kong", label: "Hong Kong", region: "Asia Pacific" },
  { value: "Japan", label: "Japan", region: "Asia Pacific" },
  { value: "Australia", label: "Australia", region: "Asia Pacific" },
  { value: "India", label: "India", region: "Asia Pacific" },
  { value: "China", label: "China", region: "Asia Pacific" },
  { value: "South Korea", label: "South Korea", region: "Asia Pacific" },
  { value: "UAE", label: "United Arab Emirates", region: "Middle East" },
  { value: "Israel", label: "Israel", region: "Middle East" },
  { value: "Saudi Arabia", label: "Saudi Arabia", region: "Middle East" },
  { value: "Canada", label: "Canada", region: "Canada" },
  { value: "United States", label: "United States", region: "USA" },
  { value: "Mexico", label: "Mexico", region: "Americas" },
  { value: "Brazil", label: "Brazil", region: "Americas" },
];

const LOCATIONS = [
  // UK Cities
  { value: "london", label: "London, United Kingdom", country: "UK" },
  { value: "manchester", label: "Manchester, United Kingdom", country: "UK" },
  { value: "birmingham", label: "Birmingham, United Kingdom", country: "UK" },
  { value: "edinburgh", label: "Edinburgh, United Kingdom", country: "UK" },
  { value: "glasgow", label: "Glasgow, United Kingdom", country: "UK" },
  { value: "leeds", label: "Leeds, United Kingdom", country: "UK" },
  { value: "bristol", label: "Bristol, United Kingdom", country: "UK" },
  { value: "cambridge", label: "Cambridge, United Kingdom", country: "UK" },
  { value: "oxford", label: "Oxford, United Kingdom", country: "UK" },
  
  // Ireland
  { value: "dublin", label: "Dublin, Ireland", country: "Ireland" },
  { value: "cork", label: "Cork, Ireland", country: "Ireland" },
  { value: "galway", label: "Galway, Ireland", country: "Ireland" },
  
  // Germany
  { value: "frankfurt", label: "Frankfurt, Germany", country: "Germany" },
  { value: "berlin", label: "Berlin, Germany", country: "Germany" },
  { value: "munich", label: "Munich, Germany", country: "Germany" },
  { value: "hamburg", label: "Hamburg, Germany", country: "Germany" },
  { value: "dusseldorf", label: "Düsseldorf, Germany", country: "Germany" },
  { value: "cologne", label: "Cologne, Germany", country: "Germany" },
  { value: "stuttgart", label: "Stuttgart, Germany", country: "Germany" },
  
  // France
  { value: "paris", label: "Paris, France", country: "France" },
  { value: "lyon", label: "Lyon, France", country: "France" },
  { value: "marseille", label: "Marseille, France", country: "France" },
  { value: "nice", label: "Nice, France", country: "France" },
  { value: "toulouse", label: "Toulouse, France", country: "France" },
  
  // Netherlands
  { value: "amsterdam", label: "Amsterdam, Netherlands", country: "Netherlands" },
  { value: "rotterdam", label: "Rotterdam, Netherlands", country: "Netherlands" },
  { value: "the-hague", label: "The Hague, Netherlands", country: "Netherlands" },
  { value: "eindhoven", label: "Eindhoven, Netherlands", country: "Netherlands" },
  
  // Switzerland
  { value: "zurich", label: "Zurich, Switzerland", country: "Switzerland" },
  { value: "geneva", label: "Geneva, Switzerland", country: "Switzerland" },
  { value: "basel", label: "Basel, Switzerland", country: "Switzerland" },
  { value: "bern", label: "Bern, Switzerland", country: "Switzerland" },
  
  // Belgium
  { value: "brussels", label: "Brussels, Belgium", country: "Belgium" },
  { value: "antwerp", label: "Antwerp, Belgium", country: "Belgium" },
  
  // Luxembourg
  { value: "luxembourg-city", label: "Luxembourg City, Luxembourg", country: "Luxembourg" },
  
  // Spain
  { value: "madrid", label: "Madrid, Spain", country: "Spain" },
  { value: "barcelona", label: "Barcelona, Spain", country: "Spain" },
  { value: "valencia", label: "Valencia, Spain", country: "Spain" },
  { value: "seville", label: "Seville, Spain", country: "Spain" },
  
  // Italy
  { value: "milan", label: "Milan, Italy", country: "Italy" },
  { value: "rome", label: "Rome, Italy", country: "Italy" },
  { value: "turin", label: "Turin, Italy", country: "Italy" },
  { value: "florence", label: "Florence, Italy", country: "Italy" },
  
  // Portugal
  { value: "lisbon", label: "Lisbon, Portugal", country: "Portugal" },
  { value: "porto", label: "Porto, Portugal", country: "Portugal" },
  
  // Austria
  { value: "vienna", label: "Vienna, Austria", country: "Austria" },
  
  // Nordics
  { value: "stockholm", label: "Stockholm, Sweden", country: "Sweden" },
  { value: "gothenburg", label: "Gothenburg, Sweden", country: "Sweden" },
  { value: "oslo", label: "Oslo, Norway", country: "Norway" },
  { value: "copenhagen", label: "Copenhagen, Denmark", country: "Denmark" },
  { value: "helsinki", label: "Helsinki, Finland", country: "Finland" },
  
  // Poland
  { value: "warsaw", label: "Warsaw, Poland", country: "Poland" },
  { value: "krakow", label: "Krakow, Poland", country: "Poland" },
  
  // Asia Pacific
  { value: "singapore", label: "Singapore", country: "Singapore" },
  { value: "hong-kong", label: "Hong Kong", country: "Hong Kong" },
  { value: "tokyo", label: "Tokyo, Japan", country: "Japan" },
  { value: "osaka", label: "Osaka, Japan", country: "Japan" },
  { value: "sydney", label: "Sydney, Australia", country: "Australia" },
  { value: "melbourne", label: "Melbourne, Australia", country: "Australia" },
  { value: "brisbane", label: "Brisbane, Australia", country: "Australia" },
  { value: "perth", label: "Perth, Australia", country: "Australia" },
  { value: "mumbai", label: "Mumbai, India", country: "India" },
  { value: "bangalore", label: "Bangalore, India", country: "India" },
  { value: "delhi", label: "Delhi, India", country: "India" },
  { value: "shanghai", label: "Shanghai, China", country: "China" },
  { value: "beijing", label: "Beijing, China", country: "China" },
  { value: "shenzhen", label: "Shenzhen, China", country: "China" },
  { value: "seoul", label: "Seoul, South Korea", country: "South Korea" },
  
  // Middle East
  { value: "dubai", label: "Dubai, UAE", country: "UAE" },
  { value: "abu-dhabi", label: "Abu Dhabi, UAE", country: "UAE" },
  { value: "tel-aviv", label: "Tel Aviv, Israel", country: "Israel" },
  { value: "riyadh", label: "Riyadh, Saudi Arabia", country: "Saudi Arabia" },
  
  // Canada
  { value: "toronto", label: "Toronto, Canada", country: "Canada" },
  { value: "vancouver", label: "Vancouver, Canada", country: "Canada" },
  { value: "montreal", label: "Montreal, Canada", country: "Canada" },
  { value: "calgary", label: "Calgary, Canada", country: "Canada" },
  { value: "ottawa", label: "Ottawa, Canada", country: "Canada" },
  
  // USA (at the end)
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
  { value: "washington-dc", label: "Washington, DC", country: "USA" },
  { value: "phoenix", label: "Phoenix, AZ", country: "USA" },
  { value: "philadelphia", label: "Philadelphia, PA", country: "USA" },
  { value: "san-diego", label: "San Diego, CA", country: "USA" },
  { value: "charlotte", label: "Charlotte, NC", country: "USA" },
  { value: "san-jose", label: "San Jose, CA", country: "USA" },
  { value: "minneapolis", label: "Minneapolis, MN", country: "USA" },
  { value: "detroit", label: "Detroit, MI", country: "USA" },
  
  // Latin America
  { value: "mexico-city", label: "Mexico City, Mexico", country: "Mexico" },
  { value: "sao-paulo", label: "São Paulo, Brazil", country: "Brazil" },
  { value: "rio", label: "Rio de Janeiro, Brazil", country: "Brazil" },
];

const EUROPEAN_COUNTRIES = ["UK", "Ireland", "Germany", "France", "Netherlands", "Switzerland", "Belgium", "Luxembourg", "Spain", "Italy", "Portugal", "Austria", "Sweden", "Norway", "Denmark", "Finland", "Poland"];
const APAC_COUNTRIES = ["Singapore", "Hong Kong", "Japan", "Australia", "India", "China", "South Korea"];
const MIDDLE_EAST_COUNTRIES = ["UAE", "Israel", "Saudi Arabia"];

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
    const location = LOCATIONS.find((l) => l.value === value);
    if (location) return location.label;
    const country = COUNTRIES.find((c) => c.value === value);
    if (country) return country.label;
    return value;
  };

  const isCountry = (value: string) => {
    return COUNTRIES.some((c) => c.value === value);
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
        <PopoverContent className="w-[400px] p-0 bg-popover z-50" align="start">
          <Command>
            <CommandInput placeholder="Search cities or countries..." />
            <CommandList className="max-h-[400px]">
              <CommandEmpty>No location found.</CommandEmpty>
              
              {/* Countries Section */}
              <CommandGroup heading="🌍 Countries (Broad Search)">
                {COUNTRIES.map((country) => (
                  <CommandItem
                    key={country.value}
                    value={`country-${country.label}`}
                    onSelect={() => toggleLocation(country.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedLocations.includes(country.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <Globe className="mr-2 h-3 w-3 text-muted-foreground" />
                    {country.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              
              {/* UK & Ireland Cities */}
              <CommandGroup heading="🇬🇧 UK & Ireland">
                {LOCATIONS.filter(l => l.country === "UK" || l.country === "Ireland").map((location) => (
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
              
              {/* Europe Cities */}
              <CommandGroup heading="🇪🇺 Europe">
                {LOCATIONS.filter(l => EUROPEAN_COUNTRIES.includes(l.country) && l.country !== "UK" && l.country !== "Ireland").map((location) => (
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
              
              {/* Asia Pacific */}
              <CommandGroup heading="🌏 Asia Pacific">
                {LOCATIONS.filter(l => APAC_COUNTRIES.includes(l.country)).map((location) => (
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
              
              {/* Middle East */}
              <CommandGroup heading="🌍 Middle East">
                {LOCATIONS.filter(l => MIDDLE_EAST_COUNTRIES.includes(l.country)).map((location) => (
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
              
              {/* Canada */}
              <CommandGroup heading="🇨🇦 Canada">
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
              
              {/* Latin America */}
              <CommandGroup heading="🌎 Latin America">
                {LOCATIONS.filter(l => l.country === "Mexico" || l.country === "Brazil").map((location) => (
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
              
              {/* USA (at the end) */}
              <CommandGroup heading="🇺🇸 USA">
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
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedLocations.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {selectedLocations.map((value) => (
            <Badge
              key={value}
              variant={isCountry(value) ? "default" : "secondary"}
              className="gap-1 pr-1"
            >
              {isCountry(value) && <Globe className="h-3 w-3 mr-1" />}
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
        Select countries for broad searches or specific cities for targeted results
      </p>
    </div>
  );
}
