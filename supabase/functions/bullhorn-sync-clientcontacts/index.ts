import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_PROFILE = "Nikita Vojevoda";
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
  | "skills";
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
          .split(/[\n,;|]+/)
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

    const parts = target.split(" ").filter(Boolean);
    if (parts.length > 1) {
      return parts.every((part) => tokenSet.has(part));
    }
    if (target.length <= 3) {
      return tokenSet.has(target);
    }
    for (const token of tokenSet) {
      if (token.includes(target)) return true;
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

async function getClientContactMetaFields(restUrl: string, bhRestToken: string): Promise<Set<string> | null> {
  const metaUrl = `${restUrl}meta/ClientContact?BhRestToken=${encodeURIComponent(bhRestToken)}`;
  try {
    const response = await fetch(metaUrl);
    if (!response.ok) return null;
    const payload = await response.json();
    const fieldNames = extractMetaFieldNames(payload);
    return fieldNames.size ? fieldNames : null;
  } catch {
    return null;
  }
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
    "occupation",
    "status",
    "phone",
    "mobile",
    "dateAdded",
    "dateLastModified",
    "isDeleted",
    "lastVisit",
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
  if (supportedFields) {
    // Some Bullhorn instances expose these as computed/export fields even if meta is inconsistent.
    ["skills", "skillsCount", "dateLastVisit", "dateLastComment", "address1", "address2", "city", "state"].forEach(add);
  }

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
  const personReference = base.personReference && typeof base.personReference === "object"
    ? base.personReference
    : null;
  const targetEntity =
    base.targetEntity && typeof base.targetEntity === "object"
      ? (base.targetEntity as Record<string, unknown>)
      : null;
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
    targetEntityName:
      base.targetEntityName
        ? String(base.targetEntityName)
        : targetEntity?.entityName
          ? String(targetEntity.entityName)
          : targetEntity?.name
            ? String(targetEntity.name)
            : null,
    targetEntityId: toFiniteNumber(
      base.targetEntityID ?? base.targetEntityId ?? targetEntity?.id ?? targetEntity?.entityID ?? targetEntity?.entityId,
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

async function fetchBullhornNotesForEntity(
  restUrl: string,
  bhRestToken: string,
  entityName: string,
  entityId: number,
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

  return dedupeLiveNotes(results);
}

function noteDateMillis(note: Record<string, unknown>): number {
  const dateValue = note.dateAdded;
  const ts = new Date(String(dateValue || "")).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function updateLatestNoteMap(
  map: Map<number, Record<string, unknown>>,
  note: Record<string, unknown>,
) {
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

    for (const id of missingIds) {
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
    }
  }

  return latestByContact;
}

async function enrichContactsWithLatestNotes(supabase: any, contacts: any[]): Promise<any[]> {
  const rows = Array.isArray(contacts) ? contacts : [];
  if (!rows.length) return rows;

  const ids = rows
    .map((contact) => Number(contact?.bullhorn_id ?? contact?.id))
    .filter((id) => Number.isFinite(id));
  if (!ids.length) return rows;

  const tokens = await getStoredBullhornTokens(supabase);
  if (!tokens) return rows;

  const latestByContact = await fetchLatestNotesForContactIds(tokens.rest_url, tokens.bh_rest_token, ids);
  if (!latestByContact.size) return rows;

  for (const contact of rows) {
    const id = Number(contact?.bullhorn_id ?? contact?.id);
    if (!Number.isFinite(id)) continue;
    const note = latestByContact.get(id);
    if (!note) continue;

    const comments = typeof note.comments === "string" ? note.comments.trim() : "";
    const action = typeof note.action === "string" ? note.action.trim() : "";
    contact.latest_note = comments && action ? `${action}: ${comments}` : comments || action || null;
    contact.latest_note_action = action || null;
    contact.latest_note_date = normalizeBullhornDate(note.dateAdded);
  }

  return rows;
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

function mapMirrorRow(contact: any, jobId: string) {
  const email = normalizeEmail(contact?.email);
  return {
    bullhorn_id: Number(contact?.id),
    synced_at: new Date().toISOString(),
    last_synced_job_id: jobId,
    name: contact?.name || null,
    first_name: contact?.firstName || null,
    last_name: contact?.lastName || null,
    email,
    email_normalized: email,
    occupation: contact?.occupation || null,
    status: contact?.status || null,
    phone: contact?.phone || null,
    mobile: contact?.mobile || null,
    address_city: contact?.address?.city || contact?.city || null,
    address_state: contact?.address?.state || contact?.state || null,
    address_country_id: Number.isFinite(Number(contact?.address?.countryID)) ? Number(contact.address.countryID) : null,
    client_corporation_id: Number.isFinite(Number(contact?.clientCorporation?.id))
      ? Number(contact.clientCorporation.id)
      : null,
    client_corporation_name: contact?.clientCorporation?.name || null,
    owner_id: Number.isFinite(Number(contact?.owner?.id)) ? Number(contact.owner.id) : null,
    owner_name: contact?.owner?.name || null,
    date_added: normalizeBullhornDate(contact?.dateAdded),
    date_last_modified: normalizeBullhornDate(contact?.dateLastModified),
    is_deleted: Boolean(contact?.isDeleted),
    raw: contact,
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

    if (totalExpected === null && Number.isFinite(Number(total))) {
      totalExpected = Number(total);
    }

    if (!rows.length) {
      completed = true;
      break;
    }

    const mapped = rows.map((c) => mapMirrorRow(c, job.id)).filter((row) => Number.isFinite(Number(row.bullhorn_id)));

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const profileName = String(body?.profileName || "").trim();
    const data = body?.data || {};

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
          .order("synced_at", { ascending: false });

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
          .order("synced_at", { ascending: false })
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

    return jsonResponse({ success: false, error: "Unknown action" }, 400);
  } catch (error: any) {
    console.error("[bullhorn-sync-clientcontacts] Fatal error:", error);
    return jsonResponse({ success: false, error: error?.message || "Unknown error" }, 500);
  }
});
