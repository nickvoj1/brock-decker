export interface SearchPreference {
  industry?: string;
  industries?: string[];
  sectors?: string[];
  roles?: string[];
  targetRoles?: string[];
  locations?: string[];
}

export interface BullhornSkillsContact {
  title?: string;
  company?: string;
  location?: string;
}

// Stored as an array of per-industry preference objects in DB.
export function normalizePreferencesData(raw: unknown): SearchPreference | undefined {
  const anyRaw = raw as any;
  if (!anyRaw) return undefined;

  if (Array.isArray(anyRaw)) {
    const first = anyRaw[0] || {};
    const industries = anyRaw.map((p: any) => p?.industry).filter(Boolean);
    return {
      ...first,
      industries: industries.length ? industries : first.industries,
    } as SearchPreference;
  }

  return anyRaw as SearchPreference;
}

// Skills mapping using EXACT Bullhorn Skill entity names.
// These MUST match the skill names in Bullhorn's Skill list for association/import to work.

const INDUSTRY_DIRECT_SKILLS: Record<string, string[]> = {
  "real estate": ["AREC", "CONSTRUCTION"],
  "capital markets": ["CAPITAL MARKETS"],
  "private equity": ["BUY SIDE", "PE", "CORP M&A"],
  "private equity (pe)": ["BUY SIDE", "PE", "CORP M&A"],
  "pe": ["BUY SIDE", "PE", "CORP M&A"],
  "buyout": ["BUY SIDE", "PE", "CORP M&A"],
  "venture capital": ["CORP VC", "VC"],
  "venture capital (vc)": ["CORP VC", "VC"],
  "vc": ["CORP VC", "VC"],
  "investment banking": ["CORPORATE BANKING", "CAPITAL MARKETS"],
  "ib": ["CORPORATE BANKING", "CAPITAL MARKETS"],
  "management consulting": ["CONSULT", "ADVISORY INVESMENT"],
  "hedge fund": ["BUY SIDE", "ALT INVESTMENT"],
  "asset management": ["ASS MAN", "BUY SIDE"],
  "infrastructure": ["CONSTRUCTION", "CAPITAL GOODS"],
  "corporate finance": ["CORP FIN", "CORPORATE BANKING"],
  "wealth management": ["AFFLUENT BANKING", "ADVISORY INVESMENT"],
  "family office": ["AFFLUENT BANKING", "BUY SIDE"],
  "private credit": ["CREDIT", "Debt", "BUY SIDE"],
  "private debt": ["CREDIT", "Debt", "BUY SIDE"],
  "credit": ["CREDIT", "Debt"],
  "distressed": ["CREDIT", "BANKRUPCY", "Debt", "DISTRESSED"],
  "special situations": ["DISTRESSED", "BANKRUPCY"],
  "m&a": ["CORP M&A"],
  "mergers & acquisitions": ["CORP M&A"],
  "dcm": ["DCM", "Debt", "CAPITAL MARKETS"],
  "ecm": ["ECM", "CAPITAL MARKETS"],
};

const SECTOR_SKILLS: Record<string, string[]> = {
  "real estate & construction": ["AREC", "CONSTRUCTION"],
  "financial services": ["CORPORATE BANKING", "CAPITAL MARKETS"],
  "technology": ["DATA", "AUTOMATION"],
  "healthcare": ["CLINICAL", "BIOTEC"],
  "energy": ["ATOMIC ENERGY", "CLEANTECH"],
  "industrials": ["CAPITAL GOODS", "AUTOMATION"],
  "consumer": ["CONSUMER GOOD", "B2C"],
  "media": ["COMMUNICATION", "ADVERTISING"],
  "telecommunications": ["COMMUNICATION"],
  "retail": ["B2C", "CONSUMER GOOD"],
};

const INDUSTRY_SKILLS: Record<string, string[]> = {
  "private equity": ["BUY SIDE", "PE"],
  "pe": ["BUY SIDE", "PE"],
  "venture capital": ["CORP VC", "VC"],
  "vc": ["CORP VC", "VC"],
  "hedge fund": ["BUY SIDE", "ALT INVESTMENT"],
  "investment bank": ["CORPORATE BANKING"],
  "ib": ["CORPORATE BANKING"],
  "asset management": ["ASS MAN"],
  "mergers": ["CORP M&A"],
  "acquisitions": ["CORP M&A", "ACQUISITION FINANCE"],
  "m&a": ["CORP M&A"],
  "leveraged buyout": ["Debt", "BUY SIDE", "PE"],
  "lbo": ["Debt", "BUY SIDE", "PE"],
  "debt capital": ["DCM", "Debt"],
  "dcm": ["DCM", "Debt"],
  "ecm": ["ECM", "CAPITAL MARKETS"],
  // Note: Only add consulting for explicit consulting searches, NOT for PE
  "consulting": ["CONSULT"],
  "management consulting": ["CONSULT"],
  "real estate": ["AREC"],
  "property": ["AREC", "CONSTRUCTION"],
  "infrastructure": ["CONSTRUCTION", "CAPITAL GOODS"],
  "credit": ["CREDIT", "Debt"],
  "private credit": ["CREDIT", "Debt", "BUY SIDE"],
  "private debt": ["CREDIT", "Debt", "BUY SIDE"],
  "distressed": ["CREDIT", "DISTRESSED", "BANKRUPCY"],
  "special situations": ["DISTRESSED", "BANKRUPCY"],
  "growth equity": ["BUY SIDE", "CORP VC", "PE"],
  "buyout": ["BUY SIDE", "PE", "Debt"],
  "commodities": ["COMMODITIES"],
  "derivatives": ["CDS", "CVA"],
  "trading": ["DEALER"],
  "bonds": ["BOND", "Debt"],
  "fixed income": ["BOND", "Debt"],
  "equities": ["CAPITAL MARKETS"],
  "crypto": ["CRYPTO", "BLOCKCHAIN"],
  "blockchain": ["BLOCKCHAIN"],
  "fintech": ["AUTOMATION", "DATA"],
  "insurance": ["ASSURANCE"],
  "banking": ["BANK", "CORPORATE BANKING"],
  "clearing": ["CLEARING", "CUSTODY"],
  "custody": ["CUSTODY"],
};

const LOCATION_SKILLS: Record<string, string[]> = {
  // Europe
  london: ["LONDON"],
  "united kingdom": ["LONDON"],
  uk: ["LONDON"],
  england: ["LONDON"],
  frankfurt: ["DACH", "FRANKFURT"],
  munich: ["DACH"],
  berlin: ["BERLIN", "DACH"],
  germany: ["DACH"],
  dach: ["DACH"],
  zurich: ["DACH", "BASEL"],
  geneva: ["DACH"],
  switzerland: ["DACH", "BASEL"],
  dubai: ["ABU DHABI"],
  "abu dhabi": ["ABU DHABI"],
  uae: ["ABU DHABI"],
  stockholm: ["COPENHAGEN"],
  oslo: ["COPENHAGEN"],
  copenhagen: ["COPENHAGEN"],
  helsinki: ["COPENHAGEN"],
  nordics: ["COPENHAGEN"],
  amsterdam: ["AMSTERDAM", "BENELUX"],
  brussels: ["BRUSSEL", "BENELUX"],
  benelux: ["BENELUX", "AMSTERDAM"],
  paris: ["PARIS"],
  france: ["PARIS"],
  milan: ["MILAN"],
  italy: ["MILAN"],
  rome: ["MILAN"],
  madrid: ["BARCELONA"],
  spain: ["BARCELONA"],
  barcelona: ["BARCELONA"],
  // Americas
  "new york": ["NEW YORK", "AMERICAS"],
  nyc: ["NEW YORK", "AMERICAS"],
  boston: ["Boston", "AMERICAS"],
  chicago: ["CHICAGO", "AMERICAS"],
  "san francisco": ["California", "AMERICAS"],
  "los angeles": ["California", "AMERICAS"],
  texas: ["DALLAS", "AMERICAS"],
  dallas: ["DALLAS", "AMERICAS"],
  houston: ["DALLAS", "AMERICAS"],
  atlanta: ["ATL", "AMERICAS"],
  miami: ["AMERICAS"],
  charlotte: ["CHARLOTTE", "AMERICAS"],
  "united states": ["AMERICAS"],
  usa: ["AMERICAS"],
  canada: ["CANADA", "AMERICAS"],
  brazil: ["BRAZIL", "AMERICAS"],
  // APAC
  singapore: ["APAC", "ASIA"],
  "hong kong": ["APAC", "ASIA", "CHINA"],
  tokyo: ["APAC", "ASIA"],
  japan: ["APAC", "ASIA"],
  australia: ["AUSTRALIA", "APAC"],
  sydney: ["AUSTRALIA", "APAC"],
  china: ["CHINA", "APAC", "ASIA"],
  beijing: ["BEIJING", "CHINA", "APAC"],
  bangkok: ["BANGKOK", "APAC"],
  asia: ["ASIA", "APAC"],
  // Middle East / Africa
  bahrain: ["BAHRAIN"],
  cairo: ["CAIRO", "AFRICA"],
  africa: ["AFRICA", "AFRICAN"],
  // CEE
  "czech republic": ["CZECH REPUBLIC", "CEE"],
  poland: ["CEE"],
  hungary: ["CEE"],
  romania: ["CEE"],
  bulgaria: ["BULGARIA", "CEE"],
  croatia: ["CROATIA", "CEE"],
};

const ROLE_SKILLS: Record<string, string[]> = {
  // Leadership
  head: ["BUSINESS"],
  director: ["BUSINESS"],
  partner: ["BUSINESS", "BOUTIQUE"],
  "managing partner": ["BUSINESS", "BOUTIQUE"],
  "senior partner": ["BUSINESS", "BOUTIQUE"],
  "equity partner": ["BUSINESS", "BOUTIQUE"],
  "managing director": ["BUSINESS"],
  md: ["BUSINESS"],
  principal: ["BUSINESS"],
  "vice president": ["BUSINESS"],
  vp: ["BUSINESS"],
  svp: ["BUSINESS"],
  evp: ["BUSINESS"],
  senior: ["BUSINESS"],
  associate: ["BUSINESS"],
  analyst: ["ANALYSIS"],
  manager: ["BUSINESS"],
  // Investment
  "portfolio manager": ["BUY SIDE", "ASS MAN"],
  "investment manager": ["BUY SIDE", "ASS MAN"],
  "fund manager": ["BUY SIDE", "ASS MAN"],
  "buy side": ["BUY SIDE"],
  buyside: ["BUY SIDE"],
  growth: ["CORP VC"],
  fundraising: ["Capital Formation"],
  "investor relations": ["Capital Formation"],
  ir: ["Capital Formation"],
  // C-Suite
  cfo: ["CORP FIN", "ACCOUNTING"],
  ceo: ["BUSINESS"],
  coo: ["CONTROL", "BUSINESS"],
  cio: ["DATA", "BUSINESS"],
  cto: ["DATA", "AUTOMATION"],
  chief: ["BUSINESS"],
  founder: ["BUSINESS"],
  "co-founder": ["BUSINESS"],
  // HR & Talent
  hr: ["C&B", "COMPENSATION"],
  "human resources": ["C&B", "COMPENSATION"],
  talent: ["C&B"],
  recruiting: ["C&B"],
  recruiter: ["C&B"],
  // Legal
  "general counsel": ["COMPLIANCE", "ARBITRATION"],
  gc: ["COMPLIANCE"],
  "legal counsel": ["COMPLIANCE", "ARBITRATION"],
  counsel: ["COMPLIANCE"],
  attorney: ["ARBITRATION"],
  lawyer: ["ARBITRATION"],
  "legal director": ["COMPLIANCE"],
  "head of legal": ["COMPLIANCE"],
  "chief legal officer": ["COMPLIANCE"],
  clo: ["COMPLIANCE"],
  compliance: ["COMPLIANCE", "CENTRAL COMPLIANCE"],
  regulatory: ["COMPLIANCE", "CONDUCT RISK"],
  // Operations & Strategy
  operations: ["CONTROL", "BACK OFFICE"],
  strategy: ["CORP STRATEGY"],
  "business development": ["BUS DEV"],
  bd: ["BUS DEV"],
  "corporate development": ["CORP DEV", "CORP M&A"],
  // Risk
  risk: ["CYBER RISK", "CONDUCT RISK"],
  audit: ["AUDIT", "CONTROL"],
  // Tech
  developer: ["APPLICATION DEVELOPER"],
  engineer: ["APPLICATION DEVELOPER", "AUTOMATION"],
  data: ["DATA", "DATASCIENCE", "BIG DATA"],
  cloud: ["CLOUD", "AWS", "AZURE"],
};

// Buy Side companies (PE, VC, Hedge Funds, Asset Managers, Credit Funds)
const BUY_SIDE_COMPANY_PATTERNS = [
  'blackstone', 'kkr', 'carlyle', 'apollo global', 'tpg', 'warburg pincus',
  'advent international', 'bain capital', 'permira', 'cvc capital', 'apax',
  'bc partners', 'eqt', 'cinven', 'pai partners', 'bridgepoint', 'ardian',
  'partners group', 'general atlantic', 'silver lake', 'thoma bravo', 'vista equity',
  'hellman', 'providence equity', 'onex', 'hg capital', 'montagu', 'ik partners',
  'triton', 'nordic capital', 'equistone', 'charterhouse', 'advent',
  'ares', 'blue owl', 'owl rock', 'golub capital', 'antares capital', 'hps investment',
  'sixth street', 'oak hill', 'goldentree', 'oaktree', 'cerberus', 'pgim', 'pimco',
  'blackrock', 'vanguard', 'fidelity', 'wellington', 't. rowe', 'invesco',
  'franklin templeton', 'nuveen', 'gam', 'schroders', 'jupiter', 'abrdn', 'man group',
  'citadel', 'millennium', 'point72', 'bridgewater', 'two sigma', 'de shaw', 'd.e. shaw',
  'renaissance', 'elliott', 'baupost', 'brevan howard', 'capula', 'qube',
  'sequoia', 'andreessen', 'a16z', 'benchmark', 'accel', 'kleiner', 'greylock',
  'lightspeed', 'general catalyst', 'index ventures', 'insight partners', 'balderton', 'atomico',
  'qatar investment', 'qia', 'adia', 'gic', 'temasek', 'cppib', 'cdpq', 'calpers',
];

// Sell Side companies (Investment Banks, M&A Advisory)
const SELL_SIDE_COMPANY_PATTERNS = [
  'goldman sachs', 'morgan stanley', 'j.p. morgan', 'jp morgan', 'jpmorgan',
  'bank of america', 'bofa securities', 'citigroup', 'citibank', 'barclays',
  'deutsche bank', 'ubs', 'credit suisse', 'hsbc',
  'lazard', 'evercore', 'moelis', 'centerview', 'perella weinberg', 'rothschild',
  'greenhill', 'pjt partners', 'guggenheim', 'jefferies', 'nomura', 'macquarie',
];

// Skills that conflict - cannot appear together
const BUY_SIDE_ONLY_SKILLS = ['BUY SIDE', 'PE', 'CORP VC', 'VC', 'ALT INVESTMENT', 'ASS MAN'];
const SELL_SIDE_ONLY_SKILLS = ['SELL SIDE', 'CORPORATE BANKING', 'TIER 1'];

function detectCompanySide(companyName: string): 'buy' | 'sell' | null {
  const lower = companyName.toLowerCase();
  for (const pattern of BUY_SIDE_COMPANY_PATTERNS) {
    if (lower.includes(pattern)) return 'buy';
  }
  for (const pattern of SELL_SIDE_COMPANY_PATTERNS) {
    if (lower.includes(pattern)) return 'sell';
  }
  return null;
}

export function generateBullhornSkillsString(
  contact: BullhornSkillsContact,
  preferences?: SearchPreference
): string {
  const skills = new Set<string>();
  
  // Detect company side for conflict resolution
  const companySide = detectCompanySide(contact.company || '');

  // 1) Direct industry mapping
  if (preferences?.industry) {
    const lower = String(preferences.industry).toLowerCase();
    for (const [keyword, skillCodes] of Object.entries(INDUSTRY_DIRECT_SKILLS)) {
      if (lower.includes(keyword) || keyword.includes(lower)) {
        skillCodes.forEach((s) => skills.add(s));
      }
    }
  }

  // 2) Industries array mapping
  if (preferences?.industries) {
    for (const industry of preferences.industries) {
      const lowerIndustry = String(industry).toLowerCase();
      for (const [keyword, skillCodes] of Object.entries(INDUSTRY_DIRECT_SKILLS)) {
        if (lowerIndustry.includes(keyword) || keyword.includes(lowerIndustry)) {
          skillCodes.forEach((s) => skills.add(s));
        }
      }
      for (const [keyword, skillCodes] of Object.entries(INDUSTRY_SKILLS)) {
        if (lowerIndustry.includes(keyword) || keyword.includes(lowerIndustry)) {
          skillCodes.forEach((s) => skills.add(s));
        }
      }
    }
  }

  // 3) Sectors mapping
  if (preferences?.sectors) {
    for (const sector of preferences.sectors) {
      const lowerSector = String(sector).toLowerCase();
      for (const [keyword, skillCodes] of Object.entries(SECTOR_SKILLS)) {
        if (lowerSector.includes(keyword) || keyword.includes(lowerSector)) {
          skillCodes.forEach((s) => skills.add(s));
        }
      }
    }
  }

  // 4) Company keyword mapping
  const companyLower = String(contact.company || "").toLowerCase();
  for (const [keyword, skillCodes] of Object.entries(INDUSTRY_SKILLS)) {
    if (companyLower.includes(keyword)) {
      skillCodes.forEach((s) => skills.add(s));
    }
  }

  // 5) Location mapping
  const locationLower = String(contact.location || "").toLowerCase();
  for (const [keyword, skillCodes] of Object.entries(LOCATION_SKILLS)) {
    if (locationLower.includes(keyword)) {
      skillCodes.forEach((s) => skills.add(s));
    }
  }

  // 5b) Always add a city identifier (best-effort)
  if (contact.location) {
    const city = String(contact.location).split(",")[0]?.trim();
    if (city) skills.add(city.toUpperCase());
  }

  // 6) Preference locations mapping
  if (preferences?.locations) {
    for (const loc of preferences.locations) {
      const lowerLoc = String(loc).toLowerCase();
      for (const [keyword, skillCodes] of Object.entries(LOCATION_SKILLS)) {
        if (lowerLoc.includes(keyword) || keyword.includes(lowerLoc)) {
          skillCodes.forEach((s) => skills.add(s));
        }
      }
    }
  }

  // 7) Role/title mapping
  const titleLower = String(contact.title || "").toLowerCase();
  for (const [keyword, skillCodes] of Object.entries(ROLE_SKILLS)) {
    if (titleLower.includes(keyword)) {
      skillCodes.forEach((s) => skills.add(s));
    }
  }

  // 8) Target roles mapping (search intent)
  if (preferences?.targetRoles) {
    for (const role of preferences.targetRoles) {
      const lowerRole = String(role).toLowerCase();
      for (const [keyword, skillCodes] of Object.entries(ROLE_SKILLS)) {
        if (lowerRole.includes(keyword) || keyword.includes(lowerRole)) {
          skillCodes.forEach((s) => skills.add(s));
        }
      }
    }
  }

  // 9) CONFLICT RESOLUTION: Remove conflicting skills based on company side
  if (companySide === 'buy') {
    SELL_SIDE_ONLY_SKILLS.forEach(s => skills.delete(s));
    skills.add('BUY SIDE');
  } else if (companySide === 'sell') {
    BUY_SIDE_ONLY_SKILLS.forEach(s => skills.delete(s));
    skills.add('SELL SIDE');
  }

  // 10) Ensure minimum skill count (at least 4 skills)
  if (skills.size < 4) {
    skills.add("BUSINESS");
    if (titleLower.includes("senior") || titleLower.includes("head") || titleLower.includes("director")) {
      skills.add("SENIOR");
    } else if (titleLower.includes("associate") || titleLower.includes("analyst")) {
      skills.add("JUNIOR");
    } else {
      skills.add("MID-LEVEL");
    }
    if (skills.size < 4 && locationLower) {
      if (locationLower.includes("london") || locationLower.includes("uk")) skills.add("LONDON");
      else if (locationLower.includes("new york") || locationLower.includes("usa")) skills.add("AMERICAS");
      else skills.add("GLOBAL");
    }
  }

  // Hard guarantee: never return empty Skills
  if (skills.size === 0) {
    skills.add("BUSINESS");
    skills.add("GLOBAL");
    skills.add("SENIOR");
    skills.add("FINANCE");
  }

  return Array.from(skills).join(" ; ");
}

export function countBullhornSkills(skillsString: string): number {
  return skillsString
    .split(" ; ")
    .map((s) => s.trim())
    .filter(Boolean).length;
}
