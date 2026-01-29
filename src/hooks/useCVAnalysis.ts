import { useMemo } from "react";
import { 
  analyzeCVComplete, 
  analyzeIndustries, 
  analyzeLocations, 
  analyzeTargetRoles,
  type ParsedCandidate,
  type CVAnalysisResult,
  type IndustrySuggestion,
  type LocationSuggestion,
  type RoleSuggestion,
} from "@/lib/cvAnalyzer";

export type { 
  ParsedCandidate, 
  CVAnalysisResult, 
  IndustrySuggestion, 
  LocationSuggestion, 
  RoleSuggestion 
};

/**
 * Hook to perform complete CV analysis and suggest industries, locations, and target roles.
 * Uses the comprehensive CV analysis engine for intelligent suggestions.
 */
export function useCVAnalysis(cvData: ParsedCandidate | null): CVAnalysisResult | null {
  return useMemo(() => {
    if (!cvData) {
      return null;
    }

    return analyzeCVComplete(cvData);
  }, [cvData]);
}

/**
 * Hook for industry suggestions only (backward compatible)
 */
export function useIndustryAnalysis(cvData: ParsedCandidate | null): IndustrySuggestion {
  return useMemo(() => {
    if (!cvData) {
      return { 
        industries: [], 
        sectors: [], 
        confidence: "low" as const,
        matchedCompanies: [],
        reasoning: [],
      };
    }

    return analyzeIndustries(cvData);
  }, [cvData]);
}

/**
 * Hook for location suggestions based on CV and industries
 */
export function useLocationAnalysis(
  cvData: ParsedCandidate | null, 
  industries: string[]
): LocationSuggestion {
  return useMemo(() => {
    if (!cvData) {
      return { 
        locations: [], 
        countries: [],
        confidence: "low" as const,
        reasoning: [],
      };
    }

    return analyzeLocations(cvData, industries);
  }, [cvData, industries]);
}

/**
 * Hook for target role suggestions based on CV and industries
 */
export function useRoleAnalysis(
  cvData: ParsedCandidate | null,
  industries: string[]
): RoleSuggestion {
  return useMemo(() => {
    if (!cvData) {
      return { 
        roles: [], 
        confidence: "low" as const,
        reasoning: [],
      };
    }

    return analyzeTargetRoles(cvData, industries);
  }, [cvData, industries]);
}
