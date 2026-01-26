import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface RoleSuggestionsProps {
  suggestions: string[];
  selectedRoles: string[];
  onAddRole: (role: string) => void;
  onAddAll: () => void;
}

export function RoleSuggestions({
  suggestions,
  selectedRoles,
  onAddRole,
  onAddAll,
}: RoleSuggestionsProps) {
  // Filter out already selected roles
  const availableSuggestions = suggestions.filter(
    (s) => !selectedRoles.includes(s)
  );

  if (availableSuggestions.length === 0) return null;

  return (
    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Lightbulb className="h-4 w-4" />
          Suggested Roles
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddAll}
          className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
        >
          Add all
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {availableSuggestions.map((role) => (
          <Badge
            key={role}
            variant="outline"
            className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors text-xs"
            onClick={() => onAddRole(role)}
          >
            + {role}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Based on the CV and selected industries. Click to add.
      </p>
    </div>
  );
}
