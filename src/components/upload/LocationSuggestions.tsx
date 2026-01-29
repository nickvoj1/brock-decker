import { Lightbulb, MapPin, Globe, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface LocationSuggestionsProps {
  locationSuggestions: string[];
  countrySuggestions: string[];
  selectedLocations: string[];
  confidence: "high" | "medium" | "low";
  reasoning: string[];
  onAddLocation: (location: string) => void;
  onAddAllLocations: () => void;
}

// Helper to get display label for a location
const getLocationLabel = (value: string): string => {
  // Map of location values to display labels
  const labels: Record<string, string> = {
    "london": "London",
    "manchester": "Manchester",
    "birmingham": "Birmingham",
    "edinburgh": "Edinburgh",
    "glasgow": "Glasgow",
    "leeds": "Leeds",
    "bristol": "Bristol",
    "cambridge": "Cambridge",
    "oxford": "Oxford",
    "dublin": "Dublin",
    "cork": "Cork",
    "galway": "Galway",
    "frankfurt": "Frankfurt",
    "berlin": "Berlin",
    "munich": "Munich",
    "hamburg": "Hamburg",
    "dusseldorf": "Düsseldorf",
    "cologne": "Cologne",
    "stuttgart": "Stuttgart",
    "paris": "Paris",
    "lyon": "Lyon",
    "marseille": "Marseille",
    "nice": "Nice",
    "toulouse": "Toulouse",
    "amsterdam": "Amsterdam",
    "rotterdam": "Rotterdam",
    "the-hague": "The Hague",
    "eindhoven": "Eindhoven",
    "zurich": "Zurich",
    "geneva": "Geneva",
    "basel": "Basel",
    "bern": "Bern",
    "brussels": "Brussels",
    "antwerp": "Antwerp",
    "luxembourg-city": "Luxembourg City",
    "madrid": "Madrid",
    "barcelona": "Barcelona",
    "valencia": "Valencia",
    "seville": "Seville",
    "milan": "Milan",
    "rome": "Rome",
    "turin": "Turin",
    "florence": "Florence",
    "lisbon": "Lisbon",
    "porto": "Porto",
    "vienna": "Vienna",
    "stockholm": "Stockholm",
    "gothenburg": "Gothenburg",
    "oslo": "Oslo",
    "copenhagen": "Copenhagen",
    "helsinki": "Helsinki",
    "warsaw": "Warsaw",
    "krakow": "Krakow",
    "singapore": "Singapore",
    "hong-kong": "Hong Kong",
    "tokyo": "Tokyo",
    "osaka": "Osaka",
    "sydney": "Sydney",
    "melbourne": "Melbourne",
    "brisbane": "Brisbane",
    "perth": "Perth",
    "mumbai": "Mumbai",
    "bangalore": "Bangalore",
    "delhi": "Delhi",
    "shanghai": "Shanghai",
    "beijing": "Beijing",
    "shenzhen": "Shenzhen",
    "seoul": "Seoul",
    "dubai": "Dubai",
    "abu-dhabi": "Abu Dhabi",
    "tel-aviv": "Tel Aviv",
    "riyadh": "Riyadh",
    "toronto": "Toronto",
    "vancouver": "Vancouver",
    "montreal": "Montreal",
    "calgary": "Calgary",
    "ottawa": "Ottawa",
    "new-york": "New York",
    "los-angeles": "Los Angeles",
    "chicago": "Chicago",
    "houston": "Houston",
    "san-francisco": "San Francisco",
    "boston": "Boston",
    "miami": "Miami",
    "dallas": "Dallas",
    "seattle": "Seattle",
    "denver": "Denver",
    "atlanta": "Atlanta",
    "austin": "Austin",
    "washington-dc": "Washington DC",
    "phoenix": "Phoenix",
    "philadelphia": "Philadelphia",
    "san-diego": "San Diego",
    "charlotte": "Charlotte",
    "san-jose": "San Jose",
    "minneapolis": "Minneapolis",
    "detroit": "Detroit",
    "mexico-city": "Mexico City",
    "sao-paulo": "São Paulo",
    "rio": "Rio de Janeiro",
  };
  
  return labels[value] || value;
};

export function LocationSuggestions({
  locationSuggestions,
  countrySuggestions,
  selectedLocations,
  confidence,
  reasoning,
  onAddLocation,
  onAddAllLocations,
}: LocationSuggestionsProps) {
  // Filter out already selected locations
  const availableLocations = locationSuggestions.filter(
    (loc) => !selectedLocations.includes(loc)
  );
  
  const availableCountries = countrySuggestions.filter(
    (country) => !selectedLocations.includes(country)
  );

  if (availableLocations.length === 0 && availableCountries.length === 0) return null;

  const confidenceColor = {
    high: "text-green-600 bg-green-50 border-green-200",
    medium: "text-yellow-600 bg-yellow-50 border-yellow-200",
    low: "text-gray-600 bg-gray-50 border-gray-200",
  };

  return (
    <div className="p-3 bg-blue-50/50 border border-blue-200/50 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
            <MapPin className="h-4 w-4" />
            Suggested Locations
          </div>
          <Badge 
            variant="outline" 
            className={cn("text-xs", confidenceColor[confidence])}
          >
            {confidence} confidence
          </Badge>
          {reasoning.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1 hover:bg-blue-100 rounded-full transition-colors">
                  <Info className="h-3.5 w-3.5 text-blue-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-medium text-xs">Analysis reasoning:</p>
                  <ul className="text-xs space-y-0.5">
                    {reasoning.map((reason, i) => (
                      <li key={i}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddAllLocations}
          className="h-7 px-2 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-100"
        >
          Add all
        </Button>
      </div>
      
      {/* Countries (broader) */}
      {availableCountries.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="h-3 w-3" />
            Countries (broader search)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableCountries.map((country) => (
              <Badge
                key={country}
                variant="outline"
                className="cursor-pointer hover:bg-blue-100 hover:border-blue-400 transition-colors text-xs bg-blue-50/50"
                onClick={() => onAddLocation(country)}
              >
                <Globe className="h-3 w-3 mr-1 text-blue-500" />
                + {country}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {/* Cities (more targeted) */}
      {availableLocations.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            Cities (targeted search)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableLocations.map((location) => (
              <Badge
                key={location}
                variant="outline"
                className="cursor-pointer hover:bg-blue-100 hover:border-blue-400 transition-colors text-xs"
                onClick={() => onAddLocation(location)}
              >
                + {getLocationLabel(location)}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        Based on candidate's work history and industry. Click to add.
      </p>
    </div>
  );
}
