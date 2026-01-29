import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Clock, Trash2, Search, Play } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useProfileName } from "@/hooks/useProfileName";
import { getCandidateProfiles, deleteCandidateProfile } from "@/lib/dataApi";

interface SavedProfile {
  id: string;
  profile_name: string;
  candidate_id: string;
  name: string;
  current_title: string | null;
  location: string | null;
  email: string | null;
  skills: string[];
  work_history: { company: string; title: string; duration?: string }[];
  created_at: string;
}

export default function PreviousCVs() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const profileName = useProfileName();
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
        skills: (p.skills as string[]) || [],
        work_history: (p.work_history as { company: string; title: string; duration?: string }[]) || [],
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
      title="Previous CVs"
      description="View and manage saved candidate profiles"
    >
      <div className="max-w-4xl space-y-6">
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
