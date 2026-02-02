import { useState, useEffect } from "react";
import { User, Clock, ChevronDown, Trash2, Search } from "lucide-react";
import { getCandidateProfiles, deleteCandidateProfile } from "@/lib/dataApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useProfileName } from "@/hooks/useProfileName";

export interface SavedProfile {
  id: string;
  profile_name: string;
  candidate_id: string;
  name: string;
  current_title: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  summary: string | null;
  skills: string[];
  work_history: { company: string; title: string; duration?: string }[];
  education: { institution: string; degree: string; year?: string }[];
  created_at: string;
}

interface SavedProfilesSelectorProps {
  onSelectProfile: (profile: SavedProfile) => void;
}

export function SavedProfilesSelector({
  onSelectProfile,
}: SavedProfilesSelectorProps) {
  const profileName = useProfileName();
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchProfiles = async () => {
    if (!profileName) return;
    
    setIsLoading(true);
    try {
      const result = await getCandidateProfiles(profileName);
      
      if (!result.success) throw new Error(result.error);
      
      // Transform data to match our interface
      const transformedData: SavedProfile[] = (result.data || []).map((p: any) => ({
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
      
      setProfiles(transformedData);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount and when profile changes
  useEffect(() => {
    fetchProfiles();
  }, [profileName]);

  const handleDelete = async (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    if (!profileName) return;
    
    try {
      const result = await deleteCandidateProfile(profileName, profileId);
      if (!result.success) throw new Error(result.error);
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    } catch (error) {
      console.error("Error deleting profile:", error);
    }
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
    });
  };

  return (
    <div className="space-y-3">

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (!isOpen) fetchProfiles();
            }}
          >
            <span className="flex items-center gap-1.5">
              <User className="h-3 w-3" />
              Select from Previous CVs ({profiles.length})
            </span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="rounded-lg border bg-card p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, title, or uploader..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Loading profiles...
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                {searchQuery ? "No matching profiles found" : "No saved profiles yet"}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => {
                      onSelectProfile(profile);
                      setIsOpen(false);
                    }}
                    className="flex items-center justify-between p-3 rounded-md border bg-background hover:bg-muted/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {profile.name}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {profile.profile_name}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {profile.current_title || "No title"}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(profile.created_at)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDelete(e, profile.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
