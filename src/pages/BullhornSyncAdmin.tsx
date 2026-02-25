import { useEffect, useMemo, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Database, RefreshCw, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const ADMIN_PROFILE = "Nikita Vojevoda";
const CONTACTS_PAGE_SIZE = 25;
const CORE_RAW_COLUMN_KEYS = new Set([
  "id",
  "name",
  "occupation",
  "clientCorporation",
  "email",
  "status",
  "phone",
  "owner",
  "address",
  "lastVisit",
  "dateAdded",
  "dateLastModified",
  "skills",
]);

function formatMirrorValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) {
    if (!value.length) return "-";
    return value.map((item) => formatMirrorValue(item)).join("; ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("id" in record || "name" in record) {
      const name = record.name ? String(record.name) : "";
      const id = record.id !== undefined && record.id !== null ? String(record.id) : "";
      const combined = `${name}${id ? ` (${id})` : ""}`.trim();
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

export default function BullhornSyncAdmin() {
  const profileName = useProfileName();
  const navigate = useNavigate();
  const [syncJobs, setSyncJobs] = useState<BullhornSyncJob[]>([]);
  const [syncJobLoading, setSyncJobLoading] = useState(false);
  const [syncActionLoading, setSyncActionLoading] = useState(false);
  const [mirrorCount, setMirrorCount] = useState(0);
  const [contacts, setContacts] = useState<BullhornMirrorContact[]>([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsSearchDraft, setContactsSearchDraft] = useState("");
  const [contactsSearch, setContactsSearch] = useState("");

  useEffect(() => {
    if (profileName && profileName !== ADMIN_PROFILE) {
      toast.error("Access denied. Admin only.");
      navigate("/");
      return;
    }
    if (profileName === ADMIN_PROFILE) {
      loadBullhornSyncData();
    }
  }, [profileName, navigate]);

  useEffect(() => {
    const activeJob = syncJobs.find((job) => job.status === "queued" || job.status === "running");
    if (!activeJob || profileName !== ADMIN_PROFILE) return;

    const interval = setInterval(() => {
      loadBullhornSyncData({ silent: true });
      loadBullhornMirrorContacts({ silent: true });
    }, 3000);

    return () => clearInterval(interval);
  }, [syncJobs, profileName]);

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

  const loadBullhornMirrorContacts = async (
    options: { silent?: boolean; page?: number; search?: string } = {},
  ) => {
    if (!options.silent) setContactsLoading(true);
    try {
      const page = options.page ?? contactsPage;
      const search = options.search ?? contactsSearch;
      const offset = (page - 1) * CONTACTS_PAGE_SIZE;
      const result = await listBullhornMirrorContacts(ADMIN_PROFILE, {
        limit: CONTACTS_PAGE_SIZE,
        offset,
        search,
      });

      if (result.success && result.data) {
        setContacts(result.data.contacts || []);
        setContactsTotal(result.data.total || 0);
      } else if (!options.silent) {
        toast.error(result.error || "Failed to load synced contacts");
      }
    } catch {
      if (!options.silent) toast.error("Failed to load synced contacts");
    } finally {
      if (!options.silent) setContactsLoading(false);
    }
  };

  useEffect(() => {
    if (profileName === ADMIN_PROFILE) {
      loadBullhornMirrorContacts();
    }
  }, [profileName, contactsPage, contactsSearch]);

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
        loadBullhornMirrorContacts({ silent: true, page: 1 }),
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
  const progressPercent = latestSyncJob?.total_expected
    ? Math.min(100, Math.round((latestSyncJob.total_synced / latestSyncJob.total_expected) * 100))
    : 0;
  const totalContactPages = Math.max(1, Math.ceil(contactsTotal / CONTACTS_PAGE_SIZE));
  const pageStart = contactsTotal === 0 ? 0 : (contactsPage - 1) * CONTACTS_PAGE_SIZE + 1;
  const pageEnd = Math.min(contactsPage * CONTACTS_PAGE_SIZE, contactsTotal);
  const rawColumns = useMemo(() => {
    const columns = new Set<string>();
    contacts.forEach((contact) => {
      if (contact.raw && typeof contact.raw === "object" && !Array.isArray(contact.raw)) {
        Object.keys(contact.raw).forEach((key) => columns.add(key));
      }
    });
    return Array.from(columns).sort((a, b) => a.localeCompare(b));
  }, [contacts]);
  const extraRawColumns = useMemo(
    () => rawColumns.filter((column) => !CORE_RAW_COLUMN_KEYS.has(column)),
    [rawColumns],
  );

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
    <AppLayout title="Contact Sync" description="Background read-only sync of Bullhorn contacts (ClientContact)">
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
                  ? `${latestSyncJob.total_synced.toLocaleString()} / ${(latestSyncJob.total_expected || 0).toLocaleString()}`
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
                  syncJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs">{job.id.slice(0, 12)}...</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{job.total_synced.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(job.total_expected || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />
                          {job.started_at
                            ? formatDistanceToNow(new Date(job.started_at), { addSuffix: true })
                            : "-"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Synced Contacts</CardTitle>
              <CardDescription>
                Bullhorn-style grid with core CRM columns + all additional mirrored fields ({extraRawColumns.length} extra columns)
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
                  setContactsPage(1);
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
                  setContactsPage(1);
                }}
              >
                Clear
              </Button>
              <Button variant="outline" onClick={() => loadBullhornMirrorContacts()} disabled={contactsLoading}>
                <RefreshCw className={`h-4 w-4 ${contactsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScrollArea className="h-[420px] w-full">
            <Table className="min-w-full w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Synced At</TableHead>
                  <TableHead className="whitespace-nowrap">ID</TableHead>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Job Title</TableHead>
                  <TableHead className="whitespace-nowrap">Company</TableHead>
                  <TableHead className="whitespace-nowrap">Work Email</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Work Phone</TableHead>
                  <TableHead className="whitespace-nowrap">Consultant</TableHead>
                  <TableHead className="whitespace-nowrap">Address</TableHead>
                  <TableHead className="whitespace-nowrap">Last Visit</TableHead>
                  <TableHead className="whitespace-nowrap">Date Added</TableHead>
                  <TableHead className="whitespace-nowrap">Last Modified</TableHead>
                  <TableHead className="whitespace-nowrap">Skills</TableHead>
                  {extraRawColumns.map((column) => (
                    <TableHead key={column} className="whitespace-nowrap">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={Math.max(14, extraRawColumns.length + 14)}
                      className="text-center text-sm text-muted-foreground"
                    >
                      {contactsLoading ? "Loading contacts..." : "No synced contacts yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => {
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
                    const skills = formatMirrorValue(rawRecord.skills);
                    return (
                      <TableRow key={contact.bullhorn_id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground py-2">
                          {new Date(contact.synced_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap py-2">{contact.bullhorn_id}</TableCell>
                        <TableCell className="max-w-[200px] text-xs py-2">{fullName}</TableCell>
                        <TableCell className="max-w-[240px] text-xs py-2">{jobTitle}</TableCell>
                        <TableCell className="max-w-[220px] text-xs py-2">{company}</TableCell>
                        <TableCell className="max-w-[230px] text-xs py-2">
                          {workEmail !== "-" ? (
                            <a href={`mailto:${workEmail}`} className="text-primary hover:underline">
                              {workEmail}
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="max-w-[120px] text-xs py-2">{status}</TableCell>
                        <TableCell className="max-w-[160px] text-xs py-2">{workPhone}</TableCell>
                        <TableCell className="max-w-[180px] text-xs py-2">{consultant}</TableCell>
                        <TableCell className="max-w-[260px] text-xs py-2">{address}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs py-2">{lastVisit}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs py-2">{dateAdded}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs py-2">{dateLastModified}</TableCell>
                        <TableCell className="max-w-[260px] text-xs py-2" title={skills}>
                          {skills.length > 120 ? `${skills.slice(0, 117)}...` : skills}
                        </TableCell>
                        {extraRawColumns.map((column) => {
                          const rawValue = formatMirrorValue(rawRecord[column]);
                          const displayValue = rawValue.length > 140 ? `${rawValue.slice(0, 137)}...` : rawValue;
                          const isEmailColumn = column.toLowerCase() === "email" && rawValue.includes("@");
                          return (
                            <TableCell
                              key={`${contact.bullhorn_id}-${column}`}
                              className="max-w-[300px] text-xs align-top py-2"
                              title={rawValue}
                            >
                              {isEmailColumn ? (
                                <a href={`mailto:${rawValue}`} className="text-primary hover:underline">
                                  {displayValue}
                                </a>
                              ) : (
                                displayValue
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {pageStart}-{pageEnd} of {contactsTotal.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContactsPage((p) => Math.max(1, p - 1))}
                disabled={contactsPage <= 1 || contactsLoading}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {contactsPage} / {totalContactPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContactsPage((p) => Math.min(totalContactPages, p + 1))}
                disabled={contactsPage >= totalContactPages || contactsLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
