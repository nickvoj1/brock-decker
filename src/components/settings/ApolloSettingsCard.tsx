import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ApiSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  is_configured: boolean;
}

export function ApolloSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [apolloKey, setApolloKey] = useState("");
  const [showApollo, setShowApollo] = useState(false);
  const [testingApollo, setTestingApollo] = useState(false);
  const [apolloStatus, setApolloStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const { data: settings } = useQuery({
    queryKey: ['api-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_settings')
        .select('*');
      if (error) throw error;
      return data as ApiSetting[];
    },
  });

  useEffect(() => {
    if (settings) {
      const apolloSetting = settings.find(s => s.setting_key === 'apollo_api_key');
      if (apolloSetting) {
        setApolloKey(apolloSetting.setting_value);
      }
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('api_settings')
        .update({ 
          setting_value: value, 
          is_configured: value.length > 0 
        })
        .eq('setting_key', key);
      if (error) throw error;
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

  const isApolloConfigured = settings?.find(s => s.setting_key === 'apollo_api_key')?.is_configured;

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
                placeholder="Enter your Apollo.io API key"
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
          <Button onClick={handleSaveApollo} disabled={saveMutation.isPending}>
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
