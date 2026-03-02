import { useState } from "react";
import { Brain, Building2, TrendingUp, Target, Loader2, ChevronDown, ChevronUp, ExternalLink, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WorkExperience {
  company: string;
  title: string;
  duration?: string;
}

interface CVData {
  name: string;
  current_title: string;
  location: string;
  skills: string[];
  work_history: WorkExperience[];
  summary?: string;
}

interface CompanyResearch {
  company: string;
  sector: string;
  size: string;
  reputation: string;
  relevance: string;
}

interface MarketInsights {
  hotRoles: string[];
  trendingSkills: string[];
  marketOutlook: string;
  salaryRange: string;
  demandLevel: "high" | "medium" | "low";
}

interface SkillsAnalysis {
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  competitiveness: "high" | "medium" | "low";
}

interface TargetingSuggestions {
  industries: string[];
  locations: string[];
  roles: string[];
  reasoning: string;
}

interface PerplexityResearch {
  companyResearch: CompanyResearch[];
  marketInsights: MarketInsights;
  skillsAnalysis: SkillsAnalysis;
  targetingSuggestions: TargetingSuggestions;
}

interface Props {
  cvData: CVData | null;
  onApplyIndustries?: (industries: string[]) => void;
  onApplyLocations?: (locations: string[]) => void;
  onApplyRoles?: (roles: string[]) => void;
}

const levelConfig = {
  high: { color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", icon: CheckCircle2, label: "High" },
  medium: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: TrendingUp, label: "Medium" },
  low: { color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: AlertTriangle, label: "Low" },
};

export function PerplexityCVInsights({ cvData, onApplyIndustries, onApplyLocations, onApplyRoles }: Props) {
  const [research, setResearch] = useState<PerplexityResearch | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>("companies");
  const { toast } = useToast();

  const handleResearch = async () => {
    if (!cvData) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("perplexity-cv-research", {
        body: { cvData },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Research failed");

      setResearch(data.research);
      setCitations(data.citations || []);
      setIsExpanded(true);

      toast({
        title: "Perplexity Research Complete",
        description: `Analyzed ${data.research?.companyResearch?.length || 0} companies with market insights`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to run research";
      toast({ title: "Research Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!cvData) return null;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <Card className="animate-slide-up border-purple-500/20 bg-purple-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Perplexity Market Intelligence</CardTitle>
              <CardDescription>AI-powered research on companies, market trends & skills</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {research && (
              <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
            <Button
              onClick={handleResearch}
              disabled={isLoading}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Researching...
                </>
              ) : research ? (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Re-research
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Run Research
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {research && isExpanded && (
        <CardContent className="space-y-4">
          {/* Company Research */}
          {research.companyResearch?.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => toggleSection("companies")}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                  <Building2 className="h-4 w-4" />
                  Company Research ({research.companyResearch.length})
                </div>
                {expandedSection === "companies" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedSection === "companies" && (
                <div className="space-y-2 pl-6">
                  {research.companyResearch.map((c, i) => (
                    <div key={i} className="p-3 rounded-lg bg-background border text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{c.company}</span>
                        <Badge variant="outline" className="text-xs">{c.sector}</Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {c.size} • {c.reputation}
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">{c.relevance}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Market Insights */}
          {research.marketInsights && (
            <div className="space-y-2">
              <button
                onClick={() => toggleSection("market")}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                  <TrendingUp className="h-4 w-4" />
                  Market Insights
                  {research.marketInsights.demandLevel && (
                    <Badge variant="outline" className={cn("text-xs", levelConfig[research.marketInsights.demandLevel]?.bg, levelConfig[research.marketInsights.demandLevel]?.border)}>
                      {research.marketInsights.demandLevel} demand
                    </Badge>
                  )}
                </div>
                {expandedSection === "market" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedSection === "market" && (
                <div className="space-y-3 pl-6">
                  <p className="text-sm text-muted-foreground">{research.marketInsights.marketOutlook}</p>
                  {research.marketInsights.salaryRange && (
                    <p className="text-xs text-muted-foreground">💰 Salary range: <span className="text-foreground font-medium">{research.marketInsights.salaryRange}</span></p>
                  )}
                  {research.marketInsights.hotRoles?.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">🔥 Hot roles:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {research.marketInsights.hotRoles.map((role) => (
                          <Badge key={role} variant="outline" className="text-xs cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30" onClick={() => onApplyRoles?.([role])}>
                            + {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {research.marketInsights.trendingSkills?.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">📈 Trending skills:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {research.marketInsights.trendingSkills.map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Skills Analysis */}
          {research.skillsAnalysis && (
            <div className="space-y-2">
              <button
                onClick={() => toggleSection("skills")}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                  <Target className="h-4 w-4" />
                  Skills Gap Analysis
                  {research.skillsAnalysis.competitiveness && (
                    <Badge variant="outline" className={cn("text-xs", levelConfig[research.skillsAnalysis.competitiveness]?.bg, levelConfig[research.skillsAnalysis.competitiveness]?.border)}>
                      {research.skillsAnalysis.competitiveness} competitiveness
                    </Badge>
                  )}
                </div>
                {expandedSection === "skills" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedSection === "skills" && (
                <div className="space-y-3 pl-6">
                  {research.skillsAnalysis.strengths?.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">✅ Strengths:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {research.skillsAnalysis.strengths.map((s) => (
                          <Badge key={s} variant="outline" className="text-xs bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {research.skillsAnalysis.gaps?.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">⚠️ Gaps to address:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {research.skillsAnalysis.gaps.map((g) => (
                          <Badge key={g} variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300">{g}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {research.skillsAnalysis.recommendations?.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">💡 Recommendations:</span>
                      <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                        {research.skillsAnalysis.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Targeting Suggestions with Apply buttons */}
          {research.targetingSuggestions && (
            <div className="space-y-2">
              <button
                onClick={() => toggleSection("targeting")}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                  <Sparkles className="h-4 w-4" />
                  AI Targeting Suggestions
                </div>
                {expandedSection === "targeting" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedSection === "targeting" && (
                <div className="space-y-3 pl-6">
                  <p className="text-xs text-muted-foreground italic">{research.targetingSuggestions.reasoning}</p>
                  {research.targetingSuggestions.industries?.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Industries:</span>
                        <Button variant="ghost" size="sm" className="h-5 px-2 text-xs text-purple-600" onClick={() => onApplyIndustries?.(research.targetingSuggestions.industries)}>
                          Apply all
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {research.targetingSuggestions.industries.map((ind) => (
                          <Badge key={ind} variant="outline" className="text-xs cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30" onClick={() => onApplyIndustries?.([ind])}>
                            + {ind}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {research.targetingSuggestions.locations?.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Locations:</span>
                        <Button variant="ghost" size="sm" className="h-5 px-2 text-xs text-purple-600" onClick={() => onApplyLocations?.(research.targetingSuggestions.locations)}>
                          Apply all
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {research.targetingSuggestions.locations.map((loc) => (
                          <Badge key={loc} variant="outline" className="text-xs cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30" onClick={() => onApplyLocations?.([loc])}>
                            + {loc}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {research.targetingSuggestions.roles?.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Target roles:</span>
                        <Button variant="ghost" size="sm" className="h-5 px-2 text-xs text-purple-600" onClick={() => onApplyRoles?.(research.targetingSuggestions.roles)}>
                          Apply all
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {research.targetingSuggestions.roles.map((role) => (
                          <Badge key={role} variant="outline" className="text-xs cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30" onClick={() => onApplyRoles?.([role])}>
                            + {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Citations */}
          {citations.length > 0 && (
            <div className="pt-2 border-t border-purple-500/10">
              <p className="text-xs text-muted-foreground mb-1">Sources:</p>
              <div className="flex flex-wrap gap-1">
                {citations.slice(0, 5).map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                  >
                    <ExternalLink className="h-3 w-3" />
                    [{i + 1}]
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
