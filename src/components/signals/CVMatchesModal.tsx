import { useEffect, useState } from "react";
import { FileText, ExternalLink, User, Building2, MapPin, Briefcase } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { getCandidateProfiles } from "@/lib/dataApi";
import { Signal } from "@/lib/signalsApi";

interface CandidateProfile {
  id: string;
  name: string;
  current_title: string | null;
  location: string | null;
  email: string | null;
  skills: string[] | null;
  work_history: Array<{ company: string; title: string }> | null;
  summary: string | null;
  match_score: number | null;
}

interface CVMatchesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signal: Signal | null;
  profileName: string;
  onSelectCV: (cv: CandidateProfile) => void;
}

export function CVMatchesModal({ open, onOpenChange, signal, profileName, onSelectCV }: CVMatchesModalProps) {
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [matchedCandidates, setMatchedCandidates] = useState<Array<CandidateProfile & { matchScore: number; matchRating: number; matchReasons: string[] }>>([]);

  useEffect(() => {
    if (open && profileName) {
      loadCandidates();
    }
  }, [open, profileName]);

  useEffect(() => {
    if (signal && candidates.length > 0) {
      calculateMatches();
    }
  }, [signal, candidates]);

  const loadCandidates = async () => {
    setIsLoading(true);
    try {
      const response = await getCandidateProfiles(profileName);
      if (response.success && response.data) {
        setCandidates(response.data);
      }
    } catch (error) {
      console.error("Failed to load candidates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert raw score to 1-10 rating
  const scoreToRating = (score: number): number => {
    // Max theoretical score is about 100-110, scale to 1-10
    const rating = Math.ceil((score / 100) * 10);
    return Math.max(1, Math.min(10, rating));
  };

  const calculateMatches = () => {
    if (!signal) return;

    const signalCompany = signal.company?.toLowerCase() || "";
    const signalTitle = signal.title?.toLowerCase() || "";
    const signalDescription = signal.description?.toLowerCase() || "";
    const signalType = signal.signal_type || "";
    
    // Keywords to match against candidate profiles
    const signalKeywords = [
      signalCompany,
      ...signalTitle.split(/\s+/),
      ...signalDescription.split(/\s+/).filter(w => w.length > 4),
    ].filter(Boolean);

    const matches = candidates.map(candidate => {
      let score = 0;
      const reasons: string[] = [];

      const candidateData = [
        candidate.name?.toLowerCase() || "",
        candidate.current_title?.toLowerCase() || "",
        candidate.summary?.toLowerCase() || "",
        ...(candidate.skills || []).map(s => s.toLowerCase()),
        ...(candidate.work_history || []).map(w => `${w.company} ${w.title}`.toLowerCase()),
      ].join(" ");

      // Check for PE/VC/Finance experience (high weight)
      const financeKeywords = ["private equity", "pe", "venture", "vc", "investment", "fund", "m&a", "buyout", "portfolio", "asset management", "capital", "finance", "banking"];
      const hasFinanceExp = financeKeywords.some(kw => candidateData.includes(kw));
      if (hasFinanceExp) {
        score += 35;
        reasons.push("PE/Finance background");
      }

      // Match signal type to candidate skills
      if (signalType === "fund_close" || signalType === "new_fund") {
        const fundKeywords = ["fundraising", "investor relations", "lp", "capital raising", "fund operations"];
        if (fundKeywords.some(kw => candidateData.includes(kw))) {
          score += 25;
          reasons.push("Fund experience");
        }
      }

      if (signalType === "deal" || signalType === "exit") {
        const dealKeywords = ["m&a", "due diligence", "transaction", "deal", "acquisition", "divestiture"];
        if (dealKeywords.some(kw => candidateData.includes(kw))) {
          score += 25;
          reasons.push("Deal/M&A experience");
        }
      }

      // Location matching (region-based)
      const regionLocations: Record<string, string[]> = {
        europe: ["london", "frankfurt", "paris", "amsterdam", "zurich", "berlin", "munich", "luxembourg"],
        uae: ["dubai", "abu dhabi", "riyadh", "doha"],
        east_usa: ["new york", "boston", "miami", "washington", "charlotte"],
        west_usa: ["san francisco", "los angeles", "seattle", "denver"],
      };
      
      const signalRegion = signal.region as keyof typeof regionLocations;
      const candidateLocation = candidate.location?.toLowerCase() || "";
      
      if (regionLocations[signalRegion]?.some(loc => candidateLocation.includes(loc))) {
        score += 20;
        reasons.push(`Based in ${signal.region.replace("_", " ").toUpperCase()}`);
      }

      // Keyword overlap (company name, signal keywords)
      const keywordMatches = signalKeywords.filter(kw => 
        kw.length > 3 && candidateData.includes(kw.toLowerCase())
      );
      if (keywordMatches.length > 0) {
        score += Math.min(keywordMatches.length * 5, 20);
        if (keywordMatches.length >= 2) {
          reasons.push(`${keywordMatches.length} keyword matches`);
        }
      }

      // Seniority matching for high-value signals
      if (signal.amount && signal.amount >= 100) {
        const seniorTitles = ["director", "vp", "head of", "partner", "principal", "managing"];
        if (seniorTitles.some(t => candidateData.includes(t))) {
          score += 15;
          reasons.push("Senior profile");
        }
      }

      const rating = scoreToRating(score);
      return { ...candidate, matchScore: score, matchRating: rating, matchReasons: reasons };
    });

    // Sort by score and filter those with rating >= 3 (score >= 20)
    const filtered = matches
      .filter(m => m.matchRating >= 3)
      .sort((a, b) => b.matchScore - a.matchScore);

    setMatchedCandidates(filtered);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CV Matches
          </DialogTitle>
          <DialogDescription>
            {signal?.company ? (
              <>Candidates matching <span className="font-medium text-foreground">{signal.company}</span> ({signal.signal_type?.replace("_", " ")})</>
            ) : (
              <>Candidates matching this signal</>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[50vh]">
          {isLoading ? (
            <div className="space-y-3 p-1">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : matchedCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">No matching CVs found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Upload more CVs to find matches for this signal
              </p>
            </div>
          ) : (
            <div className="space-y-3 p-1">
              {matchedCandidates.map(candidate => (
                <Card key={candidate.id} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{candidate.name}</h3>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs font-bold ${
                              candidate.matchRating >= 8 ? "bg-green-500/20 text-green-600" :
                              candidate.matchRating >= 6 ? "bg-yellow-500/20 text-yellow-600" :
                              "bg-muted text-muted-foreground"
                            }`}
                          >
                            {candidate.matchRating}/10 fit
                          </Badge>
                        </div>
                        
                        {candidate.current_title && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Briefcase className="h-3 w-3" />
                            {candidate.current_title}
                          </p>
                        )}
                        
                        {candidate.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {candidate.location}
                          </p>
                        )}

                        {candidate.matchReasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {candidate.matchReasons.map((reason, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button 
                        size="sm" 
                        onClick={() => onSelectCV(candidate)}
                        className="shrink-0"
                      >
                        Use CV
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

        {matchedCandidates.length > 0 && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            {matchedCandidates.length} candidate{matchedCandidates.length !== 1 ? "s" : ""} found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
