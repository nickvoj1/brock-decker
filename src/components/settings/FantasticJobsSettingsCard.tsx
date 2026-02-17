import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
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

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (!profileName) throw new Error("No profile selected");
      const response = await saveApiSetting(profileName, key, value);
      if (!response.success) throw new Error(response.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-settings'] });
      toast({
        title: "Settings saved",
        description: "Fantastic.jobs API key has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ key: 'rapidapi_key', value: apiKey });
    setApiKey("");
  };

  const testConnection = async () => {
    setTesting(true);
    setTestStatus('idle');
    
    try {
      const { data, error } = await supabase.functions.invoke('fantastic-jobs', {
        body: { keyword: "test", location: "London", apiKey },
      });
      
      if (error) throw error;
      setTestStatus(data?.success ? 'success' : 'error');
    } catch {
      setTestStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const isConfigured = settings?.find((s: any) => s.setting_key === 'rapidapi_key')?.is_configured;

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
              <CardTitle className="text-lg">Fantastic.jobs (RapidAPI)</CardTitle>
              <CardDescription>API key for the Job Board tab on Signals</CardDescription>
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
          <Label htmlFor="rapidApiKey">RapidAPI Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="rapidApiKey"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isConfigured ? "••••••••••••••••" : "Enter your RapidAPI key"}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your key at{" "}
            <a href="https://rapidapi.com/letscrape-6bRBa3QguO5/api/active-jobs-db" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              RapidAPI → Active Jobs DB
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saveMutation.isPending || !apiKey}>
            Save
          </Button>
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={testing || !apiKey}
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
