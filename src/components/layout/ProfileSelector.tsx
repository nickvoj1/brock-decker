import { useState, useEffect } from "react";
import { User, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const PROFILE_NAMES = [
  "Denis Radchenko",
  "Arthur Lots",
  "Rudolf Rakiss",
  "Arturs Salcevich",
  "Nick Bulmeistar",
  "Rainer Grote",
  "Vadzim Valasevich",
];

const PROFILE_NAME_KEY = "apollo-search-profile-name";

interface ProfileSelectorProps {
  onProfileChange?: (name: string) => void;
}

export function ProfileSelector({ onProfileChange }: ProfileSelectorProps) {
  const [selectedProfile, setSelectedProfile] = useState<string>(() => {
    return localStorage.getItem(PROFILE_NAME_KEY) || "";
  });
  const [isOpen, setIsOpen] = useState(!selectedProfile);

  useEffect(() => {
    if (selectedProfile) {
      localStorage.setItem(PROFILE_NAME_KEY, selectedProfile);
      onProfileChange?.(selectedProfile);
    }
  }, [selectedProfile, onProfileChange]);

  // Auto-open dropdown if no profile selected
  useEffect(() => {
    if (!selectedProfile) {
      setIsOpen(true);
    }
  }, [selectedProfile]);

  const handleSelect = (name: string) => {
    setSelectedProfile(name);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={selectedProfile ? "outline" : "default"}
          size="sm"
          className="gap-2"
        >
          <User className="h-4 w-4" />
          <span className="max-w-[120px] truncate">
            {selectedProfile || "Select Profile"}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        {PROFILE_NAMES.map((name) => (
          <DropdownMenuItem
            key={name}
            onClick={() => handleSelect(name)}
            className="flex items-center justify-between"
          >
            <span>{name}</span>
            {selectedProfile === name && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
