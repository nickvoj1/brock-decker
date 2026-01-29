import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Search, 
  Users, 
  FileText, 
  TrendingUp, 
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  BarChart3
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProfileName } from "@/hooks/useProfileName";
import { format, subDays, startOfDay } from "date-fns";
import { getEnrichmentRuns, getCandidateProfiles } from "@/lib/dataApi";

interface DashboardStats {
  totalSearches: number;
  totalContacts: number;
  newContacts: number;
  savedCVs: number;
  successRate: number;
  lastWeekSearches: number;
  topIndustries: { name: string; count: number }[];
}

interface RecentActivity {
  id: string;
  type: 'search' | 'cv_upload';
  title: string;
  subtitle: string;
  status?: 'success' | 'partial' | 'failed';
  timestamp: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const profileName = useProfileName();
  const [stats, setStats] = useState<DashboardStats>({
    totalSearches: 0,
    totalContacts: 0,
    newContacts: 0,
    savedCVs: 0,
    successRate: 0,
    lastWeekSearches: 0,
    topIndustries: [],
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profileName) {
      fetchDashboardData();
    } else {
      setIsLoading(false);
    }
  }, [profileName]);

  const fetchDashboardData = async () => {
    if (!profileName) return;
    
    setIsLoading(true);
    try {
      // Fetch runs for this user via data API
      const runsResponse = await getEnrichmentRuns(profileName);
      const allRuns = runsResponse.success ? (runsResponse.data || []) : [];

      // Fetch saved CVs for this user via data API
      const cvsResponse = await getCandidateProfiles(profileName);
      const allCVs = cvsResponse.success ? (cvsResponse.data || []) : [];

      // Calculate stats
      const successfulRuns = allRuns.filter((r: any) => r.status === 'success' || r.status === 'partial');
      const totalContacts = allRuns.reduce((sum: number, r: any) => {
        const contacts = Array.isArray(r.enriched_data) ? r.enriched_data.length : 0;
        return sum + contacts;
      }, 0);

      // Last 7 days searches
      const weekAgo = subDays(new Date(), 7);
      const lastWeekSearches = allRuns.filter((r: any) => new Date(r.created_at) >= weekAgo).length;

      // Top industries
      const industryCount: Record<string, number> = {};
      allRuns.forEach((run: any) => {
        const prefs = run.preferences_data as any[];
        if (Array.isArray(prefs)) {
          prefs.forEach(p => {
            if (p.industry) {
              industryCount[p.industry] = (industryCount[p.industry] || 0) + 1;
            }
          });
        }
      });
      const topIndustries = Object.entries(industryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      // Use cached Bullhorn overlap data from localStorage instead of fetching
      let existingInBullhorn = 0;
      try {
        const cached = localStorage.getItem('bullhorn-overlap-cache');
        if (cached) {
          const overlapData = JSON.parse(cached);
          allRuns.forEach((run: any) => {
            if (overlapData[run.id]) {
              existingInBullhorn += overlapData[run.id].existing || 0;
            }
          });
        }
      } catch {
        // Ignore cache errors
      }

      const newContacts = Math.max(0, totalContacts - existingInBullhorn);

      setStats({
        totalSearches: allRuns.length,
        totalContacts,
        newContacts,
        savedCVs: allCVs.length,
        successRate: allRuns.length > 0 ? Math.round((successfulRuns.length / allRuns.length) * 100) : 0,
        lastWeekSearches,
        topIndustries,
      });

      // Build activity timeline (last 10 items)
      const activities: RecentActivity[] = [];
      
      // Add recent runs
      allRuns.slice(0, 5).forEach((run: any) => {
        const candidates = run.candidates_data as any[];
        const candidateName = candidates?.[0]?.name || 'Unknown';
        const contactsFound = Array.isArray(run.enriched_data) ? run.enriched_data.length : 0;
        
        activities.push({
          id: run.id,
          type: 'search',
          title: `Search for ${candidateName}`,
          subtitle: `${contactsFound} contacts found`,
          status: run.status as 'success' | 'partial' | 'failed',
          timestamp: run.created_at,
        });
      });

      // Add recent CV uploads
      allCVs.slice(0, 5).forEach((cv: any) => {
        activities.push({
          id: cv.id,
          type: 'cv_upload',
          title: `CV saved: ${cv.name}`,
          subtitle: cv.current_title || 'No title',
          timestamp: cv.created_at,
        });
      });

      // Sort by timestamp and take top 8
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities.slice(0, 8));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(date, 'MMM d');
  };

  if (!profileName) {
    return (
      <AppLayout
        title="My Dashboard"
        description="Your personal workspace overview"
      >
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Select a Profile</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Please select your profile from the header dropdown to view your personal dashboard with searches, CVs, and activity history.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={`Welcome, ${profileName.split(' ')[0]}`}
      description="Your personal workspace overview"
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="animate-slide-up" style={{ animationDelay: '0ms' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Searches</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '-' : stats.totalSearches}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.lastWeekSearches} this week
              </p>
            </CardContent>
          </Card>

          <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">New Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '-' : stats.newContacts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalContacts} total, {stats.totalContacts - stats.newContacts} in Bullhorn
              </p>
            </CardContent>
          </Card>

          <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saved CVs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '-' : stats.savedCVs}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Candidate profiles
              </p>
            </CardContent>
          </Card>

          <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '-' : `${stats.successRate}%`}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Successful searches
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Quick Actions */}
          <Card className="lg:col-span-1 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Quick Actions
              </CardTitle>
              <CardDescription>Jump right into your workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start gap-2" 
                onClick={() => navigate('/')}
              >
                <Search className="h-4 w-4" />
                New Contact Search
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => navigate('/previous-cvs')}
              >
                <FileText className="h-4 w-4" />
                Browse Saved CVs
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => navigate('/history')}
              >
                <Clock className="h-4 w-4" />
                View Search History
              </Button>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '250ms' }}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Your latest actions</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No recent activity yet</p>
                  <p className="text-xs mt-1">Start by uploading a CV or running a search</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div 
                      key={activity.id} 
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (activity.type === 'search') navigate('/history');
                        else navigate('/previous-cvs');
                      }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                        {activity.type === 'search' ? getStatusIcon(activity.status) : <FileText className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{activity.subtitle}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatRelativeTime(activity.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Industries */}
        {stats.topIndustries.length > 0 && (
          <Card className="animate-slide-up" style={{ animationDelay: '300ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Top Industries Searched
              </CardTitle>
              <CardDescription>Your most frequently targeted industries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topIndustries.map((industry, index) => (
                  <div key={industry.name} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{industry.name}</span>
                        <span className="text-xs text-muted-foreground">{industry.count} searches</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ 
                            width: `${Math.max(10, (industry.count / stats.topIndustries[0].count) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
