import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfileName } from "@/hooks/useProfileName";
import {
  BullhornSyncJob,
  getBullhornMirrorStats,
  listBullhornSyncJobs,
  startBullhornClientContactSync,
} from "@/lib/bullhornSyncApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Database, RefreshCw, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const ADMIN_PROFILE = "Nikita Vojevoda";

export default function BullhornSyncAdmin() {
  const profileName = useProfileName();
  const navigate = useNavigate();
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
      await loadBullhornSyncData();
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
    </AppLayout>
  );
}
