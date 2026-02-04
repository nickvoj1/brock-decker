// Region detection patterns for auto-routing signals based on feedback
const REGION_PATTERNS: Record<string, string[]> = {
  london: [
    "london",
    "uk",
    "united kingdom",
    "britain",
    "british",
    "england",
    "ftse",
    "city of london",
    "canary wharf",
    "mayfair",
    "the city",
  ],
  europe: [
    "europe",
    "european",
    "eu",
    "germany",
    "german",
    "france",
    "french",
    "paris",
    "frankfurt",
    "amsterdam",
    "netherlands",
    "dutch",
    "spain",
    "spanish",
    "madrid",
    "italy",
    "italian",
    "milan",
    "switzerland",
    "swiss",
    "zurich",
    "geneva",
    "nordic",
    "scandinavia",
    "sweden",
    "stockholm",
    "copenhagen",
    "denmark",
    "norway",
    "oslo",
    "finland",
    "helsinki",
    "belgium",
    "brussels",
    "luxembourg",
    "portugal",
    "lisbon",
    "austria",
    "vienna",
    "ireland",
    "dublin",
    "poland",
    "warsaw",
  ],
  uae: [
    "uae",
    "dubai",
    "abu dhabi",
    "emirates",
    "middle east",
    "mena",
    "gulf",
    "gcc",
    "saudi",
    "qatar",
    "bahrain",
    "kuwait",
    "oman",
    "riyadh",
  ],
  usa: [
    "usa",
    "us",
    "united states",
    "america",
    "american",
    "new york",
    "nyc",
    "boston",
    "chicago",
    "san francisco",
    "sf",
    "los angeles",
    "la",
    "texas",
    "dallas",
    "houston",
    "atlanta",
    "miami",
    "seattle",
    "washington dc",
    "wall street",
    "silicon valley",
  ],
};

// Phrases that indicate the user wants to move the signal to a different region
const REASSIGNMENT_PHRASES = [
  "actually",
  "should be",
  "belongs to",
  "move to",
  "wrong region",
  "not",
  "is really",
  "this is",
  "it's",
  "its",
  "correct region is",
  "correct region:",
  "goes to",
];

export interface RegionDetectionResult {
  detectedRegion: string | null;
  confidence: "high" | "medium" | "low";
  matchedKeywords: string[];
}

/**
 * Detects if feedback text suggests the signal belongs to a different region
 * @param feedbackText The user's feedback comment
 * @param currentRegion The signal's current region
 * @returns Detection result with region and confidence
 */
export function detectRegionFromFeedback(
  feedbackText: string,
  currentRegion: string
): RegionDetectionResult {
  const lowerText = feedbackText.toLowerCase();
  const lowerCurrentRegion = currentRegion.toLowerCase();
  
  // Check if the text contains reassignment phrases
  const hasReassignmentPhrase = REASSIGNMENT_PHRASES.some(phrase => 
    lowerText.includes(phrase)
  );
  
  // Find all region matches
  const matches: { region: string; keywords: string[]; count: number }[] = [];
  
  for (const [region, keywords] of Object.entries(REGION_PATTERNS)) {
    const matchedKeywords = keywords.filter(kw => lowerText.includes(kw));
    if (matchedKeywords.length > 0) {
      matches.push({
        region,
        keywords: matchedKeywords,
        count: matchedKeywords.length,
      });
    }
  }
  
  // Sort by number of keyword matches
  matches.sort((a, b) => b.count - a.count);
  
  // If no matches found, return null
  if (matches.length === 0) {
    return {
      detectedRegion: null,
      confidence: "low",
      matchedKeywords: [],
    };
  }
  
  const topMatch = matches[0];
  
  // If the top match is the current region, try the second match
  if (topMatch.region === lowerCurrentRegion) {
    if (matches.length > 1) {
      const secondMatch = matches[1];
      return {
        detectedRegion: secondMatch.region,
        confidence: hasReassignmentPhrase ? "high" : "medium",
        matchedKeywords: secondMatch.keywords,
      };
    }
    return {
      detectedRegion: null,
      confidence: "low",
      matchedKeywords: [],
    };
  }
  
  // Determine confidence based on keyword count and reassignment phrases
  let confidence: "high" | "medium" | "low" = "low";
  
  if (hasReassignmentPhrase && topMatch.count >= 1) {
    confidence = "high";
  } else if (topMatch.count >= 2) {
    confidence = "high";
  } else if (topMatch.count === 1 && hasReassignmentPhrase) {
    confidence = "high";
  } else if (topMatch.count === 1) {
    confidence = "medium";
  }
  
  return {
    detectedRegion: topMatch.region,
    confidence,
    matchedKeywords: topMatch.keywords,
  };
}

/**
 * Validates if a region string is a valid region
 */
export function isValidRegion(region: string): boolean {
  const validRegions = ["london", "europe", "uae", "usa"];
  return validRegions.includes(region.toLowerCase());
}

/**
 * Normalizes region string to proper format
 */
export function normalizeRegion(region: string): string {
  const normalized = region.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
