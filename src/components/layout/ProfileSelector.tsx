import { useState, useEffect } from "react";
import { User, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const PROFILE_NAMES = [
  "Denis Radchenko",
  "Arthur Lots",
  "Rudolf Rakiss",
  "Arturs Salcevich",
  "Nick Bulmeistar",
  "Rainer Grote",
  "Vadzim Valasevich",
  "Nikita Vojevoda",
];

const PROFILE_NAME_KEY = "apollo-search-profile-name";
const REMEMBER_ME_KEY = "apollo-search-remember-me";

interface ProfileSelectorProps {
  onProfileChange?: (name: string) => void;
}

export function ProfileSelector({ onProfileChange }: ProfileSelectorProps) {
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    return localStorage.getItem(REMEMBER_ME_KEY) === "true";
  });
  
  const [selectedProfile, setSelectedProfile] = useState<string>(() => {
    // Only load saved profile if "remember me" was checked
    const savedRemember = localStorage.getItem(REMEMBER_ME_KEY) === "true";
    if (savedRemember) {
      return localStorage.getItem(PROFILE_NAME_KEY) || "";
    }
    return "";
  });
  
  const [isOpen, setIsOpen] = useState(!selectedProfile);

  useEffect(() => {
    if (selectedProfile) {
      if (rememberMe) {
        localStorage.setItem(PROFILE_NAME_KEY, selectedProfile);
      } else {
        localStorage.removeItem(PROFILE_NAME_KEY);
      }
      onProfileChange?.(selectedProfile);
    }
  }, [selectedProfile, rememberMe, onProfileChange]);

  useEffect(() => {
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe.toString());
  }, [rememberMe]);

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
      <DropdownMenuContent align="end" className="w-[220px] bg-popover z-50">
        {PROFILE_NAMES.map((name) => (
          <DropdownMenuItem
            key={name}
            onClick={() => handleSelect(name)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>{name}</span>
            {selectedProfile === name && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div 
          className="flex items-center gap-2 px-2 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            id="remember-me"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
          />
          <Label 
            htmlFor="remember-me" 
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Remember me
          </Label>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
