/**
 * Industry & Sector Matching Engine
 * Provides precise CV-based matching for industries and sectors
 */

export interface WorkExperience {
  company: string;
  title: string;
  duration?: string;
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
}

// ============== COMPANY MAPPINGS ==============
// Direct company name to industry mappings for precise matching

export const COMPANY_TO_INDUSTRY: Record<string, string[]> = {
  // Bulge Bracket Investment Banks
  "goldman sachs": ["Investment Banking", "Capital Markets", "Asset Management"],
  "morgan stanley": ["Investment Banking", "Wealth Management", "Capital Markets"],
  "jp morgan": ["Investment Banking", "Asset Management", "Commercial Banking"],
  "jpmorgan": ["Investment Banking", "Asset Management", "Commercial Banking"],
  "j.p. morgan": ["Investment Banking", "Asset Management", "Commercial Banking"],
  "bank of america": ["Investment Banking", "Commercial Banking"],
  "bofa securities": ["Investment Banking", "Capital Markets"],
  "merrill lynch": ["Wealth Management", "Investment Banking"],
  "citigroup": ["Investment Banking", "Commercial Banking"],
  "citi": ["Investment Banking", "Commercial Banking"],
  "barclays": ["Investment Banking", "Capital Markets"],
  "deutsche bank": ["Investment Banking", "Capital Markets"],
  "credit suisse": ["Investment Banking", "Wealth Management"],
  "ubs": ["Investment Banking", "Wealth Management", "Asset Management"],
  "hsbc": ["Commercial Banking", "Investment Banking"],
  
  // Elite Boutiques
  "lazard": ["Investment Banking", "Mergers & Acquisitions (M&A)", "Financial Advisory"],
  "evercore": ["Investment Banking", "Mergers & Acquisitions (M&A)"],
  "moelis": ["Investment Banking", "Mergers & Acquisitions (M&A)"],
  "centerview": ["Investment Banking", "Mergers & Acquisitions (M&A)"],
  "pjt partners": ["Investment Banking", "Restructuring"],
  "perella weinberg": ["Investment Banking", "Financial Advisory"],
  "rothschild": ["Investment Banking", "Mergers & Acquisitions (M&A)"],
  "greenhill": ["Investment Banking", "Mergers & Acquisitions (M&A)"],
  "guggenheim": ["Investment Banking", "Asset Management"],
  "houlihan lokey": ["Investment Banking", "Restructuring", "Valuation Advisory"],
  "jefferies": ["Investment Banking", "Capital Markets"],
  "william blair": ["Investment Banking", "Asset Management"],
  "robert w. baird": ["Investment Banking", "Wealth Management"],
  "stifel": ["Investment Banking", "Wealth Management"],
  "raymond james": ["Investment Banking", "Wealth Management"],
  "piper sandler": ["Investment Banking", "Capital Markets"],
  
  // Private Equity - Mega Funds
  "blackstone": ["Private Equity (PE)", "Real Estate Private Equity", "Private Credit"],
  "kkr": ["Private Equity (PE)", "Infrastructure PE", "Private Credit"],
  "kohlberg kravis": ["Private Equity (PE)"],
  "carlyle": ["Private Equity (PE)", "Infrastructure PE", "Real Estate"],
  "apollo": ["Private Equity (PE)", "Private Credit", "Real Estate"],
  "tpg": ["Private Equity (PE)", "Growth Equity"],
  "tpg capital": ["Private Equity (PE)"],
  "warburg pincus": ["Private Equity (PE)", "Growth Equity"],
  "advent international": ["Private Equity (PE)"],
  "bain capital": ["Private Equity (PE)", "Venture Capital (VC)", "Private Credit"],
  "cvc capital": ["Private Equity (PE)"],
  "eqt": ["Private Equity (PE)", "Infrastructure PE"],
  "permira": ["Private Equity (PE)"],
  "cinven": ["Private Equity (PE)"],
  "apax": ["Private Equity (PE)"],
  "bc partners": ["Private Equity (PE)"],
  "hellman & friedman": ["Private Equity (PE)"],
  "leonard green": ["Private Equity (PE)"],
  "silver lake": ["Private Equity (PE)"],
  "thoma bravo": ["Private Equity (PE)"],
  "vista equity": ["Private Equity (PE)"],
  "general atlantic": ["Private Equity (PE)", "Growth Equity"],
  "providence equity": ["Private Equity (PE)"],
  "welsh carson": ["Private Equity (PE)"],
  "gtcr": ["Private Equity (PE)"],
  "madison dearborn": ["Private Equity (PE)"],
  "hig capital": ["Private Equity (PE)", "Private Credit"],
  "american securities": ["Private Equity (PE)"],
  "clayton dubilier": ["Private Equity (PE)"],
  "cd&r": ["Private Equity (PE)"],
  "roark capital": ["Private Equity (PE)"],
  "platinum equity": ["Private Equity (PE)"],
  "veritas capital": ["Private Equity (PE)"],
  "insight partners": ["Private Equity (PE)", "Venture Capital (VC)"],
  
  // Hedge Funds
  "bridgewater": ["Hedge Fund", "Asset Management"],
  "citadel": ["Hedge Fund", "Quantitative Trading"],
  "millennium": ["Hedge Fund"],
  "de shaw": ["Hedge Fund", "Quantitative Trading"],
  "d.e. shaw": ["Hedge Fund", "Quantitative Trading"],
  "two sigma": ["Hedge Fund", "Quantitative Trading"],
  "point72": ["Hedge Fund"],
  "renaissance": ["Hedge Fund", "Quantitative Trading"],
  "aqr": ["Hedge Fund", "Quantitative Trading", "Asset Management"],
  "baupost": ["Hedge Fund"],
  "elliott": ["Hedge Fund", "Distressed Debt"],
  "viking global": ["Hedge Fund"],
  "lone pine": ["Hedge Fund"],
  "coatue": ["Hedge Fund", "Venture Capital (VC)"],
  "tiger global": ["Hedge Fund", "Venture Capital (VC)"],
  "pershing square": ["Hedge Fund"],
  "third point": ["Hedge Fund"],
  "balyasny": ["Hedge Fund"],
  "och-ziff": ["Hedge Fund"],
  "sculptor": ["Hedge Fund"],
  "man group": ["Hedge Fund", "Asset Management"],
  "brevan howard": ["Hedge Fund"],
  "marshall wace": ["Hedge Fund"],
  "bluecrest": ["Hedge Fund"],
  "capula": ["Hedge Fund"],
  "winton": ["Hedge Fund", "Quantitative Trading"],
  "jane street": ["Quantitative Trading", "Sales & Trading"],
  "jump trading": ["Quantitative Trading"],
  "drw": ["Quantitative Trading"],
  "hudson river trading": ["Quantitative Trading"],
  "hrt": ["Quantitative Trading"],
  "optiver": ["Quantitative Trading", "Sales & Trading"],
  "imc": ["Quantitative Trading", "Sales & Trading"],
  "susquehanna": ["Quantitative Trading", "Sales & Trading"],
  "sig": ["Quantitative Trading"],
  "virtu": ["Quantitative Trading", "Sales & Trading"],
  "tower research": ["Quantitative Trading"],
  "worldquant": ["Quantitative Trading", "Hedge Fund"],
  
  // Asset Management
  "blackrock": ["Asset Management"],
  "vanguard": ["Asset Management"],
  "fidelity": ["Asset Management", "Wealth Management"],
  "state street": ["Asset Management"],
  "pimco": ["Asset Management", "Fixed Income"],
  "capital group": ["Asset Management"],
  "t. rowe price": ["Asset Management"],
  "t rowe price": ["Asset Management"],
  "wellington": ["Asset Management"],
  "invesco": ["Asset Management"],
  "franklin templeton": ["Asset Management"],
  "legg mason": ["Asset Management"],
  "janus henderson": ["Asset Management"],
  "alliance bernstein": ["Asset Management"],
  "alliancebernstein": ["Asset Management"],
  "neuberger berman": ["Asset Management", "Private Equity (PE)"],
  "nuveen": ["Asset Management"],
  "pgim": ["Asset Management", "Real Estate"],
  "amundi": ["Asset Management"],
  "schroders": ["Asset Management"],
  "aberdeen": ["Asset Management"],
  "baillie gifford": ["Asset Management"],
  "legal & general": ["Asset Management"],
  
  // Venture Capital
  "sequoia": ["Venture Capital (VC)"],
  "andreessen horowitz": ["Venture Capital (VC)"],
  "a16z": ["Venture Capital (VC)"],
  "accel": ["Venture Capital (VC)"],
  "benchmark": ["Venture Capital (VC)"],
  "greylock": ["Venture Capital (VC)"],
  "kleiner perkins": ["Venture Capital (VC)"],
  "index ventures": ["Venture Capital (VC)"],
  "lightspeed": ["Venture Capital (VC)"],
  "bessemer": ["Venture Capital (VC)"],
  "founders fund": ["Venture Capital (VC)"],
  "khosla ventures": ["Venture Capital (VC)"],
  "union square ventures": ["Venture Capital (VC)"],
  "usv": ["Venture Capital (VC)"],
  "gv": ["Venture Capital (VC)"],
  "google ventures": ["Venture Capital (VC)"],
  "softbank": ["Venture Capital (VC)", "Private Equity (PE)"],
  "y combinator": ["Venture Capital (VC)"],
  "yc": ["Venture Capital (VC)"],
  "first round": ["Venture Capital (VC)"],
  "spark capital": ["Venture Capital (VC)"],
  "ivp": ["Venture Capital (VC)"],
  "institutional venture partners": ["Venture Capital (VC)"],
  "matrix partners": ["Venture Capital (VC)"],
  "new enterprise associates": ["Venture Capital (VC)"],
  "nea": ["Venture Capital (VC)"],
  "atomico": ["Venture Capital (VC)"],
  "balderton": ["Venture Capital (VC)"],
  "northzone": ["Venture Capital (VC)"],
  
  // Management Consulting
  "mckinsey": ["Strategy Consulting", "Management Consulting"],
  "bain & company": ["Strategy Consulting", "Management Consulting"],
  "bain and company": ["Strategy Consulting", "Management Consulting"],
  "boston consulting": ["Strategy Consulting", "Management Consulting"],
  "bcg": ["Strategy Consulting", "Management Consulting"],
  "deloitte": ["Management Consulting", "Financial Advisory", "Transaction Advisory"],
  "pwc": ["Management Consulting", "Financial Advisory", "Transaction Advisory"],
  "pricewaterhousecoopers": ["Management Consulting", "Transaction Advisory"],
  "kpmg": ["Management Consulting", "Transaction Advisory"],
  "ey": ["Management Consulting", "Transaction Advisory"],
  "ernst & young": ["Management Consulting", "Transaction Advisory"],
  "accenture": ["Management Consulting"],
  "oliver wyman": ["Strategy Consulting", "Management Consulting"],
  "l.e.k.": ["Strategy Consulting"],
  "lek": ["Strategy Consulting"],
  "roland berger": ["Strategy Consulting"],
  "strategy&": ["Strategy Consulting"],
  "kearney": ["Management Consulting"],
  "at kearney": ["Management Consulting"],
  "booz allen": ["Management Consulting"],
  "parthenon": ["Strategy Consulting"],
  "ey-parthenon": ["Strategy Consulting"],
  "alixpartners": ["Restructuring", "Management Consulting"],
  "fti consulting": ["Restructuring", "Financial Advisory"],
  
  // Private Credit
  "ares": ["Private Credit", "Direct Lending", "Private Equity (PE)"],
  "golub capital": ["Private Credit", "Direct Lending"],
  "owl rock": ["Private Credit", "Direct Lending"],
  "blue owl": ["Private Credit", "Direct Lending"],
  "sixth street": ["Private Credit", "Private Equity (PE)"],
  "hps": ["Private Credit"],
  "hps investment partners": ["Private Credit"],
  "crescent capital": ["Private Credit"],
  "monroe capital": ["Private Credit"],
  "antares": ["Private Credit", "Direct Lending"],
  "churchill": ["Private Credit"],
  
  // Real Estate
  "brookfield": ["Real Estate", "Real Estate Private Equity", "Infrastructure"],
  "starwood capital": ["Real Estate Private Equity"],
  "cbre": ["Real Estate"],
  "jll": ["Real Estate"],
  "jones lang lasalle": ["Real Estate"],
  "cushman wakefield": ["Real Estate"],
  "colliers": ["Real Estate"],
  "greystar": ["Real Estate"],
  "blackstone real estate": ["Real Estate Private Equity"],
  "prologis": ["Real Estate"],
  "simon property": ["Real Estate"],
  "vornado": ["Real Estate"],
  "tishman speyer": ["Real Estate"],
  "hines": ["Real Estate"],
  "related companies": ["Real Estate"],
  
  // FinTech
  "stripe": ["FinTech", "Payments"],
  "square": ["FinTech", "Payments"],
  "block": ["FinTech", "Payments"],
  "paypal": ["FinTech", "Payments"],
  "plaid": ["FinTech"],
  "robinhood": ["FinTech", "WealthTech"],
  "coinbase": ["Blockchain & Crypto", "FinTech"],
  "revolut": ["FinTech"],
  "chime": ["FinTech"],
  "sofi": ["FinTech"],
  "affirm": ["FinTech", "Payments"],
  "klarna": ["FinTech", "Payments"],
  "adyen": ["FinTech", "Payments"],
  "wise": ["FinTech", "Payments"],
  "transferwise": ["FinTech", "Payments"],
  "marqeta": ["FinTech", "Payments"],
  "brex": ["FinTech"],
  "ramp": ["FinTech"],
  
  // Insurance
  "aig": ["Insurance"],
  "allianz": ["Insurance", "Asset Management"],
  "axa": ["Insurance"],
  "zurich": ["Insurance"],
  "chubb": ["Insurance"],
  "travelers": ["Insurance"],
  "progressive": ["Insurance"],
  "allstate": ["Insurance"],
  "metlife": ["Insurance"],
  "prudential": ["Insurance", "Asset Management"],
  "munich re": ["Reinsurance"],
  "swiss re": ["Reinsurance"],
  "lloyd's": ["Insurance"],
  "berkshire hathaway": ["Insurance", "Private Equity (PE)"],
  
  // Big Tech
  "google": ["Technology"],
  "alphabet": ["Technology"],
  "microsoft": ["Technology"],
  "amazon": ["Technology"],
  "apple": ["Technology"],
  "meta": ["Technology"],
  "facebook": ["Technology"],
  "netflix": ["Technology", "Media & Entertainment"],
  "salesforce": ["Technology"],
  "oracle": ["Technology"],
  "ibm": ["Technology"],
  "adobe": ["Technology"],
  "nvidia": ["Technology"],
  "intel": ["Technology"],
  "cisco": ["Technology", "Telecommunications"],
};

// ============== TITLE PATTERNS ==============
// Job title keywords that indicate specific industries

export const TITLE_TO_INDUSTRY: Record<string, { industries: string[]; requiresContext?: boolean }> = {
  // Investment Banking Specific
  "investment banker": { industries: ["Investment Banking"] },
  "investment banking analyst": { industries: ["Investment Banking"] },
  "investment banking associate": { industries: ["Investment Banking"] },
  "m&a": { industries: ["Mergers & Acquisitions (M&A)", "Investment Banking"] },
  "mergers and acquisitions": { industries: ["Mergers & Acquisitions (M&A)"] },
  "ecm": { industries: ["Equity Capital Markets (ECM)", "Capital Markets"] },
  "dcm": { industries: ["Debt Capital Markets (DCM)", "Capital Markets"] },
  "capital markets": { industries: ["Capital Markets"] },
  "leveraged finance": { industries: ["Leveraged Finance"] },
  "lev fin": { industries: ["Leveraged Finance"] },
  "restructuring": { industries: ["Restructuring"] },
  "distressed": { industries: ["Distressed Debt", "Restructuring"] },
  
  // Private Equity Specific
  "private equity": { industries: ["Private Equity (PE)"] },
  "pe associate": { industries: ["Private Equity (PE)"] },
  "pe analyst": { industries: ["Private Equity (PE)"] },
  "buyout": { industries: ["Private Equity (PE)"] },
  "growth equity": { industries: ["Private Equity (PE)", "Venture Capital (VC)"] },
  "portfolio operations": { industries: ["Private Equity (PE)"] },
  "portfolio company": { industries: ["Private Equity (PE)"] },
  "operating partner": { industries: ["Private Equity (PE)"] },
  
  // Venture Capital Specific
  "venture capital": { industries: ["Venture Capital (VC)"] },
  "vc analyst": { industries: ["Venture Capital (VC)"] },
  "vc associate": { industries: ["Venture Capital (VC)"] },
  "venture partner": { industries: ["Venture Capital (VC)"] },
  
  // Hedge Fund / Trading
  "hedge fund": { industries: ["Hedge Fund"] },
  "portfolio manager": { industries: ["Hedge Fund", "Asset Management"] },
  "pm": { industries: ["Hedge Fund", "Asset Management"], requiresContext: true },
  "quant": { industries: ["Quantitative Trading", "Hedge Fund"] },
  "quantitative": { industries: ["Quantitative Trading"] },
  "trader": { industries: ["Sales & Trading", "Quantitative Trading"] },
  "trading": { industries: ["Sales & Trading"] },
  "equity research": { industries: ["Equity Research"] },
  "research analyst": { industries: ["Equity Research"], requiresContext: true },
  "sell-side": { industries: ["Equity Research", "Investment Banking"] },
  "buy-side": { industries: ["Hedge Fund", "Asset Management"] },
  
  // Asset & Wealth Management
  "asset management": { industries: ["Asset Management"] },
  "fund manager": { industries: ["Asset Management", "Hedge Fund"] },
  "wealth manager": { industries: ["Wealth Management"] },
  "wealth management": { industries: ["Wealth Management"] },
  "private banker": { industries: ["Wealth Management"] },
  "private banking": { industries: ["Wealth Management"] },
  "family office": { industries: ["Family Office", "Wealth Management"] },
  
  // Consulting
  "strategy consultant": { industries: ["Strategy Consulting"] },
  "management consultant": { industries: ["Management Consulting"] },
  "consultant": { industries: ["Management Consulting"], requiresContext: true },
  "engagement manager": { industries: ["Management Consulting", "Strategy Consulting"] },
  "project leader": { industries: ["Strategy Consulting"] },
  "principal": { industries: ["Management Consulting", "Private Equity (PE)"], requiresContext: true },
  
  // Credit
  "private credit": { industries: ["Private Credit"] },
  "direct lending": { industries: ["Direct Lending", "Private Credit"] },
  "credit analyst": { industries: ["Private Credit", "Credit"] },
  "mezzanine": { industries: ["Mezzanine Finance", "Private Credit"] },
  
  // Real Estate
  "real estate": { industries: ["Real Estate"] },
  "repe": { industries: ["Real Estate Private Equity"] },
  "acquisitions": { industries: ["Real Estate", "Private Equity (PE)"], requiresContext: true },
  
  // Corporate Finance
  "fp&a": { industries: ["Corporate Finance"] },
  "financial planning": { industries: ["Corporate Finance"] },
  "treasury": { industries: ["Corporate Finance"] },
  "corporate development": { industries: ["Corporate Development"] },
  "corp dev": { industries: ["Corporate Development"] },
  "controller": { industries: ["Corporate Finance"] },
  "cfo": { industries: ["Corporate Finance"] },
  
  // FinTech / Tech
  "fintech": { industries: ["FinTech"] },
  "payments": { industries: ["Payments", "FinTech"] },
  "blockchain": { industries: ["Blockchain & Crypto"] },
  "crypto": { industries: ["Blockchain & Crypto"] },
  "web3": { industries: ["Blockchain & Crypto"] },
  
  // Insurance
  "underwriter": { industries: ["Insurance"] },
  "underwriting": { industries: ["Insurance"] },
  "actuary": { industries: ["Actuarial", "Insurance"] },
  "actuarial": { industries: ["Actuarial", "Insurance"] },
  "claims": { industries: ["Insurance"], requiresContext: true },
  "reinsurance": { industries: ["Reinsurance"] },
};

// ============== SECTOR INFERENCE ==============
// Map industries to sectors for automatic sector suggestions

export const INDUSTRY_TO_SECTOR: Record<string, string[]> = {
  "Private Equity (PE)": ["Financial Services"],
  "Venture Capital (VC)": ["Financial Services", "Technology"],
  "Hedge Fund": ["Financial Services"],
  "Asset Management": ["Financial Services"],
  "Wealth Management": ["Financial Services"],
  "Investment Banking": ["Financial Services"],
  "Mergers & Acquisitions (M&A)": ["Financial Services"],
  "Capital Markets": ["Financial Services"],
  "Equity Capital Markets (ECM)": ["Financial Services"],
  "Debt Capital Markets (DCM)": ["Financial Services"],
  "Leveraged Finance": ["Financial Services"],
  "Restructuring": ["Financial Services"],
  "Private Credit": ["Financial Services"],
  "Direct Lending": ["Financial Services"],
  "Credit": ["Financial Services"],
  "Mezzanine Finance": ["Financial Services"],
  "Distressed Debt": ["Financial Services"],
  "Strategy Consulting": ["Financial Services"],
  "Management Consulting": ["Financial Services"],
  "Corporate Finance": ["Financial Services"],
  "Corporate Development": ["Financial Services"],
  "Financial Advisory": ["Financial Services"],
  "Transaction Advisory": ["Financial Services"],
  "Valuation Advisory": ["Financial Services"],
  "Family Office": ["Financial Services"],
  "Quantitative Trading": ["Financial Services", "Technology"],
  "Sales & Trading": ["Financial Services"],
  "Equity Research": ["Financial Services"],
  "Fixed Income": ["Financial Services"],
  "Derivatives": ["Financial Services"],
  "Commodities": ["Financial Services"],
  "Foreign Exchange (FX)": ["Financial Services"],
  "Real Estate": ["Real Estate & Construction"],
  "Real Estate Private Equity": ["Real Estate & Construction", "Financial Services"],
  "Infrastructure": ["Industrial", "Financial Services"],
  "Infrastructure PE": ["Industrial", "Financial Services"],
  "FinTech": ["Financial Services", "Technology"],
  "Payments": ["Financial Services", "Technology"],
  "Blockchain & Crypto": ["Financial Services", "Technology"],
  "WealthTech": ["Financial Services", "Technology"],
  "InsurTech": ["Financial Services", "Technology"],
  "RegTech": ["Financial Services", "Technology"],
  "Insurance": ["Financial Services"],
  "Reinsurance": ["Financial Services"],
  "Actuarial": ["Financial Services"],
  "Risk Management": ["Financial Services"],
  "Commercial Banking": ["Financial Services"],
  "Technology": ["Technology"],
};

// ============== MATCHING FUNCTIONS ==============

export function matchCompanyToIndustries(company: string): string[] {
  const companyLower = company.toLowerCase().trim();
  const matched = new Set<string>();
  
  // Direct match
  for (const [key, industries] of Object.entries(COMPANY_TO_INDUSTRY)) {
    if (companyLower.includes(key) || key.includes(companyLower)) {
      industries.forEach(i => matched.add(i));
    }
  }
  
  // Pattern-based matching for common suffixes
  const pePatterns = [" capital", " partners", " equity", " management", " advisors", " group"];
  const vcPatterns = [" ventures", " labs"];
  const consultingPatterns = [" consulting", " advisory"];
  const bankPatterns = [" bank", " securities", " financial"];
  
  if (pePatterns.some(p => companyLower.endsWith(p)) && matched.size === 0) {
    // Could be PE/VC/AM - mark as potential
    matched.add("Private Equity (PE)");
    matched.add("Asset Management");
  }
  
  if (vcPatterns.some(p => companyLower.includes(p)) && matched.size === 0) {
    matched.add("Venture Capital (VC)");
  }
  
  if (consultingPatterns.some(p => companyLower.includes(p)) && matched.size === 0) {
    matched.add("Management Consulting");
  }
  
  if (bankPatterns.some(p => companyLower.includes(p)) && matched.size === 0) {
    matched.add("Investment Banking");
    matched.add("Commercial Banking");
  }
  
  return Array.from(matched);
}

export function matchTitleToIndustries(title: string, companies: string[]): string[] {
  const titleLower = title.toLowerCase().trim();
  const matched = new Set<string>();
  
  // Check title patterns
  for (const [pattern, config] of Object.entries(TITLE_TO_INDUSTRY)) {
    if (titleLower.includes(pattern)) {
      if (config.requiresContext) {
        // For generic titles, check if companies provide context
        const hasContext = companies.some(c => matchCompanyToIndustries(c).length > 0);
        if (hasContext) {
          config.industries.forEach(i => matched.add(i));
        }
      } else {
        config.industries.forEach(i => matched.add(i));
      }
    }
  }
  
  return Array.from(matched);
}

export function inferSectorsFromIndustries(industries: string[]): string[] {
  const sectors = new Set<string>();
  
  for (const industry of industries) {
    const mappedSectors = INDUSTRY_TO_SECTOR[industry];
    if (mappedSectors) {
      mappedSectors.forEach(s => sectors.add(s));
    }
  }
  
  return Array.from(sectors);
}

export interface IndustrySuggestion {
  industries: string[];
  sectors: string[];
  confidence: "high" | "medium" | "low";
  matchedCompanies: string[];
}

export function analyzeCandidate(candidate: ParsedCandidate): IndustrySuggestion {
  const industryScores = new Map<string, number>();
  const matchedCompanies: string[] = [];
  
  // Analyze work history
  const workHistory = candidate.work_history || [];
  const companies = workHistory.map(w => w.company);
  const titles = workHistory.map(w => w.title);
  
  // Weight recent experience more heavily
  workHistory.forEach((job, index) => {
    const recencyWeight = Math.max(1, 3 - index * 0.5); // First job = 3x, second = 2.5x, etc.
    
    // Match company
    const companyIndustries = matchCompanyToIndustries(job.company);
    if (companyIndustries.length > 0) {
      matchedCompanies.push(job.company);
      companyIndustries.forEach(ind => {
        industryScores.set(ind, (industryScores.get(ind) || 0) + 3 * recencyWeight);
      });
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
      industryScores.set(ind, (industryScores.get(ind) || 0) + 4); // Current title weighted heavily
    });
  }
  
  // Analyze skills
  if (candidate.skills && candidate.skills.length > 0) {
    const skillsText = candidate.skills.join(" ").toLowerCase();
    
    // Skill-based industry hints
    if (skillsText.includes("financial modeling") || skillsText.includes("lbo") || skillsText.includes("dcf")) {
      industryScores.set("Investment Banking", (industryScores.get("Investment Banking") || 0) + 2);
      industryScores.set("Private Equity (PE)", (industryScores.get("Private Equity (PE)") || 0) + 2);
    }
    if (skillsText.includes("due diligence") || skillsText.includes("deal sourcing")) {
      industryScores.set("Private Equity (PE)", (industryScores.get("Private Equity (PE)") || 0) + 2);
      industryScores.set("Venture Capital (VC)", (industryScores.get("Venture Capital (VC)") || 0) + 1);
    }
    if (skillsText.includes("python") || skillsText.includes("machine learning") || skillsText.includes("algo")) {
      industryScores.set("Quantitative Trading", (industryScores.get("Quantitative Trading") || 0) + 1);
    }
    if (skillsText.includes("pitchbook") || skillsText.includes("presentation")) {
      industryScores.set("Investment Banking", (industryScores.get("Investment Banking") || 0) + 1);
      industryScores.set("Management Consulting", (industryScores.get("Management Consulting") || 0) + 1);
    }
  }
  
  // Sort by score and take top industries
  const sortedIndustries = Array.from(industryScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([ind]) => ind);
  
  // Determine confidence
  const maxScore = Math.max(...Array.from(industryScores.values()), 0);
  let confidence: "high" | "medium" | "low" = "low";
  if (maxScore >= 8) confidence = "high";
  else if (maxScore >= 4) confidence = "medium";
  
  // Infer sectors
  const sectors = inferSectorsFromIndustries(sortedIndustries);
  
  return {
    industries: sortedIndustries,
    sectors: sectors.slice(0, 5),
    confidence,
    matchedCompanies: [...new Set(matchedCompanies)],
  };
}
