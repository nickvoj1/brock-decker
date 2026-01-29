import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Loader2, FileText, Settings2, Users, MapPin } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CVUploadZone } from "@/components/upload/CVUploadZone";
import { IndustrySelector } from "@/components/upload/IndustrySelector";
import { IndustrySuggestions } from "@/components/upload/IndustrySuggestions";
import { LocationSelector } from "@/components/upload/LocationSelector";
import { LocationSuggestions } from "@/components/upload/LocationSuggestions";
import { RoleSelector } from "@/components/upload/RoleSelector";
import { RoleSuggestions } from "@/components/upload/RoleSuggestions";
import { SearchDebugPanel } from "@/components/upload/SearchDebugPanel";
import { ContactPreviewModal, Contact } from "@/components/upload/ContactPreviewModal";
import { SavedProfilesSelector, SavedProfile } from "@/components/upload/SavedProfilesSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCVAnalysis } from "@/hooks/useCVAnalysis";
import { useProfileName } from "@/hooks/useProfileName";
import { createEnrichmentRun, updateEnrichmentRun } from "@/lib/dataApi";
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
  
  // Use the shared profile name hook - this ensures sync with header profile selector
  const profileName = useProfileName();
  
  // Quick search mode (no CV)
  const [isQuickSearch, setIsQuickSearch] = useState(false);
  const [quickSearchName, setQuickSearchName] = useState('');
  const [existingSearchNames, setExistingSearchNames] = useState<string[]>([]);
  
  // CV file states
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvData, setCvData] = useState<ParsedCandidate | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [isParsingCV, setIsParsingCV] = useState(false);
  const [loadedFromHistory, setLoadedFromHistory] = useState(false);
  
  // Industry selection
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  
  // Industry sectors (optional, broad categories) - always start empty
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  
  // Excluded industries (for this search only)
  const [excludedIndustries, setExcludedIndustries] = useState<string[]>([]);
  
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
  
  // Contact preview modal state
  const [showPreview, setShowPreview] = useState(false);
  const [previewContacts, setPreviewContacts] = useState<Contact[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  // Comprehensive CV analysis for industries, locations, and roles
  const cvAnalysis = useCVAnalysis(cvData);

  // Fetch existing search names for uniqueness validation
  useEffect(() => {
    const fetchExistingNames = async () => {
      const { data } = await supabase
        .from('enrichment_runs')
        .select('candidates_data')
        .eq('uploaded_by', profileName);
      
      if (data) {
        const names = data
          .map(r => {
            const candidates = r.candidates_data as any[];
            return candidates?.[0]?.name;
          })
          .filter(Boolean);
        setExistingSearchNames(names);
      }
    };
    if (profileName) fetchExistingNames();
  }, [profileName]);

  // Check for profile selected from PreviousCVs page
  useEffect(() => {
    const storedProfile = sessionStorage.getItem("selected-cv-profile");
    if (storedProfile) {
      try {
        const profile = JSON.parse(storedProfile);
        handleSelectSavedProfile(profile);
        sessionStorage.removeItem("selected-cv-profile");
      } catch (e) {
        console.error("Failed to parse stored profile:", e);
      }
    }
  }, []);

  // Profile name now managed by useProfileName hook - no need to save here

  // Save selected roles to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(selectedRoles));
  }, [selectedRoles]);

  const handleCvFileSelect = async (file: File) => {
    setCvFile(file);
    setCvError(null);
    setCvData(null);
    setIsParsingCV(true);
    setLoadedFromHistory(false);

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
      
      // Auto-save to history if profile name is set
      if (profileName.trim()) {
        await saveCandidateProfile(result.data);
      }
      
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
    setLoadedFromHistory(false);
  };

  // Handle selecting a saved profile from history
  const handleSelectSavedProfile = (profile: SavedProfile) => {
    const candidate: ParsedCandidate = {
      candidate_id: profile.candidate_id,
      name: profile.name,
      current_title: profile.current_title || '',
      location: profile.location || '',
      email: profile.email || undefined,
      phone: profile.phone || undefined,
      summary: profile.summary || undefined,
      skills: profile.skills,
      work_history: profile.work_history,
      education: profile.education,
    };
    setCvData(candidate);
    setCvFile(null);
    setCvError(null);
    setLoadedFromHistory(true);
    toast({
      title: "Profile loaded",
      description: `Loaded ${profile.name}'s profile from history`,
    });
  };

  // Save parsed CV to database (upsert - update if same name+email exists)
  const saveCandidateProfile = async (candidate: ParsedCandidate) => {
    if (!profileName.trim()) return;
    
    try {
      // Check if a profile with the same name and email already exists
      let query = supabase
        .from("candidate_profiles")
        .select("id")
        .eq("name", candidate.name);
      
      if (candidate.email) {
        query = query.eq("email", candidate.email);
      }
      
      const { data: existing } = await query.maybeSingle();
      
      if (existing) {
        // Update existing profile
        const { error } = await supabase
          .from("candidate_profiles")
          .update({
            profile_name: profileName.trim(),
            candidate_id: candidate.candidate_id,
            current_title: candidate.current_title,
            location: candidate.location,
            phone: candidate.phone || null,
            summary: candidate.summary || null,
            skills: candidate.skills as unknown as Json,
            work_history: candidate.work_history as unknown as Json,
            education: candidate.education as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new profile
        const { error } = await supabase.from("candidate_profiles").insert({
          profile_name: profileName.trim(),
          candidate_id: candidate.candidate_id,
          name: candidate.name,
          current_title: candidate.current_title,
          location: candidate.location,
          email: candidate.email || null,
          phone: candidate.phone || null,
          summary: candidate.summary || null,
          skills: candidate.skills as unknown as Json,
          work_history: candidate.work_history as unknown as Json,
          education: candidate.education as unknown as Json,
        });

        if (error) throw error;
      }
    } catch (error) {
      console.error("Error saving candidate profile:", error);
    }
  };

  const isSearchNameUnique = quickSearchName.trim() && !existingSearchNames.includes(quickSearchName.trim());
  
  // Require profile to be selected to run searches
  const canRunCvMode = profileName && cvData && selectedIndustries.length > 0 && selectedLocations.length > 0 && selectedRoles.length > 0 && !isRunning && !isParsingCV;
  const canRunQuickMode = profileName && isQuickSearch && isSearchNameUnique && selectedIndustries.length > 0 && selectedLocations.length > 0 && selectedRoles.length > 0 && !isRunning;
  const canRun = isQuickSearch ? canRunQuickMode : canRunCvMode;

  // Convert selected industries to preferences data format for backend
  const getPreferencesData = () => {
    return selectedIndustries.map(industry => ({
      industry,
      companies: '',
      exclusions: '',
      excludedIndustries: excludedIndustries, // Pass excluded industries to backend
      locations: selectedLocations,
      targetRoles: selectedRoles,
      sectors: selectedSectors, // Include selected sectors for Apollo filtering
    }));
  };

  const handleRunEnrichment = async () => {
    // For quick search, create a placeholder candidate
    const candidateData = isQuickSearch 
      ? {
          candidate_id: `QS-${Date.now()}`,
          name: quickSearchName.trim(),
          current_title: 'Quick Search',
          location: selectedLocations[0] || '',
          skills: [],
          work_history: [],
          education: [],
        }
      : cvData;
    
    if (!candidateData || selectedIndustries.length === 0) return;
    
    const preferencesData = getPreferencesData();
    
    setIsRunning(true);
    
    try {
      // Create a new run record via data-api (service role, bypasses RLS)
      const runResult = await createEnrichmentRun(profileName.trim(), {
        search_counter: maxContacts,
        candidates_count: 1,
        preferences_count: selectedIndustries.length,
        status: 'running' as const,
        bullhorn_enabled: false,
        candidates_data: JSON.parse(JSON.stringify([candidateData])),
        preferences_data: JSON.parse(JSON.stringify(preferencesData)),
      });

      if (!runResult.success || !runResult.data) {
        throw new Error(runResult.error || 'Failed to create run');
      }
      
      const run = runResult.data;

      toast({
        title: "Searching for contacts",
        description: `Finding up to ${maxContacts} hiring contacts${isQuickSearch ? ` for "${quickSearchName}"` : ` for ${candidateData.name}`}`,
      });

      // Call the enrichment edge function
      const { data: enrichResult, error: enrichError } = await supabase.functions.invoke('run-enrichment', {
        body: { runId: run.id }
      });

      if (enrichError) {
        await updateEnrichmentRun(profileName.trim(), run.id, { 
          status: 'failed', 
          error_message: enrichError.message 
        });
        throw enrichError;
      }

      // Use contacts directly from edge function response (no extra DB fetch needed)
      const contacts = (enrichResult?.contacts as Contact[]) || [];
      
      if (contacts.length > 0) {
        setPreviewContacts(contacts);
        setCurrentRunId(run.id);
        setShowPreview(true);
      } else {
        toast({
          title: "No contacts found",
          description: "Try adjusting your search criteria",
          variant: "destructive",
        });
      }
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

  const handleDownloadCSV = (contacts: Contact[]) => {
    if (contacts.length === 0) return;
    
    const csvHeader = "Name,Title,Location,Email,Company\n";
    const csvRows = contacts.map(c => 
      `"${c.name}","${c.title}","${c.location}","${c.email}","${c.company}"`
    ).join("\n");
    
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${isQuickSearch ? quickSearchName.replace(/\s+/g, '-') : (cvData?.name?.replace(/\s+/g, '-') || 'export')}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "CSV Downloaded",
      description: `Exported ${contacts.length} contacts`,
    });
  };

  const handleProceedToHistory = () => {
    setShowPreview(false);
    navigate('/history');
  };

  return (
    <>
    <AppLayout 
      title="Find Hiring Contacts" 
      description="Upload a CV and find relevant hiring contacts on Apollo.io"
    >
      <div className="max-w-4xl space-y-6">
        {/* Step 1: Upload CV or Quick Search */}
        <Card className="animate-slide-up">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">Step 1: {isQuickSearch ? 'Name Your Search' : 'Upload CV'} & Select Industries</CardTitle>
                  <CardDescription>{isQuickSearch ? 'Enter a unique search name' : 'Upload a candidate CV or select from history'}, then choose target industries</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsQuickSearch(!isQuickSearch);
                  if (!isQuickSearch) {
                    handleCvClear();
                  }
                }}
              >
                {isQuickSearch ? 'Use CV' : 'Quick Search'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* CV Upload or Quick Search Name */}
              <div className="space-y-3">
                {isQuickSearch ? (
                  <div className="space-y-2">
                    <Label htmlFor="quickSearchName">Search Name (must be unique)</Label>
                    <Input
                      id="quickSearchName"
                      placeholder="e.g., Private Equity London Q1"
                      value={quickSearchName}
                      onChange={(e) => setQuickSearchName(e.target.value)}
                      className={quickSearchName && !isSearchNameUnique ? 'border-destructive' : ''}
                    />
                    {quickSearchName && !isSearchNameUnique && (
                      <p className="text-xs text-destructive">This name already exists. Please choose a unique name.</p>
                    )}
                    {quickSearchName && isSearchNameUnique && (
                      <p className="text-xs text-success">✓ Name is unique</p>
                    )}
                  </div>
                ) : loadedFromHistory && cvData ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Selected Candidate</label>
                    <div className="rounded-lg border-2 border-success bg-success/5 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                            <Users className="h-5 w-5 text-success" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{cvData.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {cvData.current_title} • {cvData.location}
                            </p>
                            <p className="text-xs text-success mt-1">Loaded from history</p>
                          </div>
                        </div>
                        <button
                          onClick={handleCvClear}
                          className="rounded-full p-1 hover:bg-muted transition-colors"
                        >
                          <span className="sr-only">Clear</span>
                          ×
                        </button>
                      </div>
                      {cvData.work_history && cvData.work_history.length > 0 && (
                        <div className="mt-3 p-2 rounded-md bg-muted/50 text-sm">
                          <span className="text-muted-foreground">Recent:</span>{" "}
                          <span className="text-foreground">
                            {cvData.work_history[0]?.title} @ {cvData.work_history[0]?.company}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <CVUploadZone
                    onFileSelect={handleCvFileSelect}
                    onClear={handleCvClear}
                    onParsed={setCvData}
                    file={cvFile}
                    parsedData={cvData}
                    error={cvError}
                    isProcessing={isParsingCV}
                  />
                )}
                {/* Saved Profiles Selector - only show in CV mode */}
                {!isQuickSearch && (
                  <SavedProfilesSelector
                    onSelectProfile={handleSelectSavedProfile}
                  />
                )}
              </div>
              <div className="space-y-4">
                <IndustrySelector
                  selectedIndustries={selectedIndustries}
                  onSelectionChange={setSelectedIndustries}
                  selectedSectors={selectedSectors}
                  onSectorsChange={setSelectedSectors}
                  excludedIndustries={excludedIndustries}
                  onExcludedChange={setExcludedIndustries}
                />
                {cvData && cvAnalysis && (cvAnalysis.industries.industries.length > 0 || cvAnalysis.industries.sectors.length > 0) && (
                  <IndustrySuggestions
                    industrySuggestions={cvAnalysis.industries.industries}
                    sectorSuggestions={cvAnalysis.industries.sectors}
                    selectedIndustries={selectedIndustries}
                    selectedSectors={selectedSectors}
                    confidence={cvAnalysis.industries.confidence}
                    matchedCompanies={cvAnalysis.industries.matchedCompanies}
                    onAddIndustry={(industry) => {
                      if (!selectedIndustries.includes(industry)) {
                        setSelectedIndustries([...selectedIndustries, industry]);
                      }
                    }}
                    onAddSector={(sector) => {
                      if (!selectedSectors.includes(sector)) {
                        setSelectedSectors([...selectedSectors, sector]);
                      }
                    }}
                    onAddAllIndustries={() => {
                      const newIndustries = [...selectedIndustries];
                      cvAnalysis.industries.industries.forEach((i) => {
                        if (!newIndustries.includes(i)) {
                          newIndustries.push(i);
                        }
                      });
                      setSelectedIndustries(newIndustries);
                    }}
                    onAddAllSectors={() => {
                      const newSectors = [...selectedSectors];
                      cvAnalysis.industries.sectors.forEach((s) => {
                        if (!newSectors.includes(s)) {
                          newSectors.push(s);
                        }
                      });
                      setSelectedSectors(newSectors);
                    }}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Select Locations */}
        <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 2: Select Locations</CardTitle>
                <CardDescription>Choose where to find hiring contacts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <LocationSelector
              selectedLocations={selectedLocations}
              onSelectionChange={setSelectedLocations}
            />
            {cvData && cvAnalysis && cvAnalysis.locations.locations.length > 0 && (
              <LocationSuggestions
                locationSuggestions={cvAnalysis.locations.locations}
                countrySuggestions={cvAnalysis.locations.countries}
                selectedLocations={selectedLocations}
                confidence={cvAnalysis.locations.confidence}
                reasoning={cvAnalysis.locations.reasoning}
                onAddLocation={(location) => {
                  if (!selectedLocations.includes(location)) {
                    setSelectedLocations([...selectedLocations, location]);
                  }
                }}
                onAddAllLocations={() => {
                  const newLocations = [...selectedLocations];
                  [...cvAnalysis.locations.countries, ...cvAnalysis.locations.locations].forEach((loc) => {
                    if (!newLocations.includes(loc)) {
                      newLocations.push(loc);
                    }
                  });
                  setSelectedLocations(newLocations);
                }}
              />
            )}
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
            {cvData && cvAnalysis && cvAnalysis.roles.roles.length > 0 && (
              <RoleSuggestions
                suggestions={cvAnalysis.roles.roles}
                selectedRoles={selectedRoles}
                confidence={cvAnalysis.roles.confidence}
                reasoning={cvAnalysis.roles.reasoning}
                onAddRole={(role) => {
                  if (!selectedRoles.includes(role)) {
                    setSelectedRoles([...selectedRoles, role]);
                  }
                }}
                onAddAll={() => {
                  const newRoles = [...selectedRoles];
                  cvAnalysis.roles.roles.forEach((role) => {
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
                  {!profileName 
                    ? "Please sign in from the header to run searches"
                    : canRun 
                      ? `Ready to find up to ${maxContacts} contacts for ${isQuickSearch ? quickSearchName : cvData?.name} in ${selectedLocations.length} location(s)`
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
    
    {/* Contact Preview Modal */}
    <ContactPreviewModal
      isOpen={showPreview}
      onClose={() => setShowPreview(false)}
      contacts={previewContacts}
      candidateName={cvData?.name || "Candidate"}
      onProceed={handleProceedToHistory}
      onDownload={handleDownloadCSV}
    />
    </>
  );
}
