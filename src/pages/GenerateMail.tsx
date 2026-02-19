import { useState, useEffect } from "react";
import { Mail, Loader2, Sparkles, Copy, Check, FileText, Save, Trash2, History, BookTemplate, User, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CVUploadZone } from "@/components/upload/CVUploadZone";
import { IndustrySelector } from "@/components/upload/IndustrySelector";
import { LocationSelector } from "@/components/upload/LocationSelector";
import { SavedProfilesSelector, SavedProfile } from "@/components/upload/SavedProfilesSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getPitchTemplates, savePitchTemplate, deletePitchTemplate, setDefaultTemplate, getPitchHistory, savePitch } from "@/lib/dataApi";
import { useToast } from "@/hooks/use-toast";
import { useProfileName } from "@/hooks/useProfileName";
import { format } from "date-fns";

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

interface PitchTemplate {
  id: string;
  profile_name: string;
  name: string;
  subject_template: string | null;
  body_template: string;
  is_default: boolean;
  created_at: string;
}

interface GeneratedPitch {
  id: string;
  profile_name: string;
  template_id: string | null;
  candidate_name: string;
  candidate_title: string | null;
  subject: string | null;
  body: string;
  industries: string[];
  locations: string[];
  created_at: string;
}

export default function GenerateMail() {
  const { toast } = useToast();
  const profileName = useProfileName();
  
  // Templates
  const [templates, setTemplates] = useState<PitchTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  
  // Save template dialog
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  
  // Pitch history
  const [pitchHistory, setPitchHistory] = useState<GeneratedPitch[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  
  // Pitch template
  const [preferredPitch, setPreferredPitch] = useState("");
  const [subject, setSubject] = useState("");
  
  // CV states
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvData, setCvData] = useState<ParsedCandidate | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [isParsingCV, setIsParsingCV] = useState(false);
  const [loadedFromHistory, setLoadedFromHistory] = useState(false);
  
  // Selection states
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  
  // Pitch mode: 'personalized' (requires CV) or 'general' (no CV needed)
  const [pitchMode, setPitchMode] = useState<"personalized" | "general">("personalized");
  
  // Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPitch, setGeneratedPitch] = useState("");
  const [generatedSubject, setGeneratedSubject] = useState("");
  const [copied, setCopied] = useState<"pitch" | "subject" | null>(null);

  // Load templates when profile changes
  useEffect(() => {
    if (profileName) {
      loadTemplates();
      loadPitchHistory();
    } else {
      setTemplates([]);
      setPitchHistory([]);
    }
  }, [profileName]);

  const loadTemplates = async () => {
    if (!profileName) return;
    
    setIsLoadingTemplates(true);
    try {
      const response = await getPitchTemplates(profileName);
      if (!response.success) throw new Error(response.error);
      
      const data = response.data || [];
      setTemplates(data);
      
      // Auto-select default template
      const defaultTemplate = data.find((t: PitchTemplate) => t.is_default);
      if (defaultTemplate && !selectedTemplateId) {
        setSelectedTemplateId(defaultTemplate.id);
        setPreferredPitch(defaultTemplate.body_template);
        setSubject(defaultTemplate.subject_template || "");
      }
    } catch (error: any) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const loadPitchHistory = async () => {
    if (!profileName) return;
    
    setIsLoadingHistory(true);
    try {
      const response = await getPitchHistory(profileName);
      if (!response.success) throw new Error(response.error);
      
      setPitchHistory(response.data || []);
    } catch (error: any) {
      console.error('Error loading pitch history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setPreferredPitch(template.body_template);
      setSubject(template.subject_template || "");
      toast({
        title: "Template loaded",
        description: `Loaded "${template.name}"`,
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!profileName || !preferredPitch.trim() || !newTemplateName.trim()) return;
    
    setIsSavingTemplate(true);
    try {
      const isFirst = templates.length === 0;
      
      const response = await savePitchTemplate(profileName, {
        name: newTemplateName.trim(),
        subject_template: subject.trim() || null,
        body_template: preferredPitch.trim(),
        is_default: isFirst,
      });

      if (!response.success) throw new Error(response.error);
      
      const data = response.data;
      setTemplates(prev => [data, ...prev]);
      setSelectedTemplateId(data.id);
      setNewTemplateName("");
      setShowSaveTemplateDialog(false);
      
      toast({
        title: "Template saved",
        description: `"${data.name}" has been saved to your templates`,
      });
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: "Error saving template",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!profileName) return;
    try {
      const response = await deletePitchTemplate(profileName, templateId);
      if (!response.success) throw new Error(response.error);
      
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
      }
      
      toast({
        title: "Template deleted",
      });
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error deleting template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSetDefaultTemplate = async (templateId: string) => {
    if (!profileName) return;
    try {
      const response = await setDefaultTemplate(profileName, templateId);
      if (!response.success) throw new Error(response.error);
      
      setTemplates(prev => prev.map(t => ({
        ...t,
        is_default: t.id === templateId,
      })));
      
      toast({
        title: "Default template updated",
      });
    } catch (error: any) {
      console.error('Error setting default:', error);
    }
  };

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
      
      toast({
        title: "CV parsed successfully",
        description: `Extracted profile for ${result.data.name}`,
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

  const handleLoadFromHistory = (pitch: GeneratedPitch) => {
    setGeneratedPitch(pitch.body);
    setGeneratedSubject(pitch.subject || "");
    setShowHistoryDialog(false);
    toast({
      title: "Pitch loaded",
      description: `Loaded pitch for ${pitch.candidate_name}`,
    });
  };

  const canGenerate = profileName && preferredPitch.trim() && selectedIndustries.length > 0 && selectedLocations.length > 0 && !isGenerating && (pitchMode === "general" || cvData);

  const handleGenerate = async () => {
    if (!preferredPitch.trim() || !profileName) return;
    if (pitchMode === "personalized" && !cvData) return;
    
    setIsGenerating(true);
    setGeneratedPitch("");
    setGeneratedSubject("");
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-pitch', {
        body: {
          candidate: pitchMode === "personalized" ? cvData : null,
          preferredPitch: preferredPitch.trim(),
          subject: subject.trim(),
          industries: selectedIndustries,
          sectors: selectedSectors,
          locations: selectedLocations,
          isGeneral: pitchMode === "general",
        }
      });

      if (error) throw error;

      const pitch = data.pitch || "";
      const subjectLine = data.subject || subject.trim();
      
      setGeneratedPitch(pitch);
      setGeneratedSubject(subjectLine);
      
      // Save to history via dataApi
      await savePitch(profileName, {
        template_id: selectedTemplateId,
        candidate_name: pitchMode === "general" ? "General Pitch" : cvData!.name,
        candidate_title: pitchMode === "general" ? null : (cvData?.current_title || null),
        subject: subjectLine || null,
        body: pitch,
        industries: selectedIndustries,
        locations: selectedLocations,
      });
      
      // Refresh history
      loadPitchHistory();
      
      toast({
        title: "Pitch generated",
        description: "Your personalized pitch is ready!",
      });
    } catch (error: any) {
      console.error('Generation error:', error);
      toast({
        title: "Error generating pitch",
        description: error.message || 'Failed to generate pitch',
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, type: "pitch" | "subject") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: "Copied to clipboard",
      description: `${type === "pitch" ? "Pitch" : "Subject"} copied!`,
    });
  };

  if (!profileName) {
    return (
      <AppLayout 
        title="Generate Mail" 
        description="Generate personalized pitch emails for candidates"
      >
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">Select a Profile</h3>
            <p className="text-sm text-muted-foreground">
              Please sign in from the header to generate pitches and save templates.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      title="Generate Mail" 
      description="Generate personalized pitch emails for candidates"
    >
      <div className="max-w-4xl space-y-6">
        {/* Template Management Bar */}
        <Card className="animate-slide-up">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookTemplate className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">Your Templates</CardTitle>
                  <CardDescription>
                    {templates.length > 0 
                      ? `${templates.length} saved template${templates.length > 1 ? 's' : ''}`
                      : "No templates yet - save your first pitch template below"
                    }
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <History className="h-4 w-4 mr-2" />
                      History ({pitchHistory.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Generated Pitches History</DialogTitle>
                      <DialogDescription>
                        Your previously generated pitches
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[50vh]">
                      {pitchHistory.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No pitches generated yet
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {pitchHistory.map((pitch) => (
                            <div 
                              key={pitch.id} 
                              className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => handleLoadFromHistory(pitch)}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-medium">{pitch.candidate_name}</p>
                                  {pitch.candidate_title && (
                                    <p className="text-sm text-muted-foreground">{pitch.candidate_title}</p>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(pitch.created_at), "MMM d, yyyy HH:mm")}
                                </span>
                              </div>
                              {pitch.subject && (
                                <p className="text-sm font-medium text-primary mb-1">
                                  {pitch.subject}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {pitch.body}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          {templates.length > 0 && (
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`
                      group flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
                      ${selectedTemplateId === template.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:border-primary/50 hover:bg-muted/50'
                      }
                    `}
                    onClick={() => handleSelectTemplate(template.id)}
                  >
                    <span className="text-sm font-medium">{template.name}</span>
                    {template.is_default && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}
                    <div className="hidden group-hover:flex items-center gap-1 ml-1">
                      {!template.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefaultTemplate(template.id);
                          }}
                          title="Set as default"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template.id);
                        }}
                        title="Delete template"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Step 1: Template & CV */}
        <Card className="animate-slide-up">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">Step 1: Pitch Template & Candidate</CardTitle>
                  <CardDescription>Provide your preferred pitch style and select a candidate</CardDescription>
                </div>
              </div>
              {preferredPitch.trim() && (
                <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Save as Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Save Template</DialogTitle>
                      <DialogDescription>
                        Save your current pitch as a reusable template
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="templateName">Template Name</Label>
                        <Input
                          id="templateName"
                          placeholder="e.g., PE Candidate Pitch"
                          value={newTemplateName}
                          onChange={(e) => setNewTemplateName(e.target.value)}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p><strong>Subject:</strong> {subject || "(none)"}</p>
                        <p className="mt-1"><strong>Body preview:</strong></p>
                        <p className="line-clamp-3 mt-1">{preferredPitch}</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSaveTemplateDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSaveTemplate} 
                        disabled={!newTemplateName.trim() || isSavingTemplate}
                      >
                        {isSavingTemplate ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Template
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Pitch Mode Toggle */}
            <div className="space-y-2">
              <Label>Pitch Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={pitchMode === "personalized" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPitchMode("personalized")}
                  className="flex-1"
                >
                  <User className="h-4 w-4 mr-2" />
                  Personalized (with CV)
                </Button>
                <Button
                  type="button"
                  variant={pitchMode === "general" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPitchMode("general")}
                  className="flex-1"
                >
                  <Users className="h-4 w-4 mr-2" />
                  General (no CV)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {pitchMode === "personalized" 
                  ? "Generate a pitch tailored to a specific candidate's CV and experience."
                  : "Generate a general pitch template without specific candidate details."
                }
              </p>
            </div>

            {/* Pitch Template */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject (optional)</Label>
                <Input
                  id="subject"
                  placeholder="e.g., Outstanding Private Equity Candidate - Available Immediately"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pitch">Your Preferred Pitch Template *</Label>
                <Textarea
                  id="pitch"
                  placeholder={pitchMode === "personalized" 
                    ? "Paste your preferred pitch email here. The AI will adapt it for the specific candidate while maintaining your style and tone..."
                    : "Paste your preferred pitch email here. The AI will refine it for your target industries and locations..."
                  }
                  value={preferredPitch}
                  onChange={(e) => setPreferredPitch(e.target.value)}
                  className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  {pitchMode === "personalized"
                    ? "The AI will analyze your pitch style and generate a similar one tailored to the candidate's background."
                    : "The AI will refine your pitch template for the selected industries and locations."
                  }
                </p>
              </div>
            </div>

            {/* CV Selection - only for personalized mode */}
            {pitchMode === "personalized" && (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  {loadedFromHistory && cvData ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Selected Candidate</label>
                      <div className="rounded-lg border-2 border-success bg-success/5 p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{cvData.name}</p>
                              <p className="text-sm text-muted-foreground">{cvData.current_title}</p>
                              {cvData.location && (
                                <p className="text-xs text-muted-foreground">{cvData.location}</p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCvClear}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            Change
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <CVUploadZone 
                        onFileSelect={handleCvFileSelect}
                        onClear={handleCvClear}
                        file={cvFile}
                        originalFile={cvFile}
                        parsedData={cvData}
                        error={cvError}
                        isProcessing={isParsingCV}
                      />
                    </>
                  )}
                  
                  {!loadedFromHistory && (
                    <SavedProfilesSelector onSelectProfile={handleSelectSavedProfile} />
                  )}
                </div>

                {/* CV Preview */}
                {cvData && (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <h4 className="font-medium text-foreground">Candidate Summary</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {cvData.name}</p>
                      <p><span className="text-muted-foreground">Title:</span> {cvData.current_title}</p>
                      {cvData.location && <p><span className="text-muted-foreground">Location:</span> {cvData.location}</p>}
                      {cvData.skills?.length > 0 && (
                        <p><span className="text-muted-foreground">Key Skills:</span> {cvData.skills.slice(0, 5).join(", ")}</p>
                      )}
                      {cvData.work_history?.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Recent Experience:</span>
                          <ul className="mt-1 space-y-1 pl-4">
                            {cvData.work_history.slice(0, 2).map((job, i) => (
                              <li key={i} className="text-xs">{job.title} at {job.company}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Target Selection */}
        <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <span className="text-sm font-semibold">2</span>
              </div>
              <div>
                <CardTitle className="text-lg">Step 2: Target Industries & Locations</CardTitle>
                <CardDescription>Select the industries and locations to tailor the pitch</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Target Industries *</Label>
                <IndustrySelector
                  selectedIndustries={selectedIndustries}
                  selectedSectors={selectedSectors}
                  onSelectionChange={setSelectedIndustries}
                  onSectorsChange={setSelectedSectors}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Target Locations *</Label>
                <LocationSelector
                  selectedLocations={selectedLocations}
                  onSelectionChange={setSelectedLocations}
                />
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Pitch...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Personalized Pitch
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Output */}
        {(generatedPitch || generatedSubject) && (
          <Card className="animate-slide-up border-success/50 bg-success/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">Generated Pitch</CardTitle>
                  <CardDescription>Your personalized pitch is ready to use</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {generatedSubject && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Subject Line</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(generatedSubject, "subject")}
                    >
                      {copied === "subject" ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <p className="font-medium">{generatedSubject}</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Email Body</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedPitch, "pitch")}
                  >
                    {copied === "pitch" ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm">{generatedPitch}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
