import { useState } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { CVUploadZone } from "@/components/upload/CVUploadZone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getBrandingForPreset, getStoredBrandingPreset } from "@/lib/cvBranding";
import { normalizeCandidateName } from "@/lib/nameUtils";

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

type CVBrandingAssets = {
  headerImageUrl: string | null;
  watermarkImageUrl: string | null;
  headerText: string;
};

export default function CVEditor() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvData, setCvData] = useState<ParsedCandidate | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [isParsingCV, setIsParsingCV] = useState(false);

  const sanitizeCandidateForClient = (candidate: ParsedCandidate): ParsedCandidate => {
    // Privacy-first editor mode: keep full name and professional history, strip direct personal contacts.
    return {
      ...candidate,
      name: normalizeCandidateName(candidate.name) || candidate.name,
      current_title: candidate.current_title || "",
      location: "",
      email: "",
      phone: "",
    };
  };

  const selectedPreset = getStoredBrandingPreset();
  const presetBranding = getBrandingForPreset(selectedPreset);
  const branding: CVBrandingAssets = {
    headerImageUrl: presetBranding.headerImageUrl,
    watermarkImageUrl: presetBranding.watermarkImageUrl,
    headerText: presetBranding.headerText,
  };

  const handleCvFileSelect = async (file: File) => {
    setCvFile(file);
    setCvError(null);
    setCvData(null);
    setIsParsingCV(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-cv`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to parse CV");
      }

      setCvData(sanitizeCandidateForClient(result.data));
      toast({
        title: "CV parsed",
        description: "Personal contact fields were removed. You can edit and download the CV.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse CV";
      setCvError(message);
      toast({
        title: "Parse failed",
        description: message,
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

  return (
    <AppLayout title="CV Editor" description="Upload, edit, and download CVs without running search">
      <div className="buttons-3d max-w-4xl space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/previous-cvs")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to CVs
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Edit CV
            </CardTitle>
            <CardDescription>
              This is a standalone CV editing flow. Use "Edit Parsed CV" after upload, then download.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CVUploadZone
              onFileSelect={handleCvFileSelect}
              onClear={handleCvClear}
              onParsed={setCvData}
              file={cvFile}
              parsedData={cvData}
              error={cvError}
              isProcessing={isParsingCV}
              originalFile={cvFile}
              headerImageUrl={branding.headerImageUrl}
              watermarkImageUrl={branding.watermarkImageUrl}
              headerText={branding.headerText}
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
