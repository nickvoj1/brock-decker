import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2, CheckCircle2, XCircle, Loader2, Eye, EyeOff, ExternalLink, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ApiSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  is_configured: boolean;
}

interface BullhornToken {
  id: string;
  rest_url: string;
  created_at: string;
  expires_at: string | null;
}

interface DistListTestResult {
  test: string;
  success: boolean;
  details: string;
  rawResponse?: any;
}

interface DistListTestResponse {
  success: boolean;
  accessLevel: string;
  summary: string;
  recommendation: string;
  tests: DistListTestResult[];
  error?: string;
}

export function BullhornSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [bullhornClientId, setBullhornClientId] = useState("");
  const [bullhornClientSecret, setBullhornClientSecret] = useState("");
  const [bullhornUsername, setBullhornUsername] = useState("");
  const [bullhornPassword, setBullhornPassword] = useState("");
  const [showBullhornSecret, setShowBullhornSecret] = useState(false);
  const [showBullhornPassword, setShowBullhornPassword] = useState(false);
  const [testingBullhorn, setTestingBullhorn] = useState(false);
  const [bullhornStatus, setBullhornStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connecting, setConnecting] = useState(false);
  
  // Distribution List API test state
  const [testingDistList, setTestingDistList] = useState(false);
  const [distListResults, setDistListResults] = useState<DistListTestResponse | null>(null);
  const [showDistListModal, setShowDistListModal] = useState(false);

  // Check for OAuth callback results
  useEffect(() => {
    const success = searchParams.get('bullhorn_success');
    const error = searchParams.get('bullhorn_error');
    
    if (success) {
      toast({
        title: "Bullhorn Connected!",
        description: "Successfully authenticated with Bullhorn.",
      });
      queryClient.invalidateQueries({ queryKey: ['bullhorn-tokens'] });
      setSearchParams({});
    } else if (error) {
      toast({
        title: "Bullhorn Connection Failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      setSearchParams({});
    }
  }, [searchParams, toast, queryClient, setSearchParams]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['api-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_settings')
        .select('*');
      if (error) throw error;
      return data as ApiSetting[];
    },
  });

  const { data: bullhornTokens } = useQuery({
    queryKey: ['bullhorn-tokens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bullhorn_tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data as BullhornToken[];
    },
  });

  useEffect(() => {
    if (settings) {
      settings.forEach((s) => {
        switch (s.setting_key) {
          case 'bullhorn_client_id':
            setBullhornClientId(s.setting_value);
            break;
          case 'bullhorn_client_secret':
            setBullhornClientSecret(s.setting_value);
            break;
          case 'bullhorn_username':
            setBullhornUsername(s.setting_value);
            break;
          case 'bullhorn_password':
            setBullhornPassword(s.setting_value);
            break;
        }
      });
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
        description: "Your Bullhorn credentials have been updated.",
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

  const handleSaveBullhorn = () => {
    saveMutation.mutate({ key: 'bullhorn_client_id', value: bullhornClientId });
    saveMutation.mutate({ key: 'bullhorn_client_secret', value: bullhornClientSecret });
    saveMutation.mutate({ key: 'bullhorn_username', value: bullhornUsername });
    saveMutation.mutate({ key: 'bullhorn_password', value: bullhornPassword });
  };

  const handleConnectBullhorn = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('bullhorn-initiate-oauth');
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      // In preview, navigating inside an iframe can fail due to Bullhorn's anti-framing headers.
      // Prefer opening a new tab; fall back to same-tab navigation if popups are blocked.
      const authUrl = data.authUrl as string | undefined;
      if (!authUrl) throw new Error('No authUrl returned from server');

      // If we're inside an iframe (Lovable preview), open a new tab to avoid anti-framing blocks.
      let inIframe = false;
      try {
        inIframe = window.self !== window.top;
      } catch {
        inIframe = true;
      }

      if (inIframe) {
        const opened = window.open(authUrl, '_blank', 'noopener,noreferrer');
        if (opened) {
          toast({
            title: 'Continue in new tab',
            description: 'Complete Bullhorn authorization, then return here and refresh if needed.',
          });
          setConnecting(false);
        } else {
          // Popup blocked — try same-tab redirect
          window.location.href = authUrl;
        }
      } else {
        // Normal app usage: same-tab redirect so the callback can return to /settings with params.
        window.location.href = authUrl;
      }
    } catch (error: any) {
      toast({
        title: "Connection Error",
        description: error.message,
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const testBullhornConnection = async () => {
    setTestingBullhorn(true);
    setBullhornStatus('idle');
    
    try {
      const { data, error } = await supabase.functions.invoke('test-bullhorn', {
        body: {
          clientId: bullhornClientId,
          clientSecret: bullhornClientSecret,
        }
      });
      
      if (error) throw error;
      setBullhornStatus(data.success ? 'success' : 'error');
    } catch (error) {
      setBullhornStatus('error');
    } finally {
      setTestingBullhorn(false);
    }
  };

  const testDistListAccess = async () => {
    setTestingDistList(true);
    setDistListResults(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-bullhorn-distlist');
      
      if (error) throw error;
      setDistListResults(data as DistListTestResponse);
      setShowDistListModal(true);
    } catch (error: any) {
      setDistListResults({
        success: false,
        accessLevel: 'ERROR',
        summary: '❌ Test Failed',
        recommendation: error.message,
        tests: [],
        error: error.message,
      });
      setShowDistListModal(true);
    } finally {
      setTestingDistList(false);
    }
  };

  const isBullhornConfigured = settings?.find(s => s.setting_key === 'bullhorn_client_id')?.is_configured;
  const isConnected = bullhornTokens && bullhornTokens.length > 0;
  const tokenInfo = bullhornTokens?.[0];

  return (
    <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Bullhorn</CardTitle>
              <CardDescription>OAuth credentials for candidate management</CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isBullhornConfigured && (
              <span className="flex items-center gap-1 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                Configured
              </span>
            )}
            {isConnected && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                Connected to {tokenInfo?.rest_url?.split('//')[1]?.split('.')[0] || 'Bullhorn'}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bhClientId">Client ID</Label>
            <Input
              id="bhClientId"
              value={bullhornClientId}
              onChange={(e) => setBullhornClientId(e.target.value)}
              placeholder="OAuth Client ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bhClientSecret">Client Secret</Label>
            <div className="relative">
              <Input
                id="bhClientSecret"
                type={showBullhornSecret ? "text" : "password"}
                value={bullhornClientSecret}
                onChange={(e) => setBullhornClientSecret(e.target.value)}
                placeholder="OAuth Client Secret"
              />
              <button
                type="button"
                onClick={() => setShowBullhornSecret(!showBullhornSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showBullhornSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bhUsername">API Username</Label>
            <Input
              id="bhUsername"
              value={bullhornUsername}
              onChange={(e) => setBullhornUsername(e.target.value)}
              placeholder="Bullhorn API Username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bhPassword">API Password</Label>
            <div className="relative">
              <Input
                id="bhPassword"
                type={showBullhornPassword ? "text" : "password"}
                value={bullhornPassword}
                onChange={(e) => setBullhornPassword(e.target.value)}
                placeholder="Bullhorn API Password"
              />
              <button
                type="button"
                onClick={() => setShowBullhornPassword(!showBullhornPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showBullhornPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Register your OAuth app with redirect URI: <code className="bg-muted px-1 py-0.5 rounded text-xs">
            https://flbeeduimzyjecdlonde.supabase.co/functions/v1/bullhorn-oauth-callback
          </code>
        </p>
        
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSaveBullhorn} disabled={saveMutation.isPending}>
            Save
          </Button>
          <Button
            variant="outline"
            onClick={handleConnectBullhorn}
            disabled={connecting || !bullhornClientId || !bullhornClientSecret}
          >
            {connecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            {isConnected ? 'Reconnect' : 'Connect to Bullhorn'}
          </Button>
          <Button
            variant="outline"
            onClick={testBullhornConnection}
            disabled={testingBullhorn || !bullhornClientId || !bullhornClientSecret}
          >
            {testingBullhorn ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : bullhornStatus === 'success' ? (
              <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
            ) : bullhornStatus === 'error' ? (
              <XCircle className="mr-2 h-4 w-4 text-destructive" />
            ) : null}
            Test Connection
          </Button>
          <Button
            variant="outline"
            onClick={testDistListAccess}
            disabled={testingDistList || !isConnected}
            title={!isConnected ? "Connect to Bullhorn first" : "Test Distribution Lists API access"}
          >
            {testingDistList ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Shield className="mr-2 h-4 w-4" />
            )}
            Test DistList Access
          </Button>
        </div>

        {isConnected && tokenInfo && (
          <div className="rounded-lg border bg-muted/50 p-3 text-sm">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">OAuth Connected</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              REST URL: {tokenInfo.rest_url}
              {tokenInfo.expires_at && (
                <> • Expires: {new Date(tokenInfo.expires_at).toLocaleString()}</>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Distribution List API Test Results Modal */}
      <Dialog open={showDistListModal} onOpenChange={setShowDistListModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bullhorn Distribution Lists API Test</DialogTitle>
            <DialogDescription>
              Testing your Bullhorn instance's API access for Distribution Lists
            </DialogDescription>
          </DialogHeader>
          
          {distListResults && (
            <div className="space-y-4">
              {/* Summary */}
              <div className={`rounded-lg border p-4 ${
                distListResults.accessLevel === 'FULL_ACCESS' 
                  ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                  : distListResults.accessLevel === 'QUERY_ONLY'
                  ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
                  : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
              }`}>
                <div className="text-lg font-semibold">{distListResults.summary}</div>
                <div className="text-sm text-muted-foreground mt-1">{distListResults.recommendation}</div>
              </div>

              {/* Test Results */}
              <div className="space-y-2">
                <h4 className="font-medium">Test Results</h4>
                {distListResults.tests.map((test, index) => (
                  <div
                    key={index}
                    className={`rounded border p-3 ${
                      test.success 
                        ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                        : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {test.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">{test.test}</span>
                    </div>
                    <div className="text-sm mt-1 text-muted-foreground">{test.details}</div>
                    {test.rawResponse && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                          View Raw Response
                        </summary>
                        <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                          {typeof test.rawResponse === 'string' 
                            ? test.rawResponse 
                            : JSON.stringify(test.rawResponse, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>

              {/* Access Level Badge */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground">Access Level:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  distListResults.accessLevel === 'FULL_ACCESS' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : distListResults.accessLevel === 'QUERY_ONLY'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {distListResults.accessLevel}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
