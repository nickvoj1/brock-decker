import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfileName } from "@/hooks/useProfileName";
import {
  BullhornContactFilterField,
  BullhornContactFilterOperator,
  BullhornContactFilterRow,
  BullhornLiveCompanyDetail,
  BullhornLiveContactDetail,
  BullhornMirrorContact,
  BullhornSyncJob,
  getBullhornLiveCompanyDetail,
  getBullhornLiveContactDetail,
  getBullhornMirrorStats,
  listBullhornMirrorContacts,
  listBullhornSyncJobs,
  startBullhornClientContactSync,
} from "@/lib/bullhornSyncApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDown, ArrowUp, ArrowUpDown, Briefcase, Building2, Calendar, Clock, Database, Mail, Phone, Plus, RefreshCw, User, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const ADMIN_PROFILE = "Nikita Vojevoda";
const CONTACTS_PAGE_SIZE = 25;
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
  skills: string;
  lastNoteMillis: number | null;
  dateAddedMillis: number | null;
  dateLastModifiedMillis: number | null;
};

type ProfileNoteEntry = {
  label: string;
  value: string;
  date: string | null;
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

function buildAppliedFilters(rows: ContactFilterDraftRow[]): BullhornContactFilterRow[] {
  return rows
    .map((row) => ({
      field: row.field,
      operator: row.operator,
      values: row.valueInput
        .split(/[\n,;|]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    }))
    .filter((row) => row.values.length > 0);
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
  const liveLatestNote = formatMirrorValue(contact.latest_note ?? contact.latest_note_action);
  const lastNoteText = liveLatestNote !== "-"
    ? liveLatestNote
    : formatMirrorValue(rawRecord.lastNote ?? rawRecord.comments ?? rawRecord.notes ?? rawRecord.description);
  const lastNoteDate = formatMirrorDate(contact.latest_note_date ?? rawRecord.dateLastComment);
  const lastNote = lastNoteText !== "-"
    ? lastNoteText
    : lastNoteDate !== "-"
      ? `Updated ${lastNoteDate}`
      : "-";
  const lastNoteRaw = contact.latest_note_date ?? rawRecord.dateLastComment ?? rawRecord.dateLastModified;
  const dateAddedRaw = rawRecord.dateAdded;
  const dateLastModifiedRaw = rawRecord.dateLastModified ?? contact.date_last_modified;
  const dateAdded = formatMirrorDate(dateAddedRaw);
  const dateLastModified = formatMirrorDate(dateLastModifiedRaw);
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
    skills,
    lastNoteMillis: toDateMillis(lastNoteRaw),
    dateAddedMillis: toDateMillis(dateAddedRaw),
    dateLastModifiedMillis: toDateMillis(dateLastModifiedRaw),
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

  const prioritizedKeys = ["note", "notes", "comment", "comments", "description", "text", "value", "name", "data"];
  const fromKeys = prioritizedKeys.flatMap((key) => (key in record ? extractTextChunks(record[key]) : []));
  if (fromKeys.length) return fromKeys;

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
      const comments = formatMirrorValue(record.comments);
      if (comments === "-") return null;
      return {
        label: formatMirrorValue(record.action) !== "-" ? formatMirrorValue(record.action) : "Bullhorn Note",
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
  const [syncJobs, setSyncJobs] = useState<BullhornSyncJob[]>([]);
  const [syncJobLoading, setSyncJobLoading] = useState(false);
  const [syncActionLoading, setSyncActionLoading] = useState(false);
  const [mirrorCount, setMirrorCount] = useState(0);
  const [contacts, setContacts] = useState<BullhornMirrorContact[]>([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsOffset, setContactsOffset] = useState(0);
  const [hasMoreContacts, setHasMoreContacts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [contactsSearchDraft, setContactsSearchDraft] = useState("");
  const [contactsSearch, setContactsSearch] = useState("");
  const [filterRows, setFilterRows] = useState<ContactFilterDraftRow[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<BullhornContactFilterRow[]>([]);
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<ContactSortKey>("id");
  const [sortDirection, setSortDirection] = useState<ContactSortDirection>("desc");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [selectedContactProfile, setSelectedContactProfile] = useState<ContactDisplayRow | null>(null);
  const [selectedCompanyProfile, setSelectedCompanyProfile] = useState<ContactDisplayRow | null>(null);
  const [liveContactDetail, setLiveContactDetail] = useState<BullhornLiveContactDetail | null>(null);
  const [liveCompanyDetail, setLiveCompanyDetail] = useState<BullhornLiveCompanyDetail | null>(null);
  const [contactDetailLoading, setContactDetailLoading] = useState(false);
  const [companyDetailLoading, setCompanyDetailLoading] = useState(false);
  const [liveDetailApiSupported, setLiveDetailApiSupported] = useState(true);
  const contactDetailRequestIdRef = useRef(0);
  const companyDetailRequestIdRef = useRef(0);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (profileName && profileName !== ADMIN_PROFILE) {
      toast.error("Access denied. Admin only.");
      navigate("/");
      return;
    }
    if (profileName === ADMIN_PROFILE && !tableOnly) {
      loadBullhornSyncData();
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

      if (jobsResult.success && Array.isArray(jobsResult.data)) {
        setSyncJobs(jobsResult.data);
      }

      if (statsResult.success && statsResult.data) {
        setMirrorCount(statsResult.data.totalMirroredContacts || 0);
      }
    } catch (err) {
      console.error("Failed to load Bullhorn contact sync state", err);
    } finally {
      if (!options.silent) setSyncJobLoading(false);
    }
  };

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

  if (profileName !== ADMIN_PROFILE) {
    return null;
  }

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
  }, [selectedContactProfile, selectedLiveContactCompanyRecord, selectedLiveContactRecord]);

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

  const openContactProfile = useCallback(async (row: ContactDisplayRow) => {
    const requestId = contactDetailRequestIdRef.current + 1;
    contactDetailRequestIdRef.current = requestId;
    setSelectedCompanyProfile(null);
    setSelectedContactProfile(row);
    setLiveContactDetail(null);
    if (!liveDetailApiSupported) {
      setContactDetailLoading(false);
      return;
    }
    setContactDetailLoading(true);

    const result = await getBullhornLiveContactDetail(ADMIN_PROFILE, row.contact.bullhorn_id);
    if (contactDetailRequestIdRef.current !== requestId) return;

    if (result.success && result.data) {
      setLiveContactDetail(result.data);
    } else if (result.error) {
      if (result.error.toLowerCase().includes("unknown action")) {
        setLiveDetailApiSupported(false);
        toast.info("Live Bullhorn detail fetch is not deployed yet. Showing mirrored profile data.");
      } else {
        toast.error(`Live Bullhorn contact fetch failed: ${result.error}`);
      }
    }
    setContactDetailLoading(false);
  }, [liveDetailApiSupported]);

  const openCompanyProfile = useCallback(async (row: ContactDisplayRow) => {
    const requestId = companyDetailRequestIdRef.current + 1;
    companyDetailRequestIdRef.current = requestId;
    setSelectedContactProfile(null);
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

    const result = await getBullhornLiveCompanyDetail(ADMIN_PROFILE, companyId);
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
  }, [liveDetailApiSupported]);

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

      <Card className={tableOnly ? "border-0 bg-transparent shadow-none -mx-4 md:-mx-6 lg:-mx-7 h-[calc(100dvh-6rem)] md:h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-8rem)] flex flex-col overflow-hidden" : undefined}>
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
                onClick={() => loadBullhornMirrorContacts({ reset: true })}
                disabled={contactsLoading}
              >
                <RefreshCw className={`h-4 w-4 ${contactsLoading ? "animate-spin" : ""}`} />
              </Button>
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
                        placeholder="Values (comma separated for OR)"
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
                    <TableCell colSpan={13} className="py-5 text-center text-base text-muted-foreground">
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
            setSelectedContactProfile(null);
            setLiveContactDetail(null);
            setContactDetailLoading(false);
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
                  {contactDetailLoading ? " • Loading live Bullhorn data..." : liveContactDetail ? " • Live data loaded" : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="notes">Last Notes</TabsTrigger>
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
                        <p className="text-sm font-medium">Last Visit: {(contactOverview as any)?.lastVisit || (selectedContactProfile as any).lastVisit}</p>
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Skills</p>
                      <p className="text-sm font-medium whitespace-pre-wrap break-words">{contactOverview?.skills || selectedContactProfile.skills}</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="notes" className="space-y-3">
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
                        {contactDetailLoading ? "Loading notes from Bullhorn..." : "No notes found in synced or live Bullhorn payload for this contact."}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="raw">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap break-words text-xs leading-5">
                        {JSON.stringify(selectedContactRaw || {}, null, 2)}
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
                  {companyDetailLoading ? " • Loading live Bullhorn data..." : liveCompanyDetail ? " • Live data loaded" : ""}
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
                    {(selectedLiveCompanyNotes.length ? selectedLiveCompanyNotes : selectedCompanyData.notes).length ? (
                      (selectedLiveCompanyNotes.length ? selectedLiveCompanyNotes : selectedCompanyData.notes).map((note, index) => (
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
                        {companyDetailLoading ? "Loading company notes from Bullhorn..." : "No company notes found in synced or live Bullhorn payload."}
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
