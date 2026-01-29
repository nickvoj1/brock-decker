import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfileName } from "@/hooks/useProfileName";
import { getAdminActivity, AdminActivityData } from "@/lib/dataApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Users, Play, Mail, FileText, TrendingUp, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const ADMIN_PROFILE = "Nikita Vojevoda";

export default function AdminPanel() {
  const profileName = useProfileName();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminActivityData | null>(null);

  useEffect(() => {
    // Redirect non-admin users
    if (profileName && profileName !== ADMIN_PROFILE) {
      toast.error("Access denied. Admin only.");
      navigate("/");
      return;
    }

    if (profileName === ADMIN_PROFILE) {
      loadData();
    }
  }, [profileName, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getAdminActivity(ADMIN_PROFILE);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        toast.error(result.error || "Failed to load admin data");
      }
    } catch (err) {
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  if (profileName !== ADMIN_PROFILE) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "partial": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "failed": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "running": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const userStatsArray = data?.userStats 
    ? Object.entries(data.userStats).map(([name, stats]) => ({ name, ...stats }))
    : [];

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

        {/* Stats Overview */}
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

        {/* User Breakdown */}
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
                            <Badge variant="outline" className="ml-2 text-xs">Admin</Badge>
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

        {/* Activity Tabs */}
        <Tabs defaultValue="runs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="runs" className="gap-2">
              <Play className="h-4 w-4" /> Recent Runs
            </TabsTrigger>
            <TabsTrigger value="pitches" className="gap-2">
              <Mail className="h-4 w-4" /> Recent Pitches
            </TabsTrigger>
            <TabsTrigger value="cvs" className="gap-2">
              <FileText className="h-4 w-4" /> Recent CVs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="runs">
            <Card>
              <CardHeader>
                <CardTitle>Enrichment Runs</CardTitle>
                <CardDescription>All team search activity</CardDescription>
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
                          <TableHead>Status</TableHead>
                          <TableHead>Results</TableHead>
                          <TableHead>Industries</TableHead>
                          <TableHead className="text-right">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.runs.map((run) => {
                          const prefs = run.preferences_data as any;
                          const industries = prefs?.industries?.slice(0, 2)?.join(", ") || "-";
                          return (
                            <TableRow key={run.id}>
                              <TableCell className="font-medium">{run.uploaded_by}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getStatusColor(run.status)}>
                                  {run.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{run.processed_count}/{run.candidates_count}</TableCell>
                              <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                                {industries}
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                <div className="flex items-center justify-end gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
        </Tabs>
      </div>
    </AppLayout>
  );
}
