import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_PROFILE = "Nikita Vojevoda";
const BUILD_MARKER = "parser-hardened-v2";
let bootLogged = false;
const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_MAX_BATCHES_PER_INVOCATION = 8;
const DEFAULT_TEST_BATCH_SIZE = 5;
const DEFAULT_CONTACT_LIST_LIMIT = 25;
const DEFAULT_CLIENTCONTACT_CORE_FIELDS = [
  "id",
  "name",
  "firstName",
  "lastName",
  "email",
  "occupation",
  "status",
  "phone",
  "mobile",
  "address(city,state,countryID,countryName)",
  "clientCorporation(id,name)",
  "owner(id,name)",
  "dateAdded",
  "dateLastModified",
  "isDeleted",
];
const DEFAULT_CLIENTCONTACT_FALLBACK_FIELDS = [
  ...DEFAULT_CLIENTCONTACT_CORE_FIELDS,
  "dateLastVisit",
  "dateLastComment",
  "address1",
  "address2",
  "city",
  "state",
];
const DEFAULT_CLIENTCONTACT_SKILLS_FALLBACK_FIELDS = [
  ...DEFAULT_CLIENTCONTACT_FALLBACK_FIELDS,
  "skills",
  "skillsCount",
  "skillList",
  "skillIDList",
  "specialty",
  "specialities",
  "expertise",
  "categories(id,name)",
  "specialties(id,name)",
];
const DEFAULT_CONSERVATIVE_CUSTOM_TEXTBLOCK_FIELDS = Array.from({ length: 5 }, (_, idx) => `customTextBlock${idx + 1}`);
const DEFAULT_CONSERVATIVE_CUSTOM_TEXT_FIELDS = Array.from({ length: 20 }, (_, idx) => `customText${idx + 1}`);
const DEFAULT_CONSERVATIVE_CUSTOM_FIELDS = [
  ...DEFAULT_CONSERVATIVE_CUSTOM_TEXTBLOCK_FIELDS,
  ...DEFAULT_CONSERVATIVE_CUSTOM_TEXT_FIELDS,
];
const CUSTOM_SKILL_OVERLAY_FIELDS = [
  ...Array.from({ length: 20 }, (_, idx) => `customTextBlock${idx + 1}`),
  ...Array.from({ length: 40 }, (_, idx) => `customText${idx + 1}`),
  ...Array.from({ length: 20 }, (_, idx) => `customObject${idx + 1}`),
];
const SKILL_OVERLAY_FIELDS = [
  "id",
  "skills",
  "skillsCount",
  "skillList",
  "skillIDList",
  "specialty",
  "specialities",
  "expertise",
  "categories(id,name)",
  "specialties(id,name)",
  "dateLastVisit",
  "dateLastComment",
  "address1",
  "address2",
  "city",
  "state",
  ...CUSTOM_SKILL_OVERLAY_FIELDS,
].join(",");
const SKILL_KEY_REGEX = /(skill|special|categor|expert|industry|sector|keyword|tag)/i;
const CUSTOM_FIELD_REGEX = /^custom(textblock|text|object|int|date)\d+$/i;
const MIRROR_FILTER_FIELDS = new Set([
  "name",
  "company",
  "title",
  "email",
  "city",
  "country",
  "consultant",
  "status",
  "skills",
  "preferred_contact",
  "comm_status",
  "last_contacted",
  "has_resume",
  "mass_mail_opt_out",
]);
const CONTACT_DETAIL_FIELD_SELECTORS = [
  "id,name,firstName,lastName,email,occupation,status,phone,mobile,address(city,state,countryID,countryName),address1,address2,city,state,dateAdded,dateLastModified,dateLastVisit,dateLastComment,skills,skillsCount,skillList,skillIDList,specialty,specialities,expertise,categories(id,name),specialties(id,name),clientCorporation(id,name),owner(id,name),comments,description,notes",
  DEFAULT_CLIENTCONTACT_SKILLS_FALLBACK_FIELDS.join(","),
  DEFAULT_CLIENTCONTACT_FALLBACK_FIELDS.join(","),
  DEFAULT_CLIENTCONTACT_CORE_FIELDS.join(","),
  "*",
];
const COMPANY_DETAIL_FIELD_SELECTORS = [
  "id,name,status,url,phone,industry,address1,address2,city,state,countryID,countryName,dateAdded,dateLastModified,owner(id,name),companyDescription,comments,notes",
  "id,name,status,url,phone,industry,address1,address2,city,state,countryID,countryName,dateAdded,dateLastModified,owner(id,name)",
  "id,name,status,url,phone,industry,city,state,countryID,countryName,dateAdded,dateLastModified",
  "id,name,url,phone",
  "*",
];
const CONTACTS_BY_COMPANY_FIELD_SELECTORS = [
  "id,name,firstName,lastName,email,occupation,status,phone,mobile,dateLastModified,dateLastComment,owner(id,name),clientCorporation(id,name)",
  "id,name,firstName,lastName,email,occupation,status,phone,mobile,dateLastModified,clientCorporation(id,name)",
  "id,name,email,occupation,status,phone,mobile",
];
const NOTE_QUERY_FIELD_SELECTORS = [
  "id,action,comments,dateAdded,personReference(id,name),targetEntityName,targetEntityID",
  "id,comments,dateAdded,targetEntityName,targetEntityID",
  "id,comments,dateAdded",
];
const NOTE_ENTITY_FIELD_SELECTORS = [
  "id,action,comments,comment,notes,description,dateAdded,dateLastModified,personReference(id,name),targetEntityName,targetEntityID",
  "id,action,comments,dateAdded,personReference(id,name),targetEntityName,targetEntityID",
  "id,comments,dateAdded,targetEntityName,targetEntityID",
  "id,dateAdded",
];
const CONTACT_NOTE_OVERLAY_FIELDS = "id,dateLastComment,dateLastVisit,comments,notes,description";
const TASK_QUERY_FIELD_SELECTORS = [
  "id,subject,comments,status,type,dateAdded,dateLastModified,dateBegin,dateEnd,owner(id,name),clientContact(id,name),clientContactReference(id,name)",
  "id,subject,comments,status,type,dateAdded,dateLastModified,clientContact(id),clientContactReference(id)",
  "id,subject,comments,status,type,dateAdded,dateLastModified",
];
const APPOINTMENT_QUERY_FIELD_SELECTORS = [
  "id,subject,comments,status,type,dateAdded,dateLastModified,dateBegin,dateEnd,owner(id,name),clientContact(id,name),clientContactReference(id,name)",
  "id,subject,comments,status,type,dateAdded,dateLastModified,clientContact(id),clientContactReference(id)",
  "id,subject,comments,status,type,dateAdded,dateLastModified",
];
const CLIENT_CORP_APPOINTMENT_SELECTORS = [
  "id,dateAdded,dateLastModified,appointment(id,subject,comments,status,type,dateBegin,dateEnd),clientContact(id,name),owner(id,name)",
  "id,dateAdded,dateLastModified,appointment(id,subject,status,type,dateBegin,dateEnd),clientContact(id)",
  "id,dateAdded,dateLastModified,appointment(id,subject)",
];
const CLIENT_CORP_TASK_SELECTORS = [
  "id,dateAdded,dateLastModified,task(id,subject,comments,status,type,dateBegin,dateEnd),clientContact(id,name),owner(id,name)",
  "id,dateAdded,dateLastModified,task(id,subject,status,type,dateBegin,dateEnd),clientContact(id)",
  "id,dateAdded,dateLastModified,task(id,subject)",
];
const FILE_ATTACHMENT_SELECTORS = [
  "id,fileType,name,type,fileSize,contentType,isDeleted,dateAdded,dateLastModified,isResume",
  "*",
];
const CONTACT_PARITY_ENTITY_META = ["ClientContact", "ClientCorporation", "Note", "Task", "Appointment"];
const CONTACT_TIMELINE_PAGE_SIZE = 200;
const CONTACT_TIMELINE_MAX_PAGES_PER_QUERY = 10;
const DICTIONARY_AUTO_HYDRATE_ENTITY_MAP: Record<string, { where: string; selectors: string[] }> = {
  ClientContact: { where: "id>0", selectors: CONTACT_DETAIL_FIELD_SELECTORS },
  ClientCorporation: { where: "id>0", selectors: COMPANY_DETAIL_FIELD_SELECTORS },
  Note: { where: "id>0", selectors: NOTE_QUERY_FIELD_SELECTORS },
  Task: { where: "id>0", selectors: TASK_QUERY_FIELD_SELECTORS },
  Appointment: { where: "id>0", selectors: APPOINTMENT_QUERY_FIELD_SELECTORS },
};

type SyncStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type MirrorFilterOperator = "contains" | "equals";
type MirrorFilterField =
  | "name"
  | "company"
  | "title"
  | "email"
  | "city"
  | "country"
  | "consultant"
  | "status"
  | "skills"
  | "preferred_contact"
  | "comm_status"
  | "last_contacted"
  | "has_resume"
  | "mass_mail_opt_out";
type MirrorFilterRow = {
  field: MirrorFilterField;
  operator: MirrorFilterOperator;
  values: string[];
};

type BullhornTokens = {
  access_token: string;
  refresh_token: string | null;
  bh_rest_token: string;
  rest_url: string;
  expires_at: string | null;
};

type SyncJob = {
  id: string;
  requested_by: string;
  status: SyncStatus;
  batch_size: number;
  include_deleted: boolean;
  next_start: number;
  total_expected: number | null;
  total_synced: number;
  batches_processed: number;
  last_batch_size: number;
  metadata: Record<string, unknown> | null;
};

type ContactParitySummary = {
  eventCount: number;
  lastContactedAt: string | null;
  lastNoteAt: string | null;
  lastTaskAt: string | null;
  lastCallAt: string | null;
  lastEmailSentAt: string | null;
  lastEmailReceivedAt: string | null;
  documentsCount: number;
  hasResume: boolean;
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeBatchSize(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(2000, Math.floor(n)));
}

function normalizeMaxBatches(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return DEFAULT_MAX_BATCHES_PER_INVOCATION;
  return Math.max(1, Math.min(40, Math.floor(n)));
}

function normalizeMaxContacts(input: unknown): number | null {
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  const normalized = Math.floor(n);
  if (normalized <= 0) return null;
  return Math.min(200000, normalized);
}

function normalizeListLimit(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return DEFAULT_CONTACT_LIST_LIMIT;
  return Math.max(5, Math.min(200, Math.floor(n)));
}

function normalizeListOffset(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function normalizeSearchTerm(input: unknown): string {
  return String(input || "")
    .replace(/[,%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function normalizeDistributionListName(input: unknown): string {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function normalizeFilterOperator(input: unknown): MirrorFilterOperator {
  return String(input || "").toLowerCase() === "equals" ? "equals" : "contains";
}

function normalizeFilterRows(input: unknown): MirrorFilterRow[] {
  if (!Array.isArray(input)) return [];

  const normalized: MirrorFilterRow[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const field = String(record.field || "").toLowerCase() as MirrorFilterField;
    if (!MIRROR_FILTER_FIELDS.has(field)) continue;

    const rawValues = Array.isArray(record.values)
      ? record.values
      : String(record.values || "")
          .split(/[\n,;|]+|\s+\bOR\b\s+/i)
          .map((item) => item.trim())
          .filter(Boolean);

    const values = rawValues
      .map((value) =>
        String(value || "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter((value) => value.length > 0)
      .slice(0, 25);

    if (!values.length) continue;
    normalized.push({
      field,
      operator: normalizeFilterOperator(record.operator),
      values,
    });
  }

  return normalized.slice(0, 20);
}

function parseJsonLikeString(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const looksJson =
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    (trimmed.startsWith('"{') && trimmed.endsWith('}"')) ||
    (trimmed.startsWith('"[') && trimmed.endsWith(']"'));
  if (!looksJson) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") {
      try {
        return JSON.parse(parsed);
      } catch {
        return parsed;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeLooseText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+&.\-/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readRawRecord(contact: any): Record<string, unknown> {
  const raw = contact?.raw;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function findAddressRecord(contact: any): Record<string, unknown> {
  const rawRecord = readRawRecord(contact);
  const rawAddress = rawRecord.address;
  if (rawAddress && typeof rawAddress === "object" && !Array.isArray(rawAddress)) {
    return rawAddress as Record<string, unknown>;
  }
  if (typeof rawAddress === "string") {
    const parsed = parseJsonLikeString(rawAddress);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  return {};
}

function extractSkillTermsFromMirrorContact(contact: any): string[] {
  const rawRecord = readRawRecord(contact);
  const terms: string[] = [];
  const seen = new Set<string>();

  const addTerm = (value: string) => {
    const normalized = normalizeToken(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    terms.push(normalized);
  };

  for (const [key, value] of Object.entries(rawRecord)) {
    const lower = key.toLowerCase();
    if (!SKILL_KEY_REGEX.test(lower) && !CUSTOM_FIELD_REGEX.test(lower)) continue;

    const candidates = valueToSkillTerms(value);
    for (const candidate of candidates) addTerm(candidate);

    if (typeof value === "string") {
      const parsed = parseJsonLikeString(value);
      if (parsed !== null) {
        for (const candidate of valueToSkillTerms(parsed)) addTerm(candidate);
      }
    }
  }

  return terms;
}

function getFieldValuesForMirrorFilter(contact: any, field: MirrorFilterField): string[] {
  const rawRecord = readRawRecord(contact);
  const addressRecord = findAddressRecord(contact);
  const values: string[] = [];

  const addValue = (value: unknown) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string") {
      const normalized = normalizeLooseText(value);
      if (normalized) values.push(normalized);
      return;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      values.push(normalizeLooseText(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) addValue(entry);
      return;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      if ("name" in record) addValue(record.name);
      if ("value" in record) addValue(record.value);
      return;
    }
  };

  switch (field) {
    case "name":
      addValue(contact?.name);
      addValue(rawRecord.name);
      addValue(contact?.first_name);
      addValue(contact?.last_name);
      addValue(`${contact?.first_name || ""} ${contact?.last_name || ""}`.trim());
      break;
    case "company":
      addValue(contact?.client_corporation_name);
      addValue(rawRecord.clientCorporation);
      addValue(rawRecord.clientCorporationName);
      break;
    case "title":
      addValue(contact?.occupation);
      addValue(rawRecord.occupation);
      break;
    case "email":
      addValue(contact?.email);
      addValue(rawRecord.email);
      break;
    case "city":
      addValue(contact?.address_city);
      addValue(addressRecord.city);
      addValue(rawRecord.city);
      break;
    case "country":
      addValue(addressRecord.countryName);
      addValue(addressRecord.country);
      addValue(rawRecord.countryName);
      addValue(rawRecord.country);
      break;
    case "consultant":
      addValue(contact?.owner_name);
      addValue(rawRecord.owner);
      break;
    case "status":
      addValue(contact?.status);
      addValue(rawRecord.status);
      break;
    case "skills":
      return extractSkillTermsFromMirrorContact(contact);
    case "preferred_contact":
      addValue(contact?.preferred_contact);
      addValue(rawRecord.preferredContact);
      break;
    case "comm_status":
      addValue(contact?.comm_status_label);
      addValue(rawRecord.emailStatus);
      addValue(rawRecord.communicationStatus);
      break;
    case "last_contacted":
      addValue(contact?.last_contacted_at);
      addValue(rawRecord.lastContactedAt);
      addValue(rawRecord.dateLastComment);
      addValue(rawRecord.dateLastVisit);
      break;
    case "has_resume":
      addValue(contact?.has_resume);
      break;
    case "mass_mail_opt_out":
      addValue(contact?.mass_mail_opt_out);
      addValue(rawRecord.massMailOptOut);
      break;
  }

  return Array.from(new Set(values.filter(Boolean)));
}

function matchFilterValue(
  fieldValues: string[],
  filterValue: string,
  field: MirrorFilterField,
  operator: MirrorFilterOperator,
): boolean {
  if (!fieldValues.length) return false;
  const target = normalizeToken(filterValue);
  if (!target) return false;

  if (field === "skills") {
    const tokenSet = new Set(fieldValues.map((token) => normalizeToken(token)).filter(Boolean));
    if (!tokenSet.size) return false;

    if (operator === "equals") {
      return tokenSet.has(target);
    }

    if (tokenSet.has(target)) return true;
    for (const token of tokenSet) {
      if (token.includes(target)) return true;
    }

    const parts = target.split(" ").filter(Boolean);
    if (parts.length > 1) {
      return parts.every((part) => Array.from(tokenSet).some((token) => token === part || token.includes(part)));
    }

    if (target.length <= 3) {
      if (tokenSet.has(target)) return true;
      for (const token of tokenSet) {
        if (token.split(" ").includes(target)) return true;
      }
    }

    return false;
  }

  const normalizedValues = fieldValues.map((value) => normalizeToken(value)).filter(Boolean);
  if (!normalizedValues.length) return false;
  if (operator === "equals") {
    return normalizedValues.some((value) => value === target);
  }
  return normalizedValues.some((value) => value.includes(target));
}

function contactMatchesFilterRows(contact: any, rows: MirrorFilterRow[]): boolean {
  if (!rows.length) return true;

  // Bullhorn-like logic: OR within one row, AND between rows.
  for (const row of rows) {
    const fieldValues = getFieldValuesForMirrorFilter(contact, row.field);
    const rowMatched = row.values.some((value) => matchFilterValue(fieldValues, value, row.field, row.operator));
    if (!rowMatched) return false;
  }
  return true;
}

function contactMatchesQuickSearch(contact: any, searchTerm: string): boolean {
  if (!searchTerm) return true;
  const normalized = normalizeLooseText(searchTerm);
  if (!normalized) return true;

  const candidates = [
    contact?.name,
    contact?.email,
    contact?.client_corporation_name,
    contact?.occupation,
    contact?.address_city,
  ]
    .map((value) => normalizeLooseText(value))
    .filter(Boolean);

  return candidates.some((value) => value.includes(normalized));
}

function splitTopLevelFields(selector: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of selector) {
    if (ch === "(") {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      current += ch;
      continue;
    }
    if (ch === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) tokens.push(trimmed);
      current = "";
      continue;
    }
    current += ch;
  }
  const tail = current.trim();
  if (tail) tokens.push(tail);
  return tokens;
}

function parseInvalidFieldNames(errorBody: string): string[] {
  if (!errorBody) return [];

  const out = new Set<string>();
  const patterns = [
    /invalid field(?: name)?["'\s:=-]+([a-zA-Z0-9_]+)/gi,
    /unknown field["'\s:=-]+([a-zA-Z0-9_]+)/gi,
    /no (?:such )?(?:field|property)["'\s:=-]+([a-zA-Z0-9_]+)/gi,
    /field["'\s]+([a-zA-Z0-9_]+)["'\s]+(?:is|was) invalid/gi,
    /cannot resolve field["'\s:=-]+([a-zA-Z0-9_]+)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of errorBody.matchAll(pattern)) {
      const candidate = String(match?.[1] || "").trim();
      if (candidate) out.add(candidate.toLowerCase());
    }
  }

  return Array.from(out);
}

function removeInvalidFields(selector: string, invalidFields: string[]): string {
  if (!invalidFields.length) return selector;
  const invalidSet = new Set(invalidFields.map((f) => f.toLowerCase()));
  const kept = splitTopLevelFields(selector).filter((token) => {
    const base = token.split("(")[0]?.trim().toLowerCase() || "";
    return base && !invalidSet.has(base);
  });
  return kept.join(",");
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

function valueToSkillTerms(value: unknown): string[] {
  if (!hasMeaningfulValue(value)) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => valueToSkillTerms(item));
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.name === "string" && record.name.trim()) return [record.name.trim()];
    if (typeof record.value === "string" && record.value.trim()) return [record.value.trim()];
    return Object.values(record).flatMap((entry) => valueToSkillTerms(entry));
  }

  const raw = String(value).trim();
  if (!raw) return [];
  if (/^\d+(\.\d+)?$/.test(raw)) return [];
  if (raw.length > 450) return [];
  if (raw.includes("@") && !raw.includes(";")) return [];

  const delimiterRegex = /[;|,]/;
  if (!delimiterRegex.test(raw)) {
    if (raw.length <= 80 && raw.split(/\s+/).length <= 6) return [raw];
    return [];
  }

  const tokens = raw
    .split(/[;|,]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && token.length <= 60);
  if (tokens.length > 60) return [];
  return tokens;
}

function deriveCanonicalSkills(contact: any): void {
  if (!contact || typeof contact !== "object") return;
  const hasStringSkills = typeof contact.skills === "string" && contact.skills.trim().length > 0;
  const numericSkillsCount = Number(contact.skillsCount);
  const hasNumericSkillsCount = Number.isFinite(numericSkillsCount) && numericSkillsCount > 0;
  if (hasStringSkills && hasNumericSkillsCount) return;

  const terms: string[] = [];
  const seen = new Set<string>();
  for (const [key, value] of Object.entries(contact)) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (!SKILL_KEY_REGEX.test(lower) && !CUSTOM_FIELD_REGEX.test(lower)) continue;
    for (const rawTerm of valueToSkillTerms(value)) {
      const term = rawTerm.trim();
      if (!term) continue;
      const dedupe = term.toLowerCase();
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      terms.push(term);
    }
  }

  if (!hasStringSkills && terms.length) {
    contact.skills = terms.join(" ; ");
  }
  if (terms.length) {
    contact.skillsCount = hasNumericSkillsCount ? Math.max(Math.floor(numericSkillsCount), terms.length) : terms.length;
  }
}

function hasSkillsPayload(contact: any): boolean {
  if (!contact || typeof contact !== "object") return false;
  const candidateKeys = [
    "skills",
    "skillsCount",
    "skill",
    "skillList",
    "skillIDList",
    "specialty",
    "specialities",
    "expertise",
    "categories",
    "specialties",
  ];
  for (const key of candidateKeys) {
    if (hasMeaningfulValue(contact[key])) return true;
  }
  for (const key of Object.keys(contact)) {
    const lower = key.toLowerCase();
    if (
      (lower.includes("skill") || lower.includes("special") || lower.includes("categor")) &&
      hasMeaningfulValue(contact[key])
    ) {
      return true;
    }
  }
  return false;
}

function mergeOverlayIntoContact(contact: any, overlay: any): any {
  if (!contact || typeof contact !== "object" || !overlay || typeof overlay !== "object") return contact;
  const keysToMerge = [
    "skills",
    "skillsCount",
    "skillList",
    "skillIDList",
    "specialty",
    "specialities",
    "expertise",
    "categories",
    "specialties",
    "dateLastVisit",
    "dateLastComment",
    "address1",
    "address2",
    "city",
    "state",
    ...CUSTOM_SKILL_OVERLAY_FIELDS,
  ];
  for (const key of keysToMerge) {
    if (!hasMeaningfulValue(contact[key]) && hasMeaningfulValue(overlay[key])) {
      contact[key] = overlay[key];
    }
  }

  for (const [key, value] of Object.entries(overlay)) {
    const lower = key.toLowerCase();
    if (!SKILL_KEY_REGEX.test(lower) && !CUSTOM_FIELD_REGEX.test(lower)) continue;
    if (!hasMeaningfulValue(contact[key]) && hasMeaningfulValue(value)) {
      contact[key] = value;
    }
  }

  return contact;
}

function buildCustomFieldNames(prefix: string, max: number): string[] {
  return Array.from({ length: max }, (_, idx) => `${prefix}${idx + 1}`);
}

function addDefaultConservativeCustomFields(addSimple: (field: string) => void): void {
  for (const field of DEFAULT_CONSERVATIVE_CUSTOM_FIELDS) addSimple(field);
}

function extractMetaFieldNames(metaPayload: any): Set<string> {
  const names = new Set<string>();
  const candidates = [
    metaPayload?.fields,
    metaPayload?.data?.fields,
    metaPayload?.entity?.fields,
    metaPayload?.data?.entity?.fields,
  ];

  for (const source of candidates) {
    if (!source) continue;
    if (Array.isArray(source)) {
      for (const field of source) {
        const name = field?.name || field?.dataName || field?.fieldName;
        if (name) names.add(String(name));
      }
      continue;
    }
    if (typeof source === "object") {
      Object.keys(source).forEach((key) => names.add(String(key)));
    }
  }

  return names;
}

function extractMetaFieldEntries(metaPayload: any): Record<string, unknown>[] {
  const candidates = [
    metaPayload?.fields,
    metaPayload?.data?.fields,
    metaPayload?.entity?.fields,
    metaPayload?.data?.entity?.fields,
  ];

  for (const source of candidates) {
    if (!source) continue;
    if (Array.isArray(source)) {
      return source.filter((entry) => entry && typeof entry === "object");
    }
    if (typeof source === "object") {
      return Object.entries(source).map(([fieldName, value]) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          return { fieldName, ...(value as Record<string, unknown>) };
        }
        return { fieldName, rawValue: value };
      });
    }
  }
  return [];
}

function inferDictionaryDataType(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  return null;
}

function toTitleLabel(fieldName: string): string {
  const spaced = fieldName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return fieldName;
  return spaced
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function addDictionaryRow(rowMap: Map<string, Record<string, unknown>>, row: Record<string, unknown>) {
  const entity = normalizeOptionalString(row.entity_name);
  const field = normalizeOptionalString(row.field_name);
  if (!entity || !field) return;
  const key = `${entity}::${field}`.toLowerCase();
  if (rowMap.has(key)) return;
  rowMap.set(key, row);
}

async function inferDictionaryRowsFromSampleData(
  restUrl: string,
  bhRestToken: string,
  jobId: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];

  for (const entityName of CONTACT_PARITY_ENTITY_META) {
    const config = DICTIONARY_AUTO_HYDRATE_ENTITY_MAP[entityName];
    if (!config) continue;

    const sampleRows = await fetchQueryRowsWithFallback(
      restUrl,
      bhRestToken,
      entityName,
      config.where,
      1,
      0,
      config.selectors,
    );
    const sample =
      Array.isArray(sampleRows) && sampleRows[0] && typeof sampleRows[0] === "object"
        ? (sampleRows[0] as Record<string, unknown>)
        : null;
    if (!sample) continue;

    for (const [fieldName, value] of Object.entries(sample)) {
      const normalizedName = normalizeOptionalString(fieldName);
      if (!normalizedName) continue;
      const lower = normalizedName.toLowerCase();
      const isCustom = CUSTOM_FIELD_REGEX.test(lower) || lower.startsWith("custom");
      rows.push({
        entity_name: entityName,
        field_name: normalizedName,
        field_label: toTitleLabel(normalizedName),
        data_type: inferDictionaryDataType(value),
        field_type: null,
        required: null,
        hidden: null,
        is_custom: isCustom,
        options: [],
        raw: {
          source: "sample_inference",
          inferredType: inferDictionaryDataType(value),
        },
        last_synced_job_id: jobId,
        synced_at: new Date().toISOString(),
      });
    }
  }

  return rows;
}

async function fetchEntityMetaPayload(
  restUrl: string,
  bhRestToken: string,
  entityName: string,
): Promise<Record<string, unknown> | null> {
  const metaUrl = `${restUrl}meta/${entityName}?BhRestToken=${encodeURIComponent(bhRestToken)}`;
  try {
    const response = await fetch(metaUrl);
    if (!response.ok) return null;
    const payload = await response.json();
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function getClientContactMetaFields(restUrl: string, bhRestToken: string): Promise<Set<string> | null> {
  const payload = await fetchEntityMetaPayload(restUrl, bhRestToken, "ClientContact");
  if (!payload) return null;
  const fieldNames = extractMetaFieldNames(payload);
  return fieldNames.size ? fieldNames : null;
}

function buildClientContactFieldSelector(supportedFields: Set<string> | null): string {
  const result: string[] = [];
  const hasField = (field: string) => !supportedFields || supportedFields.has(field);
  const add = (field: string) => {
    if (!field) return;
    result.push(field);
  };
  const addSimple = (field: string) => {
    if (hasField(field)) result.push(field);
  };

  [
    "id",
    "name",
    "firstName",
    "lastName",
    "email",
    "email2",
    "email3",
    "occupation",
    "status",
    "phone",
    "phone2",
    "phone3",
    "mobile",
    "linkedIn",
    "linkedInURL",
    "linkedinUrl",
    "preferredContact",
    "massMailOptOut",
    "smsOptIn",
    "doNotCall",
    "doNotContact",
    "emailBounced",
    "emailInvalid",
    "isEmailInvalid",
    "emailStatus",
    "lastEmailSentDate",
    "lastEmailReceivedDate",
    "dateAdded",
    "dateLastModified",
    "isDeleted",
    "lastVisit",
    "dateLastVisit",
    "dateLastComment",
    "comments",
    "notes",
    "description",
  ].forEach(addSimple);

  if (hasField("address")) add("address(city,state,countryID,countryName)");
  else {
    ["city", "state", "countryID", "countryName", "address"].forEach(addSimple);
  }

  if (hasField("clientCorporation")) add("clientCorporation(id,name)");
  else ["clientCorporationName", "clientCorporationID", "clientCorporation"].forEach(addSimple);

  if (hasField("owner")) add("owner(id,name)");
  else ["ownerName", "ownerID", "owner"].forEach(addSimple);

  if (hasField("categories")) add("categories(id,name)");
  if (hasField("specialties")) add("specialties(id,name)");

  ["skills", "skillList", "skillIDList", "skill", "specialty", "specialities", "expertise"].forEach(addSimple);
  // Some Bullhorn instances expose these as computed/export fields even if meta is inconsistent.
  // We always include them and let invalid-field pruning remove unsupported fields safely.
  [
    "skills",
    "skillsCount",
    "dateLastVisit",
    "dateLastComment",
    "comments",
    "notes",
    "description",
    "address1",
    "address2",
    "city",
    "state",
    "preferredContact",
    "massMailOptOut",
    "smsOptIn",
    "doNotCall",
    "doNotContact",
    "emailBounced",
    "emailInvalid",
    "isEmailInvalid",
    "emailStatus",
    "lastEmailSentDate",
    "lastEmailReceivedDate",
    "email2",
    "email3",
    "phone2",
    "phone3",
    "linkedIn",
    "linkedInURL",
    "linkedinUrl",
  ].forEach(add);

  if (supportedFields) {
    buildCustomFieldNames("customTextBlock", 20).forEach(addSimple);
    buildCustomFieldNames("customText", 40).forEach(addSimple);
    buildCustomFieldNames("customObject", 20).forEach(addSimple);
    buildCustomFieldNames("customInt", 20).forEach(addSimple);
    buildCustomFieldNames("customDate", 20).forEach(addSimple);
  } else {
    addDefaultConservativeCustomFields(addSimple);
  }

  return Array.from(new Set(result)).join(",");
}

function buildSkillOverlayFieldSelector(supportedFields: Set<string> | null): string {
  const result: string[] = ["id"];
  const hasField = (field: string) => !supportedFields || supportedFields.has(field);
  const add = (field: string) => {
    if (!field) return;
    result.push(field);
  };
  const addSimple = (field: string) => {
    if (hasField(field)) result.push(field);
  };

  [
    "skills",
    "skillsCount",
    "skill",
    "skillList",
    "skillIDList",
    "specialty",
    "specialities",
    "expertise",
    "dateLastVisit",
    "dateLastComment",
    "address1",
    "address2",
    "city",
    "state",
  ].forEach(addSimple);

  if (hasField("categories")) add("categories(id,name)");
  if (hasField("specialties")) add("specialties(id,name)");

  if (supportedFields) {
    buildCustomFieldNames("customTextBlock", 20).forEach(addSimple);
    buildCustomFieldNames("customText", 40).forEach(addSimple);
    buildCustomFieldNames("customObject", 20).forEach(addSimple);
    buildCustomFieldNames("customInt", 20).forEach(addSimple);
    buildCustomFieldNames("customDate", 20).forEach(addSimple);

    for (const field of supportedFields) {
      const lower = field.toLowerCase();
      if (!SKILL_KEY_REGEX.test(lower) && !CUSTOM_FIELD_REGEX.test(lower)) continue;
      if (lower === "categories" || lower === "specialties") continue;
      addSimple(field);
    }
  } else {
    addDefaultConservativeCustomFields(addSimple);
  }

  return Array.from(new Set(result)).join(",");
}

function buildEntitySkillFieldSelector(supportedFields: Set<string> | null): string {
  const result: string[] = ["id"];
  const add = (field: string) => {
    if (!field) return;
    result.push(field);
  };
  const addSimple = (field: string) => {
    if (!supportedFields || supportedFields.has(field)) result.push(field);
  };

  [
    "skills",
    "skillsCount",
    "skill",
    "skillList",
    "skillIDList",
    "specialty",
    "specialities",
    "expertise",
    "dateLastVisit",
    "dateLastComment",
    "address1",
    "address2",
    "city",
    "state",
  ].forEach(addSimple);

  if (!supportedFields) {
    add("categories(id,name)");
    add("specialties(id,name)");
  } else {
    if (supportedFields.has("categories")) add("categories(id,name)");
    if (supportedFields.has("specialties")) add("specialties(id,name)");
  }

  if (supportedFields) {
    for (const field of supportedFields) {
      const lower = field.toLowerCase();
      if (!SKILL_KEY_REGEX.test(lower) && !CUSTOM_FIELD_REGEX.test(lower)) continue;
      if (lower === "categories" || lower === "specialties") continue;
      addSimple(field);
    }
  } else {
    for (const field of DEFAULT_CONSERVATIVE_CUSTOM_FIELDS) add(field);
  }

  return Array.from(new Set(result)).join(",");
}

function normalizeOptionalString(value: unknown): string | null {
  const out = String(value ?? "").trim();
  return out.length ? out : null;
}

function normalizeLooseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (["true", "1", "yes", "y", "active", "enabled"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "inactive", "disabled"].includes(normalized)) return false;
  }
  return null;
}

function maxIsoDate(...values: Array<unknown>): string | null {
  let maxTs = 0;
  let hasAny = false;
  for (const value of values) {
    const iso = normalizeBullhornDate(value);
    if (!iso) continue;
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) continue;
    hasAny = true;
    if (ts > maxTs) maxTs = ts;
  }
  return hasAny ? new Date(maxTs).toISOString() : null;
}

function extractCustomFieldSummary(contact: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  const keys = Object.keys(contact)
    .filter((key) => CUSTOM_FIELD_REGEX.test(key.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    if (!hasMeaningfulValue(contact[key])) continue;
    summary[key] = contact[key];
  }
  return summary;
}

function extractBooleanByKeyHints(contact: Record<string, unknown>, hints: string[]): boolean | null {
  const loweredHints = hints.map((hint) => hint.toLowerCase());
  const keys = Object.keys(contact);
  for (const key of keys) {
    const lower = key.toLowerCase();
    if (!loweredHints.some((hint) => lower.includes(hint))) continue;
    const normalized = normalizeLooseBoolean(contact[key]);
    if (normalized !== null) return normalized;
  }
  return null;
}

function deriveCommunicationFlags(contact: Record<string, unknown>) {
  const massMailOptOut =
    normalizeLooseBoolean(contact.massMailOptOut) ??
    normalizeLooseBoolean(contact.massmailoptout) ??
    extractBooleanByKeyHints(contact, ["massmailoptout", "emailoptout", "optout"]);
  const smsOptIn =
    normalizeLooseBoolean(contact.smsOptIn) ??
    normalizeLooseBoolean(contact.smsoptin) ??
    extractBooleanByKeyHints(contact, ["smsoptin", "sms_opt"]);
  const doNotContact =
    normalizeLooseBoolean(contact.doNotContact) ??
    normalizeLooseBoolean(contact.doNotCall) ??
    extractBooleanByKeyHints(contact, ["donotcontact", "donotcall", "do_not_contact", "do_not_call"]);
  const emailBounced =
    normalizeLooseBoolean(contact.emailBounced) ??
    normalizeLooseBoolean(contact.emailInvalid) ??
    normalizeLooseBoolean(contact.isEmailInvalid) ??
    extractBooleanByKeyHints(contact, ["emailbounced", "emailinvalid", "bounce", "undeliverable"]);

  return {
    massMailOptOut,
    smsOptIn,
    doNotContact,
    emailBounced,
  };
}

function deriveCommunicationStatusLabel(
  flags: {
    doNotContact: boolean | null;
    massMailOptOut: boolean | null;
    emailBounced: boolean | null;
  },
  fallback: unknown,
): string | null {
  if (flags.doNotContact === true) return "DO_NOT_CONTACT";
  if (flags.massMailOptOut === true) return "OPT_OUT";
  if (flags.emailBounced === true) return "BOUNCED";
  return normalizeOptionalString(fallback) || "ACTIVE";
}

function normalizeBullhornDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    const asNum = Number(trimmed);
    if (!Number.isFinite(asNum)) return null;
    const millis = asNum > 1e11 ? asNum : asNum * 1000;
    const numericDate = new Date(millis);
    return Number.isNaN(numericDate.getTime()) ? null : numericDate.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1e11 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function normalizeEmail(email: unknown): string | null {
  const value = String(email || "")
    .trim()
    .toLowerCase();
  return value && value.includes("@") ? value : null;
}

async function getStoredBullhornTokens(supabase: any): Promise<BullhornTokens | null> {
  const { data, error } = await supabase
    .from("bullhorn_tokens")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    console.log("[bullhorn-sync-clientcontacts] Token expired, attempting refresh");
    return await refreshBullhornTokens(supabase, data.refresh_token);
  }

  return data;
}

async function refreshBullhornTokens(supabase: any, refreshToken: string): Promise<BullhornTokens | null> {
  const { data: settings } = await supabase
    .from("api_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["bullhorn_client_id", "bullhorn_client_secret", "bullhorn_username", "bullhorn_password"]);

  const clientId = settings?.find((s: any) => s.setting_key === "bullhorn_client_id")?.setting_value;
  const clientSecret = settings?.find((s: any) => s.setting_key === "bullhorn_client_secret")?.setting_value;
  const username = settings?.find((s: any) => s.setting_key === "bullhorn_username")?.setting_value;
  const password = settings?.find((s: any) => s.setting_key === "bullhorn_password")?.setting_value;

  if (!clientId || !clientSecret) return null;

  let tokenData: any = null;

  if (refreshToken) {
    const tokenUrl = `https://auth.bullhornstaffing.com/oauth/token?grant_type=refresh_token&refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}`;
    const tokenResponse = await fetch(tokenUrl, { method: "POST" });
    if (tokenResponse.ok) {
      tokenData = await tokenResponse.json();
      if (!tokenData?.access_token) tokenData = null;
    }
  }

  if (!tokenData?.access_token && username && password) {
    const authUrl = `https://auth.bullhornstaffing.com/oauth/authorize?client_id=${clientId}&response_type=code&username=${encodeURIComponent(
      username,
    )}&password=${encodeURIComponent(password)}&action=Login`;
    const authResponse = await fetch(authUrl, { redirect: "manual" });
    const location = authResponse.headers.get("location");
    const codeMatch = location?.match(/code=([^&]+)/);
    if (codeMatch) {
      const code = codeMatch[1];
      const tokenUrl = `https://auth.bullhornstaffing.com/oauth/token?grant_type=authorization_code&code=${code}&client_id=${clientId}&client_secret=${clientSecret}`;
      const tokenResponse = await fetch(tokenUrl, { method: "POST" });
      if (tokenResponse.ok) tokenData = await tokenResponse.json();
    }
  }

  if (!tokenData?.access_token) return null;

  const loginUrl = `https://rest.bullhornstaffing.com/rest-services/login?version=*&access_token=${tokenData.access_token}`;
  const loginResponse = await fetch(loginUrl);
  if (!loginResponse.ok) return null;

  const loginData = await loginResponse.json();
  if (!loginData?.BhRestToken || !loginData?.restUrl) return null;

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 600) * 1000).toISOString();

  await supabase.from("bullhorn_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("bullhorn_tokens").insert({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || refreshToken,
    bh_rest_token: loginData.BhRestToken,
    rest_url: loginData.restUrl,
    expires_at: expiresAt,
  });

  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || refreshToken,
    bh_rest_token: loginData.BhRestToken,
    rest_url: loginData.restUrl,
    expires_at: expiresAt,
  };
}

async function fetchSkillOverlayForIds(
  restUrl: string,
  bhRestToken: string,
  ids: number[],
  preferredFields?: string,
): Promise<Map<number, any>> {
  const overlayById = new Map<number, any>();
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isFinite(id))));
  if (!uniqueIds.length) return overlayById;

  const whereClause = `id IN (${uniqueIds.join(",")})`;
  const buildQueryUrl = (fields: string) =>
    `${restUrl}query/ClientContact?BhRestToken=${encodeURIComponent(
      bhRestToken,
    )}&fields=${encodeURIComponent(fields)}&where=${encodeURIComponent(whereClause)}&count=${uniqueIds.length}&start=0`;

  let activeFields = preferredFields?.trim() || SKILL_OVERLAY_FIELDS;
  const attemptedSelectors = new Set<string>([activeFields]);

  for (let attempt = 0; attempt < 24; attempt++) {
    const response = await fetch(buildQueryUrl(activeFields));
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 600 + attempt * 450));
      continue;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const invalidFields = parseInvalidFieldNames(body);
      if (invalidFields.length) {
        const pruned = removeInvalidFields(activeFields, invalidFields);
        if (pruned && pruned !== activeFields && !attemptedSelectors.has(pruned)) {
          activeFields = pruned;
          attemptedSelectors.add(pruned);
          continue;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 350 + attempt * 300));
      continue;
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    for (const row of rows) {
      const id = Number(row?.id);
      if (!Number.isFinite(id)) continue;
      overlayById.set(id, row);
    }
    break;
  }

  return overlayById;
}

async function fetchWildcardOverlayBatch(
  restUrl: string,
  bhRestToken: string,
  start: number,
  count: number,
  includeDeleted: boolean,
): Promise<Map<number, any>> {
  const overlayById = new Map<number, any>();
  const whereClause = includeDeleted ? "id>0" : "isDeleted=false";
  const queryUrl = `${restUrl}query/ClientContact?BhRestToken=${encodeURIComponent(
    bhRestToken,
  )}&fields=${encodeURIComponent("*")}&where=${encodeURIComponent(whereClause)}&count=${count}&start=${start}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(queryUrl);
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 600 + attempt * 500));
      continue;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn(
        `[bullhorn-sync-clientcontacts] Wildcard overlay query failed (${response.status}): ${body.slice(0, 180)}`,
      );
      return overlayById;
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    for (const row of rows) {
      const id = Number(row?.id);
      if (!Number.isFinite(id)) continue;
      overlayById.set(id, row);
    }
    return overlayById;
  }

  return overlayById;
}

async function fetchEntityOverlayById(
  restUrl: string,
  bhRestToken: string,
  id: number,
  preferredFields?: string,
): Promise<any | null> {
  const candidates = [preferredFields?.trim() || "", "*"].filter(Boolean);
  const tried = new Set<string>();

  for (const fields of candidates) {
    if (tried.has(fields)) continue;
    tried.add(fields);

    const entityUrl = `${restUrl}entity/ClientContact/${id}?BhRestToken=${encodeURIComponent(
      bhRestToken,
    )}&fields=${encodeURIComponent(fields)}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(entityUrl);
      if (response.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 650 + attempt * 450));
        continue;
      }
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const invalidFields = parseInvalidFieldNames(body);
        if (invalidFields.length && fields !== "*") {
          break;
        }
        console.warn(
          `[bullhorn-sync-clientcontacts] Entity overlay failed for ${id} (${response.status}): ${body.slice(0, 180)}`,
        );
        return null;
      }

      const payload = await response.json();
      const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
      if (!data || typeof data !== "object") return null;
      return data;
    }
  }

  return null;
}

async function fetchQueryRowsWithFallback(
  restUrl: string,
  bhRestToken: string,
  entityName: string,
  whereClause: string,
  count: number,
  start: number,
  fieldSelectors: string[],
): Promise<any[]> {
  const selectors = fieldSelectors.map((value) => String(value || "").trim()).filter(Boolean);
  if (!selectors.length) return [];

  for (const selector of selectors) {
    let activeFields = selector;
    const attempted = new Set<string>([activeFields]);

    for (let attempt = 0; attempt < 12; attempt++) {
      const queryUrl = `${restUrl}query/${entityName}?BhRestToken=${encodeURIComponent(
        bhRestToken,
      )}&fields=${encodeURIComponent(activeFields)}&where=${encodeURIComponent(whereClause)}&count=${count}&start=${start}`;

      const response = await fetch(queryUrl);
      if (response.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 550 + attempt * 350));
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const invalidFields = parseInvalidFieldNames(body);
        if (invalidFields.length) {
          const pruned = removeInvalidFields(activeFields, invalidFields);
          if (pruned && pruned !== activeFields && !attempted.has(pruned)) {
            activeFields = pruned;
            attempted.add(pruned);
            continue;
          }
        }
        break;
      }

      const payload = await response.json().catch(() => ({}));
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      return rows;
    }
  }

  return [];
}

async function fetchEntityByIdWithFallback(
  restUrl: string,
  bhRestToken: string,
  entityName: string,
  entityId: number,
  fieldSelectors: string[],
): Promise<Record<string, unknown> | null> {
  const selectors = fieldSelectors.map((value) => String(value || "").trim()).filter(Boolean);
  if (!selectors.length) return null;

  for (const selector of selectors) {
    let activeFields = selector;
    const attempted = new Set<string>([activeFields]);

    for (let attempt = 0; attempt < 10; attempt++) {
      const entityUrl = `${restUrl}entity/${entityName}/${entityId}?BhRestToken=${encodeURIComponent(
        bhRestToken,
      )}&fields=${encodeURIComponent(activeFields)}`;
      const response = await fetch(entityUrl);

      if (response.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 550 + attempt * 350));
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const invalidFields = parseInvalidFieldNames(body);
        if (invalidFields.length) {
          const pruned = removeInvalidFields(activeFields, invalidFields);
          if (pruned && pruned !== activeFields && !attempted.has(pruned)) {
            activeFields = pruned;
            attempted.add(pruned);
            continue;
          }
        }
        break;
      }

      const payload = await response.json().catch(() => ({}));
      const resolved = payload?.data && typeof payload.data === "object" ? payload.data : payload;
      if (resolved && typeof resolved === "object" && !Array.isArray(resolved)) {
        return resolved as Record<string, unknown>;
      }
      return null;
    }
  }

  return null;
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeLiveNoteRow(input: any): Record<string, unknown> {
  const base = input && typeof input === "object" ? input : {};
  const personReference =
    base.personReference && typeof base.personReference === "object" ? base.personReference : null;
  const targetEntity =
    base.targetEntity && typeof base.targetEntity === "object" ? (base.targetEntity as Record<string, unknown>) : null;
  const normalizedAction = base.action ? String(base.action).trim() : "";
  const normalizedComments =
    base.comments !== undefined && base.comments !== null
      ? String(base.comments).trim()
      : base.comment !== undefined && base.comment !== null
        ? String(base.comment).trim()
        : base.notes !== undefined && base.notes !== null
          ? String(base.notes).trim()
          : base.note !== undefined && base.note !== null
            ? String(base.note).trim()
            : base.description !== undefined && base.description !== null
              ? String(base.description).trim()
              : "";
  return {
    id: toFiniteNumber(base.id),
    action: normalizedAction || null,
    comments: normalizedComments || null,
    dateAdded: normalizeBullhornDate(base.dateAdded ?? base.dateLastModified ?? base.modDate),
    personName: personReference?.name ? String(personReference.name) : null,
    targetEntityName: base.targetEntityName
      ? String(base.targetEntityName)
      : targetEntity?.entityName
        ? String(targetEntity.entityName)
        : targetEntity?.name
          ? String(targetEntity.name)
          : null,
    targetEntityId: toFiniteNumber(
      base.targetEntityID ??
        base.targetEntityId ??
        targetEntity?.id ??
        targetEntity?.entityID ??
        targetEntity?.entityId,
    ),
  };
}

function dedupeLiveNotes(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.id ?? "none"}|${String(row.dateAdded ?? "")}|${String(row.comments ?? "").slice(0, 180)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  out.sort((a, b) => {
    const left = toFiniteNumber(new Date(String(a.dateAdded || "")).getTime()) || 0;
    const right = toFiniteNumber(new Date(String(b.dateAdded || "")).getTime()) || 0;
    return right - left;
  });
  return out.slice(0, 25);
}

function extractNoteIdsFromEntityRecord(entityRecord: Record<string, unknown> | null): number[] {
  if (!entityRecord || typeof entityRecord !== "object") return [];

  const out: number[] = [];
  const seen = new Set<number>();

  const addId = (value: unknown) => {
    const id = toFiniteNumber(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };

  const addFromUnknown = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const entry of value) addFromUnknown(entry);
      return;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      addId(record.id ?? record.noteId ?? record.noteID);
      if (Array.isArray(record.data)) addFromUnknown(record.data);
      return;
    }
    addId(value);
  };

  addFromUnknown(entityRecord.notes);
  addFromUnknown(entityRecord.note);
  addFromUnknown(entityRecord.comments);

  return out.slice(0, 30);
}

async function fetchBullhornNotesViaAssociation(
  restUrl: string,
  bhRestToken: string,
  entityName: string,
  entityId: number,
): Promise<Record<string, unknown>[]> {
  for (const selector of NOTE_ENTITY_FIELD_SELECTORS) {
    let activeFields = selector;
    const attempted = new Set<string>([activeFields]);

    for (let attempt = 0; attempt < 12; attempt++) {
      const notesUrl = `${restUrl}entity/${entityName}/${entityId}/notes?BhRestToken=${encodeURIComponent(
        bhRestToken,
      )}&fields=${encodeURIComponent(activeFields)}&count=30&start=0&orderBy=${encodeURIComponent("-dateAdded")}`;
      const response = await fetch(notesUrl);

      if (response.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 500 + attempt * 300));
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const invalidFields = parseInvalidFieldNames(body);
        if (invalidFields.length) {
          const pruned = removeInvalidFields(activeFields, invalidFields);
          if (pruned && pruned !== activeFields && !attempted.has(pruned)) {
            activeFields = pruned;
            attempted.add(pruned);
            continue;
          }
        }
        break;
      }

      const payload = await response.json().catch(() => ({}));
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      if (!rows.length) return [];
      // deno-lint-ignore no-explicit-any
      return dedupeLiveNotes(rows.map((row: any) => normalizeLiveNoteRow(row)));
    }
  }

  return [];
}

async function fetchBullhornNotesByIds(
  restUrl: string,
  bhRestToken: string,
  noteIds: number[],
): Promise<Record<string, unknown>[]> {
  const uniqueIds = Array.from(new Set(noteIds.filter((id) => Number.isFinite(id)))).slice(0, 30);
  if (!uniqueIds.length) return [];

  const results: Record<string, unknown>[] = [];
  for (const noteId of uniqueIds) {
    const note = await fetchEntityByIdWithFallback(restUrl, bhRestToken, "Note", noteId, NOTE_ENTITY_FIELD_SELECTORS);
    if (!note) continue;
    results.push(normalizeLiveNoteRow(note));
  }

  return dedupeLiveNotes(results);
}

async function fetchBullhornNotesForEntity(
  restUrl: string,
  bhRestToken: string,
  entityName: string,
  entityId: number,
  entityRecord?: Record<string, unknown> | null,
): Promise<Record<string, unknown>[]> {
  const whereCandidates = [
    `targetEntityName='${entityName}' AND targetEntityID=${entityId}`,
    `targetEntityID=${entityId}`,
  ];

  const results: Record<string, unknown>[] = [];
  for (const whereClause of whereCandidates) {
    const rows = await fetchQueryRowsWithFallback(
      restUrl,
      bhRestToken,
      "Note",
      whereClause,
      30,
      0,
      NOTE_QUERY_FIELD_SELECTORS,
    );
    for (const row of rows) {
      results.push(normalizeLiveNoteRow(row));
    }
    if (results.length) break;
  }

  if (results.length) return dedupeLiveNotes(results);

  const viaAssociation = await fetchBullhornNotesViaAssociation(restUrl, bhRestToken, entityName, entityId);
  if (viaAssociation.length) return viaAssociation;

  const noteIds = extractNoteIdsFromEntityRecord(entityRecord || null);
  if (noteIds.length) {
    const viaIds = await fetchBullhornNotesByIds(restUrl, bhRestToken, noteIds);
    if (viaIds.length) return viaIds;
  }

  return [];
}

function normalizeTimelineEventType(source: string, value: unknown, fallbackSummary: unknown): string {
  const direct = String(value || "")
    .trim()
    .toLowerCase();
  const summary = String(fallbackSummary || "")
    .trim()
    .toLowerCase();
  const combined = `${direct} ${summary}`.trim();
  if (!combined) return source;
  if (combined.includes("email") || combined.includes("mail")) return "email";
  if (combined.includes("call") || combined.includes("phone")) return "call";
  if (combined.includes("meeting") || combined.includes("appointment")) return "meeting";
  if (combined.includes("task") || combined.includes("to-do") || combined.includes("todo")) return "task";
  if (combined.includes("note")) return "note";
  return source;
}

function extractContactIdFromActivityRow(row: Record<string, unknown>): number | null {
  const directCandidates = [
    row.targetEntityID,
    row.targetEntityId,
    row.clientContactID,
    row.clientContactId,
    row.contactID,
    row.contactId,
  ];
  for (const candidate of directCandidates) {
    const value = toFiniteNumber(candidate);
    if (value) return value;
  }

  const objectCandidates = [row.clientContact, row.clientContactReference, row.contact, row.targetEntity];
  for (const candidate of objectCandidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const record = candidate as Record<string, unknown>;
    const value = toFiniteNumber(record.id ?? record.entityID ?? record.entityId);
    if (value) return value;
  }

  return null;
}

function extractActorNameFromActivityRow(row: Record<string, unknown>): string | null {
  const owner =
    row.owner && typeof row.owner === "object" && !Array.isArray(row.owner)
      ? (row.owner as Record<string, unknown>)
      : null;
  const personReference =
    row.personReference && typeof row.personReference === "object" && !Array.isArray(row.personReference)
      ? (row.personReference as Record<string, unknown>)
      : null;

  return normalizeOptionalString(owner?.name ?? personReference?.name ?? row.personName ?? row.author);
}

function normalizeTimelineEventRow(
  source: string,
  contactId: number,
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const eventAt = normalizeBullhornDate(
    row.dateAdded ?? row.dateBegin ?? row.dateEnd ?? row.dateLastModified ?? row.modDate,
  );
  const summary = normalizeOptionalString(row.subject ?? row.action ?? row.status ?? row.type ?? row.targetEntityName);
  const details = normalizeOptionalString(row.comments ?? row.notes ?? row.description ?? row.note);
  const eventType = normalizeTimelineEventType(source, row.type ?? row.action ?? row.status, summary);
  const externalId = normalizeOptionalString(row.id);
  const externalKey = externalId
    ? `${source}:${externalId}:${contactId}`
    : `${source}:${contactId}:${eventAt || "na"}:${(summary || "").slice(0, 80)}`;

  return {
    bullhorn_contact_id: contactId,
    event_source: source,
    event_type: eventType,
    event_at: eventAt,
    summary,
    details,
    actor_name: extractActorNameFromActivityRow(row),
    entity_name: normalizeOptionalString(row.targetEntityName),
    entity_id: toFiniteNumber(row.targetEntityID ?? row.targetEntityId),
    external_key: externalKey,
    payload: row,
  };
}

async function fetchQueryRowsPaged(
  restUrl: string,
  bhRestToken: string,
  entityName: string,
  whereClause: string,
  fieldSelectors: string[],
  maxPages = CONTACT_TIMELINE_MAX_PAGES_PER_QUERY,
): Promise<any[]> {
  const rows: any[] = [];
  for (let page = 0; page < maxPages; page++) {
    const start = page * CONTACT_TIMELINE_PAGE_SIZE;
    const batch = await fetchQueryRowsWithFallback(
      restUrl,
      bhRestToken,
      entityName,
      whereClause,
      CONTACT_TIMELINE_PAGE_SIZE,
      start,
      fieldSelectors,
    );
    if (!batch.length) break;
    rows.push(...batch);
    if (batch.length < CONTACT_TIMELINE_PAGE_SIZE) break;
  }
  return rows;
}

async function fetchTimelineRowsByWhereCandidates(
  restUrl: string,
  bhRestToken: string,
  entityName: string,
  whereCandidates: string[],
  fieldSelectors: string[],
): Promise<Record<string, unknown>[]> {
  for (const whereClause of whereCandidates) {
    const rows = await fetchQueryRowsPaged(restUrl, bhRestToken, entityName, whereClause, fieldSelectors);
    const normalized = rows
      .filter((row) => row && typeof row === "object")
      .map((row) => row as Record<string, unknown>);
    if (normalized.length) return normalized;
  }
  return [];
}

async function fetchContactTimelineEvents(
  restUrl: string,
  bhRestToken: string,
  contactIds: number[],
): Promise<Record<string, unknown>[]> {
  const events: Record<string, unknown>[] = [];
  const uniqueIds = Array.from(new Set(contactIds.filter((id) => Number.isFinite(id))));
  if (!uniqueIds.length) return events;

  const chunkSize = 30;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const inList = chunk.join(",");

    const noteRows = await fetchTimelineRowsByWhereCandidates(
      restUrl,
      bhRestToken,
      "Note",
      [`targetEntityName='ClientContact' AND targetEntityID IN (${inList})`, `targetEntityID IN (${inList})`],
      NOTE_QUERY_FIELD_SELECTORS,
    );
    for (const row of noteRows) {
      const contactId = extractContactIdFromActivityRow(row);
      if (!contactId) continue;
      const normalized = normalizeTimelineEventRow("note", contactId, row);
      if (normalized) events.push(normalized);
    }

    const taskRows = await fetchTimelineRowsByWhereCandidates(
      restUrl,
      bhRestToken,
      "Task",
      [`clientContact.id IN (${inList})`, `clientContactReference.id IN (${inList})`, `clientContactID IN (${inList})`],
      TASK_QUERY_FIELD_SELECTORS,
    );
    for (const row of taskRows) {
      const contactId = extractContactIdFromActivityRow(row);
      if (!contactId) continue;
      const normalized = normalizeTimelineEventRow("task", contactId, row);
      if (normalized) events.push(normalized);
    }

    const appointmentRows = await fetchTimelineRowsByWhereCandidates(
      restUrl,
      bhRestToken,
      "Appointment",
      [`clientContact.id IN (${inList})`, `clientContactReference.id IN (${inList})`, `clientContactID IN (${inList})`],
      APPOINTMENT_QUERY_FIELD_SELECTORS,
    );
    for (const row of appointmentRows) {
      const contactId = extractContactIdFromActivityRow(row);
      if (!contactId) continue;
      const normalized = normalizeTimelineEventRow("appointment", contactId, row);
      if (normalized) events.push(normalized);
    }

    const corpAppointmentRows = await fetchTimelineRowsByWhereCandidates(
      restUrl,
      bhRestToken,
      "ClientCorporationAppointment",
      [`clientContact.id IN (${inList})`, `clientContactID IN (${inList})`],
      CLIENT_CORP_APPOINTMENT_SELECTORS,
    );
    for (const row of corpAppointmentRows) {
      const contactId = extractContactIdFromActivityRow(row);
      if (!contactId) continue;
      const appointment =
        row.appointment && typeof row.appointment === "object" && !Array.isArray(row.appointment)
          ? (row.appointment as Record<string, unknown>)
          : row;
      const normalized = normalizeTimelineEventRow("appointment", contactId, appointment);
      if (normalized) events.push(normalized);
    }

    const corpTaskRows = await fetchTimelineRowsByWhereCandidates(
      restUrl,
      bhRestToken,
      "ClientCorporationTask",
      [`clientContact.id IN (${inList})`, `clientContactID IN (${inList})`],
      CLIENT_CORP_TASK_SELECTORS,
    );
    for (const row of corpTaskRows) {
      const contactId = extractContactIdFromActivityRow(row);
      if (!contactId) continue;
      const task =
        row.task && typeof row.task === "object" && !Array.isArray(row.task)
          ? (row.task as Record<string, unknown>)
          : row;
      const normalized = normalizeTimelineEventRow("task", contactId, task);
      if (normalized) events.push(normalized);
    }
  }

  const deduped = new Map<string, Record<string, unknown>>();
  for (const event of events) {
    const key = String(event.external_key || "");
    if (!key) continue;
    deduped.set(key, event);
  }
  return Array.from(deduped.values());
}

async function fetchContactFileAttachments(
  restUrl: string,
  bhRestToken: string,
  contactId: number,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const selectors = FILE_ATTACHMENT_SELECTORS.map(
    (selector) =>
      `${restUrl}entity/ClientContact/${contactId}/fileAttachments?BhRestToken=${encodeURIComponent(
        bhRestToken,
      )}&fields=${encodeURIComponent(selector)}`,
  );

  for (const url of selectors) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const payload = await response.json().catch(() => ({}));
      const rows = Array.isArray((payload as any)?.data)
        ? (payload as any).data
        : Array.isArray(payload)
          ? payload
          : [];
      for (const row of rows) {
        if (row && typeof row === "object") out.push(row as Record<string, unknown>);
      }
      if (out.length) return out;
    } catch {
      continue;
    }
  }

  return out;
}

function normalizeDocumentRow(contactId: number, row: Record<string, unknown>): Record<string, unknown> {
  const fileId = toFiniteNumber(row.id ?? row.fileID ?? row.fileId);
  const name = normalizeOptionalString(row.name ?? row.fileName ?? row.file_name);
  const contentType = normalizeOptionalString(row.contentType ?? row.mimeType);
  const fileType = normalizeOptionalString(row.fileType ?? row.type);
  const size = toFiniteNumber(row.fileSize ?? row.size);
  const isResume = normalizeLooseBoolean(row.isResume ?? row.resume ?? row.primaryResume) === true;
  const isDeleted = normalizeLooseBoolean(row.isDeleted) === true;
  const externalKey = fileId
    ? `file:${contactId}:${fileId}`
    : `file:${contactId}:${name || "unnamed"}:${normalizeBullhornDate(row.dateAdded) || "na"}`;

  return {
    bullhorn_contact_id: contactId,
    bullhorn_file_id: fileId,
    file_name: name,
    file_type: fileType,
    content_type: contentType,
    file_size: size,
    is_resume: isResume,
    is_deleted: isDeleted,
    date_added: normalizeBullhornDate(row.dateAdded),
    date_last_modified: normalizeBullhornDate(row.dateLastModified ?? row.dateAdded),
    external_key: externalKey,
    payload: row,
  };
}

function buildDefaultContactParitySummary(): ContactParitySummary {
  return {
    eventCount: 0,
    lastContactedAt: null,
    lastNoteAt: null,
    lastTaskAt: null,
    lastCallAt: null,
    lastEmailSentAt: null,
    lastEmailReceivedAt: null,
    documentsCount: 0,
    hasResume: false,
  };
}

function applyTimelineEventToParity(
  parity: ContactParitySummary,
  eventType: string,
  eventSource: string,
  eventAt: string | null,
) {
  if (!eventAt) return;
  parity.lastContactedAt = maxIsoDate(parity.lastContactedAt, eventAt);
  if (eventSource === "note") {
    parity.lastNoteAt = maxIsoDate(parity.lastNoteAt, eventAt);
  }
  if (eventSource === "task") {
    parity.lastTaskAt = maxIsoDate(parity.lastTaskAt, eventAt);
  }
  if (eventType === "call") {
    parity.lastCallAt = maxIsoDate(parity.lastCallAt, eventAt);
  }
  if (eventType === "email") {
    parity.lastEmailSentAt = maxIsoDate(parity.lastEmailSentAt, eventAt);
  }
}

function mergeContactFieldDatesIntoParity(parity: ContactParitySummary, contact: Record<string, unknown>) {
  const fallbackLastContacted = maxIsoDate(
    contact.dateLastComment,
    contact.dateLastVisit,
    contact.lastVisit,
    contact.dateLastModified,
  );
  parity.lastContactedAt = maxIsoDate(parity.lastContactedAt, fallbackLastContacted);
  parity.lastEmailReceivedAt = maxIsoDate(parity.lastEmailReceivedAt, contact.lastEmailReceivedDate);
  parity.lastEmailSentAt = maxIsoDate(parity.lastEmailSentAt, contact.lastEmailSentDate);
}

function buildCommsStatusRow(
  contact: Record<string, unknown>,
  contactId: number,
  jobId: string,
  parity: ContactParitySummary,
): Record<string, unknown> {
  const flags = deriveCommunicationFlags(contact);
  const statusLabel = deriveCommunicationStatusLabel(flags, contact.emailStatus ?? contact.communicationStatus);
  const emailPrimary = normalizeEmail(contact.email) ?? normalizeOptionalString(contact.email);
  const emailSecondary =
    normalizeEmail(contact.email2) ?? normalizeEmail(contact.email3) ?? normalizeOptionalString(contact.email2);

  return {
    bullhorn_contact_id: contactId,
    email_primary: emailPrimary,
    email_secondary: emailSecondary,
    preferred_contact: normalizeOptionalString(contact.preferredContact),
    mass_mail_opt_out: flags.massMailOptOut,
    sms_opt_in: flags.smsOptIn,
    do_not_contact: flags.doNotContact,
    email_bounced: flags.emailBounced,
    status_label: statusLabel,
    last_email_received_at: maxIsoDate(parity.lastEmailReceivedAt, contact.lastEmailReceivedDate),
    last_email_sent_at: maxIsoDate(parity.lastEmailSentAt, contact.lastEmailSentDate),
    last_call_at: parity.lastCallAt,
    last_task_at: parity.lastTaskAt,
    last_note_at: parity.lastNoteAt,
    last_contacted_at: parity.lastContactedAt,
    raw: {
      emailStatus: contact.emailStatus ?? null,
      communicationStatus: contact.communicationStatus ?? null,
      preferredContact: contact.preferredContact ?? null,
    },
    last_synced_job_id: jobId,
  };
}

async function fetchDocumentsForContactIds(
  restUrl: string,
  bhRestToken: string,
  contactIds: number[],
): Promise<{ rows: Record<string, unknown>[]; summaryByContact: Map<number, { count: number; hasResume: boolean }> }> {
  const rows: Record<string, unknown>[] = [];
  const summaryByContact = new Map<number, { count: number; hasResume: boolean }>();
  const uniqueIds = Array.from(new Set(contactIds.filter((id) => Number.isFinite(id))));
  if (!uniqueIds.length) return { rows, summaryByContact };

  const queue = [...uniqueIds];
  const workerCount = Math.min(6, queue.length);
  const workers: Promise<void>[] = [];

  const worker = async () => {
    while (queue.length) {
      const contactId = queue.shift();
      if (!contactId) continue;
      const docs = await fetchContactFileAttachments(restUrl, bhRestToken, contactId);
      let count = 0;
      let hasResume = false;
      for (const doc of docs) {
        const normalized = normalizeDocumentRow(contactId, doc);
        rows.push(normalized);
        if (normalized.is_deleted !== true) {
          count += 1;
          if (normalized.is_resume === true) hasResume = true;
        }
      }
      summaryByContact.set(contactId, { count, hasResume });
    }
  };

  for (let i = 0; i < workerCount; i++) workers.push(worker());
  await Promise.all(workers);
  return { rows, summaryByContact };
}

async function syncCustomFieldDictionary(supabase: any, restUrl: string, bhRestToken: string, jobId: string) {
  const dictionaryRowMap = new Map<string, Record<string, unknown>>();
  for (const entityName of CONTACT_PARITY_ENTITY_META) {
    const payload = await fetchEntityMetaPayload(restUrl, bhRestToken, entityName);
    if (!payload) continue;
    const fields = extractMetaFieldEntries(payload);
    for (const field of fields) {
      const name = normalizeOptionalString(
        field.name ?? field.dataName ?? field.fieldName ?? field.field_name ?? field.fieldName ?? field.fieldname,
      );
      if (!name) continue;
      const label = normalizeOptionalString(field.label ?? field.displayLabel ?? field.displayName ?? field.caption);
      const dataType = normalizeOptionalString(field.dataType ?? field.typeName ?? field.valueType);
      const fieldType = normalizeOptionalString(field.type ?? field.fieldType ?? field.controlType);
      const required = normalizeLooseBoolean(field.required);
      const hidden = normalizeLooseBoolean(field.hidden ?? field.private);
      const options = Array.isArray(field.options) ? field.options : Array.isArray(field.values) ? field.values : [];
      const lower = name.toLowerCase();
      const isCustom = CUSTOM_FIELD_REGEX.test(lower) || lower.startsWith("custom");
      addDictionaryRow(dictionaryRowMap, {
        entity_name: entityName,
        field_name: name,
        field_label: label,
        data_type: dataType,
        field_type: fieldType,
        required,
        hidden,
        is_custom: isCustom,
        options,
        raw: field,
        last_synced_job_id: jobId,
        synced_at: new Date().toISOString(),
      });
    }
  }

  const inferredRows = await inferDictionaryRowsFromSampleData(restUrl, bhRestToken, jobId);
  for (const row of inferredRows) addDictionaryRow(dictionaryRowMap, row);

  const dictionaryRows = Array.from(dictionaryRowMap.values());
  if (!dictionaryRows.length) return;
  const { error } = await supabase
    .from("bullhorn_custom_field_dictionary")
    .upsert(dictionaryRows, { onConflict: "entity_name,field_name" });
  if (error) {
    console.warn("[bullhorn-sync-clientcontacts] Failed to upsert custom field dictionary:", error.message);
  }
}

async function resolveWritableSyncJobId(
  supabase: any,
  requestedBy: string,
  providedJobId?: string | null,
): Promise<string> {
  const normalizedProvided = normalizeOptionalString(providedJobId);
  if (normalizedProvided) {
    const { data: existingProvided, error: providedLookupError } = await supabase
      .from("bullhorn_sync_jobs")
      .select("id")
      .eq("id", normalizedProvided)
      .maybeSingle();
    if (!providedLookupError && existingProvided?.id) return String(existingProvided.id);
  }

  const { data: latestJob, error: latestLookupError } = await supabase
    .from("bullhorn_sync_jobs")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latestLookupError && latestJob?.id) return String(latestJob.id);

  const nowIso = new Date().toISOString();
  const { data: createdJob, error: createError } = await supabase
    .from("bullhorn_sync_jobs")
    .insert({
      requested_by: requestedBy || ADMIN_PROFILE,
      status: "completed",
      batch_size: 1,
      include_deleted: false,
      next_start: 0,
      total_expected: 0,
      total_synced: 0,
      batches_processed: 0,
      last_batch_size: 0,
      started_at: nowIso,
      finished_at: nowIso,
      heartbeat_at: nowIso,
      metadata: {
        source: "parity_job_seed",
      },
    })
    .select("id")
    .single();

  if (createError || !createdJob?.id) {
    throw new Error(createError?.message || "Failed to create sync job for parity writes");
  }

  return String(createdJob.id);
}

async function syncBatchParityData(
  supabase: any,
  restUrl: string,
  bhRestToken: string,
  jobId: string,
  contacts: Record<string, unknown>[],
): Promise<Map<number, ContactParitySummary>> {
  const parityById = new Map<number, ContactParitySummary>();
  const contactIds = contacts
    .map((contact) => toFiniteNumber(contact.id))
    .filter((id): id is number => Number.isFinite(id));
  if (!contactIds.length) return parityById;

  for (const id of contactIds) parityById.set(id, buildDefaultContactParitySummary());

  const timelineRowsRaw = await fetchContactTimelineEvents(restUrl, bhRestToken, contactIds);
  const timelineRows = timelineRowsRaw.map((row) => ({
    ...row,
    last_synced_job_id: jobId,
  }));

  if (timelineRows.length) {
    const { error: timelineError } = await supabase
      .from("bullhorn_contact_timeline_events")
      .upsert(timelineRows, { onConflict: "external_key" });
    if (timelineError) {
      console.warn("[bullhorn-sync-clientcontacts] Failed to upsert timeline rows:", timelineError.message);
    }
  }

  // deno-lint-ignore no-explicit-any
  for (const event of timelineRows as any[]) {
    const contactId = toFiniteNumber(event.bullhorn_contact_id);
    if (!contactId) continue;
    const parity = parityById.get(contactId) || buildDefaultContactParitySummary();
    parity.eventCount += 1;
    applyTimelineEventToParity(
      parity,
      String(event.event_type || ""),
      String(event.event_source || ""),
      normalizeBullhornDate(event.event_at),
    );
    parityById.set(contactId, parity);
  }

  const { rows: documentRowsRaw, summaryByContact: documentsSummary } = await fetchDocumentsForContactIds(
    restUrl,
    bhRestToken,
    contactIds,
  );
  const documentRows = documentRowsRaw.map((row) => ({
    ...row,
    last_synced_job_id: jobId,
  }));
  if (documentRows.length) {
    const { error: docsError } = await supabase
      .from("bullhorn_contact_documents")
      .upsert(documentRows, { onConflict: "external_key" });
    if (docsError) {
      console.warn("[bullhorn-sync-clientcontacts] Failed to upsert document rows:", docsError.message);
    }
  }

  const commStatusRows: Record<string, unknown>[] = [];
  const mirrorParityRows: Record<string, unknown>[] = [];
  for (const contact of contacts) {
    const contactId = toFiniteNumber(contact.id);
    if (!contactId) continue;
    const parity = parityById.get(contactId) || buildDefaultContactParitySummary();
    const docs = documentsSummary.get(contactId) || { count: 0, hasResume: false };
    parity.documentsCount = docs.count;
    parity.hasResume = docs.hasResume;
    mergeContactFieldDatesIntoParity(parity, contact);
    parityById.set(contactId, parity);

    commStatusRows.push(buildCommsStatusRow(contact, contactId, jobId, parity));
    mirrorParityRows.push({
      bullhorn_id: contactId,
      last_contacted_at: parity.lastContactedAt,
      timeline_event_count: parity.eventCount,
      documents_count: parity.documentsCount,
      has_resume: parity.hasResume,
      last_email_received_at: parity.lastEmailReceivedAt,
      last_email_sent_at: parity.lastEmailSentAt,
      last_synced_job_id: jobId,
      synced_at: new Date().toISOString(),
    });
  }

  if (commStatusRows.length) {
    const { error: commsError } = await supabase
      .from("bullhorn_contact_comms_status")
      .upsert(commStatusRows, { onConflict: "bullhorn_contact_id" });
    if (commsError) {
      console.warn("[bullhorn-sync-clientcontacts] Failed to upsert comm status rows:", commsError.message);
    }
  }

  if (mirrorParityRows.length) {
    const { error: mirrorParityError } = await supabase
      .from("bullhorn_client_contacts_mirror")
      .upsert(mirrorParityRows, { onConflict: "bullhorn_id" });
    if (mirrorParityError) {
      console.warn("[bullhorn-sync-clientcontacts] Failed to upsert mirror parity rows:", mirrorParityError.message);
    }
  }

  return parityById;
}

function noteDateMillis(note: Record<string, unknown>): number {
  const dateValue = note.dateAdded;
  const ts = new Date(String(dateValue || "")).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function updateLatestNoteMap(map: Map<number, Record<string, unknown>>, note: Record<string, unknown>) {
  const contactId = toFiniteNumber(note.targetEntityId);
  if (!contactId) return;

  const current = map.get(contactId);
  if (!current) {
    map.set(contactId, note);
    return;
  }
  if (noteDateMillis(note) >= noteDateMillis(current)) {
    map.set(contactId, note);
  }
}

async function fetchLatestNotesForContactIds(
  restUrl: string,
  bhRestToken: string,
  contactIds: number[],
): Promise<Map<number, Record<string, unknown>>> {
  const latestByContact = new Map<number, Record<string, unknown>>();
  const uniqueIds = Array.from(new Set(contactIds.filter((id) => Number.isFinite(id))));
  if (!uniqueIds.length) return latestByContact;

  const chunkSize = 40;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const inWhere = `targetEntityName='ClientContact' AND targetEntityID IN (${chunk.join(",")})`;
    const inRows = await fetchQueryRowsWithFallback(
      restUrl,
      bhRestToken,
      "Note",
      inWhere,
      1200,
      0,
      NOTE_QUERY_FIELD_SELECTORS,
    );

    for (const row of inRows) {
      updateLatestNoteMap(latestByContact, normalizeLiveNoteRow(row));
    }

    const missingIds = chunk.filter((id) => !latestByContact.has(id));
    if (!missingIds.length) continue;

    // Fallback pass for portals where targetEntityName differs or is missing.
    const anyEntityRows = await fetchQueryRowsWithFallback(
      restUrl,
      bhRestToken,
      "Note",
      `targetEntityID IN (${missingIds.join(",")})`,
      1200,
      0,
      NOTE_QUERY_FIELD_SELECTORS,
    );
    for (const row of anyEntityRows) {
      updateLatestNoteMap(latestByContact, normalizeLiveNoteRow(row));
    }

    const stillMissing = chunk.filter((id) => !latestByContact.has(id));
    for (const id of stillMissing) {
      const rows = await fetchQueryRowsWithFallback(
        restUrl,
        bhRestToken,
        "Note",
        `targetEntityName='ClientContact' AND targetEntityID=${id}`,
        120,
        0,
        NOTE_QUERY_FIELD_SELECTORS,
      );
      for (const row of rows) {
        updateLatestNoteMap(latestByContact, normalizeLiveNoteRow(row));
      }

      if (latestByContact.has(id)) continue;
      const fallbackRows = await fetchQueryRowsWithFallback(
        restUrl,
        bhRestToken,
        "Note",
        `targetEntityID=${id}`,
        120,
        0,
        NOTE_QUERY_FIELD_SELECTORS,
      );
      for (const row of fallbackRows) {
        updateLatestNoteMap(latestByContact, normalizeLiveNoteRow(row));
      }
    }
  }

  return latestByContact;
}

function hasPersistedLatestNote(contact: any): boolean {
  const noteText = sanitizeLatestNoteText(contact?.latest_note);
  const noteDate = typeof contact?.latest_note_date === "string" && contact.latest_note_date.trim().length > 0;
  return Boolean(noteText || noteDate);
}

function overlayNoteFieldsIntoContact(contact: any, overlay: Record<string, unknown>) {
  if (!contact || typeof contact !== "object") return;
  if (!overlay || typeof overlay !== "object") return;
  const noteKeys = ["comments", "notes", "description", "dateLastComment", "dateLastVisit"];
  for (const key of noteKeys) {
    if (!hasMeaningfulValue(contact[key]) && hasMeaningfulValue(overlay[key])) {
      contact[key] = overlay[key];
    }
  }
}

function deriveLatestNoteFromContactFields(contact: any): {
  text: string | null;
  date: string | null;
} {
  const textCandidates = [
    contact?.latest_note,
    contact?.lastNote,
    contact?.comments,
    contact?.notes,
    contact?.description,
  ];
  const text = textCandidates.map((value) => sanitizeLatestNoteText(value)).find((value) => Boolean(value)) || null;

  const date = normalizeBullhornDate(
    contact?.latest_note_date ?? contact?.dateLastComment ?? contact?.dateLastVisit ?? contact?.dateLastModified,
  );

  return { text, date };
}

async function enrichFetchedContactsWithLatestNotes(
  restUrl: string,
  bhRestToken: string,
  contacts: any[],
): Promise<any[]> {
  const rows = Array.isArray(contacts) ? contacts : [];
  if (!rows.length) return rows;

  const ids = rows.map((contact) => Number(contact?.id ?? contact?.bullhorn_id)).filter((id) => Number.isFinite(id));
  if (!ids.length) return rows;

  const latestByContact = await fetchLatestNotesForContactIds(restUrl, bhRestToken, ids);
  for (const contact of rows) {
    const id = Number(contact?.id ?? contact?.bullhorn_id);
    if (!Number.isFinite(id)) continue;
    const note = latestByContact.get(id);
    if (!note) continue;
    const comments = sanitizeLatestNoteText(note.comments) || "";
    const action = sanitizeLatestNoteText(note.action) || "";
    if (comments || action) {
      contact.latest_note = comments && action ? `${action}: ${comments}` : comments || action;
    }
    const noteDate = normalizeBullhornDate(note.dateAdded);
    if (noteDate) {
      contact.latest_note_date = noteDate;
    }
    if (action) {
      contact.latest_note_action = action;
    }
  }

  const missingIds = rows
    .filter((contact) => !hasPersistedLatestNote(contact))
    .map((contact) => Number(contact?.id ?? contact?.bullhorn_id))
    .filter((id) => Number.isFinite(id));
  if (!missingIds.length) return rows;

  const overlayById = await fetchSkillOverlayForIds(restUrl, bhRestToken, missingIds, CONTACT_NOTE_OVERLAY_FIELDS);
  for (const contact of rows) {
    const id = Number(contact?.id ?? contact?.bullhorn_id);
    if (!Number.isFinite(id)) continue;
    const overlay = overlayById.get(id);
    if (!overlay || typeof overlay !== "object") continue;

    overlayNoteFieldsIntoContact(contact, overlay as Record<string, unknown>);
    const derived = deriveLatestNoteFromContactFields(contact);
    if (!hasPersistedLatestNote(contact)) {
      if (derived.text) contact.latest_note = derived.text;
      if (derived.date) contact.latest_note_date = derived.date;
    } else if (!contact.latest_note_date && derived.date) {
      contact.latest_note_date = derived.date;
    }
  }

  return rows;
}

function isLikelyIdOnlyNoteRecord(record: Record<string, unknown>): boolean {
  const keys = Object.keys(record).map((key) => key.toLowerCase());
  if (!keys.length) return false;

  if (keys.length === 1 && keys[0] === "id" && toFiniteNumber(record.id) !== null) {
    return true;
  }

  if (Array.isArray(record.data)) {
    const onlyMetaKeys = keys.every((key) => key === "data" || key === "total" || key === "count");
    if (!onlyMetaKeys) return false;
    if (!record.data.length) return true;
    return record.data.every((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return false;
      const item = row as Record<string, unknown>;
      const itemKeys = Object.keys(item).map((key) => key.toLowerCase());
      return itemKeys.length === 1 && itemKeys[0] === "id" && toFiniteNumber(item.id) !== null;
    });
  }

  return false;
}

function sanitizeLatestNoteText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === "-" || trimmed.toLowerCase() === "[object object]") return null;

  // Treat bare numeric IDs as invalid note text.
  if (/^\d{4,14}$/.test(trimmed)) return null;

  // Treat JSON relation placeholders as invalid note text.
  const maybeJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (maybeJson) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if (isLikelyIdOnlyNoteRecord(parsed as Record<string, unknown>)) return null;
      }
    } catch {
      // Keep non-JSON strings as-is.
    }
  }

  return trimmed;
}

async function enrichContactsWithLatestNotes(supabase: any, contacts: any[]): Promise<any[]> {
  const rows = Array.isArray(contacts) ? contacts : [];
  if (!rows.length) return rows;

  const ids = rows.map((contact) => Number(contact?.bullhorn_id ?? contact?.id)).filter((id) => Number.isFinite(id));
  if (!ids.length) return rows;

  const tokens = await getStoredBullhornTokens(supabase);
  if (!tokens) return rows;

  return await enrichFetchedContactsWithLatestNotes(tokens.rest_url, tokens.bh_rest_token, rows);
}

async function fetchClientContactsBatch(
  restUrl: string,
  bhRestToken: string,
  start: number,
  count: number,
  includeDeleted: boolean,
  preferredFields?: string,
  supportedFields?: Set<string> | null,
): Promise<{ rows: any[]; total: number | null }> {
  const coreFallbackFields = DEFAULT_CLIENTCONTACT_CORE_FIELDS.join(",");
  const baselineFallbackFields = DEFAULT_CLIENTCONTACT_FALLBACK_FIELDS.join(",");
  const skillsFallbackFields = DEFAULT_CLIENTCONTACT_SKILLS_FALLBACK_FIELDS.join(",");

  const whereClause = includeDeleted ? "id>0" : "isDeleted=false";
  const buildQueryUrl = (fields: string) =>
    `${restUrl}query/ClientContact?BhRestToken=${encodeURIComponent(
      bhRestToken,
    )}&fields=${encodeURIComponent(fields)}&where=${encodeURIComponent(whereClause)}&count=${count}&start=${start}`;

  // Prefer rich selector; always degrade to core selector to avoid hard-fail syncs.
  let activeFields = preferredFields?.trim() || skillsFallbackFields;
  const attemptedSelectors = new Set<string>([activeFields]);
  const skillOverlaySelector = buildSkillOverlayFieldSelector(supportedFields ?? null);
  const entitySkillSelector = buildEntitySkillFieldSelector(supportedFields ?? null);

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 25; attempt++) {
    const queryUrl = buildQueryUrl(activeFields);
    const response = await fetch(queryUrl);
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 700 + attempt * 500));
      continue;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const normalizedBody = body.toLowerCase();
      const invalidFields = parseInvalidFieldNames(body);
      let switchedSelector = false;

      if (invalidFields.length) {
        const prunedSelector = removeInvalidFields(activeFields, invalidFields);
        if (prunedSelector && prunedSelector !== activeFields && !attemptedSelectors.has(prunedSelector)) {
          console.warn(
            `[bullhorn-sync-clientcontacts] Pruned invalid fields [${invalidFields.join(", ")}], retrying with selector size ${
              splitTopLevelFields(prunedSelector).length
            }`,
          );
          activeFields = prunedSelector;
          attemptedSelectors.add(prunedSelector);
          switchedSelector = true;
        } else if (activeFields !== coreFallbackFields && !attemptedSelectors.has(coreFallbackFields)) {
          console.warn(
            `[bullhorn-sync-clientcontacts] Invalid fields [${invalidFields.join(", ")}]; forcing core selector`,
          );
          activeFields = coreFallbackFields;
          attemptedSelectors.add(coreFallbackFields);
          switchedSelector = true;
        }
      }

      if (switchedSelector) {
        continue;
      }

      if (
        response.status >= 400 &&
        response.status < 500 &&
        (normalizedBody.includes("field") || normalizedBody.includes("invalid") || normalizedBody.includes("unknown"))
      ) {
        const fallbackCandidates = [skillsFallbackFields, baselineFallbackFields, coreFallbackFields];
        for (const candidate of fallbackCandidates) {
          if (candidate === activeFields || attemptedSelectors.has(candidate)) continue;
          const label =
            candidate === coreFallbackFields
              ? "core selector"
              : candidate === baselineFallbackFields
                ? "baseline selector"
                : "skills-aware selector";
          console.warn(`[bullhorn-sync-clientcontacts] Falling back to ${label} after field error`);
          activeFields = candidate;
          attemptedSelectors.add(candidate);
          switchedSelector = true;
          break;
        }
      }

      if (switchedSelector) {
        continue;
      }

      if (activeFields !== coreFallbackFields && response.status >= 400 && response.status < 500) {
        console.warn(
          `[bullhorn-sync-clientcontacts] Non-OK ${response.status}, forcing core selector. body=${body.slice(0, 200)}`,
        );
        activeFields = coreFallbackFields;
        attemptedSelectors.add(coreFallbackFields);
        continue;
      }
      lastError = `Bullhorn query failed (${response.status}): ${body.slice(0, 300)}`;
      await new Promise((resolve) => setTimeout(resolve, 400 + attempt * 400));
      continue;
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const totalRaw = payload?.total;
    const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : null;

    // deno-lint-ignore no-explicit-any
    const rowsWithSkillsBefore = rows.filter((row: any) => hasSkillsPayload(row)).length;
    if (rows.length && rowsWithSkillsBefore < rows.length) {
      const wildcardOverlay = await fetchWildcardOverlayBatch(restUrl, bhRestToken, start, count, includeDeleted);
      if (wildcardOverlay.size) {
        for (const row of rows) {
          const id = Number(row?.id);
          if (!Number.isFinite(id)) continue;
          const overlay = wildcardOverlay.get(id);
          if (!overlay) continue;
          mergeOverlayIntoContact(row, overlay);
        }
      }

      // deno-lint-ignore no-explicit-any
      const missingIds = rows
        .filter((row: any) => !hasSkillsPayload(row))
        .map((row: any) => Number(row?.id))
        .filter((id: any) => Number.isFinite(id));
      if (missingIds.length) {
        const overlayById = await fetchSkillOverlayForIds(restUrl, bhRestToken, missingIds, skillOverlaySelector);
        if (overlayById.size) {
          for (const row of rows) {
            const id = Number(row?.id);
            if (!Number.isFinite(id)) continue;
            const overlay = overlayById.get(id);
            if (!overlay) continue;
            mergeOverlayIntoContact(row, overlay);
          }
        }
      }

      // deno-lint-ignore no-explicit-any
      const stillMissingIds = rows
        .filter((row: any) => !hasSkillsPayload(row))
        .map((row: any) => Number(row?.id))
        .filter((id: any) => Number.isFinite(id))
        .slice(0, 50);
      if (stillMissingIds.length) {
        const rowById = new Map<number, any>();
        for (const row of rows) {
          const id = Number(row?.id);
          if (Number.isFinite(id)) rowById.set(id, row);
        }

        for (const id of stillMissingIds) {
          const entityOverlay = await fetchEntityOverlayById(restUrl, bhRestToken, id, entitySkillSelector);
          if (!entityOverlay) continue;
          const target = rowById.get(id);
          if (!target) continue;
          mergeOverlayIntoContact(target, entityOverlay);
        }
      }
    }

    for (const row of rows) {
      deriveCanonicalSkills(row);
    }

    // deno-lint-ignore no-explicit-any
    const rowsWithSkillsAfter = rows.filter((row: any) => hasSkillsPayload(row)).length;
    const firstRow = rows[0];
    const skillKeys =
      firstRow && typeof firstRow === "object"
        ? Object.keys(firstRow).filter((key) => {
            const lower = key.toLowerCase();
            return lower.includes("skill") || lower.includes("special") || lower.includes("category");
          })
        : [];
    console.log(
      `[bullhorn-sync-clientcontacts] Batch start=${start} count=${rows.length} selectorFields=${
        splitTopLevelFields(activeFields).length
      } skillKeys=${skillKeys.join(",") || "none"} hasSkills=${Boolean(firstRow?.skills)} rowsWithSkills=${
        rowsWithSkillsBefore
      }->${rowsWithSkillsAfter}`,
    );
    return { rows, total };
  }

  throw new Error(lastError || "Bullhorn query failed after retries");
}

function mapMirrorRow(contact: any, jobId: string, parity?: ContactParitySummary) {
  const record = contact && typeof contact === "object" ? (contact as Record<string, unknown>) : {};
  const email = normalizeEmail(record.email);
  const secondaryEmail =
    normalizeEmail(record.email2) ?? normalizeEmail(record.email3) ?? normalizeOptionalString(record.email2);
  const flags = deriveCommunicationFlags(record);
  const commStatusLabel = deriveCommunicationStatusLabel(flags, record.emailStatus ?? record.communicationStatus);
  const lastEmailReceivedAt = maxIsoDate(parity?.lastEmailReceivedAt, record.lastEmailReceivedDate);
  const lastEmailSentAt = maxIsoDate(parity?.lastEmailSentAt, record.lastEmailSentDate);
  const fallbackLastContacted = maxIsoDate(
    record.dateLastComment,
    record.dateLastVisit,
    record.lastVisit,
    record.dateLastModified,
  );
  const lastContactedAt = maxIsoDate(parity?.lastContactedAt, fallbackLastContacted);
  const customFieldSummary = extractCustomFieldSummary(record);

  return {
    bullhorn_id: Number(record.id),
    synced_at: new Date().toISOString(),
    last_synced_job_id: jobId,
    name: record.name || null,
    first_name: record.firstName || null,
    last_name: record.lastName || null,
    email,
    email_normalized: email,
    occupation: record.occupation || null,
    status: record.status || null,
    phone: record.phone || null,
    mobile: record.mobile || null,
    address_city: (record.address as any)?.city || record.city || null,
    address_state: (record.address as any)?.state || record.state || null,
    address_country_id: Number.isFinite(Number((record.address as any)?.countryID))
      ? Number((record.address as any).countryID)
      : null,
    client_corporation_id: Number.isFinite(Number((record.clientCorporation as any)?.id))
      ? Number((record.clientCorporation as any).id)
      : null,
    client_corporation_name: (record.clientCorporation as any)?.name || null,
    owner_id: Number.isFinite(Number((record.owner as any)?.id)) ? Number((record.owner as any).id) : null,
    owner_name: (record.owner as any)?.name || null,
    date_added: normalizeBullhornDate(record.dateAdded),
    date_last_modified: normalizeBullhornDate(record.dateLastModified),
    is_deleted: Boolean(record.isDeleted),
    linkedin_url:
      normalizeOptionalString(record.linkedInURL) ??
      normalizeOptionalString(record.linkedinUrl) ??
      normalizeOptionalString(record.linkedIn),
    work_phone_secondary: normalizeOptionalString(record.phone2) ?? normalizeOptionalString(record.phone3),
    preferred_contact: normalizeOptionalString(record.preferredContact),
    mass_mail_opt_out: flags.massMailOptOut,
    sms_opt_in: flags.smsOptIn,
    do_not_contact: flags.doNotContact,
    email_bounced: flags.emailBounced,
    comm_status_label: commStatusLabel,
    last_email_received_at: lastEmailReceivedAt,
    last_email_sent_at: lastEmailSentAt,
    last_contacted_at: lastContactedAt,
    timeline_event_count: parity?.eventCount ?? 0,
    documents_count: parity?.documentsCount ?? 0,
    has_resume: parity?.hasResume ?? false,
    custom_field_summary: customFieldSummary,
    raw: {
      ...(record as Record<string, unknown>),
      email_secondary: secondaryEmail,
    },
  };
}

async function markJobFailed(supabase: any, jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await supabase
    .from("bullhorn_sync_jobs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      last_error: message.slice(0, 4000),
    })
    .eq("id", jobId);
}

async function queueContinuation(
  supabaseUrl: string,
  serviceKey: string,
  jobId: string,
  batchSize: number,
  maxBatchesPerInvocation: number,
) {
  const invokeUrl = `${supabaseUrl}/functions/v1/bullhorn-sync-clientcontacts`;
  const payload = {
    action: "continue-sync",
    profileName: ADMIN_PROFILE,
    data: { jobId, batchSize, maxBatchesPerInvocation },
  };

  const continuation = fetch(invokeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error("[bullhorn-sync-clientcontacts] Failed to queue continuation:", err);
  });

  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (edgeRuntime?.waitUntil && typeof edgeRuntime.waitUntil === "function") {
    edgeRuntime.waitUntil(continuation);
  } else {
    void continuation;
  }
}

async function processSyncJob(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  job: SyncJob,
  maxBatchesPerInvocation: number,
) {
  const tokens = await getStoredBullhornTokens(supabase);
  if (!tokens) {
    throw new Error("Bullhorn is not connected or token refresh failed");
  }

  let nextStart = Number(job.next_start || 0);
  let totalSynced = Number(job.total_synced || 0);
  let batchesProcessed = Number(job.batches_processed || 0);
  let totalExpected = Number.isFinite(Number(job.total_expected)) ? Number(job.total_expected) : null;
  let lastBatchSize = 0;
  let completed = false;
  const maxContacts = normalizeMaxContacts(job?.metadata?.max_contacts);
  if ((totalExpected === null || totalExpected <= 0) && maxContacts !== null) {
    totalExpected = maxContacts;
  }
  const supportedFields = await getClientContactMetaFields(tokens.rest_url, tokens.bh_rest_token);
  const preferredFieldSelector = buildClientContactFieldSelector(supportedFields);
  await syncCustomFieldDictionary(supabase, tokens.rest_url, tokens.bh_rest_token, job.id);

  await supabase
    .from("bullhorn_sync_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", job.id);

  for (let i = 0; i < maxBatchesPerInvocation; i++) {
    const remainingContacts = maxContacts ? Math.max(0, maxContacts - totalSynced) : null;
    if (remainingContacts !== null && remainingContacts <= 0) {
      completed = true;
      break;
    }

    const requestBatchSize =
      remainingContacts !== null ? Math.max(1, Math.min(job.batch_size, remainingContacts)) : job.batch_size;

    const { rows, total } = await fetchClientContactsBatch(
      tokens.rest_url,
      tokens.bh_rest_token,
      nextStart,
      requestBatchSize,
      Boolean(job.include_deleted),
      preferredFieldSelector,
      supportedFields,
    );
    await enrichFetchedContactsWithLatestNotes(tokens.rest_url, tokens.bh_rest_token, rows);
    const parityById = await syncBatchParityData(supabase, tokens.rest_url, tokens.bh_rest_token, job.id, rows);

    if (totalExpected === null && Number.isFinite(Number(total))) {
      totalExpected = Number(total);
    }

    if (!rows.length) {
      completed = true;
      break;
    }

    const mapped = rows
      .map((c) => {
        const contactId = toFiniteNumber((c as any)?.id);
        const parity = contactId ? parityById.get(contactId) : undefined;
        return mapMirrorRow(c, job.id, parity);
      })
      .filter((row) => Number.isFinite(Number(row.bullhorn_id)));

    if (mapped.length) {
      const { error: upsertError } = await supabase
        .from("bullhorn_client_contacts_mirror")
        .upsert(mapped, { onConflict: "bullhorn_id" });

      if (upsertError) {
        throw new Error(`Mirror upsert failed: ${upsertError.message}`);
      }
    }

    nextStart += rows.length;
    totalSynced += rows.length;
    batchesProcessed += 1;
    lastBatchSize = rows.length;

    await supabase
      .from("bullhorn_sync_jobs")
      .update({
        next_start: nextStart,
        total_synced: totalSynced,
        batches_processed: batchesProcessed,
        last_batch_size: lastBatchSize,
        total_expected: totalExpected,
        heartbeat_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (rows.length < job.batch_size) {
      completed = true;
      break;
    }

    if (maxContacts !== null && totalSynced >= maxContacts) {
      completed = true;
      break;
    }
  }

  if (completed) {
    await supabase
      .from("bullhorn_sync_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
        total_synced: totalSynced,
        batches_processed: batchesProcessed,
        next_start: nextStart,
        last_batch_size: lastBatchSize,
        total_expected: totalExpected,
      })
      .eq("id", job.id);
    return;
  }

  await supabase
    .from("bullhorn_sync_jobs")
    .update({
      status: "running",
      total_synced: totalSynced,
      batches_processed: batchesProcessed,
      next_start: nextStart,
      last_batch_size: lastBatchSize,
      total_expected: totalExpected,
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  await queueContinuation(supabaseUrl, supabaseServiceKey, job.id, job.batch_size, maxBatchesPerInvocation);
}

serve(async (req) => {
  if (!bootLogged) {
    console.log(`[BHSYNC] boot ${BUILD_MARKER}`);
    bootLogged = true;
  }
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.json().catch(() => ({}));
    const parsedBody =
      typeof rawBody === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(rawBody);
              return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : {};
            } catch {
              return {};
            }
          })()
        : rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
          ? (rawBody as Record<string, unknown>)
          : {};

    const nestedData = parsedBody?.data;
    const data =
      nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)
        ? (nestedData as Record<string, unknown>)
        : {};

    const actionCandidates = [
      parsedBody?.action,
      data?.action,
      parsedBody?.payload && typeof parsedBody.payload === "object" && !Array.isArray(parsedBody.payload)
        ? (parsedBody.payload as Record<string, unknown>)?.action
        : undefined,
      parsedBody?.body && typeof parsedBody.body === "object" && !Array.isArray(parsedBody.body)
        ? (parsedBody.body as Record<string, unknown>)?.action
        : undefined,
    ];

    const actionRaw =
      actionCandidates.find((candidate) => typeof candidate === "string" && String(candidate).trim().length > 0) || "";
    const action = String(actionRaw)
      .trim()
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .toLowerCase();
    const profileName = String(parsedBody?.profileName || data?.profileName || "").trim();

    if (action === "__codex_ping") {
      return jsonResponse(
        {
          success: true,
          marker: BUILD_MARKER,
          action,
          bodyType: typeof rawBody,
        },
        200,
      );
    }

    if (!profileName) {
      return jsonResponse({ success: false, error: "Profile name is required" }, 400);
    }
    if (profileName !== ADMIN_PROFILE) {
      return jsonResponse({ success: false, error: "Access denied. Admin only." }, 403);
    }

    if (action === "start-sync") {
      const batchSize = normalizeBatchSize(data?.batchSize);
      const includeDeleted = Boolean(data?.includeDeleted);
      const maxBatchesPerInvocation = normalizeMaxBatches(data?.maxBatchesPerInvocation);
      const maxContacts = normalizeMaxContacts(data?.maxContacts);

      const { data: runningJob } = await supabase
        .from("bullhorn_sync_jobs")
        .select("*")
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (runningJob) {
        return jsonResponse({ success: true, data: runningJob, message: "Existing sync job is already running." });
      }

      const { data: createdJob, error: createError } = await supabase
        .from("bullhorn_sync_jobs")
        .insert({
          requested_by: profileName,
          status: "queued",
          batch_size: maxContacts ? Math.min(batchSize, maxContacts) : batchSize,
          total_expected: maxContacts,
          include_deleted: includeDeleted,
          metadata: {
            source: "manual_start",
            max_contacts: maxContacts,
            mode: maxContacts === DEFAULT_TEST_BATCH_SIZE ? "test_5_contacts" : "full_sync",
          },
        })
        .select("*")
        .single();

      if (createError || !createdJob) {
        throw new Error(createError?.message || "Failed to create sync job");
      }

      const promise = processSyncJob(
        supabase,
        supabaseUrl,
        supabaseServiceKey,
        createdJob as SyncJob,
        maxBatchesPerInvocation,
      ).catch(async (err) => {
        console.error("[bullhorn-sync-clientcontacts] Sync failed:", err);
        await markJobFailed(supabase, createdJob.id, err);
      });

      const edgeRuntime = (globalThis as any).EdgeRuntime;
      if (edgeRuntime?.waitUntil && typeof edgeRuntime.waitUntil === "function") {
        edgeRuntime.waitUntil(promise);
      } else {
        void promise;
      }

      return jsonResponse({
        success: true,
        data: createdJob,
        message: "Sync job started in background.",
      });
    }

    if (action === "continue-sync") {
      const jobId = String(data?.jobId || "").trim();
      if (!jobId) return jsonResponse({ success: false, error: "jobId is required" }, 400);

      const maxBatchesPerInvocation = normalizeMaxBatches(data?.maxBatchesPerInvocation);

      const { data: job, error } = await supabase.from("bullhorn_sync_jobs").select("*").eq("id", jobId).maybeSingle();

      if (error || !job) return jsonResponse({ success: false, error: "Sync job not found" }, 404);
      if (job.status === "completed" || job.status === "cancelled") {
        return jsonResponse({ success: true, data: job, message: "Sync job already finished." });
      }

      const promise = processSyncJob(
        supabase,
        supabaseUrl,
        supabaseServiceKey,
        job as SyncJob,
        maxBatchesPerInvocation,
      ).catch(async (err) => {
        console.error("[bullhorn-sync-clientcontacts] Continuation failed:", err);
        await markJobFailed(supabase, job.id, err);
      });

      const edgeRuntime = (globalThis as any).EdgeRuntime;
      if (edgeRuntime?.waitUntil && typeof edgeRuntime.waitUntil === "function") {
        edgeRuntime.waitUntil(promise);
      } else {
        void promise;
      }

      return jsonResponse({
        success: true,
        data: { jobId, queued: true },
        message: "Continuation queued.",
      });
    }

    if (action === "get-contact-detail") {
      const contactId = toFiniteNumber(data?.contactId);
      if (!contactId) return jsonResponse({ success: false, error: "contactId is required" }, 400);

      const tokens = await getStoredBullhornTokens(supabase);
      if (!tokens) return jsonResponse({ success: false, error: "Bullhorn is not connected" }, 400);

      const supportedFields = await getClientContactMetaFields(tokens.rest_url, tokens.bh_rest_token);
      const contactFieldSelectors = Array.from(
        new Set([buildClientContactFieldSelector(supportedFields), ...CONTACT_DETAIL_FIELD_SELECTORS].filter(Boolean)),
      );

      let contact = await fetchEntityByIdWithFallback(
        tokens.rest_url,
        tokens.bh_rest_token,
        "ClientContact",
        contactId,
        contactFieldSelectors,
      );

      if (!contact) {
        const { data: mirrorFallback } = await supabase
          .from("bullhorn_client_contacts_mirror")
          .select("*")
          .eq("bullhorn_id", contactId)
          .maybeSingle();
        const rawFallback =
          mirrorFallback?.raw && typeof mirrorFallback.raw === "object" && !Array.isArray(mirrorFallback.raw)
            ? (mirrorFallback.raw as Record<string, unknown>)
            : null;
        if (rawFallback) contact = rawFallback;
      }

      if (!contact) return jsonResponse({ success: false, error: "Contact not found in Bullhorn" }, 404);

      deriveCanonicalSkills(contact);

      const companyId =
        toFiniteNumber((contact.clientCorporation as any)?.id) ??
        toFiniteNumber((contact as any).clientCorporationID) ??
        null;

      let company: Record<string, unknown> | null = null;
      if (companyId) {
        company = await fetchEntityByIdWithFallback(
          tokens.rest_url,
          tokens.bh_rest_token,
          "ClientCorporation",
          companyId,
          COMPANY_DETAIL_FIELD_SELECTORS,
        );
      }

      const notes = await fetchBullhornNotesForEntity(
        tokens.rest_url,
        tokens.bh_rest_token,
        "ClientContact",
        contactId,
        contact,
      );

      return jsonResponse({
        success: true,
        data: {
          contact,
          company,
          notes,
        },
      });
    }

    if (action === "get-company-detail") {
      const companyId = toFiniteNumber(data?.companyId);
      if (!companyId) return jsonResponse({ success: false, error: "companyId is required" }, 400);

      const tokens = await getStoredBullhornTokens(supabase);
      if (!tokens) return jsonResponse({ success: false, error: "Bullhorn is not connected" }, 400);

      let company = await fetchEntityByIdWithFallback(
        tokens.rest_url,
        tokens.bh_rest_token,
        "ClientCorporation",
        companyId,
        COMPANY_DETAIL_FIELD_SELECTORS,
      );

      if (!company) {
        const { data: mirrorContact } = await supabase
          .from("bullhorn_client_contacts_mirror")
          .select("raw")
          .eq("client_corporation_id", companyId)
          .order("synced_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const raw =
          mirrorContact?.raw && typeof mirrorContact.raw === "object" && !Array.isArray(mirrorContact.raw)
            ? (mirrorContact.raw as Record<string, unknown>)
            : null;
        const fromRaw =
          raw?.clientCorporation && typeof raw.clientCorporation === "object" && !Array.isArray(raw.clientCorporation)
            ? (raw.clientCorporation as Record<string, unknown>)
            : null;
        if (fromRaw) company = fromRaw;
      }

      const liveContacts = await fetchQueryRowsWithFallback(
        tokens.rest_url,
        tokens.bh_rest_token,
        "ClientContact",
        `clientCorporation.id=${companyId}`,
        50,
        0,
        CONTACTS_BY_COMPANY_FIELD_SELECTORS,
      );

      const contacts = liveContacts
        .filter((row) => !(row && typeof row === "object" && (row as any).isDeleted))
        .map((row) => {
          if (row && typeof row === "object") {
            deriveCanonicalSkills(row);
          }
          return row;
        });

      const notes = await fetchBullhornNotesForEntity(
        tokens.rest_url,
        tokens.bh_rest_token,
        "ClientCorporation",
        companyId,
        company,
      );

      return jsonResponse({
        success: true,
        data: {
          company: company || null,
          contacts,
          notes,
        },
      });
    }

    if (action === "get-contact-timeline") {
      const contactId = toFiniteNumber(data?.contactId);
      if (!contactId) return jsonResponse({ success: false, error: "contactId is required" }, 400);

      const limit = normalizeListLimit(data?.limit);
      const offset = normalizeListOffset(data?.offset);
      const source = normalizeOptionalString(data?.source);

      let query = supabase
        .from("bullhorn_contact_timeline_events")
        .select("*", { count: "exact" })
        .eq("bullhorn_contact_id", contactId)
        .order("event_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false });

      if (source) query = query.eq("event_source", source.toLowerCase());

      const { data: rows, count, error } = await query.range(offset, offset + limit - 1);
      if (error) throw error;

      return jsonResponse({
        success: true,
        data: {
          rows: rows || [],
          total: count || 0,
          limit,
          offset,
        },
      });
    }

    if (action === "get-contact-documents") {
      const contactId = toFiniteNumber(data?.contactId);
      if (!contactId) return jsonResponse({ success: false, error: "contactId is required" }, 400);

      const limit = normalizeListLimit(data?.limit);
      const offset = normalizeListOffset(data?.offset);
      const includeDeleted = Boolean(data?.includeDeleted);

      let query = supabase
        .from("bullhorn_contact_documents")
        .select("*", { count: "exact" })
        .eq("bullhorn_contact_id", contactId)
        .order("date_last_modified", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false });

      if (!includeDeleted) query = query.eq("is_deleted", false);

      const { data: rows, count, error } = await query.range(offset, offset + limit - 1);
      if (error) throw error;

      return jsonResponse({
        success: true,
        data: {
          rows: rows || [],
          total: count || 0,
          limit,
          offset,
        },
      });
    }

    if (action === "get-contact-comms-status") {
      const contactId = toFiniteNumber(data?.contactId);
      if (!contactId) return jsonResponse({ success: false, error: "contactId is required" }, 400);

      const { data: row, error } = await supabase
        .from("bullhorn_contact_comms_status")
        .select("*")
        .eq("bullhorn_contact_id", contactId)
        .maybeSingle();
      if (error) throw error;
      return jsonResponse({ success: true, data: row || null });
    }

    if (action === "list-custom-field-dictionary") {
      const limit = Math.max(10, Math.min(500, Number(data?.limit) || 200));
      const offset = normalizeListOffset(data?.offset);
      const entityName = normalizeOptionalString(data?.entityName);
      const search = normalizeSearchTerm(data?.search);
      const customOnly = Boolean(data?.customOnly);

      let query = supabase
        .from("bullhorn_custom_field_dictionary")
        .select("*", { count: "exact" })
        .order("entity_name", { ascending: true })
        .order("field_name", { ascending: true });

      if (entityName) query = query.eq("entity_name", entityName);
      if (customOnly) query = query.eq("is_custom", true);
      if (search) {
        const like = `%${search}%`;
        query = query.or(
          `field_name.ilike.${like},field_label.ilike.${like},data_type.ilike.${like},field_type.ilike.${like}`,
        );
      }

      const { data: rows, count, error } = await query.range(offset, offset + limit - 1);
      if (error) throw error;

      const needsAutoHydrate = offset === 0 && !entityName && !search && !customOnly && (count || 0) === 0;

      if (needsAutoHydrate) {
        const tokens = await getStoredBullhornTokens(supabase);
        if (tokens) {
          const hydrationJobId = await resolveWritableSyncJobId(
            supabase,
            profileName || ADMIN_PROFILE,
            normalizeOptionalString(String(data?.jobId || "")),
          );
          await syncCustomFieldDictionary(supabase, tokens.rest_url, tokens.bh_rest_token, hydrationJobId);

          const {
            data: hydratedRows,
            count: hydratedCount,
            error: hydratedError,
          } = await supabase
            .from("bullhorn_custom_field_dictionary")
            .select("*", { count: "exact" })
            .order("entity_name", { ascending: true })
            .order("field_name", { ascending: true })
            .range(0, limit - 1);

          if (!hydratedError) {
            return jsonResponse({
              success: true,
              data: {
                rows: hydratedRows || [],
                total: hydratedCount || 0,
                limit,
                offset: 0,
              },
            });
          }
        }
      }

      return jsonResponse({
        success: true,
        data: {
          rows: rows || [],
          total: count || 0,
          limit,
          offset,
        },
      });
    }

    if (action === "sync-contact-parity") {
      const contactIds = Array.isArray(data?.contactIds)
        ? data.contactIds
            .map((value: unknown) => toFiniteNumber(value))
            .filter((id: number | null): id is number => Number.isFinite(id))
        : [];
      const uniqueContactIds = Array.from(new Set(contactIds));
      if (!uniqueContactIds.length) {
        return jsonResponse({ success: false, error: "contactIds is required" }, 400);
      }

      const tokens = await getStoredBullhornTokens(supabase);
      if (!tokens) return jsonResponse({ success: false, error: "Bullhorn is not connected" }, 400);

      const { data: mirrorRows, error: mirrorError } = await supabase
        .from("bullhorn_client_contacts_mirror")
        .select("*")
        .in("bullhorn_id", uniqueContactIds);
      if (mirrorError) throw mirrorError;

      const contactsById = new Map<number, Record<string, unknown>>();
      for (const row of mirrorRows || []) {
        const id = toFiniteNumber((row as any)?.bullhorn_id);
        if (!id) continue;
        const raw = (row as any)?.raw;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          contactsById.set(id, { ...(raw as Record<string, unknown>), id });
        }
      }

      const missingIds = uniqueContactIds.filter((id) => !contactsById.has(id));
      if (missingIds.length) {
        const supportedFields = await getClientContactMetaFields(tokens.rest_url, tokens.bh_rest_token);
        const selector = buildClientContactFieldSelector(supportedFields);
        const selectors = [selector, ...CONTACT_DETAIL_FIELD_SELECTORS];
        for (const id of missingIds) {
          const liveContact = await fetchEntityByIdWithFallback(
            tokens.rest_url,
            tokens.bh_rest_token,
            "ClientContact",
            id,
            selectors,
          );
          if (liveContact) contactsById.set(id, { ...liveContact, id });
        }
      }

      const contacts = Array.from(contactsById.values());
      if (!contacts.length) {
        return jsonResponse({ success: false, error: "No matching contacts found for parity sync" }, 404);
      }

      const parityJobId = await resolveWritableSyncJobId(
        supabase,
        profileName || ADMIN_PROFILE,
        normalizeOptionalString(String(data?.jobId || "")),
      );
      await enrichFetchedContactsWithLatestNotes(tokens.rest_url, tokens.bh_rest_token, contacts);
      await syncCustomFieldDictionary(supabase, tokens.rest_url, tokens.bh_rest_token, parityJobId);
      const parityById = await syncBatchParityData(
        supabase,
        tokens.rest_url,
        tokens.bh_rest_token,
        parityJobId,
        contacts,
      );

      const mappedRows = contacts
        .map((contact) => {
          const id = toFiniteNumber(contact.id);
          const parity = id ? parityById.get(id) : undefined;
          return mapMirrorRow(contact, parityJobId, parity);
        })
        .filter((row) => Number.isFinite(Number(row.bullhorn_id)));

      if (mappedRows.length) {
        const { error: upsertError } = await supabase
          .from("bullhorn_client_contacts_mirror")
          .upsert(mappedRows, { onConflict: "bullhorn_id" });
        if (upsertError) throw upsertError;
      }

      return jsonResponse({
        success: true,
        data: {
          contactCount: mappedRows.length,
          contactIds: mappedRows.map((row) => row.bullhorn_id),
        },
      });
    }

    if (action === "get-sync-job") {
      const jobId = String(data?.jobId || "").trim();
      if (!jobId) return jsonResponse({ success: false, error: "jobId is required" }, 400);

      const { data: job, error } = await supabase.from("bullhorn_sync_jobs").select("*").eq("id", jobId).maybeSingle();
      if (error || !job) return jsonResponse({ success: false, error: "Sync job not found" }, 404);

      return jsonResponse({ success: true, data: job });
    }

    if (action === "list-sync-jobs") {
      const limit = Math.max(1, Math.min(30, Number(data?.limit) || 10));
      const { data: jobs, error } = await supabase
        .from("bullhorn_sync_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return jsonResponse({ success: true, data: jobs || [] });
    }

    if (action === "list-mirror-contacts") {
      const limit = normalizeListLimit(data?.limit);
      const offset = normalizeListOffset(data?.offset);
      const searchTerm = normalizeSearchTerm(data?.search);
      const filterRows = normalizeFilterRows(data?.filters);
      const useAdvancedFiltering = filterRows.length > 0;

      if (!useAdvancedFiltering) {
        let query = supabase
          .from("bullhorn_client_contacts_mirror")
          .select("*", { count: "exact" })
          .order("bullhorn_id", { ascending: false });

        if (searchTerm) {
          const like = `%${searchTerm}%`;
          query = query.or(
            `name.ilike.${like},email.ilike.${like},client_corporation_name.ilike.${like},occupation.ilike.${like},address_city.ilike.${like}`,
          );
        }

        const { data: contacts, count, error } = await query.range(offset, offset + limit - 1);

        if (error) throw error;
        const enrichedContacts = await enrichContactsWithLatestNotes(supabase, contacts || []);
        return jsonResponse({
          success: true,
          data: {
            contacts: enrichedContacts,
            total: count || 0,
            limit,
            offset,
          },
        });
      }

      // Advanced filter mode (Bullhorn-style): OR within row values, AND between rows.
      const chunkSize = 500;
      let cursor = 0;
      let matchedTotal = 0;
      const pagedContacts: any[] = [];

      while (true) {
        const { data: batch, error } = await supabase
          .from("bullhorn_client_contacts_mirror")
          .select("*")
          .order("bullhorn_id", { ascending: false })
          .range(cursor, cursor + chunkSize - 1);

        if (error) throw error;
        const rows = Array.isArray(batch) ? batch : [];
        if (!rows.length) break;

        for (const contact of rows) {
          if (!contactMatchesQuickSearch(contact, searchTerm)) continue;
          if (!contactMatchesFilterRows(contact, filterRows)) continue;

          if (matchedTotal >= offset && pagedContacts.length < limit) {
            pagedContacts.push(contact);
          }
          matchedTotal += 1;
        }

        cursor += rows.length;
        if (rows.length < chunkSize) break;
      }

      const enrichedPagedContacts = await enrichContactsWithLatestNotes(supabase, pagedContacts);
      return jsonResponse({
        success: true,
        data: {
          contacts: enrichedPagedContacts,
          total: matchedTotal,
          limit,
          offset,
        },
      });
    }

    if (action === "list-distribution-lists") {
      const { data: lists, error } = await supabase
        .from("distribution_lists")
        .select("id,name,created_by,created_at,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const listIds = (lists || []).map((row: any) => String(row.id || "").trim()).filter(Boolean);
      const countByList = new Map<string, number>();

      if (listIds.length) {
        const { data: countRows, error: countError } = await supabase
          .from("distribution_list_contacts")
          .select("list_id")
          .in("list_id", listIds);
        if (countError) throw countError;
        for (const row of countRows || []) {
          const listId = String((row as any)?.list_id || "").trim();
          if (!listId) continue;
          countByList.set(listId, (countByList.get(listId) || 0) + 1);
        }
      }

      const result = (lists || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        contact_count: countByList.get(String(row.id || "")) || 0,
      }));

      return jsonResponse({ success: true, data: result });
    }

    if (action === "create-distribution-list") {
      const name = normalizeDistributionListName(data?.name);
      if (!name) return jsonResponse({ success: false, error: "Distribution list name is required" }, 400);

      const { data: created, error } = await supabase
        .from("distribution_lists")
        .insert({
          name,
          created_by: profileName,
        })
        .select("id,name,created_by,created_at,updated_at")
        .single();

      if (error) {
        if ((error as any)?.code === "23505") {
          return jsonResponse({ success: false, error: "Distribution list with this name already exists" }, 409);
        }
        throw error;
      }

      return jsonResponse({
        success: true,
        data: {
          ...created,
          contact_count: 0,
        },
      });
    }

    if (action === "delete-distribution-list") {
      const listId = String(data?.listId || "").trim();
      if (!listId) return jsonResponse({ success: false, error: "listId is required" }, 400);

      const { data: existingList, error: listError } = await supabase
        .from("distribution_lists")
        .select("id,name")
        .eq("id", listId)
        .maybeSingle();
      if (listError) throw listError;
      if (!existingList) return jsonResponse({ success: false, error: "Distribution list not found" }, 404);

      const { count: contactsCountBefore, error: countError } = await supabase
        .from("distribution_list_contacts")
        .select("*", { count: "exact", head: true })
        .eq("list_id", listId);
      if (countError) throw countError;

      const { data: deletedList, error: deleteError } = await supabase
        .from("distribution_lists")
        .delete()
        .eq("id", listId)
        .select("id,name")
        .maybeSingle();
      if (deleteError) throw deleteError;
      if (!deletedList) return jsonResponse({ success: false, error: "Distribution list not found" }, 404);

      return jsonResponse({
        success: true,
        data: {
          listId,
          name: deletedList.name,
          removedContacts: Number(contactsCountBefore || 0),
        },
      });
    }

    if (action === "add-contacts-to-distribution-list") {
      const listId = String(data?.listId || "").trim();
      if (!listId) return jsonResponse({ success: false, error: "listId is required" }, 400);

      const contactIds = Array.isArray(data?.contactIds)
        ? data.contactIds
            .map((value: unknown) => toFiniteNumber(value))
            .filter((id: number | null): id is number => Number.isFinite(id))
        : [];
      const uniqueContactIds = Array.from(new Set(contactIds));
      if (!uniqueContactIds.length) {
        return jsonResponse({ success: false, error: "contactIds is required" }, 400);
      }

      const { data: existingList, error: listError } = await supabase
        .from("distribution_lists")
        .select("id")
        .eq("id", listId)
        .maybeSingle();
      if (listError) throw listError;
      if (!existingList) return jsonResponse({ success: false, error: "Distribution list not found" }, 404);

      const { count: beforeCount, error: beforeCountError } = await supabase
        .from("distribution_list_contacts")
        .select("*", { count: "exact", head: true })
        .eq("list_id", listId);
      if (beforeCountError) throw beforeCountError;

      const { data: contacts, error: contactsError } = await supabase
        .from("bullhorn_client_contacts_mirror")
        .select("*")
        .in("bullhorn_id", uniqueContactIds);
      if (contactsError) throw contactsError;

      const rowsToInsert = (contacts || []).map((contact: any) => ({
        list_id: listId,
        bullhorn_id: contact.bullhorn_id,
        added_by: profileName,
        name: contact.name,
        email: contact.email,
        occupation: contact.occupation,
        company_name: contact.client_corporation_name,
        contact_snapshot: contact,
      }));

      if (rowsToInsert.length > 0) {
        const { error: insertError } = await supabase.from("distribution_list_contacts").upsert(rowsToInsert, {
          onConflict: "list_id,bullhorn_id",
          ignoreDuplicates: true,
        });
        if (insertError) throw insertError;
      }

      const { count: afterCount, error: afterCountError } = await supabase
        .from("distribution_list_contacts")
        .select("*", { count: "exact", head: true })
        .eq("list_id", listId);
      if (afterCountError) throw afterCountError;

      const inserted = Math.max(0, Number(afterCount || 0) - Number(beforeCount || 0));
      const skipped = Math.max(0, uniqueContactIds.length - inserted);

      return jsonResponse({
        success: true,
        data: {
          listId,
          inserted,
          skipped,
          totalInList: Number(afterCount || 0),
        },
      });
    }

    if (action === "list-distribution-list-contacts") {
      const listId = String(data?.listId || "").trim();
      if (!listId) return jsonResponse({ success: false, error: "listId is required" }, 400);
      const limit = normalizeListLimit(data?.limit);
      const offset = normalizeListOffset(data?.offset);
      const searchTerm = normalizeSearchTerm(data?.search);

      let query = supabase
        .from("distribution_list_contacts")
        .select("*", { count: "exact" })
        .eq("list_id", listId)
        .order("added_at", { ascending: false });

      if (searchTerm) {
        const like = `%${searchTerm}%`;
        query = query.or(`name.ilike.${like},email.ilike.${like},company_name.ilike.${like},occupation.ilike.${like}`);
      }

      const { data: contacts, count, error } = await query.range(offset, offset + limit - 1);
      if (error) throw error;

      return jsonResponse({
        success: true,
        data: {
          contacts: contacts || [],
          total: count || 0,
          limit,
          offset,
        },
      });
    }

    if (action === "remove-contacts-from-distribution-list") {
      const listId = String(data?.listId || "").trim();
      if (!listId) return jsonResponse({ success: false, error: "listId is required" }, 400);

      const contactIds = Array.isArray(data?.contactIds)
        ? data.contactIds
            .map((value: unknown) => toFiniteNumber(value))
            .filter((id: number | null): id is number => Number.isFinite(id))
        : [];
      const uniqueContactIds = Array.from(new Set(contactIds));
      if (!uniqueContactIds.length) {
        return jsonResponse({ success: false, error: "contactIds is required" }, 400);
      }

      const { data: existingList, error: listError } = await supabase
        .from("distribution_lists")
        .select("id")
        .eq("id", listId)
        .maybeSingle();
      if (listError) throw listError;
      if (!existingList) return jsonResponse({ success: false, error: "Distribution list not found" }, 404);

      const { data: removedRows, error: removeError } = await supabase
        .from("distribution_list_contacts")
        .delete()
        .eq("list_id", listId)
        .in("bullhorn_id", uniqueContactIds)
        .select("bullhorn_id");
      if (removeError) throw removeError;

      const removed = Array.isArray(removedRows) ? removedRows.length : 0;

      const { count: totalInList, error: countError } = await supabase
        .from("distribution_list_contacts")
        .select("*", { count: "exact", head: true })
        .eq("list_id", listId);
      if (countError) throw countError;

      return jsonResponse({
        success: true,
        data: {
          listId,
          removed,
          requested: uniqueContactIds.length,
          skipped: Math.max(0, uniqueContactIds.length - removed),
          totalInList: Number(totalInList || 0),
        },
      });
    }

    if (action === "get-mirror-stats") {
      const { count, error } = await supabase
        .from("bullhorn_client_contacts_mirror")
        .select("*", { count: "exact", head: true });

      if (error) throw error;

      const { data: latestJob } = await supabase
        .from("bullhorn_sync_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return jsonResponse({
        success: true,
        data: {
          totalMirroredContacts: count || 0,
          latestJob: latestJob || null,
        },
      });
    }

    return jsonResponse(
      {
        success: false,
        error: "Unknown action",
        details: {
          receivedAction: action || null,
          bodyAction: typeof parsedBody?.action === "string" ? parsedBody.action : null,
          nestedAction: typeof data?.action === "string" ? data.action : null,
          bodyType: typeof rawBody,
        },
      },
      400,
    );
  } catch (error: any) {
    console.error("[bullhorn-sync-clientcontacts] Fatal error:", error);
    return jsonResponse({ success: false, error: error?.message || "Unknown error" }, 500);
  }
});
