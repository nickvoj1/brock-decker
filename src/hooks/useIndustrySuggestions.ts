import { useMemo } from "react";
import { 
  analyzeCandidate, 
  type ParsedCandidate, 
  type IndustrySuggestion 
} from "@/lib/industryMatcher";

export type { IndustrySuggestion };

/**
 * Hook to analyze a parsed CV and suggest matching industries and sectors.
 * Uses the comprehensive industry matching engine for precise suggestions.
 */
export function useIndustrySuggestions(
  cvData: ParsedCandidate | null
): IndustrySuggestion {
  return useMemo(() => {
    if (!cvData) {
      return { 
        industries: [], 
        sectors: [], 
        confidence: "low" as const,
        matchedCompanies: [] 
      };
    }

    return analyzeCandidate(cvData);
  }, [cvData]);
}
