import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProfileName } from "@/hooks/useProfileName";
import { getApiSettings, saveApiSetting } from "@/lib/dataApi";

export function ApolloSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileName = useProfileName();
  
  const [apolloKey, setApolloKey] = useState("");
  const [showApollo, setShowApollo] = useState(false);
  const [testingApollo, setTestingApollo] = useState(false);
  const [apolloStatus, setApolloStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['api-settings', profileName],
    queryFn: async () => {
      if (!profileName) return [];
      const response = await getApiSettings(profileName);
      if (!response.success) throw new Error(response.error);
      return response.data || [];
    },
    enabled: !!profileName,
  });

  useEffect(() => {
    if (settings) {
      const apolloSetting = settings.find((s: any) => s.setting_key === 'apollo_api_key');
      if (apolloSetting) {
        // Note: setting_value is not returned by getApiSettings for security
        // We only get is_configured status
      }
    }
  }, [settings]);

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
        description: "Your API credentials have been updated.",
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

  const handleSaveApollo = () => {
    saveMutation.mutate({ key: 'apollo_api_key', value: apolloKey });
    setApolloKey(""); // Clear the field after saving for security
  };

  const testApolloConnection = async () => {
    setTestingApollo(true);
    setApolloStatus('idle');
    
    try {
      const { data, error } = await supabase.functions.invoke('test-apollo', {
        body: { apiKey: apolloKey }
      });
      
      if (error) throw error;
      setApolloStatus(data.success ? 'success' : 'error');
    } catch (error) {
      setApolloStatus('error');
    } finally {
      setTestingApollo(false);
    }
  };

  const isApolloConfigured = settings?.find((s: any) => s.setting_key === 'apollo_api_key')?.is_configured;

  if (!profileName) {
    return (
      <Card className="animate-slide-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Apollo.io</CardTitle>
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
              <Key className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Apollo.io</CardTitle>
              <CardDescription>API key for people search and enrichment</CardDescription>
            </div>
          </div>
          {isApolloConfigured && (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              Configured
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apolloKey">API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="apolloKey"
                type={showApollo ? "text" : "password"}
                value={apolloKey}
                onChange={(e) => setApolloKey(e.target.value)}
                placeholder={isApolloConfigured ? "••••••••••••••••" : "Enter your Apollo.io API key"}
              />
              <button
                type="button"
                onClick={() => setShowApollo(!showApollo)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApollo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Find your API key in Apollo.io → Settings → API
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSaveApollo} disabled={saveMutation.isPending || !apolloKey}>
            Save
          </Button>
          <Button
            variant="outline"
            onClick={testApolloConnection}
            disabled={testingApollo || !apolloKey}
          >
            {testingApollo ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : apolloStatus === 'success' ? (
              <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
            ) : apolloStatus === 'error' ? (
              <XCircle className="mr-2 h-4 w-4 text-destructive" />
            ) : null}
            Test Connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
