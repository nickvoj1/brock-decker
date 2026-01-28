import { useState, useEffect } from "react";
import { Mail, Loader2, Sparkles, Copy, Check, FileText } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export default function GenerateMail() {
  const { toast } = useToast();
  
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
  
  // Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPitch, setGeneratedPitch] = useState("");
  const [generatedSubject, setGeneratedSubject] = useState("");
  const [copied, setCopied] = useState<"pitch" | "subject" | null>(null);

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

  const canGenerate = cvData && preferredPitch.trim() && selectedIndustries.length > 0 && selectedLocations.length > 0 && !isGenerating;

  const handleGenerate = async () => {
    if (!cvData || !preferredPitch.trim()) return;
    
    setIsGenerating(true);
    setGeneratedPitch("");
    setGeneratedSubject("");
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-pitch', {
        body: {
          candidate: cvData,
          preferredPitch: preferredPitch.trim(),
          subject: subject.trim(),
          industries: selectedIndustries,
          sectors: selectedSectors,
          locations: selectedLocations,
        }
      });

      if (error) throw error;

      setGeneratedPitch(data.pitch || "");
      setGeneratedSubject(data.subject || subject.trim());
      
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

  return (
    <AppLayout 
      title="Generate Mail" 
      description="Generate personalized pitch emails for candidates"
    >
      <div className="max-w-4xl space-y-6">
        {/* Step 1: Template & CV */}
        <Card className="animate-slide-up">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 1: Pitch Template & Candidate</CardTitle>
                <CardDescription>Provide your preferred pitch style and select a candidate</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
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
                  placeholder="Paste your preferred pitch email here. The AI will adapt it for the specific candidate while maintaining your style and tone..."
                  value={preferredPitch}
                  onChange={(e) => setPreferredPitch(e.target.value)}
                  className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  The AI will analyze your pitch style and generate a similar one tailored to the candidate's background.
                </p>
              </div>
            </div>

            {/* CV Selection */}
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
