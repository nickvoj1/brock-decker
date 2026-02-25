import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfileName } from "@/hooks/useProfileName";
import { getAdminActivity, AdminActivityData } from "@/lib/dataApi";
import {
  BullhornSyncJob,
  getBullhornMirrorStats,
  listBullhornSyncJobs,
  startBullhornClientContactSync,
} from "@/lib/bullhornSyncApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, Users, Play, Mail, FileText, TrendingUp, Clock, Database, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const ADMIN_PROFILE = "Nikita Vojevoda";

export default function AdminPanel() {
  const profileName = useProfileName();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminActivityData | null>(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("all");
  const [syncJobs, setSyncJobs] = useState<BullhornSyncJob[]>([]);
  const [syncJobLoading, setSyncJobLoading] = useState(false);
  const [syncActionLoading, setSyncActionLoading] = useState(false);
  const [mirrorCount, setMirrorCount] = useState(0);

  useEffect(() => {
    if (profileName && profileName !== ADMIN_PROFILE) {
      toast.error("Access denied. Admin only.");
      navigate("/");
      return;
    }

    if (profileName === ADMIN_PROFILE) {
      loadData();
      loadBullhornSyncData();
    }
  }, [profileName, navigate]);

  useEffect(() => {
    const activeJob = syncJobs.find((job) => job.status === "queued" || job.status === "running");
    if (!activeJob || profileName !== ADMIN_PROFILE) return;

    const interval = setInterval(() => {
      loadBullhornSyncData({ silent: true });
    }, 3000);

    return () => clearInterval(interval);
  }, [syncJobs, profileName]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getAdminActivity(ADMIN_PROFILE);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        toast.error(result.error || "Failed to load admin data");
      }
    } catch {
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

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
      console.error("Failed to load Bullhorn sync state", err);
    } finally {
      if (!options.silent) setSyncJobLoading(false);
    }
  };

  const startSync = async () => {
    setSyncActionLoading(true);
    try {
      const result = await startBullhornClientContactSync(ADMIN_PROFILE, {
        batchSize: 500,
        includeDeleted: false,
        maxBatchesPerInvocation: 8,
      });

      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to start Bullhorn sync");
        return;
      }

      toast.success(result.message || "Bullhorn ClientContact sync started");
      await loadBullhornSyncData();
    } catch {
      toast.error("Failed to start Bullhorn sync");
    } finally {
      setSyncActionLoading(false);
    }
  };

  if (profileName !== ADMIN_PROFILE) {
    return null;
  }

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

  const userStatsArray = data?.userStats
    ? Object.entries(data.userStats).map(([name, stats]) => ({ name, ...stats }))
    : [];

  const toArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  const getRunPreferences = (value: unknown): Record<string, unknown> => {
    if (Array.isArray(value)) {
      const first = value[0];
      return first && typeof first === "object" ? (first as Record<string, unknown>) : {};
    }
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  };

  const getRequestTypeLabel = (rawType: unknown): string => {
    const type = String(rawType || "");
    if (type === "special_request") return "Special Request";
    if (type === "signal_ta") return "Signal TA";
    if (type === "jobboard_contact_search") return "Job Board Apollo";
    return "Contact Search";
  };

  const requestRows = (data?.runs || []).map((run) => {
    const prefs = getRunPreferences(run.preferences_data);
    const locations = toArray(prefs.locations).slice(0, 2).join(", ");
    const targetRoles = toArray(prefs.targetRoles).slice(0, 2).join(", ");
    const sectors = toArray(prefs.sectors).slice(0, 2).join(", ");
    const keywords = toArray(prefs.keywords).slice(0, 2).join(", ");
    const queryParts = [
      locations ? `Loc: ${locations}` : "",
      targetRoles ? `Roles: ${targetRoles}` : "",
      sectors ? `Industry: ${sectors}` : "",
      keywords ? `Keywords: ${keywords}` : "",
    ].filter(Boolean);

    const target =
      String(
        prefs.company ||
          prefs.targetCompany ||
          prefs.companies ||
          prefs.candidateName ||
          prefs.query ||
          "",
      ).trim() || "-";

    return {
      run,
      requestType: getRequestTypeLabel(prefs.type),
      target,
      querySummary: queryParts.join(" | ") || "-",
    };
  });

  const filteredRequestRows =
    requestStatusFilter === "all"
      ? requestRows
      : requestRows.filter(({ run }) => run.status === requestStatusFilter);

  const latestSyncJob = syncJobs[0] || null;
  const activeSyncJob = syncJobs.find((job) => job.status === "queued" || job.status === "running") || null;
  const progressPercent = latestSyncJob?.total_expected
    ? Math.min(100, Math.round((latestSyncJob.total_synced / latestSyncJob.total_expected) * 100))
    : 0;

  return (
    <AppLayout title="Admin Panel" description="Monitor team activity and usage">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
            <p className="text-muted-foreground">Monitor team activity and usage</p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userStatsArray.length}</div>
                <p className="text-xs text-muted-foreground">Active team members</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
                <Play className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.runs.length || 0}</div>
                <p className="text-xs text-muted-foreground">Enrichment searches</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pitches</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.pitches.length || 0}</div>
                <p className="text-xs text-muted-foreground">Generated emails</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saved CVs</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.candidates.length || 0}</div>
                <p className="text-xs text-muted-foreground">Candidate profiles</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage by Team Member
            </CardTitle>
            <CardDescription>Activity breakdown per user</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-center">Runs</TableHead>
                    <TableHead className="text-center">Pitches</TableHead>
                    <TableHead className="text-center">CVs</TableHead>
                    <TableHead className="text-right">Total Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userStatsArray
                    .sort((a, b) => (b.runs + b.pitches + b.candidates) - (a.runs + a.pitches + a.candidates))
                    .map((user) => (
                      <TableRow key={user.name}>
                        <TableCell className="font-medium">
                          {user.name}
                          {user.name === ADMIN_PROFILE && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Admin
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{user.runs}</TableCell>
                        <TableCell className="text-center">{user.pitches}</TableCell>
                        <TableCell className="text-center">{user.candidates}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {user.runs + user.pitches + user.candidates}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="runs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="runs" className="gap-2">
              <Play className="h-4 w-4" /> User Requests
            </TabsTrigger>
            <TabsTrigger value="pitches" className="gap-2">
              <Mail className="h-4 w-4" /> Recent Pitches
            </TabsTrigger>
            <TabsTrigger value="cvs" className="gap-2">
              <FileText className="h-4 w-4" /> Recent CVs
            </TabsTrigger>
            <TabsTrigger value="bullhorn" className="gap-2">
              <Database className="h-4 w-4" /> Bullhorn Sync
            </TabsTrigger>
          </TabsList>

          <TabsContent value="runs">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>User Requests</CardTitle>
                    <CardDescription>All request activity across users and statuses</CardDescription>
                  </div>
                  <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Query</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Results</TableHead>
                          <TableHead className="text-right">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRequestRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                              No requests found for this filter
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRequestRows.map(({ run, requestType, target, querySummary }) => (
                            <TableRow key={run.id}>
                              <TableCell className="font-medium">{run.uploaded_by}</TableCell>
                              <TableCell className="text-xs">{requestType}</TableCell>
                              <TableCell className="max-w-[180px] truncate text-xs">{target}</TableCell>
                              <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                                {querySummary}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getStatusColor(run.status)}>
                                  {run.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {run.processed_count}/{run.search_counter || run.candidates_count || 0}
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                <div className="flex items-center justify-end gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pitches">
            <Card>
              <CardHeader>
                <CardTitle>Generated Pitches</CardTitle>
                <CardDescription>Email pitches generated by the team</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead className="text-right">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.pitches.map((pitch) => (
                          <TableRow key={pitch.id}>
                            <TableCell className="font-medium">{pitch.profile_name}</TableCell>
                            <TableCell>{pitch.candidate_name}</TableCell>
                            <TableCell className="text-muted-foreground">{pitch.candidate_title || "-"}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              <div className="flex items-center justify-end gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(pitch.created_at), { addSuffix: true })}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cvs">
            <Card>
              <CardHeader>
                <CardTitle>Saved Candidate Profiles</CardTitle>
                <CardDescription>CVs saved by the team</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Candidate Name</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead className="text-right">Saved</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.candidates.map((candidate) => (
                          <TableRow key={candidate.id}>
                            <TableCell className="font-medium">{candidate.profile_name}</TableCell>
                            <TableCell>{candidate.name}</TableCell>
                            <TableCell className="text-muted-foreground">{candidate.current_title || "-"}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              <div className="flex items-center justify-end gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(candidate.created_at), { addSuffix: true })}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bullhorn">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Bullhorn ClientContact Mirror
                    </CardTitle>
                    <CardDescription>
                      Full read-only mirror sync from Bullhorn (no write/delete operations against Bullhorn).
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
                    <Button size="sm" onClick={startSync} disabled={syncActionLoading || !!activeSyncJob}>
                      {syncActionLoading ? "Starting..." : activeSyncJob ? "Sync Running" : "Start Full Sync"}
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
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest Job</p>
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

                <ScrollArea className="h-[240px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
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
                            No sync jobs yet
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
                              {job.started_at
                                ? formatDistanceToNow(new Date(job.started_at), { addSuffix: true })
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
