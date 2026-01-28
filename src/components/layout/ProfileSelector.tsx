import { useState, useEffect } from "react";
import { User, ChevronDown, Check, Lock, KeyRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_PROFILE_NAMES = [
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
const PROFILE_VERIFIED_KEY = "apollo-search-profile-verified";

// Get ordered list with selected profile at top
const getOrderedProfiles = (selectedProfile: string) => {
  if (!selectedProfile) return DEFAULT_PROFILE_NAMES;
  return [
    selectedProfile,
    ...DEFAULT_PROFILE_NAMES.filter(name => name !== selectedProfile)
  ];
};

interface ProfileSelectorProps {
  onProfileChange?: (name: string) => void;
}

export function ProfileSelector({ onProfileChange }: ProfileSelectorProps) {
  const { toast } = useToast();
  const [selectedProfile, setSelectedProfile] = useState<string>(() => {
    // Only restore if verified in this session
    const verified = sessionStorage.getItem(PROFILE_VERIFIED_KEY);
    if (verified === "true") {
      return localStorage.getItem(PROFILE_NAME_KEY) || "";
    }
    return "";
  });
  
  const [isOpen, setIsOpen] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<string>("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [profilePinStatus, setProfilePinStatus] = useState<Record<string, boolean>>({});

  // Check PIN status for all profiles on mount
  useEffect(() => {
    checkAllProfilePinStatus();
  }, []);

  useEffect(() => {
    if (selectedProfile) {
      localStorage.setItem(PROFILE_NAME_KEY, selectedProfile);
      sessionStorage.setItem(PROFILE_VERIFIED_KEY, "true");
      onProfileChange?.(selectedProfile);
      window.dispatchEvent(new Event("profile-name-changed"));
    }
  }, [selectedProfile, onProfileChange]);

  const checkAllProfilePinStatus = async () => {
    const status: Record<string, boolean> = {};
    for (const name of DEFAULT_PROFILE_NAMES) {
      try {
        const { data } = await supabase.functions.invoke('verify-profile-pin', {
          body: { action: 'check', profileName: name }
        });
        status[name] = data?.hasPin || false;
      } catch {
        status[name] = false;
      }
    }
    setProfilePinStatus(status);
  };

  const handleSelectProfile = async (name: string) => {
    setIsOpen(false);
    setPendingProfile(name);
    setPin("");
    setConfirmPin("");

    // Check if this profile has a PIN
    try {
      const { data, error } = await supabase.functions.invoke('verify-profile-pin', {
        body: { action: 'check', profileName: name }
      });

      if (error) throw error;

      if (data.hasPin) {
        // Profile has PIN, show verification dialog
        setShowPinDialog(true);
      } else {
        // No PIN set, show setup dialog
        setShowSetupDialog(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to check profile PIN status",
        variant: "destructive",
      });
    }
  };

  const handleVerifyPin = async () => {
    if (!pin || pin.length < 4) {
      toast({
        title: "Invalid PIN",
        description: "Please enter your 4-6 digit PIN",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-profile-pin', {
        body: { action: 'verify', profileName: pendingProfile, pin }
      });

      if (error) throw error;

      if (data.valid) {
        setSelectedProfile(pendingProfile);
        setShowPinDialog(false);
        setPin("");
        toast({
          title: "Welcome back!",
          description: `Signed in as ${pendingProfile}`,
        });
      } else {
        toast({
          title: "Incorrect PIN",
          description: "Please try again",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupPin = async () => {
    if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be 4-6 digits",
        variant: "destructive",
      });
      return;
    }

    if (pin !== confirmPin) {
      toast({
        title: "PINs don't match",
        description: "Please make sure both PINs are the same",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-profile-pin', {
        body: { action: 'set', profileName: pendingProfile, pin }
      });

      if (error) throw error;

      setSelectedProfile(pendingProfile);
      setShowSetupDialog(false);
      setPin("");
      setConfirmPin("");
      setProfilePinStatus(prev => ({ ...prev, [pendingProfile]: true }));
      toast({
        title: "PIN created!",
        description: `Your profile is now protected. Welcome, ${pendingProfile}!`,
      });
    } catch (error: any) {
      toast({
        title: "Setup failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setSelectedProfile("");
    localStorage.removeItem(PROFILE_NAME_KEY);
    sessionStorage.removeItem(PROFILE_VERIFIED_KEY);
    window.dispatchEvent(new Event("profile-name-changed"));
    toast({
      title: "Signed out",
      description: "You have been signed out",
    });
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={selectedProfile ? "outline" : "default"}
            size="sm"
            className="gap-2"
          >
            <User className="h-4 w-4" />
            <span className="max-w-[120px] truncate">
              {selectedProfile || "Sign In"}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[220px] bg-popover z-50">
          {getOrderedProfiles(selectedProfile).map((name) => (
            <DropdownMenuItem
              key={name}
              onClick={() => handleSelectProfile(name)}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {name}
                {profilePinStatus[name] && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </span>
              {selectedProfile === name && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          {selectedProfile && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive cursor-pointer"
              >
                Sign Out
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* PIN Verification Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Enter PIN
            </DialogTitle>
            <DialogDescription>
              Enter your PIN to sign in as {pendingProfile}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="verify-pin">PIN</Label>
              <Input
                id="verify-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Enter your PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPin()}
                autoFocus
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleVerifyPin}
              disabled={isLoading || pin.length < 4}
            >
              {isLoading ? "Verifying..." : "Sign In"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Create Your PIN
            </DialogTitle>
            <DialogDescription>
              Set a 4-6 digit PIN to protect your profile ({pendingProfile})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="new-pin">New PIN</Label>
              <Input
                id="new-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="4-6 digits"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pin">Confirm PIN</Label>
              <Input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Confirm your PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleSetupPin()}
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleSetupPin}
              disabled={isLoading || pin.length < 4 || confirmPin.length < 4}
            >
              {isLoading ? "Setting up..." : "Create PIN & Sign In"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
