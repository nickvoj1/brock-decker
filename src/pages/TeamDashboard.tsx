import { useEffect, useState, useMemo } from "react";
import { 
  Users, 
  TrendingUp, 
  Trophy,
  Calendar,
  Filter,
  Eye,
  Search,
  CheckCircle,
  Upload as UploadIcon,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useProfileName } from "@/hooks/useProfileName";
import { getTeamDashboardStats, TeamMemberStats, ChartDataPoint } from "@/lib/dataApi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TimeFilter = 'today' | 'week' | 'all';

interface AggregatedStats {
  totalRuns: number;
  avgSuccessRate: number;
  bullhornExported: number;
  totalContacts: number;
}

export default function TeamDashboard() {
  const profileName = useProfileName();
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [showMyOnly, setShowMyOnly] = useState(false);
  const [selectedRecruiter, setSelectedRecruiter] = useState<TeamMemberStats | null>(null);

  useEffect(() => {
    if (profileName) {
      fetchTeamData();
    } else {
      setIsLoading(false);
    }
  }, [profileName, timeFilter]);

  const fetchTeamData = async () => {
    if (!profileName) return;
    
    setIsLoading(true);
    try {
      const response = await getTeamDashboardStats(profileName, timeFilter);
      if (response.success && response.data) {
        setTeamStats(response.data.stats || []);
        setChartData(response.data.chartData || []);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate aggregated stats based on time filter
  const aggregatedStats = useMemo((): AggregatedStats => {
    const getRuns = (s: TeamMemberStats) => {
      switch (timeFilter) {
        case 'today': return s.runs_today || 0;
        case 'week': return s.runs_week || 0;
        default: return s.total_runs || 0;
      }
    };

    const getSuccessRate = (s: TeamMemberStats) => {
      switch (timeFilter) {
        case 'today': return s.success_rate_today || 0;
        case 'week': return s.success_rate_week || 0;
        default: return s.success_rate || 0;
      }
    };

    const getBullhorn = (s: TeamMemberStats) => {
      switch (timeFilter) {
        case 'today': return s.bullhorn_exported_today || 0;
        case 'week': return s.bullhorn_exported_week || 0;
        default: return s.bullhorn_exported || 0;
      }
    };

    const getContacts = (s: TeamMemberStats) => {
      switch (timeFilter) {
        case 'today': return s.contacts_today || 0;
        case 'week': return s.contacts_week || 0;
        default: return s.total_contacts || 0;
      }
    };

    const totalRuns = teamStats.reduce((sum, s) => sum + getRuns(s), 0);
    const avgSuccessRate = teamStats.length > 0 
      ? Math.round(teamStats.reduce((sum, s) => sum + getSuccessRate(s), 0) / teamStats.length)
      : 0;
    const bullhornExported = teamStats.reduce((sum, s) => sum + getBullhorn(s), 0);
    const totalContacts = teamStats.reduce((sum, s) => sum + getContacts(s), 0);

    return { totalRuns, avgSuccessRate, bullhornExported, totalContacts };
  }, [teamStats, timeFilter]);

  const filteredStats = useMemo(() => {
    let filtered = [...teamStats];
    
    if (showMyOnly) {
      filtered = filtered.filter(s => s.profile_name === profileName);
    }
    
    // Sort by runs based on time filter
    filtered.sort((a, b) => {
      const getRunCount = (s: TeamMemberStats) => {
        switch (timeFilter) {
          case 'today': return s.runs_today || 0;
          case 'week': return s.runs_week || 0;
          default: return s.total_runs || 0;
        }
      };
      return getRunCount(b) - getRunCount(a);
    });
    
    return filtered;
  }, [teamStats, timeFilter, showMyOnly, profileName]);

  const getContactCount = (stats: TeamMemberStats): number => {
    switch (timeFilter) {
      case 'today': return stats.contacts_today || 0;
      case 'week': return stats.contacts_week || 0;
      default: return stats.total_contacts || 0;
    }
  };

  const getRunCount = (stats: TeamMemberStats): number => {
    switch (timeFilter) {
      case 'today': return stats.runs_today || 0;
      case 'week': return stats.runs_week || 0;
      default: return stats.total_runs || 0;
    }
  };

  const getChartTitle = (): string => {
    switch (timeFilter) {
      case 'today': return 'Runs per Hour';
      case 'week': return 'Runs per Day';
      default: return 'Runs per Week';
    }
  };

  const getChartDescription = (): string => {
    switch (timeFilter) {
      case 'today': return "Today's search activity";
      case 'week': return 'Last 7 days activity';
      default: return 'Weekly activity overview';
    }
  };

  const getTimeLabel = (): string => {
    switch (timeFilter) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      default: return 'All Time';
    }
  };

  if (!profileName) {
    return (
      <AppLayout
        title="Team Dashboard"
        description="Brock & Decker recruitment metrics"
      >
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Select a Profile</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Please select your profile from the header dropdown to view team metrics.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Brock & Decker Dashboard"
      description="Team recruitment metrics & Apollo contacts"
    >
      <div className="space-y-6">
        {/* KPI Grid - Time-period responsive stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-primary/5 border-primary/20 animate-slide-up" style={{ animationDelay: '0ms' }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Runs ({getTimeLabel()})</p>
                  <p className="text-2xl font-bold text-primary">
                    {isLoading ? '-' : aggregatedStats.totalRuns}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Search className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-success/5 border-success/20 animate-slide-up" style={{ animationDelay: '50ms' }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Avg Success Rate</p>
                  <p className="text-2xl font-bold text-success">
                    {isLoading ? '-' : `${aggregatedStats.avgSuccessRate}%`}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Bullhorn Exports</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '-' : aggregatedStats.bullhornExported}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <UploadIcon className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Contacts ({getTimeLabel()})</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '-' : aggregatedStats.totalContacts.toLocaleString()}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant={showMyOnly ? "default" : "outline"} 
                size="sm"
                onClick={() => setShowMyOnly(!showMyOnly)}
              >
                My Stats Only
              </Button>

              <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                {filteredStats.length} recruiters
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Leaderboard Table */}
          <Card className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '250ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-warning" />
                Leaderboard - Runs & Contacts
              </CardTitle>
              <CardDescription>Performance per recruiter</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : filteredStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No data available</p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>Recruiter</TableHead>
                        <TableHead className="text-center">Runs</TableHead>
                        <TableHead className="text-center">Contacts</TableHead>
                        <TableHead className="text-center">Avg/Run</TableHead>
                        <TableHead className="text-center" title="% of runs with 10+ contacts">Yield</TableHead>
                        <TableHead className="text-center">Bullhorn</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStats.map((stats, index) => {
                        const isCurrentUser = stats.profile_name === profileName;
                        return (
                          <TableRow 
                            key={stats.profile_name} 
                            className={isCurrentUser ? 'bg-primary/5' : ''}
                          >
                            <TableCell className="font-medium">
                              {index === 0 && <span className="text-warning">🥇</span>}
                              {index === 1 && <span className="text-muted-foreground">🥈</span>}
                              {index === 2 && <span className="text-amber-600">🥉</span>}
                              {index > 2 && <span className="text-muted-foreground">{index + 1}</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {stats.profile_name.split(' ')[0]}
                                </span>
                                {isCurrentUser && (
                                  <Badge variant="outline" className="text-xs">You</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-bold text-primary">
                                {getRunCount(stats)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {getContactCount(stats).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-center">
                              {stats.avg_contacts_per_run || 0}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`font-medium ${
                                stats.success_rate >= 90 ? 'text-success' : 
                                stats.success_rate >= 70 ? 'text-warning' : 'text-muted-foreground'
                              }`}>
                                {stats.success_rate}%
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {stats.bullhorn_exported > 0 ? (
                                <Badge className="bg-success/10 text-success border-success/20">
                                  {stats.bullhorn_exported}
                                </Badge>
                              ) : (
                                <Badge variant="outline">0</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedRecruiter(stats)}
                                title={`View ${stats.profile_name}'s details`}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Runs Chart - Changes based on time filter */}
          <Card className="animate-slide-up" style={{ animationDelay: '300ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {getChartTitle()}
              </CardTitle>
              <CardDescription>{getChartDescription()}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p className="text-sm">No data available</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fontSize: 10 }} 
                        className="text-muted-foreground"
                        interval={timeFilter === 'today' ? 2 : 0}
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }} 
                        className="text-muted-foreground"
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [value, 'Runs']}
                      />
                      <Bar 
                        dataKey="runs" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recruiter Detail Modal */}
        <Dialog open={!!selectedRecruiter} onOpenChange={() => setSelectedRecruiter(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {selectedRecruiter?.profile_name}
              </DialogTitle>
              <DialogDescription>
                Detailed recruitment metrics
              </DialogDescription>
            </DialogHeader>
            
            {selectedRecruiter && (
              <div className="space-y-4">
                {/* Contact Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-2xl font-bold text-primary">
                      {selectedRecruiter.total_contacts.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Contacts</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <p className="text-2xl font-bold">
                      {selectedRecruiter.contacts_today}
                    </p>
                    <p className="text-xs text-muted-foreground">Today</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <p className="text-2xl font-bold">
                      {selectedRecruiter.contacts_week}
                    </p>
                    <p className="text-xs text-muted-foreground">This Week</p>
                  </div>
                </div>

                {/* Run Stats */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Search Runs</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                      <span className="text-sm">Total Runs</span>
                      <span className="font-semibold">{selectedRecruiter.total_runs}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                      <span className="text-sm">Today</span>
                      <span className="font-semibold">{selectedRecruiter.runs_today}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                      <span className="text-sm">This Week</span>
                      <span className="font-semibold">{selectedRecruiter.runs_week}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                      <span className="text-sm">Avg/Run</span>
                      <span className="font-semibold">{selectedRecruiter.avg_contacts_per_run}</span>
                    </div>
                  </div>
                </div>

                {/* Performance */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Performance</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                      <span className="text-sm" title="% of runs with 10+ contacts">Yield Rate</span>
                      <span className={`font-semibold ${
                        selectedRecruiter.success_rate >= 90 ? 'text-success' : 
                        selectedRecruiter.success_rate >= 70 ? 'text-warning' : ''
                      }`}>
                        {selectedRecruiter.success_rate}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                      <span className="text-sm">Bullhorn Exports</span>
                      <Badge className={selectedRecruiter.bullhorn_exported > 0 
                        ? "bg-success/10 text-success border-success/20" 
                        : ""
                      } variant={selectedRecruiter.bullhorn_exported > 0 ? "default" : "outline"}>
                        {selectedRecruiter.bullhorn_exported}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
