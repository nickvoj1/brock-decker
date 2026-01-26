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

// Keywords that map to specific industries - enhanced with company/role patterns
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  // Investment & Asset Management
  "Private Equity (PE)": ["private equity", "pe ", "buyout", "lbo", "leveraged buyout", "portfolio company", "growth equity"],
  "Venture Capital (VC)": ["venture capital", "vc ", "startup", "seed", "series a", "series b", "early stage", "growth stage"],
  "Hedge Fund": ["hedge fund", "quant", "systematic", "long/short", "macro", "multi-strategy", "citadel", "bridgewater", "two sigma", "de shaw"],
  "Asset Management": ["asset management", "aum", "portfolio", "fund manager", "blackrock", "vanguard", "fidelity", "state street"],
  "Wealth Management": ["wealth management", "private banking", "hnw", "uhnw", "family office", "ubs", "morgan stanley wealth", "merrill lynch"],
  
  // Investment Banking
  "Investment Banking": ["investment bank", "ib ", "m&a", "mergers", "acquisitions", "deal", "goldman sachs", "morgan stanley", "jp morgan", "jpmorgan", "bofa securities", "citi", "barclays", "credit suisse", "deutsche bank", "lazard", "evercore", "moelis", "centerview", "pjt", "perella weinberg"],
  "Capital Markets": ["capital markets", "ecm", "dcm", "equity capital", "debt capital", "syndicate", "origination"],
  "Leveraged Finance": ["leveraged finance", "lev fin", "high yield", "leveraged loans"],
  
  // Trading & Research
  "Equity Research": ["equity research", "sell-side", "buy-side research", "research analyst", "sector analyst"],
  "Sales & Trading": ["sales & trading", "trader", "trading desk", "execution", "flow trading", "market making"],
  "Quantitative Trading": ["quant", "algorithmic", "algo trading", "systematic trading", "quantitative analyst", "quantitative researcher"],
  
  // Corporate & Advisory
  "Strategy Consulting": ["strategy consulting", "mbb", "mckinsey", "bain", "bcg", "boston consulting", "strategy&", "roland berger", "oliver wyman", "kearney", "l.e.k"],
  "Management Consulting": ["management consulting", "consultant", "advisory", "deloitte", "pwc", "kpmg", "ey ", "ernst & young", "accenture"],
  "Corporate Finance": ["corporate finance", "fp&a", "treasury", "corporate dev", "corporate development", "financial planning"],
  
  // Credit & Lending
  "Private Credit": ["private credit", "direct lending", "private debt", "mezzanine", "ares", "apollo", "blackstone credit", "golub"],
  "Distressed Debt": ["distressed", "restructuring", "turnaround", "workout", "special situations"],
  
  // Real Assets
  "Real Estate": ["real estate", "repe", "property", "reit", "commercial real estate", "cbre", "jll", "cushman", "brookfield", "starwood"],
  "Infrastructure": ["infrastructure", "infra fund", "utilities", "transportation", "macquarie", "global infrastructure"],
  "Energy": ["energy", "oil", "gas", "renewable", "power", "utilities", "exxon", "chevron", "shell", "bp ", "conocophillips"],
  
  // FinTech & Technology
  "FinTech": ["fintech", "financial technology", "payments", "neobank", "stripe", "square", "plaid", "robinhood", "revolut", "chime"],
  "Blockchain & Crypto": ["blockchain", "crypto", "defi", "web3", "digital assets", "coinbase", "binance", "kraken"],
  
  // Insurance
  "Insurance": ["insurance", "underwriting", "actuarial", "reinsurance", "aig", "allianz", "axa", "zurich", "munich re", "swiss re"],
};

// Company name patterns that indicate specific industries
const COMPANY_INDUSTRY_PATTERNS: Record<string, string[]> = {
  "Private Equity (PE)": ["capital", "partners", "equity", "advisors", "investments", "kkr", "blackstone", "carlyle", "apollo", "tpg", "warburg", "silver lake", "thoma bravo", "vista equity", "hellman", "bain capital", "advent", "permira", "cinven", "cvc", "eqt", "general atlantic"],
  "Venture Capital (VC)": ["ventures", "capital", "partners", "a16z", "andreessen", "sequoia", "kleiner", "accel", "benchmark", "greylock", "index ventures", "lightspeed", "bessemer", "insight partners", "tiger global"],
  "Investment Banking": ["securities", "bank", "partners", "financial", "capital markets"],
  "Management Consulting": ["consulting", "advisory", "group"],
  "Asset Management": ["asset management", "investments", "capital", "fund"],
  "Hedge Fund": ["capital", "management", "advisors", "partners"],
};

// Job title patterns that indicate industries
const TITLE_INDUSTRY_PATTERNS: Record<string, string[]> = {
  "Private Equity (PE)": ["associate", "vice president", "principal", "director", "partner", "managing director", "investment professional", "deal team"],
  "Investment Banking": ["analyst", "associate", "vice president", "director", "managing director", "banker"],
  "Hedge Fund": ["analyst", "portfolio manager", "trader", "researcher", "quantitative"],
  "Venture Capital (VC)": ["associate", "principal", "partner", "investor", "investment team"],
  "Management Consulting": ["consultant", "associate", "manager", "principal", "partner", "engagement manager", "project leader"],
  "Corporate Finance": ["analyst", "manager", "director", "controller", "treasurer", "fp&a"],
};

// Sector keywords mapping - enhanced
const SECTOR_KEYWORDS: Record<string, string[]> = {
  "Technology": ["software", "tech", "saas", "ai", "machine learning", "data", "cloud", "fintech", "it ", "microsoft", "google", "amazon", "meta", "apple", "salesforce", "oracle", "sap", "ibm", "cisco", "intel", "nvidia"],
  "Healthcare": ["healthcare", "health", "medical", "pharma", "biotech", "hospital", "life sciences", "pfizer", "johnson & johnson", "merck", "novartis", "roche", "abbvie", "amgen", "gilead"],
  "Financial Services": ["bank", "finance", "investment", "asset management", "insurance", "trading", "capital", "securities"],
  "Industrial": ["industrial", "manufacturing", "engineering", "construction", "automotive", "aerospace", "defense", "ge ", "siemens", "honeywell", "caterpillar", "3m", "boeing", "lockheed"],
  "Consumer": ["consumer", "retail", "ecommerce", "e-commerce", "fmcg", "cpg", "brand", "nike", "coca-cola", "pepsi", "procter", "unilever", "lvmh", "amazon", "walmart", "target"],
  "Energy & Utilities": ["energy", "oil", "gas", "power", "utilities", "renewable", "solar", "wind", "exxon", "chevron", "shell", "bp "],
  "Real Estate & Construction": ["real estate", "property", "construction", "reit", "development", "cbre", "jll", "brookfield"],
  "Media & Entertainment": ["media", "entertainment", "gaming", "sports", "publishing", "advertising", "disney", "netflix", "warner", "spotify", "ea ", "activision"],
  "Telecommunications": ["telecom", "telco", "mobile", "network", "5g", "at&t", "verizon", "t-mobile", "vodafone"],
  "Transportation & Logistics": ["logistics", "transportation", "shipping", "supply chain", "aviation", "fedex", "ups", "maersk", "delta", "united airlines"],
  "Education": ["education", "edtech", "university", "school", "learning", "coursera", "pearson"],
  "Agriculture": ["agriculture", "farming", "agtech", "food", "cargill", "adm", "bunge"],
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
    
    // Combine all relevant text for general keyword analysis
    const allText = [
      cvData.current_title,
      ...(cvData.work_history || []).map(w => `${w.title} ${w.company}`),
      ...(cvData.skills || []),
      cvData.summary || '',
    ].filter(Boolean).join(" ").toLowerCase();

    // Specifically analyze work history for better targeting
    const workHistory = cvData.work_history || [];
    const companies = workHistory.map(w => w.company.toLowerCase());
    const titles = workHistory.map(w => w.title.toLowerCase());
    
    // Match companies to industries using company patterns
    for (const company of companies) {
      for (const [industry, patterns] of Object.entries(COMPANY_INDUSTRY_PATTERNS)) {
        for (const pattern of patterns) {
          if (company.includes(pattern.toLowerCase())) {
            industrySuggestions.add(industry);
            break;
          }
        }
      }
    }

    // Match job titles to industries
    for (const title of titles) {
      for (const [industry, patterns] of Object.entries(TITLE_INDUSTRY_PATTERNS)) {
        // Check if title matches pattern AND company context supports it
        for (const pattern of patterns) {
          if (title.includes(pattern.toLowerCase())) {
            // For generic titles like "analyst", need company context
            const genericTitles = ["analyst", "associate", "manager", "director", "partner", "vice president"];
            const isGeneric = genericTitles.some(g => title.includes(g));
            
            if (isGeneric) {
              // Check if any company hints at this industry
              const companyHints = COMPANY_INDUSTRY_PATTERNS[industry] || [];
              const hasCompanyContext = companies.some(c => 
                companyHints.some(hint => c.includes(hint.toLowerCase()))
              );
              if (hasCompanyContext) {
                industrySuggestions.add(industry);
              }
            } else {
              industrySuggestions.add(industry);
            }
            break;
          }
        }
      }
    }

    // Match to industries using general keywords
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

    // Add related industries based on common career patterns
    if (industrySuggestions.has("Private Equity (PE)")) {
      industrySuggestions.add("Investment Banking");
      industrySuggestions.add("Management Consulting");
      industrySuggestions.add("Corporate Finance");
    }
    if (industrySuggestions.has("Venture Capital (VC)")) {
      industrySuggestions.add("FinTech");
      industrySuggestions.add("Management Consulting");
    }
    if (industrySuggestions.has("Investment Banking")) {
      industrySuggestions.add("Private Equity (PE)");
      industrySuggestions.add("Corporate Finance");
    }
    if (industrySuggestions.has("Management Consulting")) {
      industrySuggestions.add("Strategy Consulting");
      industrySuggestions.add("Corporate Finance");
    }
    if (industrySuggestions.has("Hedge Fund")) {
      industrySuggestions.add("Asset Management");
      industrySuggestions.add("Quantitative Trading");
    }

    // Suggest Financial Services sector for finance roles
    if (industrySuggestions.size > 0 && !sectorSuggestions.has("Financial Services")) {
      const financeIndustries = ["Private Equity (PE)", "Venture Capital (VC)", "Investment Banking", "Asset Management", "Hedge Fund", "Private Credit"];
      if (financeIndustries.some(i => industrySuggestions.has(i))) {
        sectorSuggestions.add("Financial Services");
      }
    }

    return {
      industries: Array.from(industrySuggestions).slice(0, 10),
      sectors: Array.from(sectorSuggestions).slice(0, 6),
    };
  }, [cvData]);
}
