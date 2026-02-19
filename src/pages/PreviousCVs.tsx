import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Clock, Trash2, Search, Play, Download } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useProfileName } from "@/hooks/useProfileName";
import { getCandidateProfiles, deleteCandidateProfile } from "@/lib/dataApi";
import { downloadCandidatePdf } from "@/lib/cvPdf";

interface SavedProfile {
  id: string;
  profile_name: string;
  candidate_id: string;
  name: string;
  current_title: string | null;
  location: string | null;
  email: string | null;
  phone?: string | null;
  summary?: string | null;
  skills: string[];
  work_history: { company: string; title: string; duration?: string }[];
  education?: { institution: string; degree: string; year?: string }[];
  created_at: string;
}

const CV_BRANDING_STORAGE_KEY = "cv-branding-assets.v1";
type PresetKey = "acl_partners" | "everet_marsh" | "brock_decker";

type CVBrandingAssets = {
  headerImageUrl: string | null;
  watermarkImageUrl: string | null;
  headerFileName: string | null;
  watermarkFileName: string | null;
  headerText: string;
};

type CVBrandingStore = {
  selectedPreset: PresetKey;
  presets: Record<PresetKey, CVBrandingAssets>;
};

const DEFAULT_ACL_BRANDING: CVBrandingAssets = {
  headerImageUrl: null,
  watermarkImageUrl: "/cv-branding/presets/acl_watermark.png",
  headerFileName: null,
  watermarkFileName: "acl_watermark.png",
  headerText: "59-60 Russell Square, London, WC1B 4HP\ninfo@aclpartners.co.uk",
};

const DEFAULT_EVERET_BRANDING: CVBrandingAssets = {
  headerImageUrl: "/cv-branding/presets/everet_header.png",
  watermarkImageUrl: "/cv-branding/presets/everet_watermark.png",
  headerFileName: "everet-header.png",
  watermarkFileName: "everet-watermark.png",
  headerText: "Everet Marsh",
};

const DEFAULT_BROCK_BRANDING: CVBrandingAssets = {
  headerImageUrl: null,
  watermarkImageUrl: null,
  headerFileName: null,
  watermarkFileName: null,
  headerText: "Brock & Decker",
};

const DEFAULT_CV_BRANDING_STORE: CVBrandingStore = {
  selectedPreset: "acl_partners",
  presets: {
    acl_partners: DEFAULT_ACL_BRANDING,
    everet_marsh: DEFAULT_EVERET_BRANDING,
    brock_decker: DEFAULT_BROCK_BRANDING,
  },
};

export default function PreviousCVs() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const profileName = useProfileName();
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cvBrandingStore, setCvBrandingStore] = useState<CVBrandingStore>(() => {
    try {
      const raw = localStorage.getItem(CV_BRANDING_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return DEFAULT_CV_BRANDING_STORE;

      // Backward compatibility: old single-preset shape.
      if ("headerImageUrl" in parsed || "watermarkImageUrl" in parsed || "headerText" in parsed) {
        return {
          ...DEFAULT_CV_BRANDING_STORE,
          selectedPreset: "acl_partners",
          presets: {
            ...DEFAULT_CV_BRANDING_STORE.presets,
            acl_partners: {
              headerImageUrl: typeof parsed.headerImageUrl === "string" ? parsed.headerImageUrl : null,
              watermarkImageUrl: typeof parsed.watermarkImageUrl === "string" ? parsed.watermarkImageUrl : null,
              headerFileName: typeof parsed.headerFileName === "string" ? parsed.headerFileName : null,
              watermarkFileName: typeof parsed.watermarkFileName === "string" ? parsed.watermarkFileName : null,
              headerText:
                typeof parsed.headerText === "string" && parsed.headerText.trim().length > 0
                  ? parsed.headerText
                  : DEFAULT_ACL_BRANDING.headerText,
            },
          },
        };
      }

      let selectedPreset: PresetKey = "acl_partners";
      if (parsed.selectedPreset === "acl_partners" || parsed.selectedPreset === "brock_decker" || parsed.selectedPreset === "everet_marsh") {
        selectedPreset = parsed.selectedPreset;
      }
      if (parsed.selectedPreset === "everett_marsh") {
        selectedPreset = "everet_marsh";
      }

      const presets = { ...DEFAULT_CV_BRANDING_STORE.presets };
      for (const key of Object.keys(presets) as PresetKey[]) {
        const candidate =
          parsed.presets?.[key] ||
          (key === "everet_marsh" ? parsed.presets?.everett_marsh : undefined) ||
          {};
        presets[key] = {
          headerImageUrl: typeof candidate.headerImageUrl === "string" ? candidate.headerImageUrl : presets[key].headerImageUrl,
          watermarkImageUrl: typeof candidate.watermarkImageUrl === "string" ? candidate.watermarkImageUrl : presets[key].watermarkImageUrl,
          headerFileName: typeof candidate.headerFileName === "string" ? candidate.headerFileName : presets[key].headerFileName,
          watermarkFileName: typeof candidate.watermarkFileName === "string" ? candidate.watermarkFileName : presets[key].watermarkFileName,
          headerText: typeof candidate.headerText === "string" && candidate.headerText.trim().length > 0 ? candidate.headerText : presets[key].headerText,
        };
      }

      return { selectedPreset, presets };
    } catch {
      return DEFAULT_CV_BRANDING_STORE;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CV_BRANDING_STORAGE_KEY, JSON.stringify(cvBrandingStore));
    } catch (error) {
      console.error("Failed to persist CV branding assets:", error);
    }
  }, [cvBrandingStore]);

  const fetchProfiles = async () => {
    if (!profileName) {
      setProfiles([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await getCandidateProfiles(profileName);

      if (!response.success) throw new Error(response.error);

      const transformedData: SavedProfile[] = (response.data || []).map((p: any) => ({
        id: p.id,
        profile_name: p.profile_name,
        candidate_id: p.candidate_id,
        name: p.name,
        current_title: p.current_title,
        location: p.location,
        email: p.email,
        phone: p.phone,
        summary: p.summary,
        skills: (p.skills as string[]) || [],
        work_history: (p.work_history as { company: string; title: string; duration?: string }[]) || [],
        education: (p.education as { institution: string; degree: string; year?: string }[]) || [],
        created_at: p.created_at,
      }));

      // Deduplicate by name+email, keeping only the most recent
      const seen = new Map<string, SavedProfile>();
      for (const profile of transformedData) {
        const key = `${profile.name}|${profile.email || ''}`;
        if (!seen.has(key)) {
          seen.set(key, profile);
        }
      }
      
      setProfiles(Array.from(seen.values()));
    } catch (error) {
      console.error("Error fetching profiles:", error);
      toast({
        title: "Error",
        description: "Failed to load saved profiles",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [profileName]);

  const handleDelete = async (profileId: string) => {
    if (!profileName) return;
    
    try {
      const response = await deleteCandidateProfile(profileName, profileId);

      if (!response.success) throw new Error(response.error);
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      toast({
        title: "Profile deleted",
        description: "The saved CV has been removed",
      });
    } catch (error) {
      console.error("Error deleting profile:", error);
      toast({
        title: "Error",
        description: "Failed to delete profile",
        variant: "destructive",
      });
    }
  };

  const handleRunSearch = (profile: SavedProfile) => {
    // Store the selected profile in sessionStorage for the UploadRun page to pick up
    sessionStorage.setItem("selected-cv-profile", JSON.stringify(profile));
    navigate("/");
  };

  const readImageAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

  const handleBrandingUpload = async (type: "header" | "watermark", file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file for CV branding.",
        variant: "destructive",
      });
      return;
    }
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setCvBrandingStore((prev) => {
        const presetKey = prev.selectedPreset;
        const current = prev.presets[presetKey];
        return {
          ...prev,
          presets: {
            ...prev.presets,
            [presetKey]:
              type === "header"
                ? { ...current, headerImageUrl: dataUrl, headerFileName: file.name }
                : { ...current, watermarkImageUrl: dataUrl, watermarkFileName: file.name },
          },
        };
      });
      toast({
        title: type === "header" ? "Header uploaded" : "Watermark uploaded",
        description: "Saved in selected company preset.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unable to read image file",
        variant: "destructive",
      });
    }
  };

  const clearBrandingAsset = (type: "header" | "watermark") => {
    setCvBrandingStore((prev) => {
      const presetKey = prev.selectedPreset;
      const current = prev.presets[presetKey];
      return {
        ...prev,
        presets: {
          ...prev.presets,
          [presetKey]:
            type === "header"
              ? { ...current, headerImageUrl: null, headerFileName: null }
              : { ...current, watermarkImageUrl: null, watermarkFileName: null },
        },
      };
    });
  };

  const downloadProfileCV = async (profile: SavedProfile) => {
    const active = cvBrandingStore.presets[cvBrandingStore.selectedPreset];
    await downloadCandidatePdf(profile, `${(profile.name || "candidate").replace(/\s+/g, "-")}-cv`, {
      watermarkImageUrl: active.watermarkImageUrl,
      headerImageUrl: active.headerImageUrl,
      headerText: active.headerText,
    });
  };

  const renderCVBrandingCard = () => (
    <Card>
      <CardHeader>
        <CardTitle>CV Branding</CardTitle>
        <CardDescription>Upload assets once here. Watermark is top-left, header is top-right in CV preview.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="cvs-preset" className="mb-2 block">Company Preset</Label>
          <select
            id="cvs-preset"
            value={cvBrandingStore.selectedPreset}
            onChange={(e) =>
              setCvBrandingStore((prev) => ({ ...prev, selectedPreset: e.target.value as PresetKey }))
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="acl_partners">ACL Partners</option>
            <option value="everet_marsh">Everet Marsh</option>
            <option value="brock_decker">Brock &amp; Decker (Coming)</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <Button onClick={() => navigate("/cvs/editor")} className="w-full sm:w-auto">
            Upload CV & Edit
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cvs-watermark-upload">Watermark (Top Left)</Label>
          <Input
            id="cvs-watermark-upload"
            type="file"
            accept="image/*"
            onChange={(e) => handleBrandingUpload("watermark", e.target.files?.[0] || null)}
          />
          {cvBrandingStore.presets[cvBrandingStore.selectedPreset].watermarkFileName ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate pr-2">{cvBrandingStore.presets[cvBrandingStore.selectedPreset].watermarkFileName}</span>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => clearBrandingAsset("watermark")}>
                Remove
              </Button>
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cvs-header-upload">Header (Top Right)</Label>
          <Input
            id="cvs-header-upload"
            type="file"
            accept="image/*"
            onChange={(e) => handleBrandingUpload("header", e.target.files?.[0] || null)}
          />
          {cvBrandingStore.presets[cvBrandingStore.selectedPreset].headerFileName ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate pr-2">{cvBrandingStore.presets[cvBrandingStore.selectedPreset].headerFileName}</span>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => clearBrandingAsset("header")}>
                Remove
              </Button>
            </div>
          ) : null}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="cvs-header-text">Header Text (Top Right)</Label>
          <Input
            id="cvs-header-text"
            value={cvBrandingStore.presets[cvBrandingStore.selectedPreset].headerText}
            onChange={(e) =>
              setCvBrandingStore((prev) => {
                const presetKey = prev.selectedPreset;
                return {
                  ...prev,
                  presets: {
                    ...prev.presets,
                    [presetKey]: { ...prev.presets[presetKey], headerText: e.target.value },
                  },
                };
              })
            }
            placeholder="59-60 Russell Square, London, WC1B 4HP | info@aclpartners.co.uk"
          />
          <p className="text-xs text-muted-foreground">
            Used as a text header opposite the watermark when no header image is uploaded.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const filteredProfiles = profiles.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.profile_name.toLowerCase().includes(query) ||
      p.current_title?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AppLayout
      title="CVs"
      description="View and manage saved candidate profiles"
    >
      <div className="max-w-4xl space-y-6">
        {renderCVBrandingCard()}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">Saved Candidates</CardTitle>
                  <CardDescription>
                    {profiles.length} saved profile{profiles.length !== 1 ? "s" : ""}
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, title, or uploader..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {!profileName ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">Select a Profile</h3>
                <p className="text-sm text-muted-foreground">
                  Choose your profile from the header to view your saved CVs
                </p>
              </div>
            ) : isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading profiles...
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No matching profiles found" : "No saved profiles yet. Upload a CV to get started."}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {profile.name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {profile.profile_name}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {profile.current_title || "No title"} • {profile.location || "No location"}
                      </p>
                      {profile.work_history && profile.work_history.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Latest: {profile.work_history[0]?.title} @ {profile.work_history[0]?.company}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        <Clock className="h-3 w-3" />
                        {formatDate(profile.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadProfileCV(profile)}
                        className="gap-1"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleRunSearch(profile)}
                        className="gap-1"
                      >
                        <Play className="h-3 w-3" />
                        Run Search
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(profile.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
