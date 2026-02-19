import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProfileName } from "@/hooks/useProfileName";
import { getApiSettings, saveApiSetting } from "@/lib/dataApi";

export function FantasticJobsSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileName = useProfileName();
  
  const [apifyToken, setApifyToken] = useState("");
  const [actorId, setActorId] = useState("");
  const [rapidApiKey, setRapidApiKey] = useState("");
  const [showApifyToken, setShowApifyToken] = useState(false);
  const [showRapidApiKey, setShowRapidApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const { data: settings } = useQuery({
    queryKey: ['api-settings', profileName],
    queryFn: async () => {
      if (!profileName) return [];
      const response = await getApiSettings(profileName);
      if (!response.success) throw new Error(response.error);
      return response.data || [];
    },
    enabled: !!profileName,
  });

  const handleSave = async () => {
    if (!profileName) return;
    if (!apifyToken || !actorId) {
      toast({
        title: "Apify details required",
        description: "Please add both Apify token and Apify actor ID.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const updates = [
        saveApiSetting(profileName, "apify_token", apifyToken),
        saveApiSetting(profileName, "apify_actor_id", actorId),
      ];
      if (rapidApiKey.trim()) {
        updates.push(saveApiSetting(profileName, "rapidapi_key", rapidApiKey));
      }

      const results = await Promise.all(updates);
      const firstError = results.find((r) => !r.success);
      if (firstError) throw new Error(firstError.error || "Failed to save settings");

      queryClient.invalidateQueries({ queryKey: ["api-settings"] });
      setApifyToken("");
      setRapidApiKey("");
      toast({
        title: "Settings saved",
        description: "Apify and fallback settings were updated.",
      });
    } catch (error) {
      toast({
        title: "Error saving settings",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!apifyToken || !actorId) return;
    setTesting(true);
    setTestStatus('idle');
    
    try {
      const { data, error } = await supabase.functions.invoke('fantastic-jobs', {
        body: {
          keyword: "private equity",
          location: "London",
          apify_token: apifyToken,
          actor_id: actorId,
          rapidapi_key: rapidApiKey || undefined,
          limit: 10,
        },
      });
      
      if (error) throw error;
      setTestStatus(data?.success ? 'success' : 'error');
    } catch {
      setTestStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const isApifyConfigured = settings?.find((s: any) => s.setting_key === "apify_token")?.is_configured;
  const isActorConfigured = settings?.find((s: any) => s.setting_key === "apify_actor_id")?.is_configured;
  const isRapidConfigured = settings?.find((s: any) => s.setting_key === "rapidapi_key")?.is_configured;
  const isConfigured = Boolean(isApifyConfigured && isActorConfigured);

  if (!profileName) {
    return (
      <Card className="animate-slide-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Fantastic.jobs</CardTitle>
              <CardDescription>Select a profile to configure API keys</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="animate-slide-up">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Fantastic.jobs (Apify)</CardTitle>
              <CardDescription>Apify token + actor IDs for Job Board (RapidAPI optional fallback)</CardDescription>
            </div>
          </div>
          {isConfigured && (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              Configured
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apifyToken">Apify Token</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="apifyToken"
                type={showApifyToken ? "text" : "password"}
                value={apifyToken}
                onChange={(e) => setApifyToken(e.target.value)}
                placeholder={isApifyConfigured ? "••••••••••••••••" : "Enter your Apify token"}
              />
              <button
                type="button"
                onClick={() => setShowApifyToken(!showApifyToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Create token at{" "}
            <a href="https://console.apify.com/account/integrations" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Apify Console
            </a>
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="apifyActorId">Apify Actor ID</Label>
          <Input
            id="apifyActorId"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            placeholder={isActorConfigured ? "Configured (enter to update)" : "actorId1, actorId2"}
          />
          <p className="text-xs text-muted-foreground">
            Paste one or multiple IDs separated by commas. Example: <code>s3dtSTZSZWFtAVLn5,vIGxjRrHqDTPuE6M4</code>
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rapidApiFallback">RapidAPI Key (Optional Fallback)</Label>
          <div className="relative">
            <Input
              id="rapidApiFallback"
              type={showRapidApiKey ? "text" : "password"}
              value={rapidApiKey}
              onChange={(e) => setRapidApiKey(e.target.value)}
              placeholder={isRapidConfigured ? "••••••••••••••••" : "Enter RapidAPI key (optional)"}
            />
            <button
              type="button"
              onClick={() => setShowRapidApiKey(!showRapidApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showRapidApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !apifyToken || !actorId}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={testing || !apifyToken || !actorId}
          >
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : testStatus === 'success' ? (
              <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
            ) : testStatus === 'error' ? (
              <XCircle className="mr-2 h-4 w-4 text-destructive" />
            ) : null}
            Test Connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
