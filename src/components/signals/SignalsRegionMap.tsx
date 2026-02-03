import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface RegionMapProps {
  regionCounts: Record<string, number>;
  activeRegion: string;
  onRegionClick: (region: string) => void;
}

const REGION_POSITIONS = {
  london: { x: "42%", y: "25%", label: "London" },
  europe: { x: "50%", y: "35%", label: "Europe" },
  uae: { x: "65%", y: "50%", label: "UAE" },
  usa: { x: "20%", y: "35%", label: "USA" },
};

export function SignalsRegionMap({ regionCounts, activeRegion, onRegionClick }: RegionMapProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Signal Locations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-[150px] bg-muted/20 rounded-lg overflow-hidden">
          {/* Simple world map placeholder with regions */}
          <svg viewBox="0 0 100 60" className="w-full h-full opacity-20">
            <path 
              d="M10 25 Q20 20 35 25 T55 30 Q60 35 70 30 T90 35" 
              stroke="currentColor" 
              fill="none" 
              strokeWidth="0.5"
            />
            <path 
              d="M15 35 Q25 40 40 35 T60 40 Q70 45 80 40" 
              stroke="currentColor" 
              fill="none" 
              strokeWidth="0.5"
            />
          </svg>
          
          {Object.entries(REGION_POSITIONS).map(([region, pos]) => {
            const count = regionCounts[region] || 0;
            const isActive = region === activeRegion;
            
            return (
              <button
                key={region}
                onClick={() => onRegionClick(region)}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
                  isActive ? "scale-110" : "hover:scale-105"
                }`}
                style={{ left: pos.x, top: pos.y }}
              >
                <div className={`flex flex-col items-center ${isActive ? "opacity-100" : "opacity-70"}`}>
                  <div className={`relative ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    <MapPin className="h-5 w-5" />
                    {count > 0 && (
                      <span className={`absolute -top-1 -right-1 text-[10px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full ${
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted-foreground text-background"
                      }`}>
                        {count}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {pos.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
