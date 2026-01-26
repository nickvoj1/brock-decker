import { useMemo } from "react";

interface WorkExperience {
  company: string;
  title: string;
  duration?: string;
}

interface ParsedCandidate {
  candidate_id: string;
  name: string;
  current_title: string;
  location: string;
  email?: string;
  phone?: string;
  summary?: string;
  skills: string[];
  work_history: WorkExperience[];
}

// Keywords that map to specific target roles
const ROLE_KEYWORDS: Record<string, string[]> = {
  // HR & Recruiting
  "Recruiter": ["recruit", "sourcing", "talent acquisition", "headhunt"],
  "Talent Acquisition": ["talent acquisition", "ta ", "recruiting lead"],
  "HR Manager": ["hr manager", "human resources manager", "people manager"],
  "Human Resources": ["human resources", "hr ", "hrbp"],
  "Hiring Manager": ["hiring manager"],
  "Head of Talent": ["head of talent", "talent lead", "talent director"],
  "People Operations": ["people ops", "people operations", "people team"],
  "HR Director": ["hr director", "head of hr", "chief people"],
  "Talent Partner": ["talent partner", "recruiting partner"],
  "HR Business Partner": ["hrbp", "hr business partner"],
  
  // Senior Leadership
  "CEO": ["ceo", "chief executive", "founder", "co-founder"],
  "Chief Executive": ["chief executive officer"],
  "CTO": ["cto", "chief technology", "chief tech"],
  "CFO": ["cfo", "chief financial", "finance director"],
  "COO": ["coo", "chief operating", "operations director"],
  "Managing Director": ["managing director", "md ", "general manager"],
  "VP": ["vice president", "vp ", "svp ", "evp "],
  "Director": ["director of", "senior director"],
  "Partner": ["partner at", "equity partner", "managing partner"],
  "Principal": ["principal ", "senior principal"],
  
  // Finance & Investment
  "Investment Manager": ["investment manager", "portfolio manager"],
  "Portfolio Manager": ["portfolio manager", "pm "],
  "Fund Manager": ["fund manager", "asset manager"],
  "Finance Director": ["finance director", "head of finance"],
  "Finance Manager": ["finance manager", "financial controller"],
  "Investment Director": ["investment director", "head of investments"],
  "Head of Investments": ["head of investments", "chief investment"],
  
  // Technology
  "Engineering Manager": ["engineering manager", "em ", "dev manager"],
  "Head of Engineering": ["head of engineering", "vp engineering"],
  "VP Engineering": ["vp engineering", "vp of engineering"],
  "Tech Lead": ["tech lead", "technical lead", "lead engineer"],
  "IT Director": ["it director", "head of it", "cio"],
};

// Industry context that suggests certain roles
const INDUSTRY_ROLE_MAPPING: Record<string, string[]> = {
  "finance": ["Finance Director", "Finance Manager", "Investment Manager", "CFO"],
  "banking": ["Investment Manager", "Portfolio Manager", "Finance Director", "Managing Director"],
  "investment": ["Investment Manager", "Investment Director", "Portfolio Manager", "Fund Manager"],
  "private equity": ["Managing Director", "Partner", "Principal", "Investment Director"],
  "venture capital": ["Partner", "Principal", "Investment Manager", "Managing Director"],
  "technology": ["CTO", "Engineering Manager", "Head of Engineering", "VP Engineering", "Tech Lead"],
  "software": ["CTO", "Engineering Manager", "Tech Lead", "VP Engineering"],
  "consulting": ["Managing Director", "Partner", "Principal", "Director"],
  "healthcare": ["HR Director", "Talent Acquisition", "Recruiter"],
  "recruiting": ["Recruiter", "Talent Acquisition", "HR Manager", "Head of Talent"],
};

export function useRoleSuggestions(
  cvData: ParsedCandidate | null,
  selectedIndustries: string[]
): string[] {
  return useMemo(() => {
    if (!cvData) return [];

    const suggestions = new Set<string>();
    
    // Analyze work history titles
    const allTitles = [
      cvData.current_title,
      ...(cvData.work_history || []).map(w => w.title)
    ].filter(Boolean).map(t => t.toLowerCase());

    const allText = allTitles.join(" ");
    
    // Match titles to target roles
    for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (allText.includes(keyword.toLowerCase())) {
          suggestions.add(role);
          break;
        }
      }
    }

    // Add suggestions based on selected industries
    const industriesLower = selectedIndustries.map(i => i.toLowerCase()).join(" ");
    for (const [industryKey, roles] of Object.entries(INDUSTRY_ROLE_MAPPING)) {
      if (industriesLower.includes(industryKey)) {
        roles.forEach(role => suggestions.add(role));
      }
    }

    // If candidate has senior titles, suggest leadership roles
    const seniorKeywords = ["senior", "lead", "head", "director", "manager", "vp", "chief"];
    if (seniorKeywords.some(k => allText.includes(k))) {
      suggestions.add("Managing Director");
      suggestions.add("Director");
      suggestions.add("VP");
    }

    // Always suggest HR/Recruiting as these are common hiring contacts
    if (suggestions.size === 0) {
      suggestions.add("Recruiter");
      suggestions.add("Talent Acquisition");
      suggestions.add("HR Manager");
    }

    return Array.from(suggestions).slice(0, 8); // Limit to top 8 suggestions
  }, [cvData, selectedIndustries]);
}
