import { useState, useEffect } from "react";
import { User, Lock, KeyRound, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import brockDeckerLogo from "@/assets/brock-decker-logo.png";

const DEFAULT_PROFILE_NAMES = [
  "Denis Radchenko",
  "Arthur Lots",
  "Rudolf Rakiss",
  "Arturs Salcevich",
  "Nick Bulmeistar",
  "Rainer Grote",
  "Nikita Vojevoda",
];

const PROFILE_NAME_KEY = "apollo-search-profile-name";
const PROFILE_VERIFIED_KEY = "apollo-search-profile-verified";

interface AuthGateProps {
  children: React.ReactNode;
  onAuthenticated: (profileName: string) => void;
}

export function AuthGate({ children, onAuthenticated }: AuthGateProps) {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const verified = sessionStorage.getItem(PROFILE_VERIFIED_KEY);
    const profile = localStorage.getItem(PROFILE_NAME_KEY);
    return verified === "true" && !!profile && DEFAULT_PROFILE_NAMES.includes(profile);
  });
  
  const [step, setStep] = useState<"select" | "verify" | "setup">("select");
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [profilePinStatus, setProfilePinStatus] = useState<Record<string, boolean>>({});
  const [resetRequested, setResetRequested] = useState(false);

  useEffect(() => {
    checkAllProfilePinStatus();
  }, []);

  useEffect(() => {
    // Check if already authenticated on mount
    const verified = sessionStorage.getItem(PROFILE_VERIFIED_KEY);
    const profile = localStorage.getItem(PROFILE_NAME_KEY);
    if (verified === "true" && profile && DEFAULT_PROFILE_NAMES.includes(profile)) {
      setIsAuthenticated(true);
      onAuthenticated(profile);
      return;
    }
    localStorage.removeItem(PROFILE_NAME_KEY);
    sessionStorage.removeItem(PROFILE_VERIFIED_KEY);
  }, [onAuthenticated]);

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
    setSelectedProfile(name);
    setPin("");
    setConfirmPin("");
    setResetRequested(false);

    try {
      const { data, error } = await supabase.functions.invoke('verify-profile-pin', {
        body: { action: 'check', profileName: name }
      });

      if (error) throw error;

      if (data.hasPin) {
        setStep("verify");
      } else {
        setStep("setup");
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
        body: { action: 'verify', profileName: selectedProfile, pin }
      });

      if (error) throw error;

      if (data.valid) {
        localStorage.setItem(PROFILE_NAME_KEY, selectedProfile);
        sessionStorage.setItem(PROFILE_VERIFIED_KEY, "true");
        setIsAuthenticated(true);
        onAuthenticated(selectedProfile);
        window.dispatchEvent(new Event("profile-name-changed"));
        toast({
          title: "Welcome back!",
          description: `Signed in as ${selectedProfile}`,
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
        body: { action: 'set', profileName: selectedProfile, pin }
      });

      if (error) throw error;

      localStorage.setItem(PROFILE_NAME_KEY, selectedProfile);
      sessionStorage.setItem(PROFILE_VERIFIED_KEY, "true");
      setIsAuthenticated(true);
      onAuthenticated(selectedProfile);
      window.dispatchEvent(new Event("profile-name-changed"));
      toast({
        title: "PIN created!",
        description: `Your profile is now protected. Welcome, ${selectedProfile}!`,
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

  const handleForgotPin = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-profile-pin', {
        body: { action: 'request-reset', profileName: selectedProfile }
      });

      if (error) throw error;

      setResetRequested(true);
      toast({
        title: "Reset Requested",
        description: "An admin will reset your PIN. Please try again later.",
      });
    } catch (error: any) {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-2 border-foreground/20">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={brockDeckerLogo} alt="Brock Decker" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-xl">
            {step === "select" && "Sign In"}
            {step === "verify" && "Enter PIN"}
            {step === "setup" && "Create Your PIN"}
          </CardTitle>
          <CardDescription>
            {step === "select" && "Select your profile to continue"}
            {step === "verify" && `Enter your PIN to sign in as ${selectedProfile}`}
            {step === "setup" && `Set a 4-6 digit PIN to protect your profile`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "select" && (
            <div className="grid gap-2">
              {DEFAULT_PROFILE_NAMES.map((name) => (
                <Button
                  key={name}
                  variant="outline"
                  className="justify-start gap-3 h-12 border-foreground/20"
                  onClick={() => handleSelectProfile(name)}
                >
                  <User className="h-4 w-4" />
                  <span className="flex-1 text-left">{name}</span>
                  {profilePinStatus[name] && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
              ))}
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-foreground/10">
                <User className="h-4 w-4" />
                <span className="font-medium">{selectedProfile}</span>
              </div>
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
                  className="border-foreground/20"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleVerifyPin}
                disabled={isLoading || pin.length < 4 || resetRequested}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                {isLoading ? "Verifying..." : "Sign In"}
              </Button>
              {resetRequested ? (
                <p className="text-sm text-center text-muted-foreground">
                  Reset requested. Please wait for an admin to process it.
                </p>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={handleForgotPin}
                  disabled={isLoading}
                >
                  <HelpCircle className="h-4 w-4 mr-1" />
                  Forgot PIN?
                </Button>
              )}
              <Button
                variant="link"
                size="sm"
                className="w-full"
                onClick={() => setStep("select")}
              >
                ← Back to profile selection
              </Button>
            </div>
          )}

          {step === "setup" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-foreground/10">
                <User className="h-4 w-4" />
                <span className="font-medium">{selectedProfile}</span>
              </div>
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
                  className="border-foreground/20"
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
                  className="border-foreground/20"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleSetupPin}
                disabled={isLoading || pin.length < 4 || confirmPin.length < 4}
              >
                <Lock className="h-4 w-4 mr-2" />
                {isLoading ? "Setting up..." : "Create PIN & Sign In"}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="w-full"
                onClick={() => setStep("select")}
              >
                ← Back to profile selection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
