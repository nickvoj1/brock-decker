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

// Keywords that map to specific industries
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  // Investment & Asset Management
  "Private Equity (PE)": ["private equity", "pe ", "buyout", "lbo", "leveraged buyout"],
  "Venture Capital (VC)": ["venture capital", "vc ", "startup", "seed", "series a", "series b"],
  "Hedge Fund": ["hedge fund", "quant", "systematic", "long/short", "macro"],
  "Asset Management": ["asset management", "aum", "portfolio", "fund manager"],
  "Wealth Management": ["wealth management", "private banking", "hnw", "uhnw", "family office"],
  
  // Investment Banking
  "Investment Banking": ["investment bank", "ib ", "m&a", "mergers", "acquisitions", "deal"],
  "Capital Markets": ["capital markets", "ecm", "dcm", "equity capital", "debt capital"],
  "Leveraged Finance": ["leveraged finance", "lev fin", "high yield"],
  
  // Trading & Research
  "Equity Research": ["equity research", "sell-side", "buy-side research", "analyst"],
  "Sales & Trading": ["sales & trading", "trader", "trading desk", "execution"],
  "Quantitative Trading": ["quant", "algorithmic", "algo trading", "systematic trading"],
  
  // Corporate & Advisory
  "Strategy Consulting": ["strategy consulting", "mbb", "mckinsey", "bain", "bcg"],
  "Management Consulting": ["management consulting", "consultant", "advisory"],
  "Corporate Finance": ["corporate finance", "fp&a", "treasury", "corporate dev"],
  
  // Credit & Lending
  "Private Credit": ["private credit", "direct lending", "private debt"],
  "Distressed Debt": ["distressed", "restructuring", "turnaround", "workout"],
  
  // Real Assets
  "Real Estate": ["real estate", "repe", "property", "reit", "commercial real estate"],
  "Infrastructure": ["infrastructure", "infra fund", "utilities", "transportation"],
  "Energy": ["energy", "oil", "gas", "renewable", "power", "utilities"],
  
  // FinTech & Technology
  "FinTech": ["fintech", "financial technology", "payments", "neobank"],
  "Blockchain & Crypto": ["blockchain", "crypto", "defi", "web3", "digital assets"],
  
  // Insurance
  "Insurance": ["insurance", "underwriting", "actuarial", "reinsurance"],
};

// Sector keywords mapping
const SECTOR_KEYWORDS: Record<string, string[]> = {
  "Technology": ["software", "tech", "saas", "ai", "machine learning", "data", "cloud", "fintech", "it "],
  "Healthcare": ["healthcare", "health", "medical", "pharma", "biotech", "hospital", "life sciences"],
  "Financial Services": ["bank", "finance", "investment", "asset management", "insurance", "trading"],
  "Industrial": ["industrial", "manufacturing", "engineering", "construction", "automotive"],
  "Consumer": ["consumer", "retail", "ecommerce", "e-commerce", "fmcg", "cpg", "brand"],
  "Energy & Utilities": ["energy", "oil", "gas", "power", "utilities", "renewable", "solar", "wind"],
  "Real Estate & Construction": ["real estate", "property", "construction", "reit", "development"],
  "Media & Entertainment": ["media", "entertainment", "gaming", "sports", "publishing", "advertising"],
  "Telecommunications": ["telecom", "telco", "mobile", "network", "5g"],
  "Transportation & Logistics": ["logistics", "transportation", "shipping", "supply chain", "aviation"],
  "Education": ["education", "edtech", "university", "school", "learning"],
  "Agriculture": ["agriculture", "farming", "agtech", "food"],
};

export interface IndustrySuggestion {
  industries: string[];
  sectors: string[];
}

export function useIndustrySuggestions(
  cvData: ParsedCandidate | null
): IndustrySuggestion {
  return useMemo(() => {
    if (!cvData) return { industries: [], sectors: [] };

    const industrySuggestions = new Set<string>();
    const sectorSuggestions = new Set<string>();
    
    // Combine all relevant text for analysis
    const allText = [
      cvData.current_title,
      ...(cvData.work_history || []).map(w => `${w.title} ${w.company}`),
      ...(cvData.skills || []),
      cvData.summary || '',
    ].filter(Boolean).join(" ").toLowerCase();

    // Match to industries
    for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (allText.includes(keyword.toLowerCase())) {
          industrySuggestions.add(industry);
          break;
        }
      }
    }

    // Match to sectors
    for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      for (const keyword of keywords) {
        if (allText.includes(keyword.toLowerCase())) {
          sectorSuggestions.add(sector);
          break;
        }
      }
    }

    // Add related industries based on common patterns
    if (industrySuggestions.has("Private Equity (PE)")) {
      industrySuggestions.add("Investment Banking");
      industrySuggestions.add("Management Consulting");
    }
    if (industrySuggestions.has("Venture Capital (VC)")) {
      industrySuggestions.add("FinTech");
    }
    if (industrySuggestions.has("Investment Banking")) {
      industrySuggestions.add("Private Equity (PE)");
      industrySuggestions.add("Corporate Finance");
    }

    // Suggest Financial Services sector for finance roles
    if (industrySuggestions.size > 0 && !sectorSuggestions.has("Financial Services")) {
      const financeIndustries = ["Private Equity (PE)", "Venture Capital (VC)", "Investment Banking", "Asset Management"];
      if (financeIndustries.some(i => industrySuggestions.has(i))) {
        sectorSuggestions.add("Financial Services");
      }
    }

    return {
      industries: Array.from(industrySuggestions).slice(0, 8),
      sectors: Array.from(sectorSuggestions).slice(0, 5),
    };
  }, [cvData]);
}
