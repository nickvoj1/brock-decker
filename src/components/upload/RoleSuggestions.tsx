import { Lightbulb, Users, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RoleSuggestionsProps {
  suggestions: string[];
  selectedRoles: string[];
  confidence?: "high" | "medium" | "low";
  reasoning?: string[];
  onAddRole: (role: string) => void;
  onAddAll: () => void;
}

export function RoleSuggestions({
  suggestions,
  selectedRoles,
  confidence = "medium",
  reasoning = [],
  onAddRole,
  onAddAll,
}: RoleSuggestionsProps) {
  // Filter out already selected roles
  const availableSuggestions = suggestions.filter(
    (s) => !selectedRoles.includes(s)
  );

  if (availableSuggestions.length === 0) return null;

  const confidenceColor = {
    high: "text-green-600 bg-green-50 border-green-200",
    medium: "text-yellow-600 bg-yellow-50 border-yellow-200",
    low: "text-gray-600 bg-gray-50 border-gray-200",
  };

  return (
    <div className="p-3 bg-purple-50/50 border border-purple-200/50 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
            <Users className="h-4 w-4" />
            Suggested Target Contacts
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
                <button className="p-1 hover:bg-purple-100 rounded-full transition-colors">
                  <Info className="h-3.5 w-3.5 text-purple-500" />
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
          onClick={onAddAll}
          className="h-7 px-2 text-xs text-purple-700 hover:text-purple-800 hover:bg-purple-100"
        >
          Add all
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {availableSuggestions.map((role) => (
          <Badge
            key={role}
            variant="outline"
            className="cursor-pointer hover:bg-purple-100 hover:border-purple-400 transition-colors text-xs"
            onClick={() => onAddRole(role)}
          >
            + {role}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Target contacts based on candidate seniority & industry. Click to add.
      </p>
    </div>
  );
}
