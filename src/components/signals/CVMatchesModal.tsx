import { useEffect, useState } from "react";
import { FileText, ExternalLink, User, Building2, MapPin, Briefcase, Brain, Loader2, Sparkles, Target } from "lucide-react";
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
import { Signal, perplexityCVScore, perplexityIdealProfile } from "@/lib/signalsApi";
import { toast } from "sonner";

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

interface PerplexityMatch {
  candidateId: string;
  name: string;
  currentTitle: string | null;
  location: string | null;
  score: number;
  reasons: string[];
  fitSummary: string;
}

interface IdealProfile {
  idealProfile: {
    titles: string[];
    seniority: string;
    mustHaveSkills: string[];
    niceToHaveSkills: string[];
    experienceYears: string;
    industryBackground: string[];
    reasoning: string;
  };
  companyHiringContext: {
    recentHires: string;
    teamSize: string;
    culture: string;
    compensation: string;
  };
  matchCriteria: {
    strongMatch: string[];
    weakMatch: string[];
    dealbreakers: string[];
  };
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
  const [matchedCandidates, setMatchedCandidates] = useState<Array<CandidateProfile & { matchScore: number; matchRating: number; matchReasons: string[]; fitSummary?: string }>>([]);
  
  // Perplexity-powered states
  const [perplexityMatches, setPerplexityMatches] = useState<PerplexityMatch[]>([]);
  const [bestMatch, setBestMatch] = useState<{ candidateId: string; name: string; explanation: string } | null>(null);
  const [idealProfile, setIdealProfile] = useState<IdealProfile | null>(null);
  const [isPerplexityScoring, setIsPerplexityScoring] = useState(false);
  const [isLoadingIdealProfile, setIsLoadingIdealProfile] = useState(false);
  const [usePerplexity, setUsePerplexity] = useState(false);

  useEffect(() => {
    if (open && profileName) {
      loadCandidates();
      setPerplexityMatches([]);
      setBestMatch(null);
      setIdealProfile(null);
      setUsePerplexity(false);
    }
  }, [open, profileName]);

  useEffect(() => {
    if (signal && candidates.length > 0 && !usePerplexity) {
      calculateMatches();
    }
  }, [signal, candidates, usePerplexity]);

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

  const scoreToRating = (score: number): number => {
    const rating = Math.ceil((score / 100) * 10);
    return Math.max(1, Math.min(10, rating));
  };

  const calculateMatches = () => {
    if (!signal) return;

    const signalCompany = signal.company?.toLowerCase() || "";
    const signalTitle = signal.title?.toLowerCase() || "";
    const signalDescription = signal.description?.toLowerCase() || "";
    const signalType = signal.signal_type || "";
    
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

      const financeKeywords = ["private equity", "pe", "venture", "vc", "investment", "fund", "m&a", "buyout", "portfolio", "asset management", "capital", "finance", "banking"];
      if (financeKeywords.some(kw => candidateData.includes(kw))) {
        score += 35;
        reasons.push("PE/Finance background");
      }

      if (signalType === "fund_close" || signalType === "new_fund") {
        if (["fundraising", "investor relations", "lp", "capital raising", "fund operations"].some(kw => candidateData.includes(kw))) {
          score += 25;
          reasons.push("Fund experience");
        }
      }

      if (signalType === "deal" || signalType === "exit") {
        if (["m&a", "due diligence", "transaction", "deal", "acquisition", "divestiture"].some(kw => candidateData.includes(kw))) {
          score += 25;
          reasons.push("Deal/M&A experience");
        }
      }

      const regionLocations: Record<string, string[]> = {
        europe: ["london", "frankfurt", "paris", "amsterdam", "zurich", "berlin", "munich", "luxembourg"],
        uae: ["dubai", "abu dhabi", "riyadh", "doha"],
        east_usa: ["new york", "boston", "miami", "washington", "charlotte"],
        west_usa: ["san francisco", "los angeles", "seattle", "denver"],
      };
      
      const candidateLocation = candidate.location?.toLowerCase() || "";
      if (regionLocations[signal.region]?.some(loc => candidateLocation.includes(loc))) {
        score += 20;
        reasons.push(`Based in ${signal.region.replace("_", " ").toUpperCase()}`);
      }

      const keywordMatches = signalKeywords.filter(kw => kw.length > 3 && candidateData.includes(kw.toLowerCase()));
      if (keywordMatches.length > 0) {
        score += Math.min(keywordMatches.length * 5, 20);
        if (keywordMatches.length >= 2) reasons.push(`${keywordMatches.length} keyword matches`);
      }

      if (signal.amount && signal.amount >= 100) {
        if (["director", "vp", "head of", "partner", "principal", "managing"].some(t => candidateData.includes(t))) {
          score += 15;
          reasons.push("Senior profile");
        }
      }

      return { ...candidate, matchScore: score, matchRating: scoreToRating(score), matchReasons: reasons };
    });

    const filtered = matches.filter(m => m.matchRating >= 3).sort((a, b) => b.matchScore - a.matchScore);
    setMatchedCandidates(filtered);
  };

  const handlePerplexityScore = async () => {
    if (!signal) return;
    setIsPerplexityScoring(true);
    setUsePerplexity(true);

    try {
      const result = await perplexityCVScore(signal.id, profileName);
      if (result.success && result.matches) {
        setPerplexityMatches(result.matches);
        setBestMatch(result.bestMatch || null);

        // Merge with candidate data for the display
        const enhanced = result.matches.map(m => {
          const candidate = candidates.find(c => c.id === m.candidateId);
          if (!candidate) return null;
          return {
            ...candidate,
            matchScore: m.score * 10,
            matchRating: m.score,
            matchReasons: m.reasons,
            fitSummary: m.fitSummary,
          };
        }).filter(Boolean) as Array<CandidateProfile & { matchScore: number; matchRating: number; matchReasons: string[]; fitSummary?: string }>;

        setMatchedCandidates(enhanced);
        toast.success(`Perplexity scored ${result.matches.length} candidates`);
      } else {
        toast.error(result.error || "Scoring failed");
        setUsePerplexity(false);
      }
    } catch (err) {
      console.error("Perplexity scoring error:", err);
      toast.error("Failed to score with Perplexity");
      setUsePerplexity(false);
    } finally {
      setIsPerplexityScoring(false);
    }
  };

  const handleLoadIdealProfile = async () => {
    if (!signal) return;
    setIsLoadingIdealProfile(true);

    try {
      const result = await perplexityIdealProfile(signal.id);
      if (result.success && result.idealProfile) {
        setIdealProfile(result.idealProfile);
        toast.success("Ideal profile loaded");
      } else {
        toast.error(result.error || "Failed to load ideal profile");
      }
    } catch (err) {
      console.error("Ideal profile error:", err);
      toast.error("Failed to research ideal profile");
    } finally {
      setIsLoadingIdealProfile(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CV Matches
            {usePerplexity && (
              <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-xs">
                <Brain className="h-3 w-3 mr-1" />
                Perplexity-Powered
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {signal?.company ? (
              <>Candidates matching <span className="font-medium text-foreground">{signal.company}</span> ({signal.signal_type?.replace("_", " ")})</>
            ) : (
              <>Candidates matching this signal</>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={usePerplexity ? "default" : "outline"}
            onClick={handlePerplexityScore}
            disabled={isPerplexityScoring || candidates.length === 0}
            className={usePerplexity ? "bg-purple-600 hover:bg-purple-700" : ""}
          >
            {isPerplexityScoring ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Scoring...</>
            ) : (
              <><Brain className="h-3 w-3 mr-1" />Perplexity Score</>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleLoadIdealProfile}
            disabled={isLoadingIdealProfile}
          >
            {isLoadingIdealProfile ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Researching...</>
            ) : (
              <><Target className="h-3 w-3 mr-1" />Ideal Profile</>
            )}
          </Button>
          {usePerplexity && (
            <Button size="sm" variant="ghost" onClick={() => { setUsePerplexity(false); calculateMatches(); }} className="text-xs">
              Switch to local scoring
            </Button>
          )}
        </div>

        {/* Best Match Banner */}
        {bestMatch && usePerplexity && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Best Match: {bestMatch.name}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                {bestMatch.explanation}
              </p>
            </div>
          </div>
        )}

        {/* Ideal Profile Card */}
        {idealProfile && (
          <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
              <Target className="h-4 w-4" />
              Ideal Candidate Profile
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Titles:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {idealProfile.idealProfile?.titles?.map(t => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Must-have skills:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {idealProfile.idealProfile?.mustHaveSkills?.map(s => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Experience:</span>
                <p className="text-foreground">{idealProfile.idealProfile?.experienceYears} years | {idealProfile.idealProfile?.seniority}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Compensation:</span>
                <p className="text-foreground">{idealProfile.companyHiringContext?.compensation || "N/A"}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">{idealProfile.idealProfile?.reasoning}</p>
          </div>
        )}

        <ScrollArea className="h-[40vh]">
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
                Upload more CVs or try Perplexity scoring for deeper analysis
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
                          {bestMatch?.candidateId === candidate.id && (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                              <Sparkles className="h-3 w-3 mr-0.5" /> Best
                            </Badge>
                          )}
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

                        {candidate.fitSummary && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1.5 italic">
                            {candidate.fitSummary}
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
            {usePerplexity && " (Perplexity-scored)"}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
