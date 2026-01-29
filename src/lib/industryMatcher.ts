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
  "bnp paribas": ["Investment Banking", "Commercial Banking"],
  "societe generale": ["Investment Banking", "Commercial Banking"],
  "natixis": ["Investment Banking", "Asset Management"],
  "credit agricole": ["Commercial Banking", "Investment Banking"],
  "standard chartered": ["Commercial Banking", "Investment Banking"],
  "nomura": ["Investment Banking", "Asset Management"],
  "macquarie": ["Investment Banking", "Infrastructure", "Asset Management"],
  "rbc capital": ["Investment Banking", "Capital Markets"],
  "rbc": ["Investment Banking", "Commercial Banking"],
  "scotiabank": ["Investment Banking", "Commercial Banking"],
  "td securities": ["Investment Banking", "Capital Markets"],
  "bmo capital": ["Investment Banking", "Capital Markets"],
  "wells fargo": ["Investment Banking", "Commercial Banking"],
  
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
  "liontree": ["Investment Banking", "Media & Entertainment"],
  "qatalyst": ["Investment Banking", "Technology"],
  "allen & company": ["Investment Banking", "Media & Entertainment"],
  "financo": ["Investment Banking", "Consumer Products"],
  "ducera": ["Investment Banking", "Restructuring"],
  "pwp": ["Investment Banking", "Financial Advisory"],
  
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
  "ardian": ["Private Equity (PE)", "Infrastructure PE"],
  "astorg": ["Private Equity (PE)"],
  "pai partners": ["Private Equity (PE)"],
  "bridgepoint": ["Private Equity (PE)"],
  "intermediate capital": ["Private Equity (PE)", "Private Credit"],
  "icg": ["Private Equity (PE)", "Private Credit"],
  "montagu": ["Private Equity (PE)"],
  "hg capital": ["Private Equity (PE)"],
  "charterhouse": ["Private Equity (PE)"],
  "triton": ["Private Equity (PE)"],
  "nordic capital": ["Private Equity (PE)"],
  "investindustrial": ["Private Equity (PE)"],
  "eurazeo": ["Private Equity (PE)"],
  "antin": ["Infrastructure PE"],
  "dws": ["Asset Management", "Infrastructure PE"],
  "alcentra": ["Private Credit"],
  "bucephale": ["Private Equity (PE)", "Mergers & Acquisitions (M&A)"],
  "bucephale finance": ["Private Equity (PE)", "Mergers & Acquisitions (M&A)"],
  "l catterton": ["Private Equity (PE)", "Consumer Products"],
  "sycamore": ["Private Equity (PE)", "Consumer Products"],
  "cerberus": ["Private Equity (PE)", "Distressed Debt"],
  "fortress": ["Private Equity (PE)", "Private Credit"],
  "oaktree": ["Private Credit", "Distressed Debt"],
  "cppib": ["Private Equity (PE)", "Infrastructure PE"],
  "gic": ["Private Equity (PE)", "Real Estate"],
  "temasek": ["Private Equity (PE)", "Venture Capital (VC)"],
  "adia": ["Private Equity (PE)", "Real Estate"],
  "mubadala": ["Private Equity (PE)", "Infrastructure PE"],
  
  // European PE
  "3i": ["Private Equity (PE)"],
  "alchemy partners": ["Private Equity (PE)"],
  "doughty hanson": ["Private Equity (PE)"],
  "terra firma": ["Private Equity (PE)"],
  "oakley capital": ["Private Equity (PE)"],
  "hg": ["Private Equity (PE)"],
  "exponent": ["Private Equity (PE)"],
  "graphite capital": ["Private Equity (PE)"],
  "bowmark": ["Private Equity (PE)"],
  "livingbridge": ["Private Equity (PE)"],
  "ldc": ["Private Equity (PE)"],
  "foresight": ["Private Equity (PE)", "Venture Capital (VC)"],
  "inflexion": ["Private Equity (PE)"],
  "palatine": ["Private Equity (PE)"],
  "equistone": ["Private Equity (PE)"],
  "argos wityu": ["Private Equity (PE)"],
  
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
  "magnetar": ["Hedge Fund"],
  "highbridge": ["Hedge Fund"],
  "tudor": ["Hedge Fund"],
  "caxton": ["Hedge Fund"],
  "soros fund management": ["Hedge Fund"],
  "moorhead": ["Hedge Fund"],
  "egerton": ["Hedge Fund"],
  "lansdowne": ["Hedge Fund"],
  "odey": ["Hedge Fund"],
  "chenavari": ["Hedge Fund", "Private Credit"],
  "gso": ["Hedge Fund", "Private Credit"],
  
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
  "lgim": ["Asset Management"],
  "m&g": ["Asset Management"],
  "jupiter": ["Asset Management"],
  "abrdn": ["Asset Management"],
  "rathbones": ["Wealth Management"],
  "st james's place": ["Wealth Management"],
  "quilter": ["Wealth Management"],
  "brewin dolphin": ["Wealth Management"],
  "evelyn partners": ["Wealth Management"],
  "sarasin": ["Asset Management", "Wealth Management"],
  "pictet": ["Wealth Management", "Asset Management"],
  "lombard odier": ["Wealth Management"],
  "julius baer": ["Wealth Management"],
  "edmond de rothschild": ["Wealth Management", "Asset Management"],
  
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
  "general catalyst": ["Venture Capital (VC)"],
  "redpoint": ["Venture Capital (VC)"],
  "draper": ["Venture Capital (VC)"],
  "lakestar": ["Venture Capital (VC)"],
  "creandum": ["Venture Capital (VC)"],
  "partech": ["Venture Capital (VC)"],
  "idinvest": ["Venture Capital (VC)", "Private Equity (PE)"],
  "eurazeo growth": ["Venture Capital (VC)"],
  "local globe": ["Venture Capital (VC)"],
  "mosaic ventures": ["Venture Capital (VC)"],
  "notion capital": ["Venture Capital (VC)"],
  "dawn capital": ["Venture Capital (VC)"],
  "seedcamp": ["Venture Capital (VC)"],
  "passion capital": ["Venture Capital (VC)"],
  "hoxton ventures": ["Venture Capital (VC)"],
  "entrepreneur first": ["Venture Capital (VC)"],
  "ef": ["Venture Capital (VC)"],
  
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
  "accenture": ["Management Consulting", "Technology"],
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
  "alvarez & marsal": ["Restructuring", "Management Consulting"],
  "a&m": ["Restructuring", "Management Consulting"],
  "huron": ["Management Consulting"],
  "simon-kucher": ["Strategy Consulting"],
  "zs associates": ["Management Consulting"],
  "capgemini": ["Management Consulting", "Technology"],
  "pa consulting": ["Management Consulting"],
  "cognizant": ["Management Consulting", "Technology"],
  "infosys": ["Technology", "Management Consulting"],
  "wipro": ["Technology", "Management Consulting"],
  "tcs": ["Technology", "Management Consulting"],
  "tata consultancy": ["Technology", "Management Consulting"],
  
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
  "hayfin": ["Private Credit"],
  "tikehau": ["Private Credit", "Private Equity (PE)"],
  "permira credit": ["Private Credit"],
  "muzinich": ["Private Credit"],
  "arcmont": ["Private Credit"],
  "pemberton": ["Private Credit"],
  
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
  "savills": ["Real Estate"],
  "knight frank": ["Real Estate"],
  "eastdil secured": ["Real Estate", "Investment Banking"],
  "eastdil": ["Real Estate", "Investment Banking"],
  "lseg": ["Real Estate"],
  "patrizia": ["Real Estate Private Equity"],
  "m7": ["Real Estate Private Equity"],
  "tristan capital": ["Real Estate Private Equity"],
  "henderson park": ["Real Estate Private Equity"],
  "round hill": ["Real Estate Private Equity"],
  "heitman": ["Real Estate Private Equity"],
  "lasalle": ["Real Estate Private Equity"],
  "invesco real estate": ["Real Estate Private Equity"],
  "aew": ["Real Estate Private Equity"],
  "nuveen real estate": ["Real Estate Private Equity"],
  
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
  "monzo": ["FinTech"],
  "starling": ["FinTech"],
  "n26": ["FinTech"],
  "nubank": ["FinTech"],
  "checkout.com": ["FinTech", "Payments"],
  "checkout": ["FinTech", "Payments"],
  "worldpay": ["FinTech", "Payments"],
  "fis": ["FinTech", "Payments"],
  "fiserv": ["FinTech", "Payments"],
  "worldline": ["FinTech", "Payments"],
  
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
  "aviva": ["Insurance"],
  "legal & general": ["Insurance", "Asset Management"],
  "standard life": ["Insurance", "Asset Management"],
  "phoenix group": ["Insurance"],
  "hannover re": ["Reinsurance"],
  "scor": ["Reinsurance"],
  "beazley": ["Insurance"],
  "hiscox": ["Insurance"],
  
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
  "uber": ["Technology", "Transportation"],
  "airbnb": ["Technology", "Hospitality"],
  "doordash": ["Technology", "Consumer Products"],
  "spotify": ["Technology", "Media & Entertainment"],
  "snap": ["Technology", "Media & Entertainment"],
  "twitter": ["Technology", "Media & Entertainment"],
  "x": ["Technology", "Media & Entertainment"],
  "linkedin": ["Technology"],
  "slack": ["Technology"],
  "zoom": ["Technology"],
  "snowflake": ["Technology"],
  "databricks": ["Technology"],
  "palantir": ["Technology"],
  "splunk": ["Technology"],
  "servicenow": ["Technology"],
  "workday": ["Technology"],
  "shopify": ["Technology", "E-commerce"],
  "atlassian": ["Technology"],
  
  // Healthcare & Pharma
  "pfizer": ["Pharmaceuticals", "Healthcare"],
  "johnson & johnson": ["Pharmaceuticals", "Healthcare", "Consumer Products"],
  "j&j": ["Pharmaceuticals", "Healthcare"],
  "novartis": ["Pharmaceuticals", "Healthcare"],
  "roche": ["Pharmaceuticals", "Healthcare"],
  "merck": ["Pharmaceuticals", "Healthcare"],
  "abbvie": ["Pharmaceuticals", "Healthcare"],
  "bristol-myers": ["Pharmaceuticals", "Healthcare"],
  "bms": ["Pharmaceuticals", "Healthcare"],
  "eli lilly": ["Pharmaceuticals", "Healthcare"],
  "lilly": ["Pharmaceuticals", "Healthcare"],
  "sanofi": ["Pharmaceuticals", "Healthcare"],
  "gsk": ["Pharmaceuticals", "Healthcare"],
  "glaxosmithkline": ["Pharmaceuticals", "Healthcare"],
  "astrazeneca": ["Pharmaceuticals", "Healthcare"],
  "moderna": ["Biotech", "Healthcare"],
  "gilead": ["Biotech", "Healthcare"],
  "amgen": ["Biotech", "Healthcare"],
  "biogen": ["Biotech", "Healthcare"],
  "regeneron": ["Biotech", "Healthcare"],
  "vertex": ["Biotech", "Healthcare"],
  "illumina": ["Biotech", "Healthcare"],
  "thermo fisher": ["Medical Devices", "Healthcare"],
  "medtronic": ["Medical Devices", "Healthcare"],
  "abbott": ["Medical Devices", "Healthcare"],
  "stryker": ["Medical Devices", "Healthcare"],
  "boston scientific": ["Medical Devices", "Healthcare"],
  "unitedhealth": ["Healthcare Services"],
  "cvs": ["Healthcare Services", "Retail"],
  "anthem": ["Healthcare Services", "Insurance"],
  "cigna": ["Healthcare Services", "Insurance"],
  "humana": ["Healthcare Services", "Insurance"],
  
  // Energy
  "shell": ["Energy", "Oil & Gas"],
  "bp": ["Energy", "Oil & Gas"],
  "exxon": ["Energy", "Oil & Gas"],
  "exxonmobil": ["Energy", "Oil & Gas"],
  "chevron": ["Energy", "Oil & Gas"],
  "total": ["Energy", "Oil & Gas"],
  "totalenergies": ["Energy", "Oil & Gas"],
  "eni": ["Energy", "Oil & Gas"],
  "equinor": ["Energy", "Oil & Gas"],
  "conocophillips": ["Energy", "Oil & Gas"],
  "schlumberger": ["Energy", "Oil & Gas"],
  "halliburton": ["Energy", "Oil & Gas"],
  "baker hughes": ["Energy", "Oil & Gas"],
  "orsted": ["Energy", "Renewables"],
  "vestas": ["Energy", "Renewables"],
  "siemens gamesa": ["Energy", "Renewables"],
  "engie": ["Energy", "Utilities"],
  "edf": ["Energy", "Utilities"],
  "iberdrola": ["Energy", "Utilities"],
  "enel": ["Energy", "Utilities"],
  "national grid": ["Energy", "Utilities"],
  "sse": ["Energy", "Utilities"],
  "centrica": ["Energy", "Utilities"],
  
  // Consumer & Retail
  "unilever": ["Consumer Products", "FMCG"],
  "procter & gamble": ["Consumer Products", "FMCG"],
  "p&g": ["Consumer Products", "FMCG"],
  "nestle": ["Consumer Products", "Food & Beverage"],
  "coca-cola": ["Consumer Products", "Food & Beverage"],
  "pepsi": ["Consumer Products", "Food & Beverage"],
  "pepsico": ["Consumer Products", "Food & Beverage"],
  "diageo": ["Consumer Products", "Food & Beverage"],
  "ab inbev": ["Consumer Products", "Food & Beverage"],
  "lvmh": ["Consumer Products", "Luxury"],
  "kering": ["Consumer Products", "Luxury"],
  "hermes": ["Consumer Products", "Luxury"],
  "richemont": ["Consumer Products", "Luxury"],
  "nike": ["Consumer Products", "Retail"],
  "adidas": ["Consumer Products", "Retail"],
  "walmart": ["Retail"],
  "target": ["Retail"],
  "costco": ["Retail"],
  "tesco": ["Retail"],
  "sainsbury": ["Retail"],
  "carrefour": ["Retail"],
  "amazon retail": ["Retail", "E-commerce"],
  
  // Media & Entertainment
  "disney": ["Media & Entertainment"],
  "warner bros": ["Media & Entertainment"],
  "warner": ["Media & Entertainment"],
  "nbcuniversal": ["Media & Entertainment"],
  "paramount": ["Media & Entertainment"],
  "sony": ["Media & Entertainment", "Technology"],
  "vivendi": ["Media & Entertainment"],
  "rtl": ["Media & Entertainment"],
  "itv": ["Media & Entertainment"],
  "bbc": ["Media & Entertainment"],
  "sky": ["Media & Entertainment", "Telecommunications"],
  "comcast": ["Media & Entertainment", "Telecommunications"],
  "viacom": ["Media & Entertainment"],
  "news corp": ["Media & Entertainment"],
  "fox": ["Media & Entertainment"],
  "discovery": ["Media & Entertainment"],
  "live nation": ["Media & Entertainment"],
  "endeavor": ["Media & Entertainment", "Sports"],
  "img": ["Media & Entertainment", "Sports"],
  "wme": ["Media & Entertainment"],
  "caa": ["Media & Entertainment"],
  
  // Telecommunications
  "at&t": ["Telecommunications"],
  "verizon": ["Telecommunications"],
  "t-mobile": ["Telecommunications"],
  "vodafone": ["Telecommunications"],
  "bt": ["Telecommunications"],
  "orange": ["Telecommunications"],
  "telefonica": ["Telecommunications"],
  "deutsche telekom": ["Telecommunications"],
  
  // Automotive
  "volkswagen": ["Automotive"],
  "vw": ["Automotive"],
  "bmw": ["Automotive"],
  "mercedes": ["Automotive", "Luxury"],
  "daimler": ["Automotive"],
  "toyota": ["Automotive"],
  "honda": ["Automotive"],
  "ford": ["Automotive"],
  "gm": ["Automotive"],
  "general motors": ["Automotive"],
  "tesla": ["Automotive", "Technology"],
  "rivian": ["Automotive", "Technology"],
  "lucid": ["Automotive", "Technology"],
  "stellantis": ["Automotive"],
  "ferrari": ["Automotive", "Luxury"],
  "porsche": ["Automotive", "Luxury"],
  
  // Legal
  "kirkland": ["Legal"],
  "kirkland & ellis": ["Legal"],
  "latham": ["Legal"],
  "latham & watkins": ["Legal"],
  "skadden": ["Legal"],
  "simpson thacher": ["Legal"],
  "davis polk": ["Legal"],
  "sullivan & cromwell": ["Legal"],
  "wachtell": ["Legal"],
  "cleary gottlieb": ["Legal"],
  "cravath": ["Legal"],
  "freshfields": ["Legal"],
  "linklaters": ["Legal"],
  "clifford chance": ["Legal"],
  "allen & overy": ["Legal"],
  "slaughter and may": ["Legal"],
  "magic circle": ["Legal"],
  "ashurst": ["Legal"],
  "herbert smith": ["Legal"],
  "hogan lovells": ["Legal"],
  "norton rose": ["Legal"],
  "baker mckenzie": ["Legal"],
  "dla piper": ["Legal"],
  "white & case": ["Legal"],
  "debevoise": ["Legal"],
  "paul weiss": ["Legal"],
  "weil gotshal": ["Legal"],
  "sidley": ["Legal"],
  "gibson dunn": ["Legal"],
  "milbank": ["Legal"],
  "morrison foerster": ["Legal"],
  
  // Executive Search / HR
  "korn ferry": ["Executive Search", "HR Services"],
  "spencer stuart": ["Executive Search"],
  "russell reynolds": ["Executive Search"],
  "heidrick & struggles": ["Executive Search"],
  "egon zehnder": ["Executive Search"],
  "odgers berndtson": ["Executive Search"],
  "boyden": ["Executive Search"],
  "robert half": ["HR Services"],
  "michael page": ["HR Services"],
  "hays": ["HR Services"],
  "randstad": ["HR Services"],
  "adecco": ["HR Services"],
  "manpower": ["HR Services"],
};

// ============== TITLE PATTERNS ==============
// Job title keywords that indicate specific industries

export const TITLE_TO_INDUSTRY: Record<string, { industries: string[]; requiresContext?: boolean }> = {
  // Investment Banking Specific
  "investment banker": { industries: ["Investment Banking"] },
  "investment banking analyst": { industries: ["Investment Banking"] },
  "investment banking associate": { industries: ["Investment Banking"] },
  "ib analyst": { industries: ["Investment Banking"] },
  "ib associate": { industries: ["Investment Banking"] },
  "m&a": { industries: ["Mergers & Acquisitions (M&A)", "Investment Banking"] },
  "mergers and acquisitions": { industries: ["Mergers & Acquisitions (M&A)"] },
  "ecm": { industries: ["Equity Capital Markets (ECM)", "Capital Markets"] },
  "dcm": { industries: ["Debt Capital Markets (DCM)", "Capital Markets"] },
  "capital markets": { industries: ["Capital Markets"] },
  "leveraged finance": { industries: ["Leveraged Finance"] },
  "lev fin": { industries: ["Leveraged Finance"] },
  "restructuring": { industries: ["Restructuring"] },
  "distressed": { industries: ["Distressed Debt", "Restructuring"] },
  "syndicate": { industries: ["Capital Markets", "Investment Banking"] },
  "origination": { industries: ["Investment Banking", "Private Credit"] },
  "coverage": { industries: ["Investment Banking"], requiresContext: true },
  "fig": { industries: ["Investment Banking"], requiresContext: true },
  "sponsor coverage": { industries: ["Investment Banking", "Private Equity (PE)"] },
  
  // Private Equity Specific
  "private equity": { industries: ["Private Equity (PE)"] },
  "pe associate": { industries: ["Private Equity (PE)"] },
  "pe analyst": { industries: ["Private Equity (PE)"] },
  "buyout": { industries: ["Private Equity (PE)"] },
  "growth equity": { industries: ["Private Equity (PE)", "Venture Capital (VC)"] },
  "portfolio operations": { industries: ["Private Equity (PE)"] },
  "portfolio company": { industries: ["Private Equity (PE)"] },
  "operating partner": { industries: ["Private Equity (PE)"] },
  "investment professional": { industries: ["Private Equity (PE)", "Venture Capital (VC)"] },
  "deal team": { industries: ["Private Equity (PE)", "Investment Banking"] },
  "large cap": { industries: ["Private Equity (PE)"] },
  "mid-market": { industries: ["Private Equity (PE)"] },
  "mid market": { industries: ["Private Equity (PE)"] },
  "lower middle market": { industries: ["Private Equity (PE)"] },
  "lmm": { industries: ["Private Equity (PE)"] },
  "co-investment": { industries: ["Private Equity (PE)"] },
  "coinvestment": { industries: ["Private Equity (PE)"] },
  "value creation": { industries: ["Private Equity (PE)"] },
  "fund of funds": { industries: ["Private Equity (PE)", "Asset Management"] },
  "secondaries": { industries: ["Private Equity (PE)"] },
  "infrastructure": { industries: ["Infrastructure PE", "Infrastructure"] },
  
  // Venture Capital Specific
  "venture capital": { industries: ["Venture Capital (VC)"] },
  "vc analyst": { industries: ["Venture Capital (VC)"] },
  "vc associate": { industries: ["Venture Capital (VC)"] },
  "venture partner": { industries: ["Venture Capital (VC)"] },
  "early stage": { industries: ["Venture Capital (VC)"] },
  "seed": { industries: ["Venture Capital (VC)"], requiresContext: true },
  "series a": { industries: ["Venture Capital (VC)"] },
  "growth stage": { industries: ["Venture Capital (VC)", "Private Equity (PE)"] },
  "startup": { industries: ["Venture Capital (VC)", "Technology"] },
  
  // Hedge Fund / Trading
  "hedge fund": { industries: ["Hedge Fund"] },
  "portfolio manager": { industries: ["Hedge Fund", "Asset Management"] },
  "pm": { industries: ["Hedge Fund", "Asset Management"], requiresContext: true },
  "quant": { industries: ["Quantitative Trading", "Hedge Fund"] },
  "quantitative": { industries: ["Quantitative Trading"] },
  "quantitative researcher": { industries: ["Quantitative Trading"] },
  "quant researcher": { industries: ["Quantitative Trading"] },
  "quantitative developer": { industries: ["Quantitative Trading"] },
  "quant dev": { industries: ["Quantitative Trading"] },
  "trader": { industries: ["Sales & Trading", "Quantitative Trading"] },
  "trading": { industries: ["Sales & Trading"] },
  "equity research": { industries: ["Equity Research"] },
  "research analyst": { industries: ["Equity Research"], requiresContext: true },
  "sell-side": { industries: ["Equity Research", "Investment Banking"] },
  "buy-side": { industries: ["Hedge Fund", "Asset Management"] },
  "long/short": { industries: ["Hedge Fund"] },
  "long short": { industries: ["Hedge Fund"] },
  "event driven": { industries: ["Hedge Fund"] },
  "macro": { industries: ["Hedge Fund"], requiresContext: true },
  "credit trading": { industries: ["Sales & Trading", "Hedge Fund"] },
  "fixed income": { industries: ["Fixed Income", "Sales & Trading"] },
  "rates": { industries: ["Fixed Income", "Sales & Trading"] },
  "fx": { industries: ["Foreign Exchange (FX)", "Sales & Trading"] },
  "derivatives": { industries: ["Derivatives", "Sales & Trading"] },
  "commodities": { industries: ["Commodities", "Sales & Trading"] },
  "market maker": { industries: ["Quantitative Trading", "Sales & Trading"] },
  "prop trading": { industries: ["Quantitative Trading"] },
  "systematic": { industries: ["Quantitative Trading", "Hedge Fund"] },
  
  // Asset & Wealth Management
  "asset management": { industries: ["Asset Management"] },
  "fund manager": { industries: ["Asset Management", "Hedge Fund"] },
  "wealth manager": { industries: ["Wealth Management"] },
  "wealth management": { industries: ["Wealth Management"] },
  "private banker": { industries: ["Wealth Management"] },
  "private banking": { industries: ["Wealth Management"] },
  "family office": { industries: ["Family Office", "Wealth Management"] },
  "investment analyst": { industries: ["Asset Management"], requiresContext: true },
  "fund analyst": { industries: ["Asset Management"] },
  "esg": { industries: ["ESG", "Asset Management"] },
  "sustainable": { industries: ["ESG", "Impact Investing"], requiresContext: true },
  "impact investing": { industries: ["Impact Investing"] },
  
  // Consulting
  "strategy consultant": { industries: ["Strategy Consulting"] },
  "management consultant": { industries: ["Management Consulting"] },
  "consultant": { industries: ["Management Consulting"], requiresContext: true },
  "engagement manager": { industries: ["Management Consulting", "Strategy Consulting"] },
  "project leader": { industries: ["Strategy Consulting"] },
  "principal": { industries: ["Management Consulting", "Private Equity (PE)"], requiresContext: true },
  "senior consultant": { industries: ["Management Consulting"] },
  "associate consultant": { industries: ["Management Consulting"] },
  "business analyst": { industries: ["Management Consulting"], requiresContext: true },
  "strategy analyst": { industries: ["Strategy Consulting"] },
  "transaction services": { industries: ["Transaction Advisory"] },
  "due diligence": { industries: ["Transaction Advisory", "Private Equity (PE)"] },
  "commercial due diligence": { industries: ["Strategy Consulting", "Private Equity (PE)"] },
  "cdd": { industries: ["Strategy Consulting", "Private Equity (PE)"] },
  "valuation": { industries: ["Valuation Advisory", "Transaction Advisory"] },
  
  // Credit
  "private credit": { industries: ["Private Credit"] },
  "direct lending": { industries: ["Direct Lending", "Private Credit"] },
  "credit analyst": { industries: ["Private Credit", "Credit"] },
  "mezzanine": { industries: ["Mezzanine Finance", "Private Credit"] },
  "senior debt": { industries: ["Private Credit", "Direct Lending"] },
  "unitranche": { industries: ["Private Credit"] },
  "sponsored finance": { industries: ["Private Credit", "Leveraged Finance"] },
  "loan origination": { industries: ["Private Credit", "Direct Lending"] },
  
  // Real Estate
  "real estate": { industries: ["Real Estate"] },
  "repe": { industries: ["Real Estate Private Equity"] },
  "acquisitions": { industries: ["Real Estate", "Private Equity (PE)"], requiresContext: true },
  "real estate asset management": { industries: ["Asset Management", "Real Estate"] },
  "property": { industries: ["Real Estate"], requiresContext: true },
  "commercial property": { industries: ["Commercial Real Estate", "Real Estate"] },
  "residential": { industries: ["Residential Real Estate"], requiresContext: true },
  "development": { industries: ["Real Estate", "Property Development"], requiresContext: true },
  
  // Corporate Finance
  "fp&a": { industries: ["Corporate Finance"] },
  "financial planning": { industries: ["Corporate Finance"] },
  "treasury": { industries: ["Corporate Finance"] },
  "corporate development": { industries: ["Corporate Development"] },
  "corp dev": { industries: ["Corporate Development"] },
  "controller": { industries: ["Corporate Finance"] },
  "cfo": { industries: ["Corporate Finance"] },
  "investor relations": { industries: ["Corporate Finance"] },
  "ir": { industries: ["Corporate Finance"], requiresContext: true },
  "financial controller": { industries: ["Corporate Finance"] },
  "group finance": { industries: ["Corporate Finance"] },
  
  // FinTech / Tech
  "fintech": { industries: ["FinTech"] },
  "payments": { industries: ["Payments", "FinTech"] },
  "blockchain": { industries: ["Blockchain & Crypto"] },
  "crypto": { industries: ["Blockchain & Crypto"] },
  "web3": { industries: ["Blockchain & Crypto"] },
  "defi": { industries: ["Blockchain & Crypto", "FinTech"] },
  "nft": { industries: ["Blockchain & Crypto"] },
  "software engineer": { industries: ["Technology"] },
  "developer": { industries: ["Technology"], requiresContext: true },
  "engineer": { industries: ["Technology"], requiresContext: true },
  "product manager": { industries: ["Technology"] },
  "data scientist": { industries: ["Technology", "AI & Machine Learning"] },
  "machine learning": { industries: ["AI & Machine Learning", "Technology"] },
  "ai": { industries: ["AI & Machine Learning"], requiresContext: true },
  "saas": { industries: ["SaaS", "Technology"] },
  "cloud": { industries: ["Cloud Computing"], requiresContext: true },
  "cybersecurity": { industries: ["Cybersecurity", "Technology"] },
  
  // Insurance
  "underwriter": { industries: ["Insurance"] },
  "underwriting": { industries: ["Insurance"] },
  "actuary": { industries: ["Actuarial", "Insurance"] },
  "actuarial": { industries: ["Actuarial", "Insurance"] },
  "claims": { industries: ["Insurance"], requiresContext: true },
  "reinsurance": { industries: ["Reinsurance"] },
  "insurance": { industries: ["Insurance"] },
  "risk analyst": { industries: ["Risk Management", "Insurance"] },
  
  // Healthcare / Pharma
  "healthcare": { industries: ["Healthcare"] },
  "pharma": { industries: ["Pharmaceuticals"] },
  "pharmaceutical": { industries: ["Pharmaceuticals"] },
  "biotech": { industries: ["Biotech"] },
  "life sciences": { industries: ["Healthcare", "Biotech"] },
  "medical device": { industries: ["Medical Devices"] },
  "clinical": { industries: ["Healthcare", "Pharmaceuticals"] },
  "regulatory affairs": { industries: ["Pharmaceuticals", "Healthcare"] },
  
  // Energy
  "energy": { industries: ["Energy"] },
  "oil and gas": { industries: ["Oil & Gas"] },
  "oil & gas": { industries: ["Oil & Gas"] },
  "renewable": { industries: ["Renewables", "Clean Energy"] },
  "solar": { industries: ["Renewables"] },
  "wind": { industries: ["Renewables"], requiresContext: true },
  "utilities": { industries: ["Utilities"] },
  "power": { industries: ["Energy", "Utilities"], requiresContext: true },
  
  // Consumer / Retail
  "consumer": { industries: ["Consumer Products"], requiresContext: true },
  "retail": { industries: ["Retail"] },
  "fmcg": { industries: ["FMCG", "Consumer Products"] },
  "cpg": { industries: ["Consumer Products", "FMCG"] },
  "luxury": { industries: ["Luxury", "Consumer Products"] },
  "food and beverage": { industries: ["Food & Beverage"] },
  "f&b": { industries: ["Food & Beverage"] },
  "hospitality": { industries: ["Hospitality"] },
  
  // Industrial
  "manufacturing": { industries: ["Manufacturing"] },
  "industrial": { industries: ["Industrials"] },
  "aerospace": { industries: ["Aerospace & Defense"] },
  "defense": { industries: ["Aerospace & Defense", "Defense"] },
  "automotive": { industries: ["Automotive"] },
  
  // Media
  "media": { industries: ["Media & Entertainment"] },
  "entertainment": { industries: ["Media & Entertainment"] },
  "content": { industries: ["Content & Publishing"], requiresContext: true },
  "gaming": { industries: ["Gaming"] },
  "sports": { industries: ["Sports"] },
  
  // Legal
  "lawyer": { industries: ["Legal"] },
  "attorney": { industries: ["Legal"] },
  "legal counsel": { industries: ["Legal"] },
  "solicitor": { industries: ["Legal"] },
  "associate lawyer": { industries: ["Legal"] },
  "paralegal": { industries: ["Legal"] },
  
  // HR / Executive Search
  "recruiter": { industries: ["HR Services", "Executive Search"] },
  "talent acquisition": { industries: ["HR Services"] },
  "headhunter": { industries: ["Executive Search"] },
  "executive search": { industries: ["Executive Search"] },
  "hr": { industries: ["HR Services"], requiresContext: true },
  "human resources": { industries: ["HR Services"] },
};

// ============== SECTOR INFERENCE ==============
// Map industries to sectors for automatic sector suggestions
// Expanded with comprehensive sectors across all major industries

export const INDUSTRY_TO_SECTOR: Record<string, string[]> = {
  // Finance & Investment
  "Private Equity (PE)": ["Financial Services", "Investment & Private Equity"],
  "Venture Capital (VC)": ["Financial Services", "Technology", "Investment & Private Equity"],
  "Hedge Fund": ["Financial Services", "Investment & Private Equity"],
  "Asset Management": ["Financial Services", "Investment & Private Equity"],
  "Wealth Management": ["Financial Services", "Investment & Private Equity"],
  "Investment Banking": ["Financial Services", "Banking & Capital Markets"],
  "Mergers & Acquisitions (M&A)": ["Financial Services", "Banking & Capital Markets"],
  "Capital Markets": ["Financial Services", "Banking & Capital Markets"],
  "Equity Capital Markets (ECM)": ["Financial Services", "Banking & Capital Markets"],
  "Debt Capital Markets (DCM)": ["Financial Services", "Banking & Capital Markets"],
  "Leveraged Finance": ["Financial Services", "Banking & Capital Markets"],
  "Restructuring": ["Financial Services", "Banking & Capital Markets"],
  "Private Credit": ["Financial Services", "Investment & Private Equity"],
  "Direct Lending": ["Financial Services", "Investment & Private Equity"],
  "Credit": ["Financial Services", "Banking & Capital Markets"],
  "Mezzanine Finance": ["Financial Services", "Investment & Private Equity"],
  "Distressed Debt": ["Financial Services", "Investment & Private Equity"],
  "Strategy Consulting": ["Professional Services", "Consulting"],
  "Management Consulting": ["Professional Services", "Consulting"],
  "Corporate Finance": ["Financial Services", "Corporate"],
  "Corporate Development": ["Financial Services", "Corporate"],
  "Financial Advisory": ["Financial Services", "Consulting"],
  "Transaction Advisory": ["Financial Services", "Consulting"],
  "Valuation Advisory": ["Financial Services", "Consulting"],
  "Family Office": ["Financial Services", "Investment & Private Equity"],
  "Quantitative Trading": ["Financial Services", "Technology"],
  "Sales & Trading": ["Financial Services", "Banking & Capital Markets"],
  "Equity Research": ["Financial Services", "Banking & Capital Markets"],
  "Fixed Income": ["Financial Services", "Banking & Capital Markets"],
  "Derivatives": ["Financial Services", "Banking & Capital Markets"],
  "Commodities": ["Financial Services", "Energy & Resources"],
  "Foreign Exchange (FX)": ["Financial Services", "Banking & Capital Markets"],
  
  // Real Estate & Infrastructure
  "Real Estate": ["Real Estate & Construction"],
  "Real Estate Private Equity": ["Real Estate & Construction", "Investment & Private Equity"],
  "Infrastructure": ["Industrial", "Investment & Private Equity"],
  "Infrastructure PE": ["Industrial", "Investment & Private Equity"],
  "Property Development": ["Real Estate & Construction"],
  "Commercial Real Estate": ["Real Estate & Construction"],
  "Residential Real Estate": ["Real Estate & Construction"],
  
  // Technology & Digital
  "FinTech": ["Financial Services", "Technology"],
  "Payments": ["Financial Services", "Technology"],
  "Blockchain & Crypto": ["Financial Services", "Technology"],
  "WealthTech": ["Financial Services", "Technology"],
  "InsurTech": ["Financial Services", "Technology"],
  "RegTech": ["Financial Services", "Technology"],
  "Technology": ["Technology"],
  "Software": ["Technology"],
  "SaaS": ["Technology"],
  "AI & Machine Learning": ["Technology"],
  "Cloud Computing": ["Technology"],
  "Cybersecurity": ["Technology"],
  "E-commerce": ["Technology", "Consumer & Retail"],
  "Digital Media": ["Technology", "Media & Entertainment"],
  
  // Insurance & Risk
  "Insurance": ["Financial Services", "Insurance"],
  "Reinsurance": ["Financial Services", "Insurance"],
  "Actuarial": ["Financial Services", "Insurance"],
  "Risk Management": ["Financial Services", "Insurance"],
  
  // Banking
  "Commercial Banking": ["Financial Services", "Banking & Capital Markets"],
  "Retail Banking": ["Financial Services", "Banking & Capital Markets"],
  "Corporate Banking": ["Financial Services", "Banking & Capital Markets"],
  
  // Healthcare & Life Sciences
  "Healthcare": ["Healthcare & Life Sciences"],
  "Pharmaceuticals": ["Healthcare & Life Sciences"],
  "Biotech": ["Healthcare & Life Sciences", "Technology"],
  "Medical Devices": ["Healthcare & Life Sciences"],
  "Healthcare Services": ["Healthcare & Life Sciences"],
  "HealthTech": ["Healthcare & Life Sciences", "Technology"],
  
  // Energy & Resources
  "Energy": ["Energy & Resources"],
  "Oil & Gas": ["Energy & Resources"],
  "Renewables": ["Energy & Resources", "Sustainability"],
  "Clean Energy": ["Energy & Resources", "Sustainability"],
  "Mining": ["Energy & Resources"],
  "Utilities": ["Energy & Resources"],
  
  // Consumer & Retail
  "Consumer Products": ["Consumer & Retail"],
  "Retail": ["Consumer & Retail"],
  "FMCG": ["Consumer & Retail"],
  "Luxury": ["Consumer & Retail"],
  "Food & Beverage": ["Consumer & Retail"],
  "Hospitality": ["Consumer & Retail", "Travel & Leisure"],
  
  // Industrial & Manufacturing
  "Manufacturing": ["Industrial"],
  "Industrials": ["Industrial"],
  "Aerospace & Defense": ["Industrial", "Government & Defense"],
  "Automotive": ["Industrial", "Consumer & Retail"],
  "Chemicals": ["Industrial"],
  "Construction": ["Real Estate & Construction", "Industrial"],
  "Engineering": ["Industrial", "Professional Services"],
  
  // Media & Entertainment
  "Media & Entertainment": ["Media & Entertainment"],
  "Sports": ["Media & Entertainment"],
  "Gaming": ["Media & Entertainment", "Technology"],
  "Content & Publishing": ["Media & Entertainment"],
  
  // Telecommunications
  "Telecommunications": ["Technology", "Telecommunications"],
  "Telecom Infrastructure": ["Technology", "Telecommunications"],
  
  // Transportation & Logistics
  "Transportation": ["Transportation & Logistics"],
  "Logistics": ["Transportation & Logistics"],
  "Aviation": ["Transportation & Logistics"],
  "Shipping": ["Transportation & Logistics"],
  
  // Professional Services
  "Legal": ["Professional Services"],
  "Accounting": ["Professional Services", "Financial Services"],
  "HR Services": ["Professional Services"],
  "Executive Search": ["Professional Services"],
  
  // Government & Public Sector
  "Government": ["Government & Defense"],
  "Public Sector": ["Government & Defense"],
  "Defense": ["Government & Defense", "Industrial"],
  
  // Education
  "Education": ["Education"],
  "EdTech": ["Education", "Technology"],
  
  // Non-Profit & Impact
  "Non-Profit": ["Non-Profit & Social Impact"],
  "Impact Investing": ["Investment & Private Equity", "Non-Profit & Social Impact"],
  "ESG": ["Financial Services", "Sustainability"],
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
