/**
 * Enhanced CV Analysis Engine
 * Provides intelligent analysis of CVs to suggest industries, locations, and target contact roles
 */

import { 
  COMPANY_TO_INDUSTRY, 
  TITLE_TO_INDUSTRY, 
  INDUSTRY_TO_SECTOR,
  matchCompanyToIndustries,
  matchTitleToIndustries,
  inferSectorsFromIndustries
} from "./industryMatcher";

// ============== TYPES ==============

export interface WorkExperience {
  company: string;
  title: string;
  duration?: string;
}

export interface Education {
  institution: string;
  degree: string;
  year?: string;
}

export interface ParsedCandidate {
  candidate_id: string;
  name: string;
  current_title: string;
  location: string;
  email?: string;
  phone?: string;
  summary?: string;
  skills: string[];
  work_history: WorkExperience[];
  education?: Education[];
}

export interface IndustrySuggestion {
  industries: string[];
  sectors: string[];
  confidence: "high" | "medium" | "low";
  matchedCompanies: string[];
  reasoning: string[];
}

export interface LocationSuggestion {
  locations: string[];
  countries: string[];
  confidence: "high" | "medium" | "low";
  reasoning: string[];
}

export interface RoleSuggestion {
  roles: string[];
  confidence: "high" | "medium" | "low";
  reasoning: string[];
}

export interface CVAnalysisResult {
  industries: IndustrySuggestion;
  locations: LocationSuggestion;
  roles: RoleSuggestion;
}

// ============== LOCATION MAPPINGS ==============

// City to location value mapping (matching LocationSelector values)
const CITY_TO_LOCATION: Record<string, { value: string; country: string }> = {
  // UK
  "london": { value: "london", country: "United Kingdom" },
  "manchester": { value: "manchester", country: "United Kingdom" },
  "birmingham": { value: "birmingham", country: "United Kingdom" },
  "edinburgh": { value: "edinburgh", country: "United Kingdom" },
  "glasgow": { value: "glasgow", country: "United Kingdom" },
  "leeds": { value: "leeds", country: "United Kingdom" },
  "bristol": { value: "bristol", country: "United Kingdom" },
  "cambridge": { value: "cambridge", country: "United Kingdom" },
  "oxford": { value: "oxford", country: "United Kingdom" },
  "uk": { value: "United Kingdom", country: "United Kingdom" },
  "united kingdom": { value: "United Kingdom", country: "United Kingdom" },
  "britain": { value: "United Kingdom", country: "United Kingdom" },
  "england": { value: "United Kingdom", country: "United Kingdom" },
  
  // Ireland
  "dublin": { value: "dublin", country: "Ireland" },
  "cork": { value: "cork", country: "Ireland" },
  "galway": { value: "galway", country: "Ireland" },
  "ireland": { value: "Ireland", country: "Ireland" },
  
  // Germany
  "frankfurt": { value: "frankfurt", country: "Germany" },
  "berlin": { value: "berlin", country: "Germany" },
  "munich": { value: "munich", country: "Germany" },
  "hamburg": { value: "hamburg", country: "Germany" },
  "dusseldorf": { value: "dusseldorf", country: "Germany" },
  "düsseldorf": { value: "dusseldorf", country: "Germany" },
  "cologne": { value: "cologne", country: "Germany" },
  "köln": { value: "cologne", country: "Germany" },
  "stuttgart": { value: "stuttgart", country: "Germany" },
  "germany": { value: "Germany", country: "Germany" },
  
  // France
  "paris": { value: "paris", country: "France" },
  "lyon": { value: "lyon", country: "France" },
  "marseille": { value: "marseille", country: "France" },
  "nice": { value: "nice", country: "France" },
  "toulouse": { value: "toulouse", country: "France" },
  "france": { value: "France", country: "France" },
  
  // Netherlands
  "amsterdam": { value: "amsterdam", country: "Netherlands" },
  "rotterdam": { value: "rotterdam", country: "Netherlands" },
  "the hague": { value: "the-hague", country: "Netherlands" },
  "eindhoven": { value: "eindhoven", country: "Netherlands" },
  "netherlands": { value: "Netherlands", country: "Netherlands" },
  "holland": { value: "Netherlands", country: "Netherlands" },
  
  // Switzerland
  "zurich": { value: "zurich", country: "Switzerland" },
  "zürich": { value: "zurich", country: "Switzerland" },
  "geneva": { value: "geneva", country: "Switzerland" },
  "genève": { value: "geneva", country: "Switzerland" },
  "basel": { value: "basel", country: "Switzerland" },
  "bern": { value: "bern", country: "Switzerland" },
  "switzerland": { value: "Switzerland", country: "Switzerland" },
  
  // Belgium
  "brussels": { value: "brussels", country: "Belgium" },
  "antwerp": { value: "antwerp", country: "Belgium" },
  "belgium": { value: "Belgium", country: "Belgium" },
  
  // Luxembourg
  "luxembourg": { value: "luxembourg-city", country: "Luxembourg" },
  "luxembourg city": { value: "luxembourg-city", country: "Luxembourg" },
  
  // Spain
  "madrid": { value: "madrid", country: "Spain" },
  "barcelona": { value: "barcelona", country: "Spain" },
  "valencia": { value: "valencia", country: "Spain" },
  "seville": { value: "seville", country: "Spain" },
  "spain": { value: "Spain", country: "Spain" },
  
  // Italy
  "milan": { value: "milan", country: "Italy" },
  "milano": { value: "milan", country: "Italy" },
  "rome": { value: "rome", country: "Italy" },
  "roma": { value: "rome", country: "Italy" },
  "turin": { value: "turin", country: "Italy" },
  "florence": { value: "florence", country: "Italy" },
  "italy": { value: "Italy", country: "Italy" },
  
  // Portugal
  "lisbon": { value: "lisbon", country: "Portugal" },
  "porto": { value: "porto", country: "Portugal" },
  "portugal": { value: "Portugal", country: "Portugal" },
  
  // Austria
  "vienna": { value: "vienna", country: "Austria" },
  "wien": { value: "vienna", country: "Austria" },
  "austria": { value: "Austria", country: "Austria" },
  
  // Nordics
  "stockholm": { value: "stockholm", country: "Sweden" },
  "gothenburg": { value: "gothenburg", country: "Sweden" },
  "sweden": { value: "Sweden", country: "Sweden" },
  "oslo": { value: "oslo", country: "Norway" },
  "norway": { value: "Norway", country: "Norway" },
  "copenhagen": { value: "copenhagen", country: "Denmark" },
  "denmark": { value: "Denmark", country: "Denmark" },
  "helsinki": { value: "helsinki", country: "Finland" },
  "finland": { value: "Finland", country: "Finland" },
  
  // Poland
  "warsaw": { value: "warsaw", country: "Poland" },
  "krakow": { value: "krakow", country: "Poland" },
  "poland": { value: "Poland", country: "Poland" },
  
  // Asia Pacific
  "singapore": { value: "singapore", country: "Singapore" },
  "hong kong": { value: "hong-kong", country: "Hong Kong" },
  "hongkong": { value: "hong-kong", country: "Hong Kong" },
  "tokyo": { value: "tokyo", country: "Japan" },
  "osaka": { value: "osaka", country: "Japan" },
  "japan": { value: "Japan", country: "Japan" },
  "sydney": { value: "sydney", country: "Australia" },
  "melbourne": { value: "melbourne", country: "Australia" },
  "brisbane": { value: "brisbane", country: "Australia" },
  "perth": { value: "perth", country: "Australia" },
  "australia": { value: "Australia", country: "Australia" },
  "mumbai": { value: "mumbai", country: "India" },
  "bangalore": { value: "bangalore", country: "India" },
  "bengaluru": { value: "bangalore", country: "India" },
  "delhi": { value: "delhi", country: "India" },
  "india": { value: "India", country: "India" },
  "shanghai": { value: "shanghai", country: "China" },
  "beijing": { value: "beijing", country: "China" },
  "shenzhen": { value: "shenzhen", country: "China" },
  "china": { value: "China", country: "China" },
  "seoul": { value: "seoul", country: "South Korea" },
  "south korea": { value: "South Korea", country: "South Korea" },
  "korea": { value: "South Korea", country: "South Korea" },
  
  // Middle East
  "dubai": { value: "dubai", country: "UAE" },
  "abu dhabi": { value: "abu-dhabi", country: "UAE" },
  "uae": { value: "UAE", country: "UAE" },
  "united arab emirates": { value: "UAE", country: "UAE" },
  "tel aviv": { value: "tel-aviv", country: "Israel" },
  "israel": { value: "Israel", country: "Israel" },
  "riyadh": { value: "riyadh", country: "Saudi Arabia" },
  "saudi arabia": { value: "Saudi Arabia", country: "Saudi Arabia" },
  "saudi": { value: "Saudi Arabia", country: "Saudi Arabia" },
  
  // Canada
  "toronto": { value: "toronto", country: "Canada" },
  "vancouver": { value: "vancouver", country: "Canada" },
  "montreal": { value: "montreal", country: "Canada" },
  "calgary": { value: "calgary", country: "Canada" },
  "ottawa": { value: "ottawa", country: "Canada" },
  "canada": { value: "Canada", country: "Canada" },
  
  // USA
  "new york": { value: "new-york", country: "United States" },
  "nyc": { value: "new-york", country: "United States" },
  "ny": { value: "new-york", country: "United States" },
  "los angeles": { value: "los-angeles", country: "United States" },
  "la": { value: "los-angeles", country: "United States" },
  "chicago": { value: "chicago", country: "United States" },
  "houston": { value: "houston", country: "United States" },
  "san francisco": { value: "san-francisco", country: "United States" },
  "sf": { value: "san-francisco", country: "United States" },
  "boston": { value: "boston", country: "United States" },
  "miami": { value: "miami", country: "United States" },
  "dallas": { value: "dallas", country: "United States" },
  "seattle": { value: "seattle", country: "United States" },
  "denver": { value: "denver", country: "United States" },
  "atlanta": { value: "atlanta", country: "United States" },
  "austin": { value: "austin", country: "United States" },
  "washington": { value: "washington-dc", country: "United States" },
  "dc": { value: "washington-dc", country: "United States" },
  "phoenix": { value: "phoenix", country: "United States" },
  "philadelphia": { value: "philadelphia", country: "United States" },
  "san diego": { value: "san-diego", country: "United States" },
  "charlotte": { value: "charlotte", country: "United States" },
  "san jose": { value: "san-jose", country: "United States" },
  "minneapolis": { value: "minneapolis", country: "United States" },
  "detroit": { value: "detroit", country: "United States" },
  "usa": { value: "United States", country: "United States" },
  "us": { value: "United States", country: "United States" },
  "united states": { value: "United States", country: "United States" },
  "america": { value: "United States", country: "United States" },
  
  // Latin America
  "mexico city": { value: "mexico-city", country: "Mexico" },
  "mexico": { value: "Mexico", country: "Mexico" },
  "sao paulo": { value: "sao-paulo", country: "Brazil" },
  "são paulo": { value: "sao-paulo", country: "Brazil" },
  "rio": { value: "rio", country: "Brazil" },
  "rio de janeiro": { value: "rio", country: "Brazil" },
  "brazil": { value: "Brazil", country: "Brazil" },
};

// Financial hub cities - if someone works in finance, they likely want to target these
const FINANCIAL_HUBS: Record<string, string[]> = {
  "europe": ["london", "frankfurt", "zurich", "geneva", "paris", "luxembourg-city", "amsterdam", "dublin"],
  "apac": ["hong-kong", "singapore", "tokyo", "sydney"],
  "americas": ["new-york", "boston", "toronto", "chicago", "san-francisco"],
  "middle-east": ["dubai", "tel-aviv"],
};

// ============== TARGET ROLE MAPPINGS ==============

// Map candidate seniority to appropriate contact roles
const SENIORITY_TO_TARGET_ROLES: Record<string, string[]> = {
  // Junior candidates should target mid-level HR and recruiters
  "junior": [
    "Recruiter",
    "Talent Acquisition",
    "HR Manager",
    "Human Resources",
    "Hiring Manager",
    "People Operations",
    "Talent Partner",
    "HR Business Partner",
  ],
  
  // Mid-level candidates should target senior HR and some leadership
  "mid": [
    "Talent Acquisition",
    "Head of Talent",
    "HR Director",
    "HR Manager",
    "Recruiting Lead",
    "People Operations",
    "Hiring Manager",
    "Director",
  ],
  
  // Senior candidates should target leadership and C-suite
  "senior": [
    "Managing Director",
    "Partner",
    "Head of Talent",
    "HR Director",
    "CEO",
    "COO",
    "Chief People Officer",
    "VP",
  ],
  
  // Executive candidates should target board-level and C-suite
  "executive": [
    "CEO",
    "Managing Director",
    "Partner",
    "Chairman",
    "Board",
    "Principal",
    "Founder",
    "Head of",
  ],
};

// Industry-specific target roles
const INDUSTRY_TO_TARGET_ROLES: Record<string, string[]> = {
  "Private Equity (PE)": ["Managing Director", "Partner", "Principal", "Head of Talent", "Operating Partner"],
  "Venture Capital (VC)": ["Partner", "Principal", "Talent Partner", "Founder"],
  "Investment Banking": ["Managing Director", "HR Director", "Head of Talent", "Campus Recruiting"],
  "Hedge Fund": ["Managing Director", "Partner", "Head of HR", "Chief Operating Officer"],
  "Management Consulting": ["Partner", "Managing Director", "Recruiting Lead", "HR Director"],
  "Strategy Consulting": ["Partner", "Principal", "Recruiting Lead", "Talent Acquisition"],
  "Real Estate": ["Managing Director", "Partner", "Head of Talent", "HR Director"],
  "Technology": ["VP Engineering", "CTO", "Head of Talent", "Engineering Manager", "HR Director"],
  "Asset Management": ["Managing Director", "Head of HR", "Talent Acquisition", "Portfolio Manager"],
  "FinTech": ["CEO", "VP Engineering", "Head of Talent", "CTO", "HR Director"],
};

// Title patterns that indicate seniority
const SENIORITY_PATTERNS = {
  executive: [
    "ceo", "chief", "cto", "cfo", "coo", "cio", "cmo",
    "founder", "co-founder", "president", "chairman", "board",
  ],
  senior: [
    "managing director", "md", "partner", "principal", "head of",
    "director", "vp", "vice president", "svp", "evp",
    "senior vice", "general manager", "gm",
  ],
  mid: [
    "manager", "senior", "lead", "team lead", "associate director",
    "sr.", "senior associate", "engagement manager", "project leader",
  ],
  junior: [
    "analyst", "associate", "junior", "assistant", "coordinator",
    "trainee", "intern", "graduate", "entry", "staff",
  ],
};

// ============== ANALYSIS FUNCTIONS ==============

export function extractLocationsFromText(text: string): { locations: string[]; countries: string[] } {
  const textLower = text.toLowerCase();
  const locations = new Set<string>();
  const countries = new Set<string>();
  
  for (const [keyword, mapping] of Object.entries(CITY_TO_LOCATION)) {
    // Use word boundary matching to avoid false positives
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(textLower)) {
      locations.add(mapping.value);
      countries.add(mapping.country);
    }
  }
  
  return { 
    locations: Array.from(locations), 
    countries: Array.from(countries) 
  };
}

export function determineSeniority(candidate: ParsedCandidate): "junior" | "mid" | "senior" | "executive" {
  const titlesToAnalyze = [
    candidate.current_title,
    ...(candidate.work_history || []).slice(0, 3).map(w => w.title)
  ].filter(Boolean).map(t => t.toLowerCase());
  
  const allTitlesText = titlesToAnalyze.join(" ");
  
  // Check executive first
  if (SENIORITY_PATTERNS.executive.some(p => allTitlesText.includes(p))) {
    return "executive";
  }
  
  // Check senior
  if (SENIORITY_PATTERNS.senior.some(p => allTitlesText.includes(p))) {
    return "senior";
  }
  
  // Check mid
  if (SENIORITY_PATTERNS.mid.some(p => allTitlesText.includes(p))) {
    return "mid";
  }
  
  // Default to junior or use work history length as proxy
  const workHistoryCount = (candidate.work_history || []).length;
  if (workHistoryCount >= 4) return "mid";
  if (workHistoryCount >= 2) return "mid";
  
  return "junior";
}

export function analyzeLocations(candidate: ParsedCandidate, industries: string[]): LocationSuggestion {
  const locationScores = new Map<string, number>();
  const countryScores = new Map<string, number>();
  const reasoning: string[] = [];
  
  // Track primary locations (from recent work history) separately
  const primaryLocations = new Set<string>();
  let foundWorkHistoryLocations = false;
  
  // 1. HIGHEST PRIORITY: Extract from recent work history (top 3 jobs)
  // These are the PRIMARY suggestions based on where the candidate actually worked
  const recentJobs = (candidate.work_history || []).slice(0, 3);
  recentJobs.forEach((job, index) => {
    // Very high recency weight: most recent = 10x, second = 8x, third = 6x
    const recencyWeight = 10 - index * 2;
    
    // Check company name for location hints
    const companyLocations = extractLocationsFromText(job.company);
    companyLocations.locations.forEach(loc => {
      locationScores.set(loc, (locationScores.get(loc) || 0) + recencyWeight);
      primaryLocations.add(loc);
      foundWorkHistoryLocations = true;
    });
    companyLocations.countries.forEach(country => {
      countryScores.set(country, (countryScores.get(country) || 0) + recencyWeight);
    });
    
    // Check title for regional hints (e.g., "EMEA Director", "APAC Head")
    const titleLower = job.title.toLowerCase();
    if (titleLower.includes("emea") || titleLower.includes("europe")) {
      ["london", "frankfurt", "paris", "amsterdam"].forEach(loc => {
        locationScores.set(loc, (locationScores.get(loc) || 0) + recencyWeight);
        primaryLocations.add(loc);
        foundWorkHistoryLocations = true;
      });
      if (index === 0) reasoning.push(`${job.title} suggests European market focus`);
    }
    if (titleLower.includes("apac") || titleLower.includes("asia")) {
      ["hong-kong", "singapore", "tokyo", "sydney"].forEach(loc => {
        locationScores.set(loc, (locationScores.get(loc) || 0) + recencyWeight);
        primaryLocations.add(loc);
        foundWorkHistoryLocations = true;
      });
      if (index === 0) reasoning.push(`${job.title} suggests Asia Pacific market focus`);
    }
    if (titleLower.includes("americas") || titleLower.includes("latam")) {
      ["new-york", "sao-paulo", "mexico-city"].forEach(loc => {
        locationScores.set(loc, (locationScores.get(loc) || 0) + recencyWeight);
        primaryLocations.add(loc);
        foundWorkHistoryLocations = true;
      });
      if (index === 0) reasoning.push(`${job.title} suggests Americas market focus`);
    }
    
    if (companyLocations.locations.length > 0 && index < 2) {
      reasoning.push(`Recent role at ${job.company}`);
    }
  });
  
  // 2. Extract from current location field
  // If work history didn't yield locations, make this PRIMARY with high weight
  if (candidate.location) {
    const { locations, countries } = extractLocationsFromText(candidate.location);
    const locationWeight = foundWorkHistoryLocations ? 3 : 10; // High weight if no work history locations
    
    locations.forEach(loc => {
      locationScores.set(loc, (locationScores.get(loc) || 0) + locationWeight);
      if (!foundWorkHistoryLocations) primaryLocations.add(loc);
    });
    countries.forEach(country => {
      countryScores.set(country, (countryScores.get(country) || 0) + locationWeight);
    });
    if (locations.length > 0) {
      reasoning.push(`Current location: ${candidate.location}`);
    }
    
    // If still no locations found, try to infer from US state abbreviations or general patterns
    if (locationScores.size === 0 && candidate.location) {
      const locLower = candidate.location.toLowerCase();
      // Check for US patterns (city, state abbreviation like "Chelsea, MA")
      const usStatePattern = /,\s*(ma|ny|ca|tx|fl|il|pa|oh|ga|nc|nj|va|wa|az|co|mi|tn|md|wi|mn|mo|sc|al|la|ky|or|ok|ct|ut|ia|nv|ar|ms|ks|nm|ne|wv|id|hi|nh|me|ri|mt|de|sd|nd|ak|vt|dc|wy)\b/i;
      if (usStatePattern.test(candidate.location)) {
        // This is a US-based candidate - suggest major US cities based on their industry focus
        countryScores.set("United States", 10);
        reasoning.push(`US-based candidate (${candidate.location})`);
      }
    }
  }
  
  // 3. Extract from candidate summary (lower weight)
  if (candidate.summary) {
    const { locations, countries } = extractLocationsFromText(candidate.summary);
    locations.forEach((loc) => {
      locationScores.set(loc, (locationScores.get(loc) || 0) + 2);
    });
    countries.forEach((country) => {
      countryScores.set(country, (countryScores.get(country) || 0) + 2);
    });
    if (locations.length > 0 || countries.length > 0) {
      reasoning.push("Location hints found in CV summary");
    }
  }

  // 4. Extract from education institutions (lowest weight - just supplementary)
  if (candidate.education && Array.isArray(candidate.education)) {
    candidate.education.forEach((edu) => {
      const eduText = [edu.institution, edu.degree, edu.year].filter(Boolean).join(" ");
      const { locations, countries } = extractLocationsFromText(eduText);
      locations.forEach((loc) => {
        locationScores.set(loc, (locationScores.get(loc) || 0) + 1);
      });
      countries.forEach((country) => {
        countryScores.set(country, (countryScores.get(country) || 0) + 1);
      });
    });
  }
  
  // 5. If we have a country but no cities, add major cities for that country
  if (locationScores.size === 0 && countryScores.size > 0) {
    const topCountry = Array.from(countryScores.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const countryCityMap: Record<string, string[]> = {
      "United States": ["new-york", "boston", "chicago", "san-francisco", "los-angeles"],
      "United Kingdom": ["london", "manchester", "edinburgh"],
      "Germany": ["frankfurt", "berlin", "munich"],
      "France": ["paris", "lyon"],
      "Switzerland": ["zurich", "geneva"],
      "Singapore": ["singapore"],
      "Hong Kong": ["hong-kong"],
      "Australia": ["sydney", "melbourne"],
      "Canada": ["toronto", "vancouver"],
    };
    
    const suggestedCities = countryCityMap[topCountry];
    if (suggestedCities) {
      suggestedCities.forEach((city, index) => {
        locationScores.set(city, 8 - index);
        primaryLocations.add(city);
      });
      reasoning.push(`Major ${topCountry} cities suggested`);
    }
  }
  
  // 6. Add financial hub suggestions based on industry (supplementary only)
  const isFinanceRelated = industries.some(ind => 
    INDUSTRY_TO_SECTOR[ind]?.includes("Financial Services")
  );
  
  if (isFinanceRelated) {
    // If candidate is in Europe, suggest European financial hubs
    const europeanCountries = ["United Kingdom", "Germany", "France", "Switzerland", "Netherlands", "Ireland", "Luxembourg"];
    const isEuropean = Array.from(countryScores.keys()).some(c => europeanCountries.includes(c));
    
    if (isEuropean) {
      FINANCIAL_HUBS.europe.forEach(loc => {
        // Only add if not already a primary location
        if (!primaryLocations.has(loc)) {
          locationScores.set(loc, (locationScores.get(loc) || 0) + 0.5);
        }
      });
    }
    
    // If candidate is in APAC, suggest APAC financial hubs
    const apacCountries = ["Singapore", "Hong Kong", "Japan", "Australia", "China", "India"];
    const isApac = Array.from(countryScores.keys()).some(c => apacCountries.includes(c));
    
    if (isApac) {
      FINANCIAL_HUBS.apac.forEach(loc => {
        if (!primaryLocations.has(loc)) {
          locationScores.set(loc, (locationScores.get(loc) || 0) + 0.5);
        }
      });
    }
    
    // If candidate is in Americas, suggest Americas financial hubs
    const americasCountries = ["United States", "Canada", "Brazil", "Mexico"];
    const isAmericas = Array.from(countryScores.keys()).some(c => americasCountries.includes(c));
    
    if (isAmericas) {
      FINANCIAL_HUBS.americas.forEach(loc => {
        if (!primaryLocations.has(loc)) {
          locationScores.set(loc, (locationScores.get(loc) || 0) + 0.5);
        }
      });
    }
  }
  
  // Sort locations - primary ones (from work history) will naturally rank higher
  const sortedLocations = Array.from(locationScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([loc]) => loc);
  
  const sortedCountries = Array.from(countryScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([country]) => country);
  
  // Determine confidence based on whether we found primary locations
  const maxScore = Math.max(...Array.from(locationScores.values()), 0);
  let confidence: "high" | "medium" | "low" = "low";
  if (primaryLocations.size > 0 && maxScore >= 6) confidence = "high";
  else if (maxScore >= 3) confidence = "medium";
  
  return {
    locations: sortedLocations,
    countries: sortedCountries,
    confidence,
    reasoning: reasoning.slice(0, 5),
  };
}

export function analyzeTargetRoles(candidate: ParsedCandidate, industries: string[]): RoleSuggestion {
  const roleScores = new Map<string, number>();
  const reasoning: string[] = [];
  
  // 1. Determine candidate seniority
  const seniority = determineSeniority(candidate);
  reasoning.push(`Candidate seniority: ${seniority}`);
  
  // 2. Add roles based on seniority
  const seniorityRoles = SENIORITY_TO_TARGET_ROLES[seniority] || SENIORITY_TO_TARGET_ROLES.mid;
  seniorityRoles.forEach((role, index) => {
    roleScores.set(role, (roleScores.get(role) || 0) + 5 - index * 0.5);
  });
  
  // 3. Add industry-specific roles
  industries.slice(0, 5).forEach(industry => {
    const industryRoles = INDUSTRY_TO_TARGET_ROLES[industry];
    if (industryRoles) {
      industryRoles.forEach((role, index) => {
        roleScores.set(role, (roleScores.get(role) || 0) + 3 - index * 0.3);
      });
      reasoning.push(`Added ${industry}-specific contacts`);
    }
  });
  
  // 4. Special handling for specific candidate backgrounds
  const currentTitleLower = (candidate.current_title || "").toLowerCase();
  const workHistoryText = (candidate.work_history || []).map(w => w.title.toLowerCase()).join(" ");
  
  // If candidate is in tech, add tech-specific roles
  if (currentTitleLower.includes("engineer") || currentTitleLower.includes("developer") || 
      workHistoryText.includes("engineer") || workHistoryText.includes("software")) {
    ["VP Engineering", "CTO", "Engineering Manager", "Head of Engineering", "Tech Lead"].forEach(role => {
      roleScores.set(role, (roleScores.get(role) || 0) + 2);
    });
    reasoning.push("Added engineering leadership contacts for tech candidate");
  }
  
  // If candidate is in sales, add sales leadership
  if (currentTitleLower.includes("sales") || workHistoryText.includes("sales")) {
    ["VP Sales", "Head of Sales", "Sales Director", "Chief Revenue Officer"].forEach(role => {
      roleScores.set(role, (roleScores.get(role) || 0) + 2);
    });
    reasoning.push("Added sales leadership contacts");
  }
  
  // If candidate is in marketing, add marketing leadership
  if (currentTitleLower.includes("marketing") || workHistoryText.includes("marketing")) {
    ["CMO", "VP Marketing", "Head of Marketing", "Marketing Director"].forEach(role => {
      roleScores.set(role, (roleScores.get(role) || 0) + 2);
    });
    reasoning.push("Added marketing leadership contacts");
  }
  
  // Sort and return top roles
  const sortedRoles = Array.from(roleScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([role]) => role);
  
  // Determine confidence
  const maxScore = Math.max(...Array.from(roleScores.values()), 0);
  let confidence: "high" | "medium" | "low" = "low";
  if (maxScore >= 6) confidence = "high";
  else if (maxScore >= 3) confidence = "medium";
  
  return {
    roles: sortedRoles,
    confidence,
    reasoning: reasoning.slice(0, 5),
  };
}

export function analyzeIndustries(candidate: ParsedCandidate): IndustrySuggestion {
  const industryScores = new Map<string, number>();
  const matchedCompanies: string[] = [];
  const reasoning: string[] = [];
  
  // Collect previous employer names for exclusion (normalized)
  const workHistory = candidate.work_history || [];
  const previousEmployers = new Set<string>(
    workHistory.map(w => w.company.toLowerCase().trim())
  );
  
  // Also create variations of company names to catch partial matches
  const employerVariations = new Set<string>();
  previousEmployers.forEach(employer => {
    employerVariations.add(employer);
    // Add variations without common suffixes
    const withoutSuffixes = employer
      .replace(/\s*(ltd|llp|inc|corp|plc|limited|gmbh|s\.a\.|sa|ag)\.?$/i, '')
      .trim();
    if (withoutSuffixes) employerVariations.add(withoutSuffixes);
    // Add first word for simple company names
    const firstWord = employer.split(/\s+/)[0];
    if (firstWord && firstWord.length > 3) employerVariations.add(firstWord);
  });
  
  const companies = workHistory.map(w => w.company);
  
  // Weight recent experience more heavily
  workHistory.forEach((job, index) => {
    const recencyWeight = Math.max(1, 4 - index * 0.5); // First job = 4x, second = 3.5x, etc.
    
    // Match company
    const companyIndustries = matchCompanyToIndustries(job.company);
    if (companyIndustries.length > 0) {
      matchedCompanies.push(job.company);
      companyIndustries.forEach(ind => {
        industryScores.set(ind, (industryScores.get(ind) || 0) + 4 * recencyWeight);
      });
      reasoning.push(`${job.company} → ${companyIndustries.slice(0, 2).join(", ")}`);
    }
    
    // Match title
    const titleIndustries = matchTitleToIndustries(job.title, companies);
    titleIndustries.forEach(ind => {
      industryScores.set(ind, (industryScores.get(ind) || 0) + 2 * recencyWeight);
    });
  });
  
  // Analyze current title
  if (candidate.current_title) {
    const currentTitleIndustries = matchTitleToIndustries(candidate.current_title, companies);
    currentTitleIndustries.forEach(ind => {
      industryScores.set(ind, (industryScores.get(ind) || 0) + 5); // Current title weighted heavily
    });
    if (currentTitleIndustries.length > 0) {
      reasoning.push(`Current role "${candidate.current_title}" suggests ${currentTitleIndustries[0]}`);
    }
  }
  
  // Analyze skills
  if (candidate.skills && candidate.skills.length > 0) {
    const skillsText = candidate.skills.join(" ").toLowerCase();
    
    // Skill-based industry hints
    if (skillsText.includes("financial modeling") || skillsText.includes("lbo") || skillsText.includes("dcf")) {
      industryScores.set("Investment Banking", (industryScores.get("Investment Banking") || 0) + 3);
      industryScores.set("Private Equity (PE)", (industryScores.get("Private Equity (PE)") || 0) + 3);
      reasoning.push("Financial modeling skills suggest IB/PE");
    }
    if (skillsText.includes("due diligence") || skillsText.includes("deal sourcing")) {
      industryScores.set("Private Equity (PE)", (industryScores.get("Private Equity (PE)") || 0) + 2);
      industryScores.set("Venture Capital (VC)", (industryScores.get("Venture Capital (VC)") || 0) + 1);
    }
    if (skillsText.includes("python") || skillsText.includes("machine learning") || skillsText.includes("algo")) {
      industryScores.set("Quantitative Trading", (industryScores.get("Quantitative Trading") || 0) + 2);
      industryScores.set("Technology", (industryScores.get("Technology") || 0) + 2);
    }
    if (skillsText.includes("react") || skillsText.includes("typescript") || skillsText.includes("node")) {
      industryScores.set("Technology", (industryScores.get("Technology") || 0) + 3);
      industryScores.set("FinTech", (industryScores.get("FinTech") || 0) + 1);
    }
  }
  
  // Sort by score and take top industries
  // CRITICAL: Filter out industries that match previous employer names
  const sortedIndustries = Array.from(industryScores.entries())
    .sort((a, b) => b[1] - a[1])
    .filter(([ind]) => {
      // Check if the industry name matches any previous employer
      const indLower = ind.toLowerCase();
      for (const employer of employerVariations) {
        // Exact match or employer name is contained in industry
        if (indLower === employer || indLower.includes(employer) || employer.includes(indLower)) {
          // Only filter if it's a very close match (company name = industry)
          // Don't filter generic industries like "Private Equity (PE)"
          if (employer.length > 5 && (indLower === employer || employer.includes(indLower))) {
            reasoning.push(`Excluded "${ind}" (previous employer)`);
            return false;
          }
        }
      }
      return true;
    })
    .slice(0, 10)
    .map(([ind]) => ind);
  
  // Determine confidence
  const maxScore = Math.max(...Array.from(industryScores.values()), 0);
  let confidence: "high" | "medium" | "low" = "low";
  if (maxScore >= 10) confidence = "high";
  else if (maxScore >= 5) confidence = "medium";
  
  // Infer sectors - also exclude previous employers from sectors
  const allSectors = inferSectorsFromIndustries(sortedIndustries);
  const sectors = allSectors.filter(sector => {
    const sectorLower = sector.toLowerCase();
    for (const employer of employerVariations) {
      if (sectorLower === employer || sectorLower.includes(employer)) {
        return false;
      }
    }
    return true;
  });
  
  return {
    industries: sortedIndustries,
    sectors: sectors.slice(0, 5),
    confidence,
    matchedCompanies: [...new Set(matchedCompanies)],
    reasoning: reasoning.slice(0, 5),
  };
}

/**
 * Complete CV analysis - returns all suggestions
 */
export function analyzeCVComplete(candidate: ParsedCandidate): CVAnalysisResult {
  const industries = analyzeIndustries(candidate);
  const locations = analyzeLocations(candidate, industries.industries);
  const roles = analyzeTargetRoles(candidate, industries.industries);
  
  return {
    industries,
    locations,
    roles,
  };
}
