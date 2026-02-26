import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfileName } from "@/hooks/useProfileName";
import {
  BullhornMirrorContact,
  BullhornSyncJob,
  getBullhornMirrorStats,
  listBullhornMirrorContacts,
  listBullhornSyncJobs,
  startBullhornClientContactSync,
} from "@/lib/bullhornSyncApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Database, RefreshCw, Clock } from "lucide-react";
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
  const contactsScrollAreaRef = useRef<HTMLDivElement | null>(null);

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
    options: { silent?: boolean; search?: string; reset?: boolean; append?: boolean; offset?: number } = {},
  ) => {
    const isReset = Boolean(options.reset);
    if (!options.silent) setContactsLoading(true);
    if (options.append) setIsLoadingMore(true);
    try {
      const search = options.search ?? contactsSearch;
      const offset = isReset ? 0 : options.offset ?? 0;
      const result = await listBullhornMirrorContacts(ADMIN_PROFILE, {
        limit: CONTACTS_PAGE_SIZE,
        offset,
        search,
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
  }, [contactsSearch]);

  useEffect(() => {
    if (profileName === ADMIN_PROFILE) {
      loadBullhornMirrorContacts({ reset: true });
    }
  }, [profileName, contactsSearch, loadBullhornMirrorContacts]);

  useEffect(() => {
    if (profileName !== ADMIN_PROFILE) return;
    const scrollAreaRoot = contactsScrollAreaRef.current;
    if (!scrollAreaRoot) return;
    const viewport = scrollAreaRoot.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (!viewport) return;

    const maybeLoadMore = () => {
      if (contactsLoading || isLoadingMore || !hasMoreContacts) return;
      const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      if (distanceToBottom > 220) return;
      void loadBullhornMirrorContacts({ silent: true, append: true, offset: contactsOffset });
    };

    viewport.addEventListener("scroll", maybeLoadMore);
    // Trigger load-more immediately when visible area is not filled.
    maybeLoadMore();
    return () => viewport.removeEventListener("scroll", maybeLoadMore);
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

      <Card className={tableOnly ? "border-0 bg-transparent shadow-none" : undefined}>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Synced Contacts</CardTitle>
              <CardDescription>
                Bullhorn-style grid with core CRM columns. Additional mirrored fields remain stored in raw payload.
              </CardDescription>
            </div>
            <div className="flex w-full max-w-[680px] items-center gap-2">
              <Input
                value={contactsSearchDraft}
                onChange={(e) => setContactsSearchDraft(e.target.value)}
                placeholder="Search by name, email, company, title, city"
              />
              <Button
                variant="outline"
                onClick={() => {
                  setContactsSearch(contactsSearchDraft.trim());
                }}
              >
                Search
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setContactsSearchDraft("");
                  setContactsSearch("");
                }}
              >
                Clear
              </Button>
              <Button
                variant="outline"
                onClick={() => loadBullhornMirrorContacts({ reset: true })}
                disabled={contactsLoading}
              >
                <RefreshCw className={`h-4 w-4 ${contactsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={tableOnly ? "space-y-3 px-0 pb-0 -mx-4 md:-mx-6 lg:-mx-7" : "space-y-3"}>
          <ScrollArea
            ref={contactsScrollAreaRef}
            className={`h-[68vh] w-full ${
              tableOnly
                ? "h-[calc(100vh-210px)] border-l-2 border-t-2 border-primary rounded-none bg-background shadow-[inset_1px_0_0_rgba(15,15,15,0.9),inset_0_1px_0_rgba(15,15,15,0.9)]"
                : ""
            }`}
          >
            <Table className="w-[2200px] table-fixed text-base">
              <TableHeader className={tableOnly ? "[&_tr]:border-b [&_tr]:border-border/60" : "[&_tr]:border-0"}>
                <TableRow className={tableOnly ? "border-b border-border/60 bg-muted/20 hover:bg-muted/20" : "border-0 hover:bg-transparent"}>
                  <TableHead className={`w-[95px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>ID</TableHead>
                  <TableHead className={`w-[220px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>Name</TableHead>
                  <TableHead className={`w-[240px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>Job Title</TableHead>
                  <TableHead className={`w-[240px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>Company</TableHead>
                  <TableHead className={`w-[260px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>Work Email</TableHead>
                  <TableHead className={`w-[125px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>Status</TableHead>
                  <TableHead className={`w-[160px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>Work Phone</TableHead>
                  <TableHead className={`w-[180px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>Consultant</TableHead>
                  <TableHead className={`w-[220px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>Address</TableHead>
                  <TableHead className={`w-[130px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>Last Visit</TableHead>
                  <TableHead className={`w-[130px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>Date Added</TableHead>
                  <TableHead className={`w-[130px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>Last Modified</TableHead>
                  <TableHead className={`w-[370px] whitespace-nowrap text-sm ${tableOnly ? "border-r border-border/60 last:border-r-0" : ""}`}>Skills</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={tableOnly ? "[&_tr]:border-b [&_tr]:border-border/55 [&_tr:last-child]:border-b-0" : "[&_tr]:border-0"}>
                {contacts.length === 0 ? (
                  <TableRow className={tableOnly ? "border-b border-border/55 hover:bg-transparent" : "border-0 hover:bg-transparent"}>
                    <TableCell colSpan={13} className="py-5 text-center text-base text-muted-foreground">
                      {contactsLoading ? "Loading contacts..." : "No synced contacts yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact, index) => {
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
                    const lastVisit = formatMirrorDate(rawRecord.lastVisit);
                    const dateAdded = formatMirrorDate(rawRecord.dateAdded);
                    const dateLastModified = formatMirrorDate(rawRecord.dateLastModified ?? contact.date_last_modified);
                    const skills = extractSkillsFromRaw(rawRecord);
                    return (
                      <TableRow
                        key={contact.bullhorn_id}
                        className={
                          tableOnly
                            ? `border-b border-border/55 ${index % 2 === 1 ? "bg-primary/5" : ""} hover:bg-primary/10`
                            : "border-0 hover:bg-transparent"
                        }
                      >
                        <TableCell className={`w-[95px] whitespace-nowrap py-3 font-mono text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`}>{contact.bullhorn_id}</TableCell>
                        <TableCell className={`w-[220px] py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`} title={fullName}>
                          <span className="block truncate">{fullName}</span>
                        </TableCell>
                        <TableCell className={`w-[240px] py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`} title={jobTitle}>
                          <span className="block truncate">{jobTitle}</span>
                        </TableCell>
                        <TableCell className={`w-[240px] py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`} title={company}>
                          <span className="block truncate">{company}</span>
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
                        <TableCell className={`w-[130px] whitespace-nowrap py-3 text-sm ${tableOnly ? "border-r border-border/40 last:border-r-0" : ""}`}>{lastVisit}</TableCell>
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
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Loaded {contacts.length.toLocaleString()} of {contactsTotal.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {isLoadingMore ? "Loading next 25..." : hasMoreContacts ? "Scroll down to load next 25" : "All contacts loaded"}
            </p>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
