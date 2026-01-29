import { useEffect, useState, useMemo } from "react";
import { 
  Users, 
  FileText, 
  TrendingUp, 
  Trophy,
  Calendar,
  Filter,
  Eye,
  Upload as UploadIcon
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
import { useProfileName } from "@/hooks/useProfileName";
import { getTeamDashboardStats, TeamMemberStats } from "@/lib/dataApi";
import { format, subDays, startOfDay, eachHourOfInterval } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TimeFilter = 'today' | 'week' | 'month' | 'all';
type ScoreFilter = 'all' | 'high';

interface AggregatedStats {
  totalCVsToday: number;
  myCVsToday: number;
  teamCVsToday: number;
  totalCVsAll: number;
  avgScore: number;
  totalApolloContacts: number;
  bullhornUploaded: number;
  bullhornPending: number;
}

interface HourlyData {
  hour: string;
  cvs: number;
}

export default function TeamDashboard() {
  const profileName = useProfileName();
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all');
  const [showMyOnly, setShowMyOnly] = useState(false);

  useEffect(() => {
    if (profileName) {
      fetchTeamData();
    } else {
      setIsLoading(false);
    }
  }, [profileName]);

  const fetchTeamData = async () => {
    if (!profileName) return;
    
    setIsLoading(true);
    try {
      const response = await getTeamDashboardStats(profileName);
      if (response.success && response.data) {
        setTeamStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const aggregatedStats = useMemo((): AggregatedStats => {
    const myStats = teamStats.find(s => s.profile_name === profileName);
    
    return {
      totalCVsToday: teamStats.reduce((sum, s) => sum + (s.cvs_today || 0), 0),
      myCVsToday: myStats?.cvs_today || 0,
      teamCVsToday: teamStats.reduce((sum, s) => sum + (s.cvs_today || 0), 0) - (myStats?.cvs_today || 0),
      totalCVsAll: teamStats.reduce((sum, s) => sum + (s.total_cvs || 0), 0),
      avgScore: teamStats.length > 0 
        ? Math.round(teamStats.reduce((sum, s) => sum + (s.avg_score || 0), 0) / teamStats.length)
        : 0,
      totalApolloContacts: teamStats.reduce((sum, s) => sum + (s.total_apollo_contacts || 0), 0),
      bullhornUploaded: teamStats.reduce((sum, s) => sum + (s.bullhorn_uploaded || 0), 0),
      bullhornPending: teamStats.reduce((sum, s) => sum + (s.bullhorn_pending || 0), 0),
    };
  }, [teamStats, profileName]);

  const filteredStats = useMemo(() => {
    let filtered = [...teamStats];
    
    if (showMyOnly) {
      filtered = filtered.filter(s => s.profile_name === profileName);
    }
    
    if (scoreFilter === 'high') {
      filtered = filtered.filter(s => (s.avg_score || 0) >= 90);
    }
    
    // Sort by CVs based on time filter
    filtered.sort((a, b) => {
      const getCVCount = (s: TeamMemberStats) => {
        switch (timeFilter) {
          case 'today': return s.cvs_today || 0;
          case 'week': return s.cvs_week || 0;
          default: return s.total_cvs || 0;
        }
      };
      return getCVCount(b) - getCVCount(a);
    });
    
    return filtered;
  }, [teamStats, timeFilter, scoreFilter, showMyOnly, profileName]);

  // Mock hourly data for the chart (would come from real-time data in production)
  const hourlyData = useMemo((): HourlyData[] => {
    const now = new Date();
    const startOfToday = startOfDay(now);
    const hours = eachHourOfInterval({ start: startOfToday, end: now });
    
    return hours.map((hour, index) => ({
      hour: format(hour, 'HH:00'),
      cvs: Math.floor(Math.random() * 15) + (index > 8 && index < 18 ? 5 : 0), // Simulate work hours
    }));
  }, []);

  const getCVCount = (stats: TeamMemberStats): number => {
    switch (timeFilter) {
      case 'today': return stats.cvs_today || 0;
      case 'week': return stats.cvs_week || 0;
      default: return stats.total_cvs || 0;
    }
  };

  const getApolloRate = (stats: TeamMemberStats): string => {
    const cvs = stats.total_cvs || 1;
    const contacts = stats.total_apollo_contacts || 0;
    return (contacts / cvs).toFixed(1);
  };

  const getBullhornBadge = (stats: TeamMemberStats) => {
    const uploaded = stats.bullhorn_uploaded || 0;
    const pending = stats.bullhorn_pending || 0;
    const errors = stats.bullhorn_error || 0;
    
    if (errors > 0) {
      return <Badge variant="destructive">{errors} errors</Badge>;
    }
    if (pending > 0) {
      return <Badge variant="secondary">{pending} pending</Badge>;
    }
    if (uploaded > 0) {
      return <Badge className="bg-success/10 text-success border-success/20">{uploaded} uploaded</Badge>;
    }
    return <Badge variant="outline">-</Badge>;
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
      description="Team recruitment metrics & performance"
    >
      <div className="space-y-6">
        {/* KPI Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-primary/5 border-primary/20 animate-slide-up" style={{ animationDelay: '0ms' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-primary">Total CVs Today</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {isLoading ? '-' : aggregatedStats.totalCVsToday}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {aggregatedStats.totalCVsAll} total all time
              </p>
            </CardContent>
          </Card>

          <Card className="bg-success/5 border-success/20 animate-slide-up" style={{ animationDelay: '50ms' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-success">My CVs</CardTitle>
              <UploadIcon className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {isLoading ? '-' : aggregatedStats.myCVsToday}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Today's uploads
              </p>
            </CardContent>
          </Card>

          <Card className="bg-accent/50 border-accent animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Team Total</CardTitle>
              <Users className="h-4 w-4 text-accent-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {isLoading ? '-' : aggregatedStats.teamCVsToday}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Other team members today
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
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
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant={showMyOnly ? "default" : "outline"} 
                size="sm"
                onClick={() => setShowMyOnly(!showMyOnly)}
              >
                My CVs Only
              </Button>

              <Button 
                variant={scoreFilter === 'high' ? "default" : "outline"} 
                size="sm"
                onClick={() => setScoreFilter(scoreFilter === 'high' ? 'all' : 'high')}
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                High Score (90%+)
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
          <Card className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-warning" />
                Leaderboard
              </CardTitle>
              <CardDescription>Team performance rankings</CardDescription>
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
                        <TableHead className="text-center">CVs</TableHead>
                        <TableHead className="text-center">Avg Score</TableHead>
                        <TableHead className="text-center">Apollo Rate</TableHead>
                        <TableHead className="text-center">Bullhorn</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
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
                            <TableCell className="text-center font-semibold">
                              {getCVCount(stats)}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`font-medium ${
                                (stats.avg_score || 0) >= 90 ? 'text-success' : 
                                (stats.avg_score || 0) >= 70 ? 'text-warning' : 'text-muted-foreground'
                              }`}>
                                {stats.avg_score || 0}%
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {getApolloRate(stats)}/cv
                            </TableCell>
                            <TableCell className="text-center">
                              {getBullhornBadge(stats)}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
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

          {/* CVs per Hour Chart */}
          <Card className="animate-slide-up" style={{ animationDelay: '250ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                CVs / Hour
              </CardTitle>
              <CardDescription>Today's upload trend</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fontSize: 10 }} 
                      className="text-muted-foreground"
                      interval={2}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }} 
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cvs" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Row */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="animate-slide-up" style={{ animationDelay: '300ms' }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Apollo Contacts</p>
                  <p className="text-xl font-bold">{aggregatedStats.totalApolloContacts}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-slide-up" style={{ animationDelay: '350ms' }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Team Avg Score</p>
                  <p className="text-xl font-bold">{aggregatedStats.avgScore}%</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-slide-up" style={{ animationDelay: '400ms' }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Bullhorn Uploaded</p>
                  <p className="text-xl font-bold">{aggregatedStats.bullhornUploaded}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <UploadIcon className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-slide-up" style={{ animationDelay: '450ms' }}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pending Upload</p>
                  <p className="text-xl font-bold">{aggregatedStats.bullhornPending}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
