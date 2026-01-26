import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Loader2, FileText, Settings2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CVUploadZone } from "@/components/upload/CVUploadZone";
import { IndustrySelector } from "@/components/upload/IndustrySelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

interface ParsedCandidate {
  candidate_id: string;
  name: string;
  position: string;
  location: string;
  company?: string;
  email?: string;
  phone?: string;
  skills?: string[];
}

export default function UploadRun() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // CV file states
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvData, setCvData] = useState<ParsedCandidate | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [isParsingCV, setIsParsingCV] = useState(false);
  
  // Industry selection
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  
  // Run configuration
  const [searchCounter, setSearchCounter] = useState(1);
  const [bullhornEnabled, setBullhornEnabled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const handleCvFileSelect = async (file: File) => {
    setCvFile(file);
    setCvError(null);
    setCvData(null);
    setIsParsingCV(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-cv`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to parse CV');
      }

      setCvData(result.data);
      toast({
        title: "CV parsed successfully",
        description: `Extracted info for ${result.data.name}`,
      });
    } catch (error: any) {
      console.error('CV parsing error:', error);
      setCvError(error.message || 'Failed to parse CV');
      toast({
        title: "Error parsing CV",
        description: error.message || 'Failed to extract information from CV',
        variant: "destructive",
      });
    } finally {
      setIsParsingCV(false);
    }
  };

  const handleCvClear = () => {
    setCvFile(null);
    setCvData(null);
    setCvError(null);
  };

  const canRun = cvData && selectedIndustries.length > 0 && !isRunning && !isParsingCV;

  // Convert selected industries to preferences data format for backend
  const getPreferencesData = () => {
    return selectedIndustries.map(industry => ({
      industry,
      companies: '',
      exclusions: '',
    }));
  };

  const handleRunEnrichment = async () => {
    if (!cvData || selectedIndustries.length === 0) return;
    
    const preferencesData = getPreferencesData();
    
    setIsRunning(true);
    
    try {
      // Create a new run record with single candidate
      const { data: run, error: runError } = await supabase
        .from('enrichment_runs')
        .insert([{
          search_counter: searchCounter,
          candidates_count: 1,
          preferences_count: selectedIndustries.length,
          status: 'running' as const,
          bullhorn_enabled: bullhornEnabled,
          candidates_data: JSON.parse(JSON.stringify([cvData])) as Json,
          preferences_data: JSON.parse(JSON.stringify(preferencesData)) as Json,
        }])
        .select()
        .single();

      if (runError) throw runError;

      toast({
        title: "Enrichment started",
        description: `Processing candidate: ${cvData.name}`,
      });

      // Call the enrichment edge function
      const { data: enrichResult, error: enrichError } = await supabase.functions.invoke('run-enrichment', {
        body: { runId: run.id }
      });

      if (enrichError) {
        // Update run status to failed
        await supabase
          .from('enrichment_runs')
          .update({ status: 'failed', error_message: enrichError.message })
          .eq('id', run.id);
          
        throw enrichError;
      }

      toast({
        title: "Enrichment complete",
        description: "View results in Runs History",
      });

      navigate('/history');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start enrichment",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AppLayout 
      title="Upload & Run" 
      description="Upload a CV and run Apollo.io enrichment"
    >
      <div className="max-w-4xl space-y-6">
        {/* Step 1: Upload CV & Select Industries */}
        <Card className="animate-slide-up">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 1: Upload CV & Select Industries</CardTitle>
                <CardDescription>Upload a candidate CV and select target industries</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <CVUploadZone
              onFileSelect={handleCvFileSelect}
              onClear={handleCvClear}
              onParsed={setCvData}
              file={cvFile}
              parsedData={cvData}
              error={cvError}
              isProcessing={isParsingCV}
            />
            <IndustrySelector
              selectedIndustries={selectedIndustries}
              onSelectionChange={setSelectedIndustries}
            />
          </CardContent>
        </Card>

        {/* Step 2: Configure Run */}
        <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Settings2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 2: Configure Run</CardTitle>
                <CardDescription>Set enrichment parameters and integrations</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="searchCounter">Search Counter</Label>
                <Input
                  id="searchCounter"
                  type="number"
                  min={1}
                  value={searchCounter}
                  onChange={(e) => setSearchCounter(parseInt(e.target.value) || 1)}
                  className="max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Starting number for Bullhorn candidate naming
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="bullhorn">Push to Bullhorn</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Create/update candidates in Bullhorn after enrichment
                    </p>
                  </div>
                  <Switch
                    id="bullhorn"
                    checked={bullhornEnabled}
                    onCheckedChange={setBullhornEnabled}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Run */}
        <Card className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Play className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 3: Run Enrichment</CardTitle>
                <CardDescription>
                  {canRun 
                    ? `Ready to enrich ${cvData?.name} with ${selectedIndustries.length} industries`
                    : "Upload a CV and select industries to enable enrichment"
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleRunEnrichment}
              disabled={!canRun}
              className="btn-premium"
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Enrichment
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
