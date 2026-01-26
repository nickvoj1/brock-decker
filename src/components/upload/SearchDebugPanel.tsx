import { useState } from "react";
import { ChevronDown, ChevronUp, Bug, MapPin, Building2, Users, Hash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SearchDebugPanelProps {
  selectedIndustries: string[];
  selectedSectors: string[];
  selectedLocations: string[];
  selectedRoles: string[];
  maxContacts: number;
  candidateName?: string;
}

export function SearchDebugPanel({
  selectedIndustries,
  selectedSectors,
  selectedLocations,
  selectedRoles,
  maxContacts,
  candidateName,
}: SearchDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasAnySelection = 
    selectedIndustries.length > 0 || 
    selectedSectors.length > 0 || 
    selectedLocations.length > 0 || 
    selectedRoles.length > 0;

  if (!hasAnySelection) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-muted/30 border-dashed">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto hover:bg-muted/50"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bug className="h-4 w-4" />
              <span className="text-sm font-medium">Search Debug Panel</span>
              {candidateName && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {candidateName}
                </Badge>
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            {/* Max Contacts */}
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Max Contacts:</span>
              <Badge variant="secondary">{maxContacts}</Badge>
            </div>

            {/* Locations */}
            {selectedLocations.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Locations ({selectedLocations.length}):
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 ml-6">
                  {selectedLocations.map((loc) => (
                    <Badge key={loc} variant="outline" className="text-xs">
                      {loc}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Industries */}
            {selectedIndustries.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Industries ({selectedIndustries.length}):
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 ml-6">
                  {selectedIndustries.map((ind) => (
                    <Badge key={ind} variant="outline" className="text-xs">
                      {ind}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Sectors */}
            {selectedSectors.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Sectors ({selectedSectors.length}):
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 ml-6">
                  {selectedSectors.map((sec) => (
                    <Badge key={sec} variant="secondary" className="text-xs">
                      {sec}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Roles */}
            {selectedRoles.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Target Roles ({selectedRoles.length}):
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 ml-6">
                  {selectedRoles.map((role) => (
                    <Badge key={role} variant="outline" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Apollo Query Preview */}
            <div className="mt-4 p-3 bg-background rounded-md border text-xs font-mono space-y-1">
              <div className="text-muted-foreground mb-2">Apollo Query Preview:</div>
              <div><span className="text-primary">person_locations:</span> [{selectedLocations.map(l => `"${l}"`).join(", ")}]</div>
              <div><span className="text-primary">person_titles:</span> [{selectedRoles.map(r => `"${r}"`).join(", ")}]</div>
              {selectedSectors.length > 0 && (
                <div><span className="text-primary">organization_industries:</span> [{selectedSectors.map(s => `"${s}"`).join(", ")}]</div>
              )}
              <div><span className="text-primary">q_keywords:</span> "{selectedIndustries.join(" OR ")}"</div>
              <div><span className="text-primary">per_page:</span> {Math.min(maxContacts, 100)}</div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
