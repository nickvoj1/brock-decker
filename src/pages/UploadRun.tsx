import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Loader2, FileText, Settings2, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CVUploadZone } from "@/components/upload/CVUploadZone";
import { IndustrySelector } from "@/components/upload/IndustrySelector";
import { LocationSelector } from "@/components/upload/LocationSelector";
import { RoleSelector } from "@/components/upload/RoleSelector";
import { RoleSuggestions } from "@/components/upload/RoleSuggestions";
import { SearchDebugPanel } from "@/components/upload/SearchDebugPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRoleSuggestions } from "@/hooks/useRoleSuggestions";
import type { Json } from "@/integrations/supabase/types";

interface WorkExperience {
  company: string;
  title: string;
  duration?: string;
}

interface Education {
  institution: string;
  degree: string;
  year?: string;
}

interface ParsedCandidate {
  candidate_id: string;
  name: string;
  current_title: string;
  location: string;
  email?: string;
  phone?: string;
  summary?: string;
  skills: string[];
  work_history: WorkExperience[];
  education: Education[];
}

// Re-export for CVUploadZone compatibility
export type { ParsedCandidate, WorkExperience, Education };

const ROLES_STORAGE_KEY = 'apollo-search-selected-roles';

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
  
  // Industry sectors (optional, broad categories) - always start empty
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  
  // Location selection
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  
  // Target roles selection - load from localStorage or start empty
  const [selectedRoles, setSelectedRoles] = useState<string[]>(() => {
    const saved = localStorage.getItem(ROLES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  // Run configuration
  const [maxContacts, setMaxContacts] = useState(50);
  const [isRunning, setIsRunning] = useState(false);

  // Role suggestions based on CV and industries
  const roleSuggestions = useRoleSuggestions(cvData, selectedIndustries);

  // Save selected roles to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(selectedRoles));
  }, [selectedRoles]);

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
        description: `Extracted profile for ${result.data.name} with ${result.data.work_history?.length || 0} work experiences`,
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

  const canRun = cvData && selectedIndustries.length > 0 && selectedLocations.length > 0 && selectedRoles.length > 0 && !isRunning && !isParsingCV;

  // Convert selected industries to preferences data format for backend
  const getPreferencesData = () => {
    return selectedIndustries.map(industry => ({
      industry,
      companies: '',
      exclusions: '',
      locations: selectedLocations,
      targetRoles: selectedRoles,
      sectors: selectedSectors, // Include selected sectors for Apollo filtering
    }));
  };

  const handleRunEnrichment = async () => {
    if (!cvData || selectedIndustries.length === 0) return;
    
    const preferencesData = getPreferencesData();
    
    setIsRunning(true);
    
    try {
      // Create a new run record with single candidate
      // Note: search_counter is now used as maxContacts
      const { data: run, error: runError } = await supabase
        .from('enrichment_runs')
        .insert([{
          search_counter: maxContacts, // Using this field for max contacts
          candidates_count: 1,
          preferences_count: selectedIndustries.length,
          status: 'running' as const,
          bullhorn_enabled: false,
          candidates_data: JSON.parse(JSON.stringify([cvData])) as Json,
          preferences_data: JSON.parse(JSON.stringify(preferencesData)) as Json,
        }])
        .select()
        .single();

      if (runError) throw runError;

      toast({
        title: "Searching for contacts",
        description: `Finding up to ${maxContacts} hiring contacts for ${cvData.name}`,
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
        title: "Search complete",
        description: `Found ${enrichResult.contactsFound || 0} contacts. View in Runs History to download.`,
      });

      navigate('/history');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to search for contacts",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AppLayout 
      title="Find Hiring Contacts" 
      description="Upload a CV and find relevant hiring contacts on Apollo.io"
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
                <CardDescription>Upload a candidate CV and select target industries they're interested in</CardDescription>
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
              selectedSectors={selectedSectors}
              onSectorsChange={setSelectedSectors}
            />
          </CardContent>
        </Card>

        {/* Step 2: Select Locations */}
        <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Settings2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 2: Select Locations</CardTitle>
                <CardDescription>Choose where to find hiring contacts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <LocationSelector
              selectedLocations={selectedLocations}
              onSelectionChange={setSelectedLocations}
            />
          </CardContent>
        </Card>

        {/* Step 3: Select Target Roles */}
        <Card className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 3: Select Target Roles</CardTitle>
                <CardDescription>Choose which job titles to search for</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <RoleSelector
              selectedRoles={selectedRoles}
              onRolesChange={setSelectedRoles}
            />
            {cvData && roleSuggestions.length > 0 && (
              <RoleSuggestions
                suggestions={roleSuggestions}
                selectedRoles={selectedRoles}
                onAddRole={(role) => {
                  if (!selectedRoles.includes(role)) {
                    setSelectedRoles([...selectedRoles, role]);
                  }
                }}
                onAddAll={() => {
                  const newRoles = [...selectedRoles];
                  roleSuggestions.forEach((role) => {
                    if (!newRoles.includes(role)) {
                      newRoles.push(role);
                    }
                  });
                  setSelectedRoles(newRoles);
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Step 4: Configure Search */}
        <Card className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Settings2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 4: Configure Search</CardTitle>
                <CardDescription>Set how many contacts you want to find</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxContacts">Maximum Contacts</Label>
                <Input
                  id="maxContacts"
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={maxContacts}
                  onChange={(e) => setMaxContacts(Math.max(10, Math.min(500, parseInt(e.target.value) || 50)))}
                  className="max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Number of contacts to retrieve (10-500). Max 3 per company.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>What you'll get</Label>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• CSV with: Name, Location, Email, Company</p>
                  <p>• Contacts matching your selected roles</p>
                  <p>• Based on selected locations & industries</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Debug Panel */}
        <SearchDebugPanel
          selectedIndustries={selectedIndustries}
          selectedSectors={selectedSectors}
          selectedLocations={selectedLocations}
          selectedRoles={selectedRoles}
          maxContacts={maxContacts}
          candidateName={cvData?.name}
        />

        {/* Step 5: Run */}
        <Card className="animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Play className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 5: Find Contacts</CardTitle>
                <CardDescription>
                  {canRun 
                    ? `Ready to find up to ${maxContacts} contacts for ${cvData?.name} in ${selectedLocations.length} location(s)`
                    : "Complete all steps above to start searching"
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
                  Searching Apollo.io...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Find Hiring Contacts
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
