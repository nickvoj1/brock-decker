import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfileName } from "@/hooks/useProfileName";
import {
  BullhornContactCommsStatus,
  BullhornCompanyLocalNote,
  BullhornContactDocument,
  DistributionListSummary,
  BullhornSyncHealth,
  BullhornMirrorContactsMeta,
  BullhornTimelineEvent,
  addContactsToDistributionList,
  BullhornContactFilterField,
  BullhornContactFilterOperator,
  BullhornContactFilterRow,
  BullhornLiveCompanyDetail,
  BullhornLiveContactDetail,
  BullhornMirrorContact,
  BullhornSyncJob,
  createDistributionList,
  createBullhornLocalCompanyNote,
  createBullhornLocalContactNote,
  getBullhornContactCommsStatus,
  getBullhornContactDocuments,
  getBullhornContactTimeline,
  getBullhornLiveCompanyDetail,
  getBullhornLiveContactDetail,
  getBullhornMirrorStats,
  getBullhornSyncHealth,
  listDistributionLists,
  listBullhornLocalCompanyNotes,
  listBullhornMirrorContacts,
  listBullhornSyncJobs,
  runBullhornScheduledSync,
  startBullhornClientContactSync,
  upsertBullhornSyncSettings,
  updateBullhornLocalContactStatus,
  updateBullhornLocalContactStatusBatch,
} from "@/lib/bullhornSyncApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowDown, ArrowUp, ArrowUpDown, Briefcase, Building2, Calendar, Clock, Database, Mail, Phone, Plus, RefreshCw, Settings2, User, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const ADMIN_PROFILE = "Nikita Vojevoda";
const CONTACTS_PAGE_SIZE = 25;
const CONTACTS_TABLE_COLUMN_COUNT = 13;
const CRM_QUERY_SEARCH_KEY = "q";
const CRM_QUERY_SORT_KEY = "sort";
const CRM_QUERY_DIRECTION_KEY = "dir";
const CRM_QUERY_FILTERS_KEY = "filters";
const CRM_QUERY_CONTACT_ID_KEY = "contact";
const CRM_QUERY_CONTACT_TAB_KEY = "contactTab";
const CONTACT_SORT_KEYS: ContactSortKey[] = [
  "id",
  "name",
  "jobTitle",
  "company",
  "workEmail",
  "status",
  "workPhone",
  "consultant",
  "address",
  "lastNote",
  "dateAdded",
  "dateLastModified",
  "skills",
];
const CONTACT_FILTER_FIELDS: BullhornContactFilterField[] = [
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
];
const CONTACT_FILTER_OPERATORS: BullhornContactFilterOperator[] = ["contains", "equals"];
const SKILLS_CANDIDATE_KEYS = [
  "skills",
  "skill",
  "skillList",
  "skillIDList",
  "categories",
  "specialties",
  "specialty",
  "specialities",
  "expertise",
  ...Array.from({ length: 20 }, (_, idx) => `customTextBlock${idx + 1}`),
  ...Array.from({ length: 40 }, (_, idx) => `customText${idx + 1}`),
];

function isArchivedStatus(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return normalized.includes("archiv");
}

function formatMirrorValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const parseJsonLike = (input: string): unknown | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const looksJson =
      trimmed.startsWith("{") ||
      trimmed.startsWith("[") ||
      (trimmed.startsWith("\"{") && trimmed.endsWith("}\"")) ||
      (trimmed.startsWith("\"[") && trimmed.endsWith("]\""));
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
  };

  if (typeof value === "string") {
    const parsed = parseJsonLike(value);
    if (parsed !== null) return formatMirrorValue(parsed);
    return value.trim() || "-";
  }

  if (Array.isArray(value)) {
    if (!value.length) return "-";
    const rendered = value
      .map((item) => formatMirrorValue(item))
      .filter((item) => item !== "-");
    return rendered.length ? rendered.join("; ") : "-";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("data" in record) {
      const dataValue = formatMirrorValue(record.data);
      if (dataValue !== "-") return dataValue;
    }
    if ("id" in record || "name" in record) {
      const name = record.name ? String(record.name).trim() : "";
      const id = record.id !== undefined && record.id !== null ? String(record.id).trim() : "";
      const combined = name || id;
      if (combined) return combined;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatMirrorDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) {
    const millis = numeric > 1e11 ? numeric : numeric * 1000;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function formatMirrorAddress(value: unknown, fallbackCity?: string | null, fallbackState?: string | null): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const address = value as Record<string, unknown>;
    const city = String(address.city || "").trim();
    const state = String(address.state || "").trim();
    const countryName = String(address.countryName || "").trim();
    const formatted = [city, state, countryName].filter(Boolean).join(", ");
    if (formatted) return formatted;
  }
  const fallback = [fallbackCity || "", fallbackState || ""].filter(Boolean).join(", ");
  return fallback || "-";
}

function extractSkillsFromRaw(rawRecord: Record<string, unknown>): string {
  for (const key of SKILLS_CANDIDATE_KEYS) {
    if (!(key in rawRecord)) continue;
    const value = formatMirrorValue(rawRecord[key]);
    if (value !== "-") return value;
  }

  const fuzzyMatches = Object.keys(rawRecord)
    .filter((key) => {
      const lower = key.toLowerCase();
      return lower.includes("skill") || lower.includes("special") || lower.includes("category");
    })
    .map((key) => formatMirrorValue(rawRecord[key]))
    .filter((value) => value !== "-");

  if (fuzzyMatches.length) return fuzzyMatches.join(" ; ");
  return "-";
}

function getExpectedTotal(job: BullhornSyncJob | null | undefined): number | null {
  if (!job) return null;

  const direct = Number(job.total_expected);
  if (Number.isFinite(direct) && direct > 0) return direct;

  if (job.metadata && typeof job.metadata === "object") {
    const fromMetadata = Number((job.metadata as Record<string, unknown>).max_contacts);
    if (Number.isFinite(fromMetadata) && fromMetadata > 0) return fromMetadata;
  }

  return null;
}

interface BullhornSyncAdminProps {
  tableOnly?: boolean;
}

type ContactSortKey =
  | "id"
  | "name"
  | "jobTitle"
  | "company"
  | "workEmail"
  | "status"
  | "workPhone"
  | "consultant"
  | "address"
  | "lastNote"
  | "dateAdded"
  | "dateLastModified"
  | "skills";

type ContactSortDirection = "asc" | "desc";
type ContactProfileTab = "overview" | "timeline" | "notes" | "documents" | "raw";

type ContactDisplayRow = {
  contact: BullhornMirrorContact;
  fullName: string;
  jobTitle: string;
  company: string;
  workEmail: string;
  status: string;
  workPhone: string;
  consultant: string;
  address: string;
  lastNote: string;
  dateAdded: string;
  dateLastModified: string;
  lastVisit: string;
  lastContacted: string;
  commStatus: string;
  preferredContact: string;
  hasResume: string;
  skills: string;
  lastNoteMillis: number | null;
  dateAddedMillis: number | null;
  dateLastModifiedMillis: number | null;
  lastContactedMillis: number | null;
};

type ProfileNoteEntry = {
  label: string;
  value: string;
  date: string | null;
};

type LocalContactStatusDraft = {
  status: string;
  commStatusLabel: string;
  preferredContact: string;
  doNotContact: boolean;
  massMailOptOut: boolean;
  smsOptIn: boolean;
  emailBounced: boolean;
};

type BatchStatusDraft = {
  status: string;
  commStatusLabel: string;
  preferredContact: string;
  doNotContact: "keep" | "true" | "false";
  massMailOptOut: "keep" | "true" | "false";
  smsOptIn: "keep" | "true" | "false";
  emailBounced: "keep" | "true" | "false";
};

type SyncSettingsDraft = {
  enabled: boolean;
  targetHourUtc: number;
  targetMinuteUtc: number;
  minIntervalHours: number;
  maxLagHours: number;
  includeDeleted: boolean;
  batchSize: number;
  maxBatchesPerInvocation: number;
};

type CompanyProfileData = {
  id: number | null;
  name: string;
  website: string;
  phone: string;
  industry: string;
  location: string;
  contacts: ContactDisplayRow[];
  notes: ProfileNoteEntry[];
  raw: Record<string, unknown>;
};

type ContactFilterDraftRow = {
  id: string;
  field: BullhornContactFilterField;
  operator: BullhornContactFilterOperator;
  valueInput: string;
};

type CrmQueryState = {
  search: string;
  sortKey: ContactSortKey;
  sortDirection: ContactSortDirection;
  filters: BullhornContactFilterRow[];
};

const CONTACT_PROFILE_TABS: ContactProfileTab[] = ["overview", "timeline", "notes", "documents", "raw"];

const FILTER_FIELD_OPTIONS: Array<{ value: BullhornContactFilterField; label: string }> = [
  { value: "name", label: "Name" },
  { value: "company", label: "Company" },
  { value: "title", label: "Job Title" },
  { value: "email", label: "Work Email" },
  { value: "city", label: "City" },
  { value: "country", label: "Country" },
  { value: "consultant", label: "Consultant" },
  { value: "status", label: "Status" },
  { value: "skills", label: "Skills" },
  { value: "preferred_contact", label: "Preferred Contact" },
  { value: "comm_status", label: "Comms Status" },
  { value: "last_contacted", label: "Last Contacted" },
  { value: "has_resume", label: "Has Resume" },
  { value: "mass_mail_opt_out", label: "Mass Mail Opt-out" },
];

const FILTER_OPERATOR_OPTIONS: Array<{ value: BullhornContactFilterOperator; label: string }> = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
];

function createFilterDraftRow(): ContactFilterDraftRow {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `filter-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    field: "skills",
    operator: "contains",
    valueInput: "",
  };
}

function createFilterDraftRowsFromApplied(rows: BullhornContactFilterRow[]): ContactFilterDraftRow[] {
  return rows.map((row) => ({
    ...createFilterDraftRow(),
    field: row.field,
    operator: row.operator,
    valueInput: row.values.join(", "),
  }));
}

function buildAppliedFilters(rows: ContactFilterDraftRow[]): BullhornContactFilterRow[] {
  return rows
    .map((row) => ({
      field: row.field,
      operator: row.operator,
      values: row.valueInput
        .split(/[\n,;|]+|\s+\bOR\b\s+/i)
        .map((value) => value.trim())
        .filter(Boolean),
    }))
    .filter((row) => row.values.length > 0);
}

function parseFilterRowsParam(rawValue: string | null): BullhornContactFilterRow[] {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    const fieldSet = new Set<string>(CONTACT_FILTER_FIELDS);
    const operatorSet = new Set<string>(CONTACT_FILTER_OPERATORS);

    const normalized = parsed
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const record = item as Record<string, unknown>;
        const field = String(record.field || "").trim() as BullhornContactFilterField;
        const operator = String(record.operator || "").trim() as BullhornContactFilterOperator;
        if (!fieldSet.has(field)) return null;
        if (!operatorSet.has(operator)) return null;
        const values = Array.isArray(record.values)
          ? record.values
              .map((value) => String(value || "").trim())
              .filter(Boolean)
              .slice(0, 25)
          : [];
        if (!values.length) return null;
        return { field, operator, values } satisfies BullhornContactFilterRow;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row)) as BullhornContactFilterRow[];

    return normalized.slice(0, 20);
  } catch {
    return [];
  }
}

function serializeFilterRowsParam(rows: BullhornContactFilterRow[]): string {
  if (!rows.length) return "";
  return JSON.stringify(
    rows.map((row) => ({
      field: row.field,
      operator: row.operator,
      values: row.values.map((value) => String(value || "").trim()).filter(Boolean),
    })),
  );
}

function parseCrmQueryState(params: URLSearchParams): CrmQueryState {
  const search = String(params.get(CRM_QUERY_SEARCH_KEY) || "").trim();
  const sortKeyCandidate = String(params.get(CRM_QUERY_SORT_KEY) || "").trim() as ContactSortKey;
  const sortDirectionCandidate = String(params.get(CRM_QUERY_DIRECTION_KEY) || "").trim() as ContactSortDirection;
  const sortKey = CONTACT_SORT_KEYS.includes(sortKeyCandidate) ? sortKeyCandidate : "id";
  const sortDirection = sortDirectionCandidate === "asc" || sortDirectionCandidate === "desc"
    ? sortDirectionCandidate
    : "desc";
  const filters = parseFilterRowsParam(params.get(CRM_QUERY_FILTERS_KEY));

  return {
    search,
    sortKey,
    sortDirection,
    filters,
  };
}

function parseContactIdParam(value: string | null): number | null {
  const parsed = Number(value || "");
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function normalizeContactProfileTab(value: string | null): ContactProfileTab {
  const candidate = String(value || "").trim() as ContactProfileTab;
  return CONTACT_PROFILE_TABS.includes(candidate) ? candidate : "overview";
}

function toDateMillis(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) {
    const millis = numeric > 1e11 ? numeric : numeric * 1000;
    if (Number.isFinite(millis)) return millis;
  }
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDateTime(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) {
    const millis = numeric > 1e11 ? numeric : numeric * 1000;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatLagLabel(health: BullhornSyncHealth | null): string {
  if (!health) return "Lag: -";
  if (health.lagStatus === "running") return "Lag: syncing";
  if (health.lagStatus === "never_synced") return "Lag: never";
  if (health.lagHours === null || !Number.isFinite(health.lagHours)) return "Lag: -";
  if (health.lagHours < 1) return `Lag: ${Math.max(1, Math.round(health.lagHours * 60))}m`;
  return `Lag: ${health.lagHours.toFixed(1)}h`;
}

function mapHealthSettingsToDraft(health: BullhornSyncHealth | null): SyncSettingsDraft {
  return {
    enabled: health?.settings?.enabled ?? true,
    targetHourUtc: Number(health?.settings?.target_hour_utc ?? 2),
    targetMinuteUtc: Number(health?.settings?.target_minute_utc ?? 0),
    minIntervalHours: Number(health?.settings?.min_interval_hours ?? 20),
    maxLagHours: Number(health?.settings?.max_lag_hours ?? 24),
    includeDeleted: Boolean(health?.settings?.include_deleted ?? false),
    batchSize: Number(health?.settings?.batch_size ?? 500),
    maxBatchesPerInvocation: Number(health?.settings?.max_batches_per_invocation ?? 8),
  };
}

function normalizeTriStateBoolean(value: "keep" | "true" | "false"): boolean | undefined {
  if (value === "keep") return undefined;
  return value === "true";
}

function normalizeSortableText(value: string): string {
  const normalized = String(value || "").trim();
  if (!normalized || normalized === "-") return "";
  return normalized.toLowerCase();
}

function compareNullableNumbers(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareSortableText(a: string, b: string): number {
  return normalizeSortableText(a).localeCompare(normalizeSortableText(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sanitizeGridLastNoteText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text === "-") return null;
  if (text.toLowerCase() === "[object object]") return null;

  // Bullhorn relation placeholders sometimes leak as plain numeric note IDs.
  if (/^\d{4,14}$/.test(text)) return null;

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        const keys = Object.keys(record).map((key) => key.toLowerCase());
        if (keys.length === 1 && keys[0] === "id" && toNullableNumber(record.id) !== null) return null;
        if (Array.isArray(record.data)) {
          const onlyMetaKeys = keys.every((key) => key === "data" || key === "total" || key === "count");
          if (onlyMetaKeys) {
            const allIdOnly = record.data.every((row) => {
              const rowRecord = asRecord(row);
              if (!rowRecord) return false;
              const rowKeys = Object.keys(rowRecord).map((key) => key.toLowerCase());
              return rowKeys.length === 1 && rowKeys[0] === "id" && toNullableNumber(rowRecord.id) !== null;
            });
            if (allIdOnly) return null;
          }
        }
      }
    } catch {
      // Keep non-JSON parseable note text.
    }
  }

  return text;
}

function buildContactDisplayRow(contact: BullhornMirrorContact): ContactDisplayRow {
  const rawRecord =
    contact.raw && typeof contact.raw === "object" && !Array.isArray(contact.raw)
      ? (contact.raw as Record<string, unknown>)
      : {};
  const workEmail = formatMirrorValue(rawRecord.email ?? contact.email);
  const fullName = formatMirrorValue(
    rawRecord.name ??
      contact.name ??
      `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
  );
  const jobTitle = formatMirrorValue(rawRecord.occupation ?? contact.occupation);
  const company = formatMirrorValue(
    (rawRecord.clientCorporation as Record<string, unknown> | undefined)?.name ??
      contact.client_corporation_name,
  );
  const status = formatMirrorValue(rawRecord.status ?? contact.status);
  const workPhone = formatMirrorValue(rawRecord.phone);
  const consultant = formatMirrorValue(
    (rawRecord.owner as Record<string, unknown> | undefined)?.name ?? contact.owner_name,
  );
  const address = formatMirrorAddress(rawRecord.address, contact.address_city, contact.address_state);
  const liveLatestNoteRaw = contact.latest_note ?? contact.latest_note_action;
  const fallbackLatestNoteRaw =
    rawRecord.latest_note ??
    rawRecord.lastNote ??
    rawRecord.comments ??
    rawRecord.notes ??
    rawRecord.description;
  const lastNoteText =
    sanitizeGridLastNoteText(liveLatestNoteRaw) ??
    sanitizeGridLastNoteText(fallbackLatestNoteRaw) ??
    "-";
  const lastNoteDate = formatMirrorDate(contact.latest_note_date ?? rawRecord.latest_note_date ?? rawRecord.dateLastComment);
  const lastNote = lastNoteText !== "-"
    ? lastNoteText
    : lastNoteDate !== "-"
      ? `Updated ${lastNoteDate}`
      : "-";
  const lastNoteRaw =
    contact.latest_note_date ?? rawRecord.latest_note_date ?? rawRecord.dateLastComment ?? rawRecord.dateLastModified;
  const dateAddedRaw = rawRecord.dateAdded;
  const dateLastModifiedRaw = rawRecord.dateLastModified ?? contact.date_last_modified;
  const lastVisitRaw = rawRecord.dateLastVisit ?? rawRecord.lastVisit;
  const lastContactedRaw = contact.last_contacted_at ?? rawRecord.lastContactedAt ?? rawRecord.dateLastComment ?? lastVisitRaw;
  const dateAdded = formatMirrorDate(dateAddedRaw);
  const dateLastModified = formatMirrorDate(dateLastModifiedRaw);
  const lastVisit = formatMirrorDate(lastVisitRaw);
  const lastContacted = formatMirrorDate(lastContactedRaw);
  const commStatus = formatMirrorValue(
    contact.comm_status_label ??
      rawRecord.comm_status_label ??
      rawRecord.emailStatus ??
      rawRecord.communicationStatus,
  );
  const preferredContact = formatMirrorValue(
    contact.preferred_contact ?? rawRecord.preferredContact,
  );
  const hasResume = contact.has_resume ? "Yes" : "No";
  const skills = extractSkillsFromRaw(rawRecord);

  return {
    contact,
    fullName,
    jobTitle,
    company,
    workEmail,
    status,
    workPhone,
    consultant,
    address,
    lastNote,
    dateAdded,
    dateLastModified,
    lastVisit,
    lastContacted,
    commStatus,
    preferredContact,
    hasResume,
    skills,
    lastNoteMillis: toDateMillis(lastNoteRaw),
    dateAddedMillis: toDateMillis(dateAddedRaw),
    dateLastModifiedMillis: toDateMillis(dateLastModifiedRaw),
    lastContactedMillis: toDateMillis(lastContactedRaw),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getRawRecord(contact: BullhornMirrorContact): Record<string, unknown> {
  return asRecord(contact.raw) || {};
}

function toNullableNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isIdOnlyRelationRecord(record: Record<string, unknown>): boolean {
  const keys = Object.keys(record);
  const normalizedKeys = keys.map((key) => key.toLowerCase());

  if (keys.length === 1 && normalizedKeys[0] === "id" && toNullableNumber(record.id) !== null) {
    return true;
  }

  if ("data" in record && Array.isArray(record.data)) {
    const hasOnlyRelationMeta = normalizedKeys.every((key) => key === "data" || key === "total" || key === "count");
    if (!hasOnlyRelationMeta) return false;

    const rows = record.data as unknown[];
    if (!rows.length) return true;
    return rows.every((row) => {
      const item = asRecord(row);
      if (!item) return false;
      const itemKeys = Object.keys(item).map((key) => key.toLowerCase());
      return itemKeys.length === 1 && itemKeys[0] === "id" && toNullableNumber(item.id) !== null;
    });
  }

  return false;
}

function extractTextChunks(value: unknown): string[] {
  if (value === null || value === undefined) return [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "-") return [];
    return [trimmed];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractTextChunks(item));
  }

  const record = asRecord(value);
  if (!record) return [];
  if (isIdOnlyRelationRecord(record)) return [];

  const prioritizedKeys = ["note", "notes", "comment", "comments", "description", "text", "value", "name", "data"];
  const fromKeys = prioritizedKeys.flatMap((key) => (key in record ? extractTextChunks(record[key]) : []));
  if (fromKeys.length) return fromKeys;

  const meaningfulKeys = Object.keys(record).filter((key) => {
    const normalized = key.toLowerCase();
    return normalized !== "id" && normalized !== "data" && normalized !== "total" && normalized !== "count";
  });
  if (!meaningfulKeys.length) return [];

  try {
    return [JSON.stringify(record)];
  } catch {
    return [];
  }
}

function uniqueText(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function extractContactNotes(contact: BullhornMirrorContact): ProfileNoteEntry[] {
  const raw = getRawRecord(contact);
  const dateHint = formatMirrorDate(raw.dateLastComment ?? raw.dateLastModified ?? contact.date_last_modified);

  const candidates: Array<{ label: string; value: unknown }> = [
    { label: "Last Note", value: raw.lastNote },
    { label: "Comments", value: raw.comments },
    { label: "Notes", value: raw.notes },
    { label: "Description", value: raw.description },
    { label: "Summary", value: raw.summary },
  ];

  const entries: ProfileNoteEntry[] = [];
  for (const candidate of candidates) {
    const chunks = uniqueText(extractTextChunks(candidate.value)).slice(0, 2);
    for (const chunk of chunks) {
      entries.push({
        label: candidate.label,
        value: chunk,
        date: dateHint === "-" ? null : dateHint,
      });
    }
  }
  return entries;
}

function extractCompanyNotes(companyRaw: Record<string, unknown>, dateHintValue: unknown): ProfileNoteEntry[] {
  const dateHint = formatMirrorDate(dateHintValue);
  const candidates: Array<{ label: string; value: unknown }> = [
    { label: "Company Notes", value: companyRaw.notes },
    { label: "Company Comments", value: companyRaw.comments },
    { label: "Company Description", value: companyRaw.companyDescription ?? companyRaw.description },
  ];
  const entries: ProfileNoteEntry[] = [];
  for (const candidate of candidates) {
    const chunks = uniqueText(extractTextChunks(candidate.value)).slice(0, 2);
    for (const chunk of chunks) {
      entries.push({
        label: candidate.label,
        value: chunk,
        date: dateHint === "-" ? null : dateHint,
      });
    }
  }
  return entries;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function buildCompanyProfile(anchorRow: ContactDisplayRow, allRows: ContactDisplayRow[]): CompanyProfileData {
  const anchorRaw = getRawRecord(anchorRow.contact);
  const companyRaw = asRecord(anchorRaw.clientCorporation) || {};
  const companyId = toNullableNumber(companyRaw.id ?? anchorRow.contact.client_corporation_id);
  const companyName = formatMirrorValue(companyRaw.name ?? anchorRow.contact.client_corporation_name);
  const normalizedName = normalizeKey(companyName);

  const contacts = allRows.filter((row) => {
    const raw = getRawRecord(row.contact);
    const rowCompany = asRecord(raw.clientCorporation);
    const rowCompanyId = toNullableNumber(rowCompany?.id ?? row.contact.client_corporation_id);
    if (companyId !== null && rowCompanyId !== null) {
      return companyId === rowCompanyId;
    }
    return normalizeKey(row.company) === normalizedName;
  });

  const location = formatMirrorAddress(
    {
      city: companyRaw.city ?? companyRaw.addressCity,
      state: companyRaw.state ?? companyRaw.addressState,
      countryName: companyRaw.countryName ?? companyRaw.country,
    },
    null,
    null,
  );

  return {
    id: companyId,
    name: companyName,
    website: formatMirrorValue(companyRaw.url ?? companyRaw.website),
    phone: formatMirrorValue(companyRaw.phone ?? companyRaw.mainPhone),
    industry: formatMirrorValue(companyRaw.industry),
    location,
    contacts,
    notes: extractCompanyNotes(companyRaw, anchorRaw.dateLastComment ?? anchorRaw.dateLastModified),
    raw: companyRaw,
  };
}

function readNestedValue(record: Record<string, unknown> | null, path: string): unknown {
  if (!record) return null;
  const parts = path.split(".");
  let current: unknown = record;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function pickFirstDefined(record: Record<string, unknown> | null, paths: string[]): unknown {
  for (const path of paths) {
    const value = readNestedValue(record, path);
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function extractCompanyIdFromRow(row: ContactDisplayRow): number | null {
  const raw = getRawRecord(row.contact);
  const fromRaw = toNullableNumber((asRecord(raw.clientCorporation) || {}).id);
  if (fromRaw !== null) return fromRaw;
  return row.contact.client_corporation_id ?? null;
}

function mapLiveNotesToProfileEntries(notes: unknown): ProfileNoteEntry[] {
  if (!Array.isArray(notes)) return [];
  return notes
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;
      const comments = uniqueText(
        extractTextChunks(
          record.comments ?? record.comment ?? record.notes ?? record.note ?? record.description,
        ),
      )[0];
      if (!comments) return null;
      const action = formatMirrorValue(record.action ?? record.type);
      return {
        label: action !== "-" ? action : "Bullhorn Note",
        value: comments,
        date: formatMirrorDate(record.dateAdded) === "-" ? null : formatMirrorDate(record.dateAdded),
      } satisfies ProfileNoteEntry;
    })
    .filter((entry): entry is ProfileNoteEntry => Boolean(entry));
}

function toNullableDisplay(value: unknown): string | null {
  const rendered = formatMirrorValue(value);
  return rendered === "-" ? null : rendered;
}

export default function BullhornSyncAdmin({ tableOnly = false }: BullhornSyncAdminProps) {
  const profileName = useProfileName();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCrmQueryState = useMemo(
    () => parseCrmQueryState(new URLSearchParams(location.search)),
    [location.search],
  );
  const [syncJobs, setSyncJobs] = useState<BullhornSyncJob[]>([]);
  const [syncJobLoading, setSyncJobLoading] = useState(false);
  const [syncActionLoading, setSyncActionLoading] = useState(false);
  const [scheduledSyncActionLoading, setScheduledSyncActionLoading] = useState(false);
  const [syncSettingsDraft, setSyncSettingsDraft] = useState<SyncSettingsDraft>(() => mapHealthSettingsToDraft(null));
  const [syncSettingsSaving, setSyncSettingsSaving] = useState(false);
  const [mirrorCount, setMirrorCount] = useState(0);
  const [syncHealth, setSyncHealth] = useState<BullhornSyncHealth | null>(null);
  const [contactsQueryMeta, setContactsQueryMeta] = useState<BullhornMirrorContactsMeta | null>(null);
  const [contacts, setContacts] = useState<BullhornMirrorContact[]>([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsOffset, setContactsOffset] = useState(0);
  const [hasMoreContacts, setHasMoreContacts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [contactsSearchDraft, setContactsSearchDraft] = useState(() => initialCrmQueryState.search);
  const [contactsSearch, setContactsSearch] = useState(() => initialCrmQueryState.search);
  const [filterRows, setFilterRows] = useState<ContactFilterDraftRow[]>(() =>
    initialCrmQueryState.filters.length ? createFilterDraftRowsFromApplied(initialCrmQueryState.filters) : [],
  );
  const [appliedFilters, setAppliedFilters] = useState<BullhornContactFilterRow[]>(() =>
    initialCrmQueryState.filters,
  );
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false);
  const [distributionLists, setDistributionLists] = useState<DistributionListSummary[]>([]);
  const [distributionListsLoading, setDistributionListsLoading] = useState(false);
  const [isAddToListDialogOpen, setIsAddToListDialogOpen] = useState(false);
  const [targetDistributionListId, setTargetDistributionListId] = useState("");
  const [newDistributionListName, setNewDistributionListName] = useState("");
  const [addToListLoading, setAddToListLoading] = useState(false);
  const [sortKey, setSortKey] = useState<ContactSortKey>(() => initialCrmQueryState.sortKey);
  const [sortDirection, setSortDirection] = useState<ContactSortDirection>(() => initialCrmQueryState.sortDirection);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [selectedContactProfile, setSelectedContactProfile] = useState<ContactDisplayRow | null>(null);
  const [contactActiveTab, setContactActiveTab] = useState<ContactProfileTab>("overview");
  const [urlContactId, setUrlContactId] = useState<number | null>(null);
  const [selectedCompanyProfile, setSelectedCompanyProfile] = useState<ContactDisplayRow | null>(null);
  const [liveContactDetail, setLiveContactDetail] = useState<BullhornLiveContactDetail | null>(null);
  const [liveCompanyDetail, setLiveCompanyDetail] = useState<BullhornLiveCompanyDetail | null>(null);
  const [contactTimeline, setContactTimeline] = useState<BullhornTimelineEvent[]>([]);
  const [contactTimelineLoading, setContactTimelineLoading] = useState(false);
  const [contactDocuments, setContactDocuments] = useState<BullhornContactDocument[]>([]);
  const [contactDocumentsLoading, setContactDocumentsLoading] = useState(false);
  const [contactCommsStatus, setContactCommsStatus] = useState<BullhornContactCommsStatus | null>(null);
  const [contactCommsLoading, setContactCommsLoading] = useState(false);
  const [contactDetailLoading, setContactDetailLoading] = useState(false);
  const [companyDetailLoading, setCompanyDetailLoading] = useState(false);
  const [localNoteDraft, setLocalNoteDraft] = useState("");
  const [localNoteSaving, setLocalNoteSaving] = useState(false);
  const [localCompanyNotes, setLocalCompanyNotes] = useState<BullhornCompanyLocalNote[]>([]);
  const [localCompanyNoteDraft, setLocalCompanyNoteDraft] = useState("");
  const [localCompanyNoteSaving, setLocalCompanyNoteSaving] = useState(false);
  const [localStatusSaving, setLocalStatusSaving] = useState(false);
  const [batchStatusSaving, setBatchStatusSaving] = useState(false);
  const [isBatchStatusDialogOpen, setIsBatchStatusDialogOpen] = useState(false);
  const [batchStatusDraft, setBatchStatusDraft] = useState<BatchStatusDraft>({
    status: "",
    commStatusLabel: "",
    preferredContact: "",
    doNotContact: "keep",
    massMailOptOut: "keep",
    smsOptIn: "keep",
    emailBounced: "keep",
  });
  const [localStatusDraft, setLocalStatusDraft] = useState<LocalContactStatusDraft>({
    status: "",
    commStatusLabel: "",
    preferredContact: "",
    doNotContact: false,
    massMailOptOut: false,
    smsOptIn: false,
    emailBounced: false,
  });
  const [liveDetailApiSupported, setLiveDetailApiSupported] = useState(true);
  const [parityApiSupported, setParityApiSupported] = useState(true);
  const contactDetailRequestIdRef = useRef(0);
  const companyDetailRequestIdRef = useRef(0);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const isApplyingUrlStateRef = useRef(false);

  useEffect(() => {
    isApplyingUrlStateRef.current = true;
    const params = new URLSearchParams(location.search);
    const parsed = parseCrmQueryState(params);
    const nextFiltersSerialized = serializeFilterRowsParam(parsed.filters);
    const currentFiltersSerialized = serializeFilterRowsParam(appliedFilters);
    const nextUrlContactId = parseContactIdParam(params.get(CRM_QUERY_CONTACT_ID_KEY));
    const nextContactTab = normalizeContactProfileTab(params.get(CRM_QUERY_CONTACT_TAB_KEY));

    if (contactsSearchDraft !== parsed.search) setContactsSearchDraft(parsed.search);
    if (contactsSearch !== parsed.search) setContactsSearch(parsed.search);
    if (sortKey !== parsed.sortKey) setSortKey(parsed.sortKey);
    if (sortDirection !== parsed.sortDirection) setSortDirection(parsed.sortDirection);
    if (contactActiveTab !== nextContactTab) setContactActiveTab(nextContactTab);
    if (urlContactId !== nextUrlContactId) setUrlContactId(nextUrlContactId);

    if (currentFiltersSerialized !== nextFiltersSerialized) {
      setAppliedFilters(parsed.filters);
      setFilterRows(parsed.filters.length ? createFilterDraftRowsFromApplied(parsed.filters) : []);
    }
  }, [location.search]);

  useEffect(() => {
    if (isApplyingUrlStateRef.current) {
      isApplyingUrlStateRef.current = false;
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    const searchValue = contactsSearch.trim();
    if (searchValue) nextParams.set(CRM_QUERY_SEARCH_KEY, searchValue);
    else nextParams.delete(CRM_QUERY_SEARCH_KEY);

    if (sortKey !== "id") nextParams.set(CRM_QUERY_SORT_KEY, sortKey);
    else nextParams.delete(CRM_QUERY_SORT_KEY);

    if (sortDirection !== "desc") nextParams.set(CRM_QUERY_DIRECTION_KEY, sortDirection);
    else nextParams.delete(CRM_QUERY_DIRECTION_KEY);

    const serializedFilters = serializeFilterRowsParam(appliedFilters);
    if (serializedFilters) nextParams.set(CRM_QUERY_FILTERS_KEY, serializedFilters);
    else nextParams.delete(CRM_QUERY_FILTERS_KEY);

    const selectedContactId = selectedContactProfile?.contact.bullhorn_id ?? null;
    const effectiveContactId = selectedContactId ?? urlContactId;
    if (effectiveContactId) nextParams.set(CRM_QUERY_CONTACT_ID_KEY, String(effectiveContactId));
    else nextParams.delete(CRM_QUERY_CONTACT_ID_KEY);

    if (effectiveContactId && contactActiveTab !== "overview") {
      nextParams.set(CRM_QUERY_CONTACT_TAB_KEY, contactActiveTab);
    } else {
      nextParams.delete(CRM_QUERY_CONTACT_TAB_KEY);
    }

    const currentString = searchParams.toString();
    const nextString = nextParams.toString();
    if (currentString !== nextString) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [contactsSearch, sortKey, sortDirection, appliedFilters, selectedContactProfile, urlContactId, contactActiveTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (profileName && profileName !== ADMIN_PROFILE) {
      toast.error("Access denied. Admin only.");
      navigate("/");
      return;
    }
    if (profileName === ADMIN_PROFILE) {
      void loadBullhornSyncData({ silent: tableOnly });
    }
  }, [profileName, navigate, tableOnly]);

  useEffect(() => {
    if (tableOnly) return;
    const activeJob = syncJobs.find((job) => job.status === "queued" || job.status === "running");
    if (!activeJob || profileName !== ADMIN_PROFILE) return;

    const interval = setInterval(() => {
      loadBullhornSyncData({ silent: true });
      loadBullhornMirrorContacts({ silent: true, reset: true });
    }, 3000);

    return () => clearInterval(interval);
  }, [syncJobs, profileName, tableOnly]);

  const loadBullhornSyncData = async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setSyncJobLoading(true);
    try {
      const [jobsResult, statsResult] = await Promise.all([
        listBullhornSyncJobs(ADMIN_PROFILE, 10),
        getBullhornMirrorStats(ADMIN_PROFILE),
      ]);
      const healthResult = await getBullhornSyncHealth(ADMIN_PROFILE);

      if (jobsResult.success && Array.isArray(jobsResult.data)) {
        setSyncJobs(jobsResult.data);
      }

      if (statsResult.success && statsResult.data) {
        setMirrorCount(statsResult.data.totalMirroredContacts || 0);
      }

      if (healthResult.success && healthResult.data) {
        setSyncHealth(healthResult.data);
      }
    } catch (err) {
      console.error("Failed to load Bullhorn contact sync state", err);
    } finally {
      if (!options.silent) setSyncJobLoading(false);
    }
  };

  const loadDistributionLists = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setDistributionListsLoading(true);
    try {
      const result = await listDistributionLists(ADMIN_PROFILE);
      if (result.success && Array.isArray(result.data)) {
        setDistributionLists(result.data);
      } else if (!options.silent) {
        toast.error(result.error || "Failed to load distribution lists");
      }
    } catch {
      if (!options.silent) toast.error("Failed to load distribution lists");
    } finally {
      if (!options.silent) setDistributionListsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSyncSettingsDraft(mapHealthSettingsToDraft(syncHealth));
  }, [
    syncHealth?.settings?.enabled,
    syncHealth?.settings?.target_hour_utc,
    syncHealth?.settings?.target_minute_utc,
    syncHealth?.settings?.min_interval_hours,
    syncHealth?.settings?.max_lag_hours,
    syncHealth?.settings?.include_deleted,
    syncHealth?.settings?.batch_size,
    syncHealth?.settings?.max_batches_per_invocation,
  ]);

  const loadBullhornMirrorContacts = useCallback(async (
    options: {
      silent?: boolean;
      search?: string;
      filters?: BullhornContactFilterRow[];
      reset?: boolean;
      append?: boolean;
      offset?: number;
    } = {},
  ) => {
    const isReset = Boolean(options.reset);
    if (!options.silent) setContactsLoading(true);
    if (options.append) setIsLoadingMore(true);
    try {
      const search = options.search ?? contactsSearch;
      const filters = options.filters ?? appliedFilters;
      const offset = isReset ? 0 : options.offset ?? 0;
      const result = await listBullhornMirrorContacts(ADMIN_PROFILE, {
        limit: CONTACTS_PAGE_SIZE,
        offset,
        search,
        filters,
      });

      if (result.success && result.data) {
        setContactsQueryMeta(result.data.meta || null);
        const rawBatch = result.data.contacts || [];
        const visibleContacts = (result.data.contacts || []).filter((contact) => {
          const directStatus = contact.status;
          const rawStatus =
            contact.raw && typeof contact.raw === "object" && !Array.isArray(contact.raw)
              ? (contact.raw as Record<string, unknown>).status
              : null;
          return !isArchivedStatus(directStatus) && !isArchivedStatus(rawStatus);
        });

        if (isReset) {
          setContacts(visibleContacts);
        } else {
          setContacts((prev) => {
            const merged = new Map<number, BullhornMirrorContact>();
            for (const row of prev) merged.set(row.bullhorn_id, row);
            for (const row of visibleContacts) merged.set(row.bullhorn_id, row);
            return Array.from(merged.values());
          });
        }

        setContactsTotal(result.data.total || 0);
        const nextOffset = offset + rawBatch.length;
        setContactsOffset(nextOffset);
        const reachedEnd =
          rawBatch.length < CONTACTS_PAGE_SIZE ||
          (Number(result.data.total || 0) > 0 && nextOffset >= Number(result.data.total || 0));
        setHasMoreContacts(!reachedEnd);
      } else if (!options.silent) {
        toast.error(result.error || "Failed to load synced contacts");
      }
    } catch {
      if (!options.silent) toast.error("Failed to load synced contacts");
    } finally {
      if (!options.silent) setContactsLoading(false);
      if (options.append) setIsLoadingMore(false);
    }
  }, [contactsSearch, appliedFilters]);

  useEffect(() => {
    if (profileName === ADMIN_PROFILE) {
      loadBullhornMirrorContacts({ reset: true });
    }
  }, [profileName, contactsSearch, appliedFilters, loadBullhornMirrorContacts]);

  useEffect(() => {
    if (profileName === ADMIN_PROFILE) {
      void loadDistributionLists({ silent: true });
    }
  }, [profileName, loadDistributionLists]);

  useEffect(() => {
    if (!targetDistributionListId && distributionLists.length > 0) {
      setTargetDistributionListId(distributionLists[0].id);
    }
  }, [distributionLists, targetDistributionListId]);

  useEffect(() => {
    if (profileName !== ADMIN_PROFILE) return;

    const maybeLoadMore = () => {
      if (contactsLoading || isLoadingMore || !hasMoreContacts) return;
      const viewport = tableViewportRef.current;
      if (!viewport) return;
      const viewportHeight = viewport.clientHeight || 0;
      const scrollTop = viewport.scrollTop || 0;
      const scrollHeight = viewport.scrollHeight || 0;
      const distanceToBottom = scrollHeight - (scrollTop + viewportHeight);
      if (distanceToBottom > 260) return;
      void loadBullhornMirrorContacts({ silent: true, append: true, offset: contactsOffset });
    };

    const viewport = tableViewportRef.current;
    if (!viewport) return;

    viewport.addEventListener("scroll", maybeLoadMore, { passive: true });
    window.addEventListener("resize", maybeLoadMore);
    // Trigger load-more immediately when visible area is not filled.
    maybeLoadMore();
    return () => {
      viewport.removeEventListener("scroll", maybeLoadMore);
      window.removeEventListener("resize", maybeLoadMore);
    };
  }, [profileName, contactsLoading, isLoadingMore, hasMoreContacts, contactsOffset, loadBullhornMirrorContacts]);

  const startSync = async (mode: "test" | "full") => {
    setSyncActionLoading(true);
    try {
      const isTestMode = mode === "test";
      const result = await startBullhornClientContactSync(ADMIN_PROFILE, {
        batchSize: isTestMode ? 5 : 500,
        includeDeleted: false,
        maxBatchesPerInvocation: isTestMode ? 1 : 8,
        maxContacts: isTestMode ? 5 : undefined,
      });

      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to start Bullhorn contact sync");
        return;
      }

      toast.success(
        result.message || (isTestMode ? "Bullhorn 5-contact test sync started" : "Bullhorn full contact sync started"),
      );
      await Promise.all([
        loadBullhornSyncData(),
        loadBullhornMirrorContacts({ silent: true, reset: true }),
      ]);
    } catch {
      toast.error("Failed to start Bullhorn contact sync");
    } finally {
      setSyncActionLoading(false);
    }
  };

  const runScheduledSyncNow = async () => {
    setScheduledSyncActionLoading(true);
    try {
      const result = await runBullhornScheduledSync(ADMIN_PROFILE);
      if (!result.success) {
        toast.error(result.error || "Failed to run scheduled sync check");
        return;
      }

      if (result.data && typeof result.data === "object" && "skipped" in result.data && result.data.skipped) {
        toast.info(`Scheduled sync skipped: ${result.data.reason}`);
      } else {
        toast.success(result.message || "Scheduled sync started");
      }

      await Promise.all([
        loadBullhornSyncData({ silent: true }),
        loadBullhornMirrorContacts({ silent: true, reset: true }),
      ]);
    } catch {
      toast.error("Failed to run scheduled sync check");
    } finally {
      setScheduledSyncActionLoading(false);
    }
  };

  const saveSyncSettings = async () => {
    setSyncSettingsSaving(true);
    try {
      const result = await upsertBullhornSyncSettings(ADMIN_PROFILE, {
        enabled: syncSettingsDraft.enabled,
        targetHourUtc: Math.max(0, Math.min(23, Math.floor(syncSettingsDraft.targetHourUtc || 0))),
        targetMinuteUtc: Math.max(0, Math.min(59, Math.floor(syncSettingsDraft.targetMinuteUtc || 0))),
        minIntervalHours: Math.max(1, Math.min(168, Math.floor(syncSettingsDraft.minIntervalHours || 1))),
        maxLagHours: Math.max(1, Math.min(336, Math.floor(syncSettingsDraft.maxLagHours || 1))),
        includeDeleted: syncSettingsDraft.includeDeleted,
        batchSize: Math.max(5, Math.min(2000, Math.floor(syncSettingsDraft.batchSize || 5))),
        maxBatchesPerInvocation: Math.max(1, Math.min(40, Math.floor(syncSettingsDraft.maxBatchesPerInvocation || 1))),
      });
      if (!result.success) {
        toast.error(result.error || "Failed to save sync settings");
        return;
      }
      toast.success("Sync settings saved");
      await loadBullhornSyncData({ silent: true });
    } catch {
      toast.error("Failed to save sync settings");
    } finally {
      setSyncSettingsSaving(false);
    }
  };

  const latestSyncJob = syncJobs[0] || null;
  const activeSyncJob = syncJobs.find((job) => job.status === "queued" || job.status === "running") || null;
  const latestExpectedTotal = getExpectedTotal(latestSyncJob);
  const progressPercent = latestSyncJob && latestExpectedTotal
    ? Math.min(100, Math.round((latestSyncJob.total_synced / latestExpectedTotal) * 100))
    : 0;
  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
      case "completed":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "partial":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "failed":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "running":
      case "queued":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };
  const getLagStatusColor = (status: BullhornSyncHealth["lagStatus"] | null | undefined) => {
    switch (status) {
      case "ok":
        return "bg-green-500/10 text-green-700 border-green-500/30";
      case "warning":
        return "bg-amber-500/10 text-amber-700 border-amber-500/30";
      case "critical":
        return "bg-red-500/10 text-red-700 border-red-500/30";
      case "running":
        return "bg-blue-500/10 text-blue-700 border-blue-500/30";
      case "never_synced":
        return "bg-zinc-500/10 text-zinc-700 border-zinc-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const displayedContacts = useMemo(() => {
    const rows = contacts.map((contact) => buildContactDisplayRow(contact));
    const direction = sortDirection === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let compared = 0;
      switch (sortKey) {
        case "id":
          compared = a.contact.bullhorn_id - b.contact.bullhorn_id;
          break;
        case "name":
          compared = compareSortableText(a.fullName, b.fullName);
          break;
        case "jobTitle":
          compared = compareSortableText(a.jobTitle, b.jobTitle);
          break;
        case "company":
          compared = compareSortableText(a.company, b.company);
          break;
        case "workEmail":
          compared = compareSortableText(a.workEmail, b.workEmail);
          break;
        case "status":
          compared = compareSortableText(a.status, b.status);
          break;
        case "workPhone":
          compared = compareSortableText(a.workPhone, b.workPhone);
          break;
        case "consultant":
          compared = compareSortableText(a.consultant, b.consultant);
          break;
        case "address":
          compared = compareSortableText(a.address, b.address);
          break;
        case "lastNote":
          compared = compareNullableNumbers(a.lastNoteMillis, b.lastNoteMillis);
          break;
        case "dateAdded":
          compared = compareNullableNumbers(a.dateAddedMillis, b.dateAddedMillis);
          break;
        case "dateLastModified":
          compared = compareNullableNumbers(a.dateLastModifiedMillis, b.dateLastModifiedMillis);
          break;
        case "skills":
          compared = compareSortableText(a.skills, b.skills);
          break;
        default:
          compared = 0;
      }
      return compared * direction;
    });
    return rows;
  }, [contacts, sortDirection, sortKey]);

  const allContactRows = useMemo(
    () => contacts.map((contact) => buildContactDisplayRow(contact)),
    [contacts],
  );
  const allContactRowsById = useMemo(
    () => new Map(allContactRows.map((row) => [row.contact.bullhorn_id, row])),
    [allContactRows],
  );

  const selectedContactNotes = useMemo(
    () => (selectedContactProfile ? extractContactNotes(selectedContactProfile.contact) : []),
    [selectedContactProfile],
  );
  const selectedLiveContactNotes = useMemo(
    () => mapLiveNotesToProfileEntries(liveContactDetail?.notes),
    [liveContactDetail?.notes],
  );
  const selectedContactRaw = useMemo(
    () => (asRecord(liveContactDetail?.contact) || (selectedContactProfile ? getRawRecord(selectedContactProfile.contact) : null)),
    [liveContactDetail?.contact, selectedContactProfile],
  );
  const selectedCustomFieldEntries = useMemo(() => {
    const summary = selectedContactProfile?.contact.custom_field_summary;
    if (!summary || typeof summary !== "object" || Array.isArray(summary)) return [] as Array<[string, unknown]>;
    return Object.entries(summary as Record<string, unknown>).slice(0, 40);
  }, [selectedContactProfile]);
  const selectedLiveContactRecord = useMemo(
    () => asRecord(liveContactDetail?.contact),
    [liveContactDetail?.contact],
  );
  const selectedLiveContactCompanyRecord = useMemo(
    () => asRecord(liveContactDetail?.company),
    [liveContactDetail?.company],
  );

  const selectedCompanyData = useMemo(
    () => (selectedCompanyProfile ? buildCompanyProfile(selectedCompanyProfile, allContactRows) : null),
    [allContactRows, selectedCompanyProfile],
  );
  const selectedLiveCompanyRecord = useMemo(
    () => asRecord(liveCompanyDetail?.company),
    [liveCompanyDetail?.company],
  );
  const selectedLiveCompanyNotes = useMemo(
    () => mapLiveNotesToProfileEntries(liveCompanyDetail?.notes),
    [liveCompanyDetail?.notes],
  );
  const selectedLocalCompanyNotes = useMemo(
    () =>
      localCompanyNotes.map((note) => ({
        label: note.note_label || "Local CRM Note",
        value: note.note_text,
        date: formatMirrorDate(note.created_at) === "-" ? null : formatMirrorDate(note.created_at),
      })),
    [localCompanyNotes],
  );
  const displayedCompanyNotes = useMemo(() => {
    const baseNotes = selectedLiveCompanyNotes.length ? selectedLiveCompanyNotes : selectedCompanyData?.notes || [];
    return [...selectedLocalCompanyNotes, ...baseNotes];
  }, [selectedCompanyData?.notes, selectedLiveCompanyNotes, selectedLocalCompanyNotes]);

  const contactOverview = useMemo(() => {
    if (!selectedContactProfile) return null;
    const liveContact = selectedLiveContactRecord;
    const liveCompany = selectedLiveContactCompanyRecord;
    const liveAddress = formatMirrorAddress(
      pickFirstDefined(liveContact, ["address"]),
      toNullableDisplay(pickFirstDefined(liveContact, ["city"])) ?? selectedContactProfile.contact.address_city,
      toNullableDisplay(pickFirstDefined(liveContact, ["state"])) ?? selectedContactProfile.contact.address_state,
    );

    return {
      jobTitle: toNullableDisplay(pickFirstDefined(liveContact, ["occupation"])) ?? selectedContactProfile.jobTitle,
      company: toNullableDisplay(pickFirstDefined(liveCompany, ["name"])) ?? selectedContactProfile.company,
      workEmail: toNullableDisplay(pickFirstDefined(liveContact, ["email"])) ?? selectedContactProfile.workEmail,
      phone: toNullableDisplay(pickFirstDefined(liveContact, ["phone", "mobile"])) ?? selectedContactProfile.workPhone,
      consultant:
        toNullableDisplay(pickFirstDefined(liveContact, ["owner.name", "ownerName"])) ?? selectedContactProfile.consultant,
      status: toNullableDisplay(pickFirstDefined(liveContact, ["status"])) ?? selectedContactProfile.status,
      address: liveAddress === "-" ? selectedContactProfile.address : liveAddress,
      dateAdded:
        formatMirrorDate(pickFirstDefined(liveContact, ["dateAdded"])) !== "-"
          ? formatMirrorDate(pickFirstDefined(liveContact, ["dateAdded"]))
          : selectedContactProfile.dateAdded,
      dateLastModified:
        formatMirrorDate(pickFirstDefined(liveContact, ["dateLastModified"])) !== "-"
          ? formatMirrorDate(pickFirstDefined(liveContact, ["dateLastModified"]))
          : selectedContactProfile.dateLastModified,
      lastVisit:
        formatMirrorDate(pickFirstDefined(liveContact, ["dateLastVisit", "lastVisit"])) !== "-"
          ? formatMirrorDate(pickFirstDefined(liveContact, ["dateLastVisit", "lastVisit"]))
          : formatMirrorDate(readNestedValue(getRawRecord(selectedContactProfile.contact), "lastVisit")),
      lastContacted:
        formatMirrorDate(
          pickFirstDefined(liveContact, [
            "last_contacted_at",
            "lastContactedAt",
            "dateLastComment",
            "dateLastVisit",
            "lastVisit",
          ]),
        ) !== "-"
          ? formatMirrorDate(
            pickFirstDefined(liveContact, [
              "last_contacted_at",
              "lastContactedAt",
              "dateLastComment",
              "dateLastVisit",
              "lastVisit",
            ]),
          )
          : selectedContactProfile.lastContacted,
      preferredContact:
        toNullableDisplay(pickFirstDefined(liveContact, ["preferredContact"])) ??
        selectedContactProfile.preferredContact,
      commStatus:
        contactCommsStatus?.status_label ??
        toNullableDisplay(pickFirstDefined(liveContact, ["emailStatus", "communicationStatus"])) ??
        selectedContactProfile.commStatus,
      doNotContact:
        contactCommsStatus?.do_not_contact ??
        selectedContactProfile.contact.do_not_contact ??
        null,
      massMailOptOut:
        contactCommsStatus?.mass_mail_opt_out ??
        selectedContactProfile.contact.mass_mail_opt_out ??
        null,
      smsOptIn:
        contactCommsStatus?.sms_opt_in ??
        selectedContactProfile.contact.sms_opt_in ??
        null,
      emailBounced:
        contactCommsStatus?.email_bounced ??
        selectedContactProfile.contact.email_bounced ??
        null,
      lastEmailReceived:
        formatMirrorDate(
          contactCommsStatus?.last_email_received_at ??
            selectedContactProfile.contact.last_email_received_at,
        ),
      lastEmailSent:
        formatMirrorDate(
          contactCommsStatus?.last_email_sent_at ??
            selectedContactProfile.contact.last_email_sent_at,
        ),
      timelineEventCount:
        Number(selectedContactProfile.contact.timeline_event_count || contactTimeline.length || 0),
      documentsCount:
        Number(selectedContactProfile.contact.documents_count || contactDocuments.length || 0),
      hasResume:
        selectedContactProfile.contact.has_resume ||
        contactDocuments.some((doc) => doc.is_resume && !doc.is_deleted),
      skills:
        toNullableDisplay(
          pickFirstDefined(liveContact, [
            "skills",
            "skillList",
            "skillIDList",
            "specialty",
            "specialities",
            "expertise",
          ]),
        ) ?? selectedContactProfile.skills,
    };
  }, [
    contactCommsStatus,
    contactDocuments,
    contactTimeline.length,
    selectedContactProfile,
    selectedLiveContactCompanyRecord,
    selectedLiveContactRecord,
  ]);

  const companyOverview = useMemo(() => {
    if (!selectedCompanyData) return null;
    const liveCompany = selectedLiveCompanyRecord;
    const liveLocation = formatMirrorAddress(
      pickFirstDefined(liveCompany, ["address"]),
      toNullableDisplay(pickFirstDefined(liveCompany, ["city", "addressCity"])),
      toNullableDisplay(pickFirstDefined(liveCompany, ["state", "addressState"])),
    );

    return {
      id: toNullableNumber(pickFirstDefined(liveCompany, ["id"])) ?? selectedCompanyData.id,
      name: toNullableDisplay(pickFirstDefined(liveCompany, ["name"])) ?? selectedCompanyData.name,
      industry: toNullableDisplay(pickFirstDefined(liveCompany, ["industry"])) ?? selectedCompanyData.industry,
      website: toNullableDisplay(pickFirstDefined(liveCompany, ["url", "website"])) ?? selectedCompanyData.website,
      phone: toNullableDisplay(pickFirstDefined(liveCompany, ["phone", "mainPhone"])) ?? selectedCompanyData.phone,
      location: liveLocation === "-" ? selectedCompanyData.location : liveLocation,
      raw: liveCompany || selectedCompanyData.raw,
    };
  }, [selectedCompanyData, selectedLiveCompanyRecord]);

  const companyContactsView = useMemo(() => {
    const liveRows = Array.isArray(liveCompanyDetail?.contacts) ? liveCompanyDetail.contacts : [];
    if (liveRows.length) {
      return liveRows.map((row, index) => {
        const record = asRecord(row) || {};
        const bullhornId = toNullableNumber(record.id);
        const mapped = bullhornId ? allContactRowsById.get(bullhornId) : null;
        const name =
          toNullableDisplay(
            pickFirstDefined(record, [
              "name",
              "firstName",
            ]),
          ) ||
          [toNullableDisplay(pickFirstDefined(record, ["firstName"])), toNullableDisplay(pickFirstDefined(record, ["lastName"]))]
            .filter(Boolean)
            .join(" ") ||
          "Unknown";

        return {
          key: `live-${bullhornId || index}`,
          bullhornId,
          name,
          title: toNullableDisplay(pickFirstDefined(record, ["occupation"])) || "-",
          email: toNullableDisplay(pickFirstDefined(record, ["email"])) || "-",
          mappedRow: mapped || null,
        };
      });
    }

    if (!selectedCompanyData) return [];
    return selectedCompanyData.contacts.map((row) => ({
      key: `mirror-${row.contact.bullhorn_id}`,
      bullhornId: row.contact.bullhorn_id,
      name: row.fullName,
      title: row.jobTitle,
      email: row.workEmail,
      mappedRow: row,
    }));
  }, [allContactRowsById, liveCompanyDetail?.contacts, selectedCompanyData]);

  useEffect(() => {
    if (!selectedContactProfile) {
      setLocalNoteDraft("");
      setLocalStatusDraft({
        status: "",
        commStatusLabel: "",
        preferredContact: "",
        doNotContact: false,
        massMailOptOut: false,
        smsOptIn: false,
        emailBounced: false,
      });
      return;
    }

    const statusValue = contactOverview?.status || selectedContactProfile.status;
    const commStatusValue = contactOverview?.commStatus || selectedContactProfile.commStatus;
    const preferredContactValue = contactOverview?.preferredContact || selectedContactProfile.preferredContact;
    setLocalStatusDraft({
      status: statusValue === "-" ? "" : statusValue,
      commStatusLabel: commStatusValue === "-" ? "" : commStatusValue,
      preferredContact: preferredContactValue === "-" ? "" : preferredContactValue,
      doNotContact: Boolean(contactOverview?.doNotContact),
      massMailOptOut: Boolean(contactOverview?.massMailOptOut),
      smsOptIn: Boolean(contactOverview?.smsOptIn),
      emailBounced: Boolean(contactOverview?.emailBounced),
    });
  }, [selectedContactProfile, contactOverview]);

  const resetSelectedContactProfile = useCallback(() => {
    setSelectedContactProfile(null);
    setUrlContactId(null);
    setLiveContactDetail(null);
    setContactTimeline([]);
    setContactDocuments([]);
    setContactCommsStatus(null);
    setContactDetailLoading(false);
    setContactTimelineLoading(false);
    setContactDocumentsLoading(false);
    setContactCommsLoading(false);
    setContactActiveTab("overview");
  }, []);

  const openContactProfile = useCallback(async (
    row: ContactDisplayRow,
    options?: { preserveActiveTab?: boolean },
  ) => {
    const requestId = contactDetailRequestIdRef.current + 1;
    contactDetailRequestIdRef.current = requestId;
    setSelectedCompanyProfile(null);
    if (!options?.preserveActiveTab) setContactActiveTab("overview");
    setSelectedContactProfile(row);
    setLiveContactDetail(null);
    setContactTimeline([]);
    setContactDocuments([]);
    setContactCommsStatus(null);
    setContactTimelineLoading(true);
    setContactDocumentsLoading(true);
    setContactCommsLoading(true);
    if (!liveDetailApiSupported) {
      setContactDetailLoading(false);
    } else {
      setContactDetailLoading(true);
    }

    const livePromise = liveDetailApiSupported
      ? getBullhornLiveContactDetail(ADMIN_PROFILE, row.contact.bullhorn_id, { preferLive: false })
      : Promise.resolve({ success: true, data: null } as Awaited<ReturnType<typeof getBullhornLiveContactDetail>>);
    const timelinePromise = parityApiSupported
      ? getBullhornContactTimeline(ADMIN_PROFILE, row.contact.bullhorn_id, { limit: 100, offset: 0 })
      : Promise.resolve({ success: true, data: { rows: [], total: 0, limit: 100, offset: 0 } } as Awaited<
        ReturnType<typeof getBullhornContactTimeline>
      >);
    const documentsPromise = parityApiSupported
      ? getBullhornContactDocuments(ADMIN_PROFILE, row.contact.bullhorn_id, { limit: 100, offset: 0 })
      : Promise.resolve({ success: true, data: { rows: [], total: 0, limit: 100, offset: 0 } } as Awaited<
        ReturnType<typeof getBullhornContactDocuments>
      >);
    const commsPromise = parityApiSupported
      ? getBullhornContactCommsStatus(ADMIN_PROFILE, row.contact.bullhorn_id)
      : Promise.resolve({ success: true, data: null } as Awaited<
        ReturnType<typeof getBullhornContactCommsStatus>
      >);

    const [liveResult, timelineResult, documentsResult, commsResult] = await Promise.all([
      livePromise,
      timelinePromise,
      documentsPromise,
      commsPromise,
    ]);
    if (contactDetailRequestIdRef.current !== requestId) return;

    if (liveResult.success && liveResult.data) {
      setLiveContactDetail(liveResult.data);
    } else if (liveResult.error) {
      if (liveResult.error.toLowerCase().includes("unknown action")) {
        setLiveDetailApiSupported(false);
        toast.info("Live Bullhorn detail fetch is not deployed yet. Showing mirrored profile data.");
      } else {
        toast.error(`Live Bullhorn contact fetch failed: ${liveResult.error}`);
      }
    }

    if (timelineResult.success && timelineResult.data) {
      setContactTimeline(Array.isArray(timelineResult.data.rows) ? timelineResult.data.rows : []);
    } else if (timelineResult.error) {
      if (timelineResult.error.toLowerCase().includes("unknown action")) {
        setParityApiSupported(false);
      } else {
        toast.error(`Contact timeline fetch failed: ${timelineResult.error}`);
      }
    }

    if (documentsResult.success && documentsResult.data) {
      setContactDocuments(Array.isArray(documentsResult.data.rows) ? documentsResult.data.rows : []);
    } else if (documentsResult.error) {
      if (documentsResult.error.toLowerCase().includes("unknown action")) {
        setParityApiSupported(false);
      } else {
        toast.error(`Contact documents fetch failed: ${documentsResult.error}`);
      }
    }

    if (commsResult.success) {
      setContactCommsStatus(commsResult.data || null);
    } else if (commsResult.error) {
      if (commsResult.error.toLowerCase().includes("unknown action")) {
        setParityApiSupported(false);
      } else {
        toast.error(`Contact communication status fetch failed: ${commsResult.error}`);
      }
    }

    setContactDetailLoading(false);
    setContactTimelineLoading(false);
    setContactDocumentsLoading(false);
    setContactCommsLoading(false);
  }, [liveDetailApiSupported, parityApiSupported]);

  const openCompanyProfile = useCallback(async (row: ContactDisplayRow) => {
    const requestId = companyDetailRequestIdRef.current + 1;
    companyDetailRequestIdRef.current = requestId;
    resetSelectedContactProfile();
    setSelectedCompanyProfile(row);
    setLiveCompanyDetail(null);
    if (!liveDetailApiSupported) {
      setCompanyDetailLoading(false);
      return;
    }
    setCompanyDetailLoading(true);

    const companyId = extractCompanyIdFromRow(row);
    if (companyId === null) {
      setCompanyDetailLoading(false);
      return;
    }

    const result = await getBullhornLiveCompanyDetail(ADMIN_PROFILE, companyId, { preferLive: false });
    if (companyDetailRequestIdRef.current !== requestId) return;

    if (result.success && result.data) {
      setLiveCompanyDetail(result.data);
    } else if (result.error) {
      if (result.error.toLowerCase().includes("unknown action")) {
        setLiveDetailApiSupported(false);
        toast.info("Live Bullhorn detail fetch is not deployed yet. Showing mirrored profile data.");
      } else {
        toast.error(`Live Bullhorn company fetch failed: ${result.error}`);
      }
    }
    setCompanyDetailLoading(false);
  }, [liveDetailApiSupported, resetSelectedContactProfile]);

  const saveLocalNote = useCallback(async () => {
    if (!selectedContactProfile) return;
    const noteText = localNoteDraft.trim();
    if (!noteText) {
      toast.error("Enter note text before saving");
      return;
    }

    setLocalNoteSaving(true);
    try {
      const result = await createBullhornLocalContactNote(
        ADMIN_PROFILE,
        selectedContactProfile.contact.bullhorn_id,
        noteText,
      );
      if (!result.success) {
        toast.error(result.error || "Failed to save local note");
        return;
      }

      toast.success("Local note saved");
      setLocalNoteDraft("");
      await Promise.all([
        openContactProfile(selectedContactProfile, { preserveActiveTab: true }),
        loadBullhornMirrorContacts({ silent: true, reset: true }),
      ]);
    } catch {
      toast.error("Failed to save local note");
    } finally {
      setLocalNoteSaving(false);
    }
  }, [localNoteDraft, selectedContactProfile, openContactProfile, loadBullhornMirrorContacts]);

  const saveLocalStatus = useCallback(async () => {
    if (!selectedContactProfile) return;
    setLocalStatusSaving(true);
    try {
      const result = await updateBullhornLocalContactStatus(
        ADMIN_PROFILE,
        selectedContactProfile.contact.bullhorn_id,
        {
          status: localStatusDraft.status.trim() || null,
          commStatusLabel: localStatusDraft.commStatusLabel.trim() || null,
          preferredContact: localStatusDraft.preferredContact.trim() || null,
          doNotContact: localStatusDraft.doNotContact,
          massMailOptOut: localStatusDraft.massMailOptOut,
          smsOptIn: localStatusDraft.smsOptIn,
          emailBounced: localStatusDraft.emailBounced,
        },
      );
      if (!result.success) {
        toast.error(result.error || "Failed to update local status");
        return;
      }

      toast.success("Local status updated");
      await Promise.all([
        openContactProfile(selectedContactProfile, { preserveActiveTab: true }),
        loadBullhornMirrorContacts({ silent: true, reset: true }),
      ]);
    } catch {
      toast.error("Failed to update local status");
    } finally {
      setLocalStatusSaving(false);
    }
  }, [localStatusDraft, selectedContactProfile, openContactProfile, loadBullhornMirrorContacts]);

  const saveBatchLocalStatus = useCallback(async () => {
    const contactIds = Array.from(selectedContactIds);
    if (!contactIds.length) {
      toast.error("Select at least one contact first");
      return;
    }

    const payload = {
      status: batchStatusDraft.status.trim() || undefined,
      commStatusLabel: batchStatusDraft.commStatusLabel.trim() || undefined,
      preferredContact: batchStatusDraft.preferredContact.trim() || undefined,
      doNotContact: normalizeTriStateBoolean(batchStatusDraft.doNotContact),
      massMailOptOut: normalizeTriStateBoolean(batchStatusDraft.massMailOptOut),
      smsOptIn: normalizeTriStateBoolean(batchStatusDraft.smsOptIn),
      emailBounced: normalizeTriStateBoolean(batchStatusDraft.emailBounced),
    };

    const hasAnyChange = Object.values(payload).some((value) => value !== undefined);
    if (!hasAnyChange) {
      toast.error("Set at least one field for batch update");
      return;
    }

    setBatchStatusSaving(true);
    try {
      const result = await updateBullhornLocalContactStatusBatch(
        ADMIN_PROFILE,
        contactIds,
        payload,
      );
      if (!result.success || !result.data) {
        toast.error(result.error || "Batch status update failed");
        return;
      }

      const failed = Number(result.data.failed || 0);
      const updated = Number(result.data.updated || 0);
      if (failed > 0) {
        toast.warning(`Updated ${updated} contacts (${failed} failed)`);
      } else {
        toast.success(`Updated ${updated} contacts`);
      }

      setIsBatchStatusDialogOpen(false);
      await loadBullhornMirrorContacts({ silent: true, reset: true });
    } catch {
      toast.error("Batch status update failed");
    } finally {
      setBatchStatusSaving(false);
    }
  }, [batchStatusDraft, selectedContactIds, loadBullhornMirrorContacts]);

  const loadLocalCompanyNotes = useCallback(async (companyId: number, options: { silent?: boolean } = {}) => {
    try {
      const result = await listBullhornLocalCompanyNotes(ADMIN_PROFILE, companyId, { limit: 50, offset: 0 });
      if (!result.success || !result.data) {
        if (!options.silent) toast.error(result.error || "Failed to load local company notes");
        return;
      }
      setLocalCompanyNotes(result.data.rows || []);
    } catch {
      if (!options.silent) toast.error("Failed to load local company notes");
    }
  }, []);

  const saveLocalCompanyNote = useCallback(async () => {
    if (!selectedCompanyProfile) return;
    const companyId = extractCompanyIdFromRow(selectedCompanyProfile);
    if (!companyId) {
      toast.error("No company ID available for this profile");
      return;
    }

    const noteText = localCompanyNoteDraft.trim();
    if (!noteText) {
      toast.error("Enter note text before saving");
      return;
    }

    setLocalCompanyNoteSaving(true);
    try {
      const result = await createBullhornLocalCompanyNote(
        ADMIN_PROFILE,
        companyId,
        noteText,
      );
      if (!result.success) {
        toast.error(result.error || "Failed to save local company note");
        return;
      }

      toast.success("Local company note saved");
      setLocalCompanyNoteDraft("");
      await loadLocalCompanyNotes(companyId, { silent: true });
    } catch {
      toast.error("Failed to save local company note");
    } finally {
      setLocalCompanyNoteSaving(false);
    }
  }, [loadLocalCompanyNotes, localCompanyNoteDraft, selectedCompanyProfile]);

  useEffect(() => {
    if (!urlContactId) {
      if (selectedContactProfile) {
        resetSelectedContactProfile();
      }
      return;
    }

    if (selectedContactProfile?.contact.bullhorn_id === urlContactId) return;
    const row = allContactRowsById.get(urlContactId);
    if (!row) return;
    void openContactProfile(row, { preserveActiveTab: true });
  }, [urlContactId, allContactRowsById, openContactProfile, selectedContactProfile, resetSelectedContactProfile]);

  useEffect(() => {
    if (!selectedCompanyProfile) {
      setLocalCompanyNotes([]);
      setLocalCompanyNoteDraft("");
      return;
    }
    const companyId = extractCompanyIdFromRow(selectedCompanyProfile);
    if (!companyId) {
      setLocalCompanyNotes([]);
      return;
    }
    void loadLocalCompanyNotes(companyId, { silent: true });
  }, [selectedCompanyProfile, loadLocalCompanyNotes]);

  const visibleContactIds = useMemo(
    () => displayedContacts.map(({ contact }) => contact.bullhorn_id),
    [displayedContacts],
  );

  useEffect(() => {
    setSelectedContactIds((prev) => {
      if (prev.size === 0) return prev;
      const visibleSet = new Set(visibleContactIds);
      const next = new Set(Array.from(prev).filter((id) => visibleSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleContactIds]);

  const allVisibleSelected = visibleContactIds.length > 0 && visibleContactIds.every((id) => selectedContactIds.has(id));
  const partiallySelected = !allVisibleSelected && visibleContactIds.some((id) => selectedContactIds.has(id));

  const toggleSelectAllVisible = useCallback((checked: boolean | "indeterminate") => {
    setSelectedContactIds((prev) => {
      if (visibleContactIds.length === 0) return prev;
      const shouldSelectAll = checked !== false;
      const next = new Set(prev);
      if (shouldSelectAll) {
        visibleContactIds.forEach((id) => next.add(id));
      } else {
        visibleContactIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  }, [visibleContactIds]);

  const toggleSelectContact = useCallback((bullhornId: number, checked: boolean | "indeterminate") => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (checked !== false) {
        next.add(bullhornId);
      } else {
        next.delete(bullhornId);
      }
      return next;
    });
  }, []);

  const openAddToListDialog = useCallback(() => {
    if (selectedContactIds.size === 0) {
      toast.error("Select at least one contact first");
      return;
    }
    setNewDistributionListName("");
    if (!targetDistributionListId && distributionLists.length > 0) {
      setTargetDistributionListId(distributionLists[0].id);
    }
    setIsAddToListDialogOpen(true);
    if (distributionLists.length === 0) {
      void loadDistributionLists();
    }
  }, [distributionLists, loadDistributionLists, selectedContactIds, targetDistributionListId]);

  const addSelectedContactsToList = useCallback(async () => {
    if (selectedContactIds.size === 0) {
      toast.error("Select at least one contact first");
      return;
    }

    setAddToListLoading(true);
    try {
      let listId = targetDistributionListId.trim();
      const createName = newDistributionListName.trim();

      if (createName) {
        const createResult = await createDistributionList(ADMIN_PROFILE, createName);
        if (!createResult.success || !createResult.data) {
          toast.error(createResult.error || "Failed to create distribution list");
          return;
        }
        listId = createResult.data.id;
      }

      if (!listId) {
        toast.error("Choose a distribution list or create a new one");
        return;
      }

      const addResult = await addContactsToDistributionList(
        ADMIN_PROFILE,
        listId,
        Array.from(selectedContactIds),
      );

      if (!addResult.success || !addResult.data) {
        toast.error(addResult.error || "Failed to add contacts to distribution list");
        return;
      }

      const inserted = Number(addResult.data.inserted || 0);
      const skipped = Number(addResult.data.skipped || 0);
      toast.success(
        skipped > 0
          ? `Added ${inserted} contacts (${skipped} already in list)`
          : `Added ${inserted} contacts to distribution list`,
      );

      setSelectedContactIds(new Set());
      setIsAddToListDialogOpen(false);
      setTargetDistributionListId(listId);
      setNewDistributionListName("");
      await loadDistributionLists({ silent: true });
    } finally {
      setAddToListLoading(false);
    }
  }, [
    loadDistributionLists,
    newDistributionListName,
    selectedContactIds,
    targetDistributionListId,
  ]);

  const toggleSort = (key: ContactSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "id" ? "desc" : "asc");
  };

  const renderSortIcon = (key: ContactSortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-60" />;
    return sortDirection === "asc"
      ? <ArrowUp className="ml-1 h-3.5 w-3.5" />
      : <ArrowDown className="ml-1 h-3.5 w-3.5" />;
  };

  const headerSortButtonClass = tableOnly
    ? "h-8 w-full justify-between rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/85 hover:bg-primary/15"
    : "h-7 px-1 text-sm font-medium";
  const stickyHeadBaseClass = tableOnly
    ? "sticky top-0 z-30 h-11 bg-card text-foreground shadow-[inset_0_-1px_0_hsl(var(--border))]"
    : "";

  if (profileName !== ADMIN_PROFILE) {
    return null;
  }

  return (
    <AppLayout
      title="Contact Sync"
      description={tableOnly ? "Bullhorn mirrored ClientContact table view" : "Background read-only sync of Bullhorn contacts (ClientContact)"}
    >
      {!tableOnly && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Bullhorn Contact Sync
                </CardTitle>
                <CardDescription>
                  Full read-only sync from Bullhorn ClientContact (no write/delete operations against Bullhorn).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getLagStatusColor(syncHealth?.lagStatus)}>
                  {formatLagLabel(syncHealth)}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadBullhornSyncData()}
                  disabled={syncJobLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${syncJobLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startSync("test")}
                  disabled={syncActionLoading || !!activeSyncJob}
                >
                  {syncActionLoading ? "Starting..." : activeSyncJob ? "Contact Sync Running" : "Start 5-Contact Test"}
                </Button>
                <Button size="sm" onClick={() => startSync("full")} disabled={syncActionLoading || !!activeSyncJob}>
                  {syncActionLoading ? "Starting..." : activeSyncJob ? "Contact Sync Running" : "Start Full Contact Sync"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={runScheduledSyncNow}
                  disabled={scheduledSyncActionLoading}
                >
                  {scheduledSyncActionLoading ? "Checking..." : "Run Scheduled Check"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Mirrored Contacts</p>
                <p className="text-2xl font-semibold">{mirrorCount.toLocaleString()}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest Sync Run</p>
                <p className="font-medium">{latestSyncJob?.id?.slice(0, 8) || "-"}</p>
                {latestSyncJob && (
                  <Badge variant="outline" className={`mt-2 ${getStatusColor(latestSyncJob.status)}`}>
                    {latestSyncJob.status}
                  </Badge>
                )}
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Progress</p>
                <p className="font-medium">
                  {latestSyncJob
                    ? latestExpectedTotal
                      ? `${latestSyncJob.total_synced.toLocaleString()} / ${latestExpectedTotal.toLocaleString()}`
                      : `${latestSyncJob.total_synced.toLocaleString()} synced`
                    : "-"}
                </p>
                <Progress value={progressPercent} className="mt-2 h-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Next scheduled: {syncHealth?.nextScheduledRunAt ? formatDateTime(syncHealth.nextScheduledRunAt) : "-"}
                </p>
              </div>
            </div>

            <div className="rounded-md border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Settings2 className="h-4 w-4" />
                    Scheduler Settings
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Controls automatic Bullhorn mirror sync cadence.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Enabled</span>
                  <Switch
                    checked={syncSettingsDraft.enabled}
                    onCheckedChange={(checked) => setSyncSettingsDraft((prev) => ({ ...prev, enabled: checked }))}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Hour (UTC)</p>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={syncSettingsDraft.targetHourUtc}
                    onChange={(e) => setSyncSettingsDraft((prev) => ({ ...prev, targetHourUtc: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Minute (UTC)</p>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={syncSettingsDraft.targetMinuteUtc}
                    onChange={(e) => setSyncSettingsDraft((prev) => ({ ...prev, targetMinuteUtc: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Min Interval (h)</p>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={syncSettingsDraft.minIntervalHours}
                    onChange={(e) => setSyncSettingsDraft((prev) => ({ ...prev, minIntervalHours: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lag Alert (h)</p>
                  <Input
                    type="number"
                    min={1}
                    max={336}
                    value={syncSettingsDraft.maxLagHours}
                    onChange={(e) => setSyncSettingsDraft((prev) => ({ ...prev, maxLagHours: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Batch Size</p>
                  <Input
                    type="number"
                    min={5}
                    max={2000}
                    value={syncSettingsDraft.batchSize}
                    onChange={(e) => setSyncSettingsDraft((prev) => ({ ...prev, batchSize: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Batches / Invocation</p>
                  <Input
                    type="number"
                    min={1}
                    max={40}
                    value={syncSettingsDraft.maxBatchesPerInvocation}
                    onChange={(e) =>
                      setSyncSettingsDraft((prev) => ({ ...prev, maxBatchesPerInvocation: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Include Deleted</p>
                  <div className="flex h-10 items-center rounded-md border px-3">
                    <Switch
                      checked={syncSettingsDraft.includeDeleted}
                      onCheckedChange={(checked) => setSyncSettingsDraft((prev) => ({ ...prev, includeDeleted: checked }))}
                    />
                    <span className="ml-2 text-sm text-muted-foreground">
                      {syncSettingsDraft.includeDeleted ? "Include deleted contacts" : "Skip deleted contacts"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={saveSyncSettings} disabled={syncSettingsSaving}>
                  {syncSettingsSaving ? "Saving..." : "Save Scheduler Settings"}
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Synced</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        No sync runs yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    syncJobs.map((job) => {
                      const expectedTotal = getExpectedTotal(job);
                      return (
                        <TableRow key={job.id}>
                          <TableCell className="font-mono text-xs">{job.id.slice(0, 12)}...</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(job.status)}>
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{job.total_synced.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            {expectedTotal ? expectedTotal.toLocaleString() : "-"}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            <div className="flex items-center justify-end gap-1">
                              <Clock className="h-3 w-3" />
                              {job.started_at
                                ? formatDistanceToNow(new Date(job.started_at), { addSuffix: true })
                                : "-"}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Card
        className={
          tableOnly
            ? "border-0 bg-transparent shadow-none -mx-4 -mb-4 md:-mx-6 md:-mb-6 lg:-mx-7 lg:-mb-7 h-[calc(100dvh-5rem)] md:h-[calc(100dvh-6rem)] lg:h-[calc(100dvh-6.25rem)] flex flex-col overflow-hidden"
            : undefined
        }
      >
        <CardHeader
          className={tableOnly ? "border-b bg-background px-3 py-2" : undefined}
        >
          <div className="flex w-full items-center">
            <div className="flex w-full flex-wrap items-center gap-1.5">
              <Input
                className="h-8 w-[240px] min-w-[200px] md:w-[300px]"
                value={contactsSearchDraft}
                onChange={(e) => setContactsSearchDraft(e.target.value)}
                placeholder="Search by name, email, company, title, city"
              />
              <Button
                size="sm"
                variant="default"
                className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setIsFiltersDialogOpen(true)}
              >
                Filters{appliedFilters.length ? ` (${appliedFilters.length})` : ""}
              </Button>
              <Button
                size="sm"
                variant="default"
                className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={openAddToListDialog}
                disabled={selectedContactIds.size === 0}
              >
                Add to List ({selectedContactIds.size})
              </Button>
              <Button
                size="sm"
                variant="default"
                className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setBatchStatusDraft({
                    status: "",
                    commStatusLabel: "",
                    preferredContact: "",
                    doNotContact: "keep",
                    massMailOptOut: "keep",
                    smsOptIn: "keep",
                    emailBounced: "keep",
                  });
                  setIsBatchStatusDialogOpen(true);
                }}
                disabled={selectedContactIds.size === 0}
              >
                Batch Status ({selectedContactIds.size})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  setContactsSearch(contactsSearchDraft.trim());
                }}
              >
                Search
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  setContactsSearchDraft("");
                  setContactsSearch("");
                  setFilterRows([]);
                  setAppliedFilters([]);
                }}
              >
                Clear
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8"
                onClick={() => {
                  void Promise.all([
                    loadBullhornMirrorContacts({ reset: true }),
                    loadBullhornSyncData({ silent: true }),
                  ]);
                }}
                disabled={contactsLoading}
              >
                <RefreshCw className={`h-4 w-4 ${contactsLoading ? "animate-spin" : ""}`} />
              </Button>
              <Badge variant="outline" className={`h-8 px-2 text-xs ${getLagStatusColor(syncHealth?.lagStatus)}`}>
                {formatLagLabel(syncHealth)}
              </Badge>
              <Badge variant="outline" className="h-8 px-2 text-xs">
                {contactsQueryMeta?.queryMode === "rpc" ? "DB-RPC" : "Legacy"} {contactsQueryMeta?.queryDurationMs ?? 0}ms
              </Badge>
            </div>
          </div>
        </CardHeader>
        <Dialog open={isFiltersDialogOpen} onOpenChange={setIsFiltersDialogOpen}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Contact Filters</DialogTitle>
              <DialogDescription>
                Same row values = OR. Different rows = AND.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterRows((prev) => [...prev, createFilterDraftRow()])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Filter Row
                </Button>
              </div>

              {filterRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No filters added yet.
                </p>
              ) : (
                filterRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 md:col-span-3">
                      <Select
                        value={row.field}
                        onValueChange={(value) =>
                          setFilterRows((prev) =>
                            prev.map((item) => (item.id === row.id ? { ...item, field: value as BullhornContactFilterField } : item)),
                          )
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Field" />
                        </SelectTrigger>
                        <SelectContent>
                          {FILTER_FIELD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-12 md:col-span-2">
                      <Select
                        value={row.operator}
                        onValueChange={(value) =>
                          setFilterRows((prev) =>
                            prev.map((item) => (item.id === row.id ? { ...item, operator: value as BullhornContactFilterOperator } : item)),
                          )
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Operator" />
                        </SelectTrigger>
                        <SelectContent>
                          {FILTER_OPERATOR_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-11 md:col-span-6">
                      <Input
                        className="h-9"
                        value={row.valueInput}
                        onChange={(e) =>
                          setFilterRows((prev) =>
                            prev.map((item) => (item.id === row.id ? { ...item, valueInput: e.target.value } : item)),
                          )
                        }
                        placeholder="Values (comma or OR-separated)"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setFilterRows((prev) => prev.filter((item) => item.id !== row.id))}
                        aria-label="Remove filter row"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setFilterRows([]);
                  setAppliedFilters([]);
                }}
              >
                Clear Filters
              </Button>
              <Button variant="outline" onClick={() => setIsFiltersDialogOpen(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setAppliedFilters(buildAppliedFilters(filterRows));
                  setIsFiltersDialogOpen(false);
                }}
              >
                Apply Filters
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isAddToListDialogOpen} onOpenChange={setIsAddToListDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Add Contacts to Distribution List</DialogTitle>
              <DialogDescription>
                Selected contacts: {selectedContactIds.size}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Choose existing list</p>
                <div className="flex items-center gap-2">
                  <Select value={targetDistributionListId} onValueChange={setTargetDistributionListId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={distributionListsLoading ? "Loading lists..." : "Select a list"} />
                    </SelectTrigger>
                    <SelectContent>
                      {distributionLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name} ({list.contact_count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => loadDistributionLists()}
                    disabled={distributionListsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${distributionListsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Or create new list</p>
                <Input
                  className="h-9"
                  value={newDistributionListName}
                  onChange={(e) => setNewDistributionListName(e.target.value)}
                  placeholder="e.g. PE London shortlist"
                />
                <p className="text-xs text-muted-foreground">
                  If you fill this field, a new list will be created and used automatically.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddToListDialogOpen(false)} disabled={addToListLoading}>
                Cancel
              </Button>
              <Button onClick={addSelectedContactsToList} disabled={addToListLoading}>
                {addToListLoading ? "Adding..." : "Add Selected Contacts"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isBatchStatusDialogOpen} onOpenChange={setIsBatchStatusDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Batch Update Contact Status</DialogTitle>
              <DialogDescription>
                Update selected contacts in local CRM mirror only. Unset fields stay unchanged.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <Input
                  className="h-9"
                  value={batchStatusDraft.status}
                  onChange={(e) => setBatchStatusDraft((prev) => ({ ...prev, status: e.target.value }))}
                  placeholder="Contact status"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Comms Status</p>
                <Input
                  className="h-9"
                  value={batchStatusDraft.commStatusLabel}
                  onChange={(e) => setBatchStatusDraft((prev) => ({ ...prev, commStatusLabel: e.target.value }))}
                  placeholder="Comms status"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Preferred Contact</p>
                <Input
                  className="h-9"
                  value={batchStatusDraft.preferredContact}
                  onChange={(e) => setBatchStatusDraft((prev) => ({ ...prev, preferredContact: e.target.value }))}
                  placeholder="Preferred contact channel"
                />
              </div>
              {[
                { key: "doNotContact", label: "Do Not Contact" },
                { key: "massMailOptOut", label: "Mass Mail Opt-out" },
                { key: "smsOptIn", label: "SMS Opt-in" },
                { key: "emailBounced", label: "Email Bounced" },
              ].map((row) => (
                <div key={row.key} className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</p>
                  <Select
                    value={batchStatusDraft[row.key as keyof BatchStatusDraft] as string}
                    onValueChange={(value) =>
                      setBatchStatusDraft((prev) => ({
                        ...prev,
                        [row.key]: value as BatchStatusDraft["doNotContact"],
                      }))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep">Keep current</SelectItem>
                      <SelectItem value="true">Set true</SelectItem>
                      <SelectItem value="false">Set false</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBatchStatusDialogOpen(false)} disabled={batchStatusSaving}>
                Cancel
              </Button>
              <Button onClick={saveBatchLocalStatus} disabled={batchStatusSaving}>
                {batchStatusSaving ? "Updating..." : "Apply to Selected"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <CardContent className={tableOnly ? "px-0 pb-0 flex flex-col flex-1 min-h-0" : "space-y-3"}>
          <div
            className={`w-full ${
              tableOnly
                ? "flex-1 min-h-0 border-t-2 border-primary rounded-none bg-background shadow-[inset_0_1px_0_rgba(15,15,15,0.9)]"
                : ""
            }`}
          >
            <div ref={tableViewportRef} className={`w-full ${tableOnly ? "h-full overflow-y-scroll overflow-x-scroll crm-grid-shell pr-3" : "overflow-x-auto"}`}>
            <table className="w-[2600px] min-w-[2600px] table-fixed text-base">
              <TableHeader className={tableOnly ? "[&_tr]:border-b [&_tr]:border-border/60" : "[&_tr]:border-0"}>
                <TableRow className={tableOnly ? "border-b border-border/70 bg-card hover:bg-card" : "border-0 hover:bg-transparent"}>
                  <TableHead className={`${stickyHeadBaseClass} w-[140px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allVisibleSelected ? true : partiallySelected ? "indeterminate" : false}
                        onCheckedChange={toggleSelectAllVisible}
                        aria-label="Select all visible contacts"
                        className="h-4 w-4 shrink-0 border-border"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`${headerSortButtonClass} ${tableOnly ? "w-auto min-w-0 flex-1 justify-between px-1.5" : ""}`}
                        onClick={() => toggleSort("id")}
                      >
                        ID {renderSortIcon("id")}
                      </Button>
                    </div>
                  </TableHead>
                  <TableHead className={`${stickyHeadBaseClass} w-[220px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <Button variant="ghost" size="sm" className={headerSortButtonClass} onClick={() => toggleSort("name")}>
                      Name {renderSortIcon("name")}
                    </Button>
                  </TableHead>
                  <TableHead className={`${stickyHeadBaseClass} w-[240px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <Button variant="ghost" size="sm" className={headerSortButtonClass} onClick={() => toggleSort("jobTitle")}>
                      Job Title {renderSortIcon("jobTitle")}
                    </Button>
                  </TableHead>
                  <TableHead className={`${stickyHeadBaseClass} w-[240px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <Button variant="ghost" size="sm" className={headerSortButtonClass} onClick={() => toggleSort("company")}>
                      Company {renderSortIcon("company")}
                    </Button>
                  </TableHead>
                  <TableHead className={`${stickyHeadBaseClass} w-[260px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <Button variant="ghost" size="sm" className={headerSortButtonClass} onClick={() => toggleSort("workEmail")}>
                      Work Email {renderSortIcon("workEmail")}
                    </Button>
                  </TableHead>
                  <TableHead className={`${stickyHeadBaseClass} w-[125px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <Button variant="ghost" size="sm" className={headerSortButtonClass} onClick={() => toggleSort("status")}>
                      Status {renderSortIcon("status")}
                    </Button>
                  </TableHead>
                  <TableHead className={`${stickyHeadBaseClass} w-[160px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <Button variant="ghost" size="sm" className={headerSortButtonClass} onClick={() => toggleSort("workPhone")}>
                      Work Phone {renderSortIcon("workPhone")}
                    </Button>
                  </TableHead>
                  <TableHead className={`${stickyHeadBaseClass} w-[180px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <Button variant="ghost" size="sm" className={headerSortButtonClass} onClick={() => toggleSort("consultant")}>
                      Consultant {renderSortIcon("consultant")}
                    </Button>
                  </TableHead>
                  <TableHead className={`${stickyHeadBaseClass} w-[220px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <Button variant="ghost" size="sm" className={headerSortButtonClass} onClick={() => toggleSort("address")}>
                      Address {renderSortIcon("address")}
                    </Button>
                  </TableHead>
                  <TableHead className={`${stickyHeadBaseClass} w-[240px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <Button variant="ghost" size="sm" className={headerSortButtonClass} onClick={() => toggleSort("lastNote")}>
                      Last Note {renderSortIcon("lastNote")}
                    </Button>
                  </TableHead>
                  <TableHead className={`${stickyHeadBaseClass} w-[130px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <Button variant="ghost" size="sm" className={headerSortButtonClass} onClick={() => toggleSort("dateAdded")}>
                      Date Added {renderSortIcon("dateAdded")}
                    </Button>
                  </TableHead>
                  <TableHead className={`${stickyHeadBaseClass} w-[130px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <Button variant="ghost" size="sm" className={headerSortButtonClass} onClick={() => toggleSort("dateLastModified")}>
                      Last Modified {renderSortIcon("dateLastModified")}
                    </Button>
                  </TableHead>
                  <TableHead className={`${stickyHeadBaseClass} w-[370px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/70 last:border-r-0" : ""}`}>
                    <Button variant="ghost" size="sm" className={headerSortButtonClass} onClick={() => toggleSort("skills")}>
                      Skills {renderSortIcon("skills")}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={tableOnly ? "[&_tr]:border-b [&_tr]:border-border/55 [&_tr:last-child]:border-b-0" : "[&_tr]:border-0"}>
                {displayedContacts.length === 0 ? (
                  <TableRow className={tableOnly ? "border-b border-border/55 hover:bg-transparent" : "border-0 hover:bg-transparent"}>
                    <TableCell colSpan={CONTACTS_TABLE_COLUMN_COUNT} className="py-5 text-center text-base text-muted-foreground">
                      {contactsLoading ? "Loading contacts..." : "No synced contacts yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedContacts.map((row, index) => {
                    const {
                      contact,
                      workEmail,
                      fullName,
                      jobTitle,
                      company,
                      status,
                      workPhone,
                      consultant,
                      address,
                      lastNote,
                      dateAdded,
                      dateLastModified,
                      skills,
                    } = row;
                    return (
                      <TableRow
                        key={contact.bullhorn_id}
                        className={
                          tableOnly
                            ? `border-b border-border/55 ${index % 2 === 1 ? "bg-primary/5" : ""} hover:bg-primary/10`
                            : "border-0 hover:bg-transparent"
                        }
                      >
                        <TableCell className={`w-[140px] whitespace-nowrap py-3 font-mono text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`}>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedContactIds.has(contact.bullhorn_id)}
                              onCheckedChange={(checked) => toggleSelectContact(contact.bullhorn_id, checked)}
                              aria-label={`Select contact ${contact.bullhorn_id}`}
                              className="h-4 w-4 shrink-0 border-border"
                            />
                            <span>{contact.bullhorn_id}</span>
                          </div>
                        </TableCell>
                        <TableCell className={`w-[220px] py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`} title={fullName}>
                          <button
                            type="button"
                            className="block w-full truncate text-left font-medium text-primary hover:underline"
                            onClick={() => void openContactProfile(row)}
                          >
                            {fullName}
                          </button>
                        </TableCell>
                        <TableCell className={`w-[240px] py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`} title={jobTitle}>
                          <span className="block truncate">{jobTitle}</span>
                        </TableCell>
                        <TableCell className={`w-[240px] py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`} title={company}>
                          <button
                            type="button"
                            className="block w-full truncate text-left text-foreground hover:text-primary hover:underline"
                            onClick={() => void openCompanyProfile(row)}
                          >
                            {company}
                          </button>
                        </TableCell>
                        <TableCell className={`w-[260px] py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`}>
                          {workEmail !== "-" ? (
                            <a href={`mailto:${workEmail}`} className="block truncate text-primary hover:underline" title={workEmail}>
                              {workEmail}
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className={`w-[125px] py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`} title={status}>
                          <span className="block truncate">{status}</span>
                        </TableCell>
                        <TableCell className={`w-[160px] py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`} title={workPhone}>
                          <span className="block truncate">{workPhone}</span>
                        </TableCell>
                        <TableCell className={`w-[180px] py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`} title={consultant}>
                          <span className="block truncate">{consultant}</span>
                        </TableCell>
                        <TableCell className={`w-[220px] py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`} title={address}>
                          <span className="block truncate">{address}</span>
                        </TableCell>
                        <TableCell className={`w-[320px] py-3 text-sm align-top ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`} title={lastNote}>
                          <span className="block whitespace-pre-wrap break-words">{lastNote}</span>
                        </TableCell>
                        <TableCell className={`w-[130px] whitespace-nowrap py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`}>{dateAdded}</TableCell>
                        <TableCell className={`w-[130px] whitespace-nowrap py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`}>{dateLastModified}</TableCell>
                        <TableCell className={`w-[370px] py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`} title={skills}>
                          <span className="block truncate">{skills}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
                {displayedContacts.length > 0 && isLoadingMore && (
                  <TableRow className={tableOnly ? "border-b border-border/55 bg-background/80 hover:bg-transparent" : "border-0 hover:bg-transparent"}>
                    <TableCell
                      colSpan={CONTACTS_TABLE_COLUMN_COUNT}
                      className={`py-4 ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`}
                    >
                      <div className="relative h-8">
                        <div
                          className="sticky left-1/2 top-1/2 flex w-fit -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2"
                          aria-label="Loading more contacts"
                        >
                          <span
                            className="h-3 w-3 rounded-full bg-primary/80 animate-pulse"
                            style={{ animationDelay: "0ms", animationDuration: "900ms" }}
                          />
                          <span
                            className="h-3 w-3 rounded-full bg-primary/80 animate-pulse"
                            style={{ animationDelay: "150ms", animationDuration: "900ms" }}
                          />
                          <span
                            className="h-3 w-3 rounded-full bg-primary/80 animate-pulse"
                            style={{ animationDelay: "300ms", animationDuration: "900ms" }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </table>
            </div>
          </div>

          {!tableOnly && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Loaded {contacts.length.toLocaleString()} of {contactsTotal.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {isLoadingMore ? "Loading next 25..." : hasMoreContacts ? "Scroll down to load next 25" : "All contacts loaded"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={Boolean(selectedContactProfile)}
        onOpenChange={(open) => {
          if (!open) {
            resetSelectedContactProfile();
          }
        }}
      >
        <SheetContent side="right" className="w-full max-w-none p-0 sm:max-w-3xl">
          {selectedContactProfile && (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b px-6 py-4">
                <SheetTitle className="text-xl">{selectedContactProfile.fullName}</SheetTitle>
                <SheetDescription>
                  Contact Profile • Bullhorn ID {selectedContactProfile.contact.bullhorn_id}
                  {contactDetailLoading ? " • Loading CRM data..." : liveContactDetail ? " • CRM data loaded" : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <Tabs value={contactActiveTab} onValueChange={(value) => setContactActiveTab(value as ContactProfileTab)} className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="notes">Last Notes</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="raw">Raw</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <Briefcase className="h-3.5 w-3.5" />
                          Job Title
                        </p>
                        <p className="text-sm font-medium">{contactOverview?.jobTitle || selectedContactProfile.jobTitle}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          Company
                        </p>
                        <button
                          type="button"
                          className="text-left text-sm font-medium text-primary hover:underline"
                          onClick={() => void openCompanyProfile(selectedContactProfile)}
                        >
                          {contactOverview?.company || selectedContactProfile.company}
                        </button>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          Work Email
                        </p>
                        {(contactOverview?.workEmail || selectedContactProfile.workEmail) !== "-" ? (
                          <a href={`mailto:${contactOverview?.workEmail || selectedContactProfile.workEmail}`} className="text-sm font-medium text-primary hover:underline">
                            {contactOverview?.workEmail || selectedContactProfile.workEmail}
                          </a>
                        ) : (
                          <p className="text-sm font-medium">-</p>
                        )}
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          Phone
                        </p>
                        <p className="text-sm font-medium">{contactOverview?.phone || selectedContactProfile.workPhone}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          Consultant
                        </p>
                        <p className="text-sm font-medium">{contactOverview?.consultant || selectedContactProfile.consultant}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          Status
                        </p>
                        <p className="text-sm font-medium">{contactOverview?.status || selectedContactProfile.status}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          Address
                        </p>
                        <p className="text-sm font-medium">{contactOverview?.address || selectedContactProfile.address}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          Dates
                        </p>
                        <p className="text-sm font-medium">Added: {contactOverview?.dateAdded || selectedContactProfile.dateAdded}</p>
                        <p className="text-sm font-medium">Modified: {contactOverview?.dateLastModified || selectedContactProfile.dateLastModified}</p>
                        <p className="text-sm font-medium">Last Visit: {contactOverview?.lastVisit || selectedContactProfile.lastVisit}</p>
                        <p className="text-sm font-medium">Last Contacted: {contactOverview?.lastContacted || selectedContactProfile.lastContacted}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Communication Status</p>
                        {contactCommsLoading ? (
                          <p className="mb-1 text-xs text-muted-foreground">Refreshing communication state...</p>
                        ) : null}
                        <p className="text-sm font-medium">Status: {contactOverview?.commStatus || selectedContactProfile.commStatus}</p>
                        <p className="text-sm font-medium">Preferred Contact: {contactOverview?.preferredContact || selectedContactProfile.preferredContact}</p>
                        <p className="text-sm font-medium">Do Not Contact: {contactOverview?.doNotContact === null ? "-" : contactOverview?.doNotContact ? "Yes" : "No"}</p>
                        <p className="text-sm font-medium">Mass Mail Opt-Out: {contactOverview?.massMailOptOut === null ? "-" : contactOverview?.massMailOptOut ? "Yes" : "No"}</p>
                        <p className="text-sm font-medium">SMS Opt-In: {contactOverview?.smsOptIn === null ? "-" : contactOverview?.smsOptIn ? "Yes" : "No"}</p>
                        <p className="text-sm font-medium">Email Bounced: {contactOverview?.emailBounced === null ? "-" : contactOverview?.emailBounced ? "Yes" : "No"}</p>
                        <p className="text-sm font-medium">Last Email Sent: {contactOverview?.lastEmailSent || "-"}</p>
                        <p className="text-sm font-medium">Last Email Received: {contactOverview?.lastEmailReceived || "-"}</p>
                        <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Local CRM Overrides</p>
                          <div className="grid gap-2 md:grid-cols-2">
                            <Input
                              value={localStatusDraft.status}
                              onChange={(e) => setLocalStatusDraft((prev) => ({ ...prev, status: e.target.value }))}
                              placeholder="Contact status"
                              className="h-8 text-xs"
                            />
                            <Input
                              value={localStatusDraft.commStatusLabel}
                              onChange={(e) => setLocalStatusDraft((prev) => ({ ...prev, commStatusLabel: e.target.value }))}
                              placeholder="Comms status"
                              className="h-8 text-xs"
                            />
                            <Input
                              value={localStatusDraft.preferredContact}
                              onChange={(e) => setLocalStatusDraft((prev) => ({ ...prev, preferredContact: e.target.value }))}
                              placeholder="Preferred contact"
                              className="h-8 text-xs md:col-span-2"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <label className="flex items-center gap-2">
                              <Checkbox
                                checked={localStatusDraft.doNotContact}
                                onCheckedChange={(checked) =>
                                  setLocalStatusDraft((prev) => ({ ...prev, doNotContact: checked === true }))
                                }
                              />
                              Do Not Contact
                            </label>
                            <label className="flex items-center gap-2">
                              <Checkbox
                                checked={localStatusDraft.massMailOptOut}
                                onCheckedChange={(checked) =>
                                  setLocalStatusDraft((prev) => ({ ...prev, massMailOptOut: checked === true }))
                                }
                              />
                              Mass Mail Opt-Out
                            </label>
                            <label className="flex items-center gap-2">
                              <Checkbox
                                checked={localStatusDraft.smsOptIn}
                                onCheckedChange={(checked) =>
                                  setLocalStatusDraft((prev) => ({ ...prev, smsOptIn: checked === true }))
                                }
                              />
                              SMS Opt-In
                            </label>
                            <label className="flex items-center gap-2">
                              <Checkbox
                                checked={localStatusDraft.emailBounced}
                                onCheckedChange={(checked) =>
                                  setLocalStatusDraft((prev) => ({ ...prev, emailBounced: checked === true }))
                                }
                              />
                              Email Bounced
                            </label>
                          </div>
                          <div className="flex justify-end">
                            <Button size="sm" onClick={saveLocalStatus} disabled={localStatusSaving} className="h-8">
                              {localStatusSaving ? "Saving..." : "Save Local Status"}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Mirror Parity</p>
                        <p className="text-sm font-medium">Timeline Events: {(contactOverview?.timelineEventCount ?? 0).toLocaleString()}</p>
                        <p className="text-sm font-medium">Documents: {(contactOverview?.documentsCount ?? 0).toLocaleString()}</p>
                        <p className="text-sm font-medium">Has Resume: {contactOverview?.hasResume ? "Yes" : "No"}</p>
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Skills</p>
                      <p className="text-sm font-medium whitespace-pre-wrap break-words">{contactOverview?.skills || selectedContactProfile.skills}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Custom Field Snapshot</p>
                      {selectedCustomFieldEntries.length ? (
                        <div className="space-y-1.5">
                          {selectedCustomFieldEntries.map(([key, value]) => (
                            <p key={key} className="text-xs">
                              <span className="font-semibold">{key}:</span>{" "}
                              <span className="text-muted-foreground">{formatMirrorValue(value)}</span>
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No custom field summary synced for this contact yet.</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="timeline" className="space-y-3">
                    {contactTimelineLoading ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Loading full contact timeline...
                      </div>
                    ) : contactTimeline.length ? (
                      contactTimeline.map((event) => (
                        <div key={event.external_key || `${event.id}`} className="rounded-md border p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{String(event.event_type || "event").toUpperCase()}</Badge>
                              <Badge variant="secondary">{event.event_source || "source"}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{formatDateTime(event.event_at)}</p>
                          </div>
                          <p className="text-sm font-medium">{event.summary || "-"}</p>
                          {event.details ? (
                            <p className="mt-1 text-sm whitespace-pre-wrap break-words">{event.details}</p>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground">
                            Actor: {event.actor_name || "-"} • Entity: {event.entity_name || "-"} {event.entity_id ? `(${event.entity_id})` : ""}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        {!parityApiSupported
                          ? "Timeline endpoint is not deployed yet in this environment."
                          : "No timeline events synced yet for this contact."}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="notes" className="space-y-3">
                    <div className="rounded-md border p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add Local Note</p>
                      <Textarea
                        value={localNoteDraft}
                        onChange={(e) => setLocalNoteDraft(e.target.value)}
                        placeholder="Add internal CRM note (stored locally in mirrored timeline)"
                        className="min-h-[92px] text-sm"
                      />
                      <div className="mt-2 flex justify-end">
                        <Button size="sm" onClick={saveLocalNote} disabled={localNoteSaving || !localNoteDraft.trim()}>
                          {localNoteSaving ? "Saving..." : "Save Local Note"}
                        </Button>
                      </div>
                    </div>
                    {(selectedLiveContactNotes.length ? selectedLiveContactNotes : selectedContactNotes).length ? (
                      (selectedLiveContactNotes.length ? selectedLiveContactNotes : selectedContactNotes).map((note, index) => (
                        <div key={`${note.label}-${index}`} className="rounded-md border p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{note.label}</p>
                            <p className="text-xs text-muted-foreground">{note.date || "Unknown date"}</p>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words">{note.value}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        {contactDetailLoading ? "Loading notes..." : "No notes found in synced CRM payload for this contact."}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-3">
                    {contactDocumentsLoading ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Loading contact documents...
                      </div>
                    ) : contactDocuments.length ? (
                      contactDocuments.map((doc) => (
                        <div key={doc.external_key || `${doc.id}`} className="rounded-md border p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">{doc.file_name || "Unnamed file"}</p>
                              {doc.is_resume ? <Badge variant="outline">Resume</Badge> : null}
                              {doc.is_deleted ? <Badge variant="destructive">Deleted</Badge> : null}
                            </div>
                            <p className="text-xs text-muted-foreground">{formatDateTime(doc.date_last_modified || doc.date_added)}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Type: {doc.file_type || doc.content_type || "-"} • Size: {doc.file_size ? `${doc.file_size.toLocaleString()} bytes` : "-"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        {!parityApiSupported
                          ? "Documents endpoint is not deployed yet in this environment."
                          : "No documents synced yet for this contact."}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="raw">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap break-words text-xs leading-5">
                        {JSON.stringify(
                          {
                            mirror: selectedContactProfile.contact,
                            liveContact: selectedContactRaw || {},
                            communicationStatus: contactCommsStatus,
                            timelineSample: contactTimeline.slice(0, 10),
                            documentsSample: contactDocuments.slice(0, 10),
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(selectedCompanyProfile)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCompanyProfile(null);
            setLiveCompanyDetail(null);
            setCompanyDetailLoading(false);
          }
        }}
      >
        <SheetContent side="right" className="w-full max-w-none p-0 sm:max-w-3xl">
          {selectedCompanyData && (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b px-6 py-4">
                <SheetTitle className="text-xl">{companyOverview?.name || selectedCompanyData.name}</SheetTitle>
                <SheetDescription>
                  Company Profile{(companyOverview?.id ?? selectedCompanyData.id) !== null ? ` • Bullhorn ID ${companyOverview?.id ?? selectedCompanyData.id}` : ""}
                  {companyDetailLoading ? " • Loading CRM data..." : liveCompanyDetail ? " • CRM data loaded" : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="contacts">Contacts</TabsTrigger>
                    <TabsTrigger value="notes">Last Notes</TabsTrigger>
                    <TabsTrigger value="raw">Raw</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          Company
                        </p>
                        <p className="text-sm font-medium">{companyOverview?.name || selectedCompanyData.name}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Industry</p>
                        <p className="text-sm font-medium">{companyOverview?.industry || selectedCompanyData.industry}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Website</p>
                        {(companyOverview?.website || selectedCompanyData.website) !== "-" ? (
                          <a
                            href={(companyOverview?.website || selectedCompanyData.website).startsWith("http") ? (companyOverview?.website || selectedCompanyData.website) : `https://${companyOverview?.website || selectedCompanyData.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {companyOverview?.website || selectedCompanyData.website}
                          </a>
                        ) : (
                          <p className="text-sm font-medium">-</p>
                        )}
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Phone</p>
                        <p className="text-sm font-medium">{companyOverview?.phone || selectedCompanyData.phone}</p>
                      </div>
                      <div className="rounded-md border p-3 md:col-span-2">
                        <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Location</p>
                        <p className="text-sm font-medium">{companyOverview?.location || selectedCompanyData.location}</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="contacts" className="space-y-3">
                    {companyContactsView.length ? (
                      companyContactsView.map((row) => (
                        <div key={row.key} className="rounded-md border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              className="text-left text-sm font-semibold text-primary hover:underline"
                              onClick={() => {
                                if (row.mappedRow) {
                                  void openContactProfile(row.mappedRow);
                                }
                              }}
                              disabled={!row.mappedRow}
                            >
                              {row.name}
                            </button>
                            <span className="text-xs text-muted-foreground">ID {row.bullhornId ?? "-"}</span>
                          </div>
                          <p className="mt-1 text-sm">{row.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{row.email}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        {companyDetailLoading ? "Loading company contacts from Bullhorn..." : "No contacts for this company in the current dataset."}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="notes" className="space-y-3">
                    <div className="rounded-md border p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add Local Company Note</p>
                      <Textarea
                        value={localCompanyNoteDraft}
                        onChange={(e) => setLocalCompanyNoteDraft(e.target.value)}
                        placeholder="Add private CRM note for this company..."
                        className="min-h-[90px]"
                      />
                      <div className="mt-2 flex justify-end">
                        <Button size="sm" onClick={saveLocalCompanyNote} disabled={localCompanyNoteSaving}>
                          {localCompanyNoteSaving ? "Saving..." : "Save Local Note"}
                        </Button>
                      </div>
                    </div>
                    {displayedCompanyNotes.length ? (
                      displayedCompanyNotes.map((note, index) => (
                        <div key={`${note.label}-${index}`} className="rounded-md border p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{note.label}</p>
                            <p className="text-xs text-muted-foreground">{note.date || "Unknown date"}</p>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words">{note.value}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        {companyDetailLoading ? "Loading company notes..." : "No company notes found in synced CRM payload."}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="raw">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap break-words text-xs leading-5">
                        {JSON.stringify(companyOverview?.raw || selectedCompanyData.raw || {}, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
