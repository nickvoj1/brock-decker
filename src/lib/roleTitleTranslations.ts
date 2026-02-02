/**
 * Job title translations for native language searches based on location.
 * Includes gender variants where applicable (e.g., German -er/-in endings).
 */

interface LanguageConfig {
  code: string;
  name: string;
  locations: string[]; // location slugs that use this language
}

// Map of languages and their associated locations
export const languageConfigs: LanguageConfig[] = [
  {
    code: "de",
    name: "German",
    locations: ["frankfurt", "berlin", "munich", "hamburg", "dusseldorf", "vienna", "zurich", "basel"],
  },
  {
    code: "fr",
    name: "French",
    locations: ["paris", "lyon", "marseille", "geneva", "brussels", "luxembourg-city", "montreal"],
  },
  {
    code: "es",
    name: "Spanish",
    locations: ["madrid", "barcelona", "mexico-city"],
  },
  {
    code: "it",
    name: "Italian",
    locations: ["milan", "rome"],
  },
  {
    code: "nl",
    name: "Dutch",
    locations: ["amsterdam", "rotterdam", "antwerp"],
  },
  {
    code: "pt",
    name: "Portuguese",
    locations: ["lisbon", "porto", "sao-paulo", "rio"],
  },
  {
    code: "pl",
    name: "Polish",
    locations: ["warsaw", "krakow"],
  },
  {
    code: "sv",
    name: "Swedish",
    locations: ["stockholm", "gothenburg"],
  },
  {
    code: "da",
    name: "Danish",
    locations: ["copenhagen"],
  },
  {
    code: "no",
    name: "Norwegian",
    locations: ["oslo"],
  },
  {
    code: "fi",
    name: "Finnish",
    locations: ["helsinki"],
  },
  {
    code: "ja",
    name: "Japanese",
    locations: ["tokyo", "osaka"],
  },
  {
    code: "zh",
    name: "Chinese",
    locations: ["shanghai", "beijing", "shenzhen", "hong-kong"],
  },
  {
    code: "ko",
    name: "Korean",
    locations: ["seoul"],
  },
  {
    code: "ar",
    name: "Arabic",
    locations: ["dubai", "abu-dhabi", "riyadh"],
  },
  {
    code: "he",
    name: "Hebrew",
    locations: ["tel-aviv"],
  },
];

// Role translations by language code
// For gendered languages, we include both masculine and feminine forms
// Format: { "English Title": ["translation1", "translation2 (gender variant)", ...] }
const roleTranslations: Record<string, Record<string, string[]>> = {
  de: {
    // HR & Recruiting
    "Recruiter": ["Recruiter", "Recruiterin", "Personalvermittler", "Personalvermittlerin"],
    "Talent Acquisition": ["Talent Acquisition", "Talentakquise", "Personalgewinnung"],
    "HR Manager": ["HR Manager", "HR Managerin", "Personalleiter", "Personalleiterin", "Personalmanager", "Personalmanagerin"],
    "Human Resources": ["Human Resources", "Personalwesen", "Personalabteilung"],
    "Hiring Manager": ["Hiring Manager", "Einstellungsleiter", "Einstellungsleiterin"],
    "Head of Talent": ["Head of Talent", "Leiter Talentmanagement", "Leiterin Talentmanagement"],
    "People Operations": ["People Operations", "People & Culture", "Personaloperationen"],
    "HR Director": ["HR Director", "Personaldirektor", "Personaldirektorin", "Leiter Personal", "Leiterin Personal"],
    "Talent Partner": ["Talent Partner", "Talent Partnerin"],
    "HR Business Partner": ["HR Business Partner", "HR Business Partnerin", "Personalreferent", "Personalreferentin"],
    // Senior Leadership
    "CEO": ["CEO", "Geschäftsführer", "Geschäftsführerin", "Vorstandsvorsitzender", "Vorstandsvorsitzende"],
    "Chief Executive": ["Chief Executive", "Geschäftsführer", "Geschäftsführerin"],
    "CTO": ["CTO", "Technischer Leiter", "Technische Leiterin", "Chief Technology Officer"],
    "CFO": ["CFO", "Finanzvorstand", "Finanzvorständin", "Chief Financial Officer"],
    "COO": ["COO", "Betriebsleiter", "Betriebsleiterin", "Chief Operating Officer"],
    "CIO": ["CIO", "IT-Leiter", "IT-Leiterin", "Chief Information Officer"],
    "Managing Director": ["Managing Director", "Geschäftsführer", "Geschäftsführerin", "Geschäftsleiter", "Geschäftsleiterin"],
    "Managing Partner": ["Managing Partner", "Geschäftsführender Partner", "Geschäftsführende Partnerin"],
    "Senior Partner": ["Senior Partner", "Senior Partnerin"],
    "VP": ["VP", "Vice President", "Vizepräsident", "Vizepräsidentin"],
    "SVP": ["SVP", "Senior Vice President", "Senior Vizepräsident", "Senior Vizepräsidentin"],
    "Director": ["Director", "Direktor", "Direktorin", "Leiter", "Leiterin"],
    "Partner": ["Partner", "Partnerin"],
    "Principal": ["Principal", "Prinzipal", "Prinzipalin"],
    "Founder": ["Founder", "Gründer", "Gründerin", "Mitgründer", "Mitgründerin"],
    // Legal
    "General Counsel": ["General Counsel", "Chefjurist", "Chefjuristin", "Syndikus", "Syndika"],
    "Legal Director": ["Legal Director", "Leiter Recht", "Leiterin Recht", "Rechtsdirektor", "Rechtsdirektorin"],
    "Legal Counsel": ["Legal Counsel", "Rechtsberater", "Rechtsberaterin", "Justiziar", "Justiziarin"],
    "Attorney": ["Attorney", "Rechtsanwalt", "Rechtsanwältin", "Anwalt", "Anwältin"],
    "Lawyer": ["Lawyer", "Rechtsanwalt", "Rechtsanwältin", "Jurist", "Juristin"],
    // Finance
    "Finance Director": ["Finance Director", "Finanzdirektor", "Finanzdirektorin", "Leiter Finanzen", "Leiterin Finanzen"],
    "Finance Manager": ["Finance Manager", "Finanzmanager", "Finanzmanagerin"],
    "Investment Manager": ["Investment Manager", "Investmentmanager", "Investmentmanagerin"],
    // Technology
    "Engineering Manager": ["Engineering Manager", "Leiter Entwicklung", "Leiterin Entwicklung", "Entwicklungsleiter", "Entwicklungsleiterin"],
    "Head of Engineering": ["Head of Engineering", "Leiter Technik", "Leiterin Technik"],
    "Tech Lead": ["Tech Lead", "Technischer Leiter", "Technische Leiterin"],
    "IT Director": ["IT Director", "IT-Direktor", "IT-Direktorin", "IT-Leiter", "IT-Leiterin"],
  },
  fr: {
    // HR & Recruiting
    "Recruiter": ["Recruteur", "Recruteuse", "Chargé de recrutement", "Chargée de recrutement"],
    "Talent Acquisition": ["Talent Acquisition", "Acquisition de talents", "Chargé d'acquisition de talents"],
    "HR Manager": ["Responsable RH", "Directeur RH", "Directrice RH", "Manager RH"],
    "Human Resources": ["Ressources Humaines", "RH"],
    "Hiring Manager": ["Responsable du recrutement", "Manager recrutement"],
    "Head of Talent": ["Directeur des talents", "Directrice des talents", "Responsable talents"],
    "People Operations": ["People Operations", "Opérations RH"],
    "HR Director": ["Directeur RH", "Directrice RH", "Directeur des Ressources Humaines"],
    "HR Business Partner": ["HR Business Partner", "Partenaire RH"],
    // Senior Leadership
    "CEO": ["CEO", "PDG", "Président-Directeur Général", "Présidente-Directrice Générale", "Directeur Général", "Directrice Générale"],
    "CTO": ["CTO", "Directeur Technique", "Directrice Technique", "Directeur de la Technologie"],
    "CFO": ["CFO", "Directeur Financier", "Directrice Financière", "DAF"],
    "COO": ["COO", "Directeur des Opérations", "Directrice des Opérations"],
    "Managing Director": ["Directeur Général", "Directrice Générale", "DG"],
    "VP": ["VP", "Vice-Président", "Vice-Présidente"],
    "Director": ["Directeur", "Directrice"],
    "Partner": ["Associé", "Associée", "Partner"],
    "Founder": ["Fondateur", "Fondatrice", "Co-fondateur", "Co-fondatrice"],
    // Legal
    "General Counsel": ["Directeur Juridique", "Directrice Juridique", "Avocat Général"],
    "Legal Director": ["Directeur Juridique", "Directrice Juridique"],
    "Attorney": ["Avocat", "Avocate"],
    "Lawyer": ["Avocat", "Avocate", "Juriste"],
    // Finance
    "Finance Director": ["Directeur Financier", "Directrice Financière"],
    "Finance Manager": ["Responsable Financier", "Responsable Financière"],
    // Technology
    "Engineering Manager": ["Responsable Ingénierie", "Manager Technique"],
    "Head of Engineering": ["Directeur Ingénierie", "Directrice Ingénierie"],
    "IT Director": ["Directeur Informatique", "Directrice Informatique", "DSI"],
  },
  es: {
    // HR & Recruiting
    "Recruiter": ["Reclutador", "Reclutadora", "Técnico de selección"],
    "HR Manager": ["Gerente de RRHH", "Director de RRHH", "Directora de RRHH", "Responsable de Recursos Humanos"],
    "Human Resources": ["Recursos Humanos", "RRHH"],
    "HR Director": ["Director de Recursos Humanos", "Directora de Recursos Humanos"],
    // Senior Leadership
    "CEO": ["CEO", "Director General", "Directora General", "Consejero Delegado", "Consejera Delegada"],
    "CTO": ["CTO", "Director de Tecnología", "Directora de Tecnología", "Director Técnico"],
    "CFO": ["CFO", "Director Financiero", "Directora Financiera"],
    "Managing Director": ["Director General", "Directora General", "Director Gerente"],
    "VP": ["VP", "Vicepresidente", "Vicepresidenta"],
    "Director": ["Director", "Directora"],
    "Partner": ["Socio", "Socia"],
    "Founder": ["Fundador", "Fundadora", "Cofundador", "Cofundadora"],
    // Legal
    "General Counsel": ["Director Jurídico", "Directora Jurídica", "Asesor General"],
    "Attorney": ["Abogado", "Abogada"],
    "Lawyer": ["Abogado", "Abogada", "Letrado", "Letrada"],
    // Finance
    "Finance Director": ["Director Financiero", "Directora Financiera"],
    // Technology
    "Engineering Manager": ["Gerente de Ingeniería", "Director de Ingeniería"],
    "IT Director": ["Director de IT", "Directora de IT", "Director de Informática"],
  },
  it: {
    // HR & Recruiting
    "Recruiter": ["Recruiter", "Selezionatore", "Selezionatrice", "Responsabile selezione"],
    "HR Manager": ["HR Manager", "Responsabile Risorse Umane", "Direttore HR"],
    "Human Resources": ["Risorse Umane", "HR"],
    "HR Director": ["Direttore Risorse Umane", "Direttrice Risorse Umane", "HR Director"],
    // Senior Leadership
    "CEO": ["CEO", "Amministratore Delegato", "AD"],
    "CTO": ["CTO", "Direttore Tecnico", "Direttrice Tecnica"],
    "CFO": ["CFO", "Direttore Finanziario", "Direttrice Finanziaria"],
    "Managing Director": ["Direttore Generale", "Direttrice Generale", "Amministratore Delegato"],
    "Director": ["Direttore", "Direttrice"],
    "Partner": ["Partner", "Socio", "Socia"],
    "Founder": ["Fondatore", "Fondatrice", "Co-fondatore", "Co-fondatrice"],
    // Legal
    "General Counsel": ["Direttore Legale", "Direttrice Legale"],
    "Attorney": ["Avvocato", "Avvocatessa"],
    "Lawyer": ["Avvocato", "Avvocatessa", "Legale"],
  },
  nl: {
    // HR & Recruiting
    "Recruiter": ["Recruiter", "Werving"],
    "HR Manager": ["HR Manager", "Personeelsmanager", "Manager Human Resources"],
    "Human Resources": ["Human Resources", "HR", "Personeel"],
    "HR Director": ["HR Directeur", "Directeur HR", "Directeur Personeel"],
    // Senior Leadership
    "CEO": ["CEO", "Directeur", "Algemeen Directeur", "Bestuurder"],
    "CTO": ["CTO", "Technisch Directeur", "Chief Technology Officer"],
    "CFO": ["CFO", "Financieel Directeur", "Chief Financial Officer"],
    "Managing Director": ["Algemeen Directeur", "Managing Director", "Directeur"],
    "Director": ["Directeur", "Director"],
    "Partner": ["Partner", "Vennoot"],
    "Founder": ["Oprichter", "Medeoprichter", "Founder"],
    // Legal
    "General Counsel": ["General Counsel", "Hoofd Juridische Zaken"],
    "Attorney": ["Advocaat"],
    "Lawyer": ["Advocaat", "Jurist"],
  },
  pt: {
    // HR & Recruiting
    "Recruiter": ["Recrutador", "Recrutadora", "Técnico de Recrutamento"],
    "HR Manager": ["Gerente de RH", "Gestor de Recursos Humanos", "Gestora de Recursos Humanos"],
    "Human Resources": ["Recursos Humanos", "RH"],
    "HR Director": ["Diretor de RH", "Diretora de RH", "Diretor de Recursos Humanos"],
    // Senior Leadership
    "CEO": ["CEO", "Diretor Executivo", "Diretora Executiva", "Diretor Geral"],
    "CTO": ["CTO", "Diretor de Tecnologia", "Diretora de Tecnologia"],
    "CFO": ["CFO", "Diretor Financeiro", "Diretora Financeira"],
    "Managing Director": ["Diretor Geral", "Diretora Geral", "Diretor Executivo"],
    "Director": ["Diretor", "Diretora"],
    "Partner": ["Sócio", "Sócia", "Partner"],
    "Founder": ["Fundador", "Fundadora", "Cofundador", "Cofundadora"],
    // Legal
    "Attorney": ["Advogado", "Advogada"],
    "Lawyer": ["Advogado", "Advogada", "Jurista"],
  },
  pl: {
    // HR & Recruiting  
    "Recruiter": ["Rekruter", "Rekruterka", "Specjalista ds. rekrutacji"],
    "HR Manager": ["Kierownik HR", "Manager HR", "Kierownik ds. personalnych"],
    "Human Resources": ["Zasoby Ludzkie", "HR", "Kadry"],
    "HR Director": ["Dyrektor HR", "Dyrektor ds. Personalnych"],
    // Senior Leadership
    "CEO": ["CEO", "Prezes", "Dyrektor Generalny", "Dyrektor Zarządzający"],
    "CTO": ["CTO", "Dyrektor Techniczny", "Dyrektor ds. Technologii"],
    "CFO": ["CFO", "Dyrektor Finansowy"],
    "Managing Director": ["Dyrektor Zarządzający", "Dyrektor Generalny"],
    "Director": ["Dyrektor"],
    "Partner": ["Partner", "Wspólnik"],
    "Founder": ["Założyciel", "Założycielka", "Współzałożyciel"],
  },
  sv: {
    // HR & Recruiting
    "Recruiter": ["Rekryterare"],
    "HR Manager": ["HR-chef", "Personalchef", "HR Manager"],
    "Human Resources": ["HR", "Personal"],
    "HR Director": ["HR-direktör", "Personaldirektör"],
    // Senior Leadership
    "CEO": ["CEO", "VD", "Verkställande direktör"],
    "CTO": ["CTO", "Teknikchef", "Teknisk direktör"],
    "CFO": ["CFO", "Ekonomichef", "Finansdirektör"],
    "Managing Director": ["VD", "Verkställande direktör"],
    "Director": ["Direktör", "Chef"],
    "Founder": ["Grundare", "Medgrundare"],
  },
  da: {
    // HR & Recruiting
    "Recruiter": ["Rekrutterer", "Rekrutteringsspecialist"],
    "HR Manager": ["HR-chef", "Personalechef"],
    "HR Director": ["HR-direktør", "Personaledirektør"],
    // Senior Leadership
    "CEO": ["CEO", "Administrerende direktør"],
    "CTO": ["CTO", "Teknisk direktør"],
    "Managing Director": ["Administrerende direktør", "Direktør"],
    "Director": ["Direktør"],
    "Founder": ["Grundlægger", "Medstifter"],
  },
  no: {
    // HR & Recruiting
    "Recruiter": ["Rekrutterer", "Rekrutteringsrådgiver"],
    "HR Manager": ["HR-sjef", "Personalsjef"],
    "HR Director": ["HR-direktør", "Personaldirektør"],
    // Senior Leadership
    "CEO": ["CEO", "Administrerende direktør", "Daglig leder"],
    "CTO": ["CTO", "Teknisk direktør"],
    "Managing Director": ["Administrerende direktør", "Daglig leder"],
    "Director": ["Direktør"],
    "Founder": ["Grunnlegger", "Medgründer"],
  },
  fi: {
    // HR & Recruiting
    "Recruiter": ["Rekrytoija", "Rekrytointiasiantuntija"],
    "HR Manager": ["HR-päällikkö", "Henkilöstöpäällikkö"],
    "HR Director": ["HR-johtaja", "Henkilöstöjohtaja"],
    // Senior Leadership
    "CEO": ["CEO", "Toimitusjohtaja"],
    "CTO": ["CTO", "Teknologiajohtaja"],
    "Managing Director": ["Toimitusjohtaja"],
    "Director": ["Johtaja"],
    "Founder": ["Perustaja", "Osaperustaja"],
  },
  ja: {
    // HR & Recruiting
    "Recruiter": ["リクルーター", "採用担当"],
    "HR Manager": ["人事マネージャー", "人事部長", "人事課長"],
    "Human Resources": ["人事", "人事部"],
    "HR Director": ["人事部長", "人事ディレクター"],
    // Senior Leadership
    "CEO": ["CEO", "代表取締役", "社長", "最高経営責任者"],
    "CTO": ["CTO", "最高技術責任者", "技術部長"],
    "CFO": ["CFO", "最高財務責任者", "財務部長"],
    "Managing Director": ["代表取締役", "マネージングディレクター"],
    "Director": ["ディレクター", "部長", "取締役"],
    "Partner": ["パートナー"],
    "Founder": ["創業者", "ファウンダー", "共同創業者"],
  },
  zh: {
    // HR & Recruiting
    "Recruiter": ["招聘专员", "招聘经理", "猎头"],
    "HR Manager": ["人力资源经理", "人事经理", "HR经理"],
    "Human Resources": ["人力资源", "人事", "HR"],
    "HR Director": ["人力资源总监", "人事总监"],
    // Senior Leadership
    "CEO": ["CEO", "首席执行官", "总裁", "总经理"],
    "CTO": ["CTO", "首席技术官", "技术总监"],
    "CFO": ["CFO", "首席财务官", "财务总监"],
    "Managing Director": ["总经理", "董事总经理"],
    "Director": ["总监", "董事"],
    "Partner": ["合伙人"],
    "Founder": ["创始人", "联合创始人"],
  },
  ko: {
    // HR & Recruiting
    "Recruiter": ["채용담당자", "리크루터"],
    "HR Manager": ["인사매니저", "인사부장", "HR 매니저"],
    "Human Resources": ["인사", "인사팀", "HR"],
    "HR Director": ["인사이사", "인사담당임원"],
    // Senior Leadership
    "CEO": ["CEO", "대표이사", "사장"],
    "CTO": ["CTO", "기술이사", "기술담당임원"],
    "CFO": ["CFO", "재무이사"],
    "Managing Director": ["대표이사", "전무이사"],
    "Director": ["이사", "디렉터"],
    "Founder": ["창업자", "공동창업자"],
  },
  ar: {
    // HR & Recruiting (Arabic - no gender in job titles typically)
    "Recruiter": ["مسؤول التوظيف", "موظف توظيف"],
    "HR Manager": ["مدير الموارد البشرية", "مدير شؤون الموظفين"],
    "Human Resources": ["الموارد البشرية", "شؤون الموظفين"],
    "HR Director": ["مدير إدارة الموارد البشرية"],
    // Senior Leadership
    "CEO": ["الرئيس التنفيذي", "المدير العام"],
    "CTO": ["المدير التقني", "مدير التكنولوجيا"],
    "CFO": ["المدير المالي"],
    "Managing Director": ["المدير العام", "المدير الإداري"],
    "Director": ["مدير"],
    "Partner": ["شريك"],
    "Founder": ["مؤسس"],
  },
  he: {
    // HR & Recruiting
    "Recruiter": ["מגייס", "מגייסת"],
    "HR Manager": ["מנהל משאבי אנוש", "מנהלת משאבי אנוש"],
    "Human Resources": ["משאבי אנוש", "HR"],
    "HR Director": ["סמנכ\"ל משאבי אנוש"],
    // Senior Leadership
    "CEO": ["מנכ\"ל"],
    "CTO": ["סמנכ\"ל טכנולוגיות", "CTO"],
    "CFO": ["סמנכ\"ל כספים", "CFO"],
    "Managing Director": ["מנכ\"ל", "מנהל כללי"],
    "Director": ["מנהל", "מנהלת"],
    "Partner": ["שותף", "שותפה"],
    "Founder": ["מייסד", "מייסדת"],
  },
};

/**
 * Get the language code for a given location slug
 */
export function getLanguageForLocation(locationSlug: string): string | null {
  const config = languageConfigs.find(lang => 
    lang.locations.includes(locationSlug.toLowerCase())
  );
  return config?.code || null;
}

/**
 * Get all unique languages for a set of locations
 */
export function getLanguagesForLocations(locationSlugs: string[]): string[] {
  const languages = new Set<string>();
  for (const slug of locationSlugs) {
    const lang = getLanguageForLocation(slug);
    if (lang) {
      languages.add(lang);
    }
  }
  return Array.from(languages);
}

/**
 * Get translated role titles for a given English role and language
 */
export function getTranslatedRoles(englishRole: string, languageCode: string): string[] {
  const langTranslations = roleTranslations[languageCode];
  if (!langTranslations) return [];
  
  return langTranslations[englishRole] || [];
}

/**
 * Expand a list of English role titles to include native language translations
 * based on the selected locations. Returns deduplicated list with English first,
 * then native translations.
 */
export function expandRolesWithTranslations(
  englishRoles: string[], 
  locationSlugs: string[]
): string[] {
  const languages = getLanguagesForLocations(locationSlugs);
  
  // Start with all English roles
  const allRoles = new Set<string>(englishRoles);
  
  // Add translations for each language detected from locations
  for (const lang of languages) {
    for (const englishRole of englishRoles) {
      const translations = getTranslatedRoles(englishRole, lang);
      translations.forEach(t => allRoles.add(t));
    }
  }
  
  return Array.from(allRoles);
}

/**
 * Get a summary of which languages will be searched based on locations
 */
export function getLanguageSummary(locationSlugs: string[]): { code: string; name: string; locations: string[] }[] {
  const summary: { code: string; name: string; locations: string[] }[] = [];
  
  for (const config of languageConfigs) {
    const matchingLocations = config.locations.filter(loc => 
      locationSlugs.includes(loc)
    );
    
    if (matchingLocations.length > 0) {
      summary.push({
        code: config.code,
        name: config.name,
        locations: matchingLocations,
      });
    }
  }
  
  return summary;
}
