import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { History, Download, Eye, Filter, Inbox, Users, Trash2, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProfileName } from "@/hooks/useProfileName";
import type { Json } from "@/integrations/supabase/types";

type RunStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed';

interface ApolloContact {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  location?: string;
}

interface SearchPreference {
  industry?: string;
  industries?: string[];
  sectors?: string[];
  roles?: string[];
  targetRoles?: string[];
  locations?: string[];
}

// Skills mapping - EXPANDED for 4+ skills per contact (matching export-to-bullhorn)

// Direct industry name to skill mapping (from search preferences)
const INDUSTRY_DIRECT_SKILLS: Record<string, string[]> = {
  'real estate': ['RE', 'PROPERTY'],
  'capital markets': ['CAP MKTS', 'FIN SVCS'],
  'private equity': ['PE', 'BUY SIDE'],
  'private equity (pe)': ['PE', 'BUY SIDE'],
  'venture capital': ['VC', 'GROWTH'],
  'venture capital (vc)': ['VC', 'GROWTH'],
  'investment banking': ['IB', 'FIN SVCS'],
  'management consulting': ['CONSULTING', 'ADVISORY'],
  'hedge fund': ['HEDGE FUND', 'BUY SIDE'],
  'asset management': ['ASSET MAN', 'BUY SIDE'],
  'infrastructure': ['INFRA', 'RE'],
  'corporate finance': ['CORP FIN', 'FIN SVCS'],
  'wealth management': ['WEALTH MAN', 'FIN SVCS'],
  'family office': ['FAMILY OFFICE', 'WEALTH MAN'],
};

// Sector to skill mapping
const SECTOR_SKILLS: Record<string, string[]> = {
  'real estate & construction': ['RE', 'PROPERTY'],
  'financial services': ['FIN SVCS'],
  'technology': ['TECH'],
  'healthcare': ['HEALTHCARE'],
  'energy': ['ENERGY'],
  'industrials': ['INDUSTRIALS'],
  'consumer': ['CONSUMER'],
  'media': ['MEDIA'],
  'telecommunications': ['TELECOM'],
  'retail': ['RETAIL'],
};

// Skills mapping based on Bullhorn patterns
const INDUSTRY_SKILLS: Record<string, string[]> = {
  'private equity': ['PE'],
  'venture capital': ['VC'],
  'hedge fund': ['HEDGE FUND'],
  'investment bank': ['IB'],
  'asset management': ['ASSET MAN'],
  'mergers': ['M&A'],
  'acquisitions': ['M&A'],
  'm&a': ['M&A'],
  'leveraged buyout': ['LBO'],
  'lbo': ['LBO'],
  'debt capital': ['DCM'],
  'secondaries': ['SECN'],
  'tier 1': ['TIER1'],
  'tier1': ['TIER1'],
  'bulge bracket': ['TIER1'],
  'consulting': ['CONSULTING'],
  'management consulting': ['CONSULTING'],
  'real estate': ['RE'],
  'property': ['RE', 'PROPERTY'],
  'infrastructure': ['INFRA'],
  'credit': ['CREDIT'],
  'distressed': ['DISTRESSED'],
  'growth equity': ['GROWTH'],
  'buyout': ['LBO'],
};

const LOCATION_SKILLS: Record<string, string[]> = {
  'london': ['UK', 'LONDON'],
  'united kingdom': ['UK'],
  'uk': ['UK'],
  'england': ['UK'],
  'frankfurt': ['DACH', 'GERMANY'],
  'munich': ['DACH', 'GERMANY'],
  'berlin': ['DACH', 'GERMANY'],
  'germany': ['DACH', 'GERMANY'],
  'dach': ['DACH'],
  'zurich': ['SWISS', 'DACH'],
  'geneva': ['SWISS', 'DACH'],
  'switzerland': ['SWISS', 'DACH'],
  'dubai': ['UAE', 'MENA'],
  'abu dhabi': ['UAE', 'MENA'],
  'uae': ['UAE', 'MENA'],
  'stockholm': ['NORDICS'],
  'oslo': ['NORDICS'],
  'copenhagen': ['NORDICS'],
  'helsinki': ['NORDICS'],
  'nordics': ['NORDICS'],
  'amsterdam': ['BENELUX'],
  'brussels': ['BENELUX'],
  'benelux': ['BENELUX'],
  'paris': ['FRANCE'],
  'france': ['FRANCE'],
  'milan': ['ITALY'],
  'italy': ['ITALY'],
  'rome': ['ITALY'],
  'madrid': ['SPAIN'],
  'spain': ['SPAIN'],
  'new york': ['NYC', 'US'],
  'nyc': ['NYC', 'US'],
  'boston': ['US', 'NORTHEAST'],
  'chicago': ['US', 'MIDWEST'],
  'san francisco': ['US', 'WEST COAST'],
  'los angeles': ['US', 'WEST COAST'],
  'texas': ['US', 'SOUTH'],
  'dallas': ['US', 'SOUTH'],
  'houston': ['US', 'SOUTH'],
  'atlanta': ['US', 'SOUTH'],
  'miami': ['US', 'SOUTH'],
  'united states': ['US'],
  'usa': ['US'],
  'singapore': ['APAC', 'SINGAPORE'],
  'hong kong': ['APAC', 'HK'],
  'tokyo': ['APAC', 'JAPAN'],
  'australia': ['APAC', 'ANZ'],
  'sydney': ['APAC', 'ANZ'],
};

const ROLE_SKILLS: Record<string, string[]> = {
  // Leadership
  'head': ['HEAD', 'SENIOR'],
  'director': ['HEAD', 'SENIOR'],
  'partner': ['HEAD', 'SENIOR', 'PARTNER'],
  'managing partner': ['HEAD', 'SENIOR', 'PARTNER', 'MP'],
  'senior partner': ['HEAD', 'SENIOR', 'PARTNER'],
  'equity partner': ['HEAD', 'SENIOR', 'PARTNER'],
  'managing director': ['HEAD', 'MD'],
  'md': ['HEAD', 'MD'],
  'principal': ['HEAD', 'SENIOR'],
  'vice president': ['VP'],
  'vp': ['VP'],
  'svp': ['VP', 'SENIOR'],
  'evp': ['VP', 'SENIOR', 'C-SUITE'],
  'senior': ['SENIOR'],
  'associate': ['ASSOCIATE'],
  'analyst': ['ANALYST'],
  'manager': ['MANAGER'],
  // Investment
  'portfolio manager': ['PM', 'BUY SIDE'],
  'investment manager': ['IM', 'BUY SIDE'],
  'fund manager': ['FM', 'BUY SIDE'],
  'buy side': ['BUY SIDE'],
  'buyside': ['BUY SIDE'],
  'growth': ['GROWTH'],
  'fundraising': ['FUNDRAISING', 'IR'],
  'investor relations': ['IR', 'FUNDRAISING'],
  'ir': ['IR'],
  // C-Suite
  'cfo': ['CFO', 'C-SUITE'],
  'ceo': ['CEO', 'C-SUITE'],
  'coo': ['COO', 'C-SUITE'],
  'cio': ['CIO', 'C-SUITE'],
  'cto': ['CTO', 'C-SUITE'],
  'chief': ['C-SUITE'],
  'founder': ['FOUNDER', 'C-SUITE'],
  'co-founder': ['FOUNDER', 'C-SUITE'],
  // HR & Talent
  'hr': ['HR', 'TALENT'],
  'human resources': ['HR', 'TALENT'],
  'talent': ['TALENT', 'HR'],
  'recruiting': ['TALENT', 'HR'],
  'recruiter': ['TALENT', 'HR'],
  // Legal
  'general counsel': ['LEGAL', 'GC', 'C-SUITE'],
  'gc': ['LEGAL', 'GC'],
  'legal counsel': ['LEGAL'],
  'counsel': ['LEGAL'],
  'attorney': ['LEGAL'],
  'lawyer': ['LEGAL'],
  'legal director': ['LEGAL', 'HEAD'],
  'head of legal': ['LEGAL', 'HEAD'],
  'chief legal officer': ['LEGAL', 'CLO', 'C-SUITE'],
  'clo': ['LEGAL', 'CLO', 'C-SUITE'],
  'compliance': ['COMPLIANCE', 'LEGAL'],
  'regulatory': ['REGULATORY', 'COMPLIANCE'],
  // Operations & Strategy
  'operations': ['OPS'],
  'strategy': ['STRATEGY'],
  'business development': ['BD'],
  'bd': ['BD'],
  'corporate development': ['CORP DEV', 'M&A'],
};

function normalizePreferencesData(raw: Json): SearchPreference | undefined {
  const anyRaw = raw as unknown as any;
  if (!anyRaw) return undefined;

  // Stored as an array of per-industry preference objects.
  if (Array.isArray(anyRaw)) {
    const first = anyRaw[0] || {};
    const industries = anyRaw.map((p: any) => p?.industry).filter(Boolean);
    return {
      ...first,
      industries: industries.length ? industries : first.industries,
    } as SearchPreference;
  }

  return anyRaw as SearchPreference;
}

function generateSkillsString(contact: ApolloContact, preferences?: SearchPreference): string {
  const skills = new Set<string>();

  // 1. Match from search preferences - direct industry mapping
  if (preferences?.industry) {
    const lowerIndustry = preferences.industry.toLowerCase();
    for (const [keyword, skillCodes] of Object.entries(INDUSTRY_DIRECT_SKILLS)) {
      if (lowerIndustry.includes(keyword) || keyword.includes(lowerIndustry)) {
        skillCodes.forEach(s => skills.add(s));
      }
    }
  }

  // 2. Match from industries array in preferences
  if (preferences?.industries) {
    for (const industry of preferences.industries) {
      const lowerIndustry = industry.toLowerCase();
      for (const [keyword, skillCodes] of Object.entries(INDUSTRY_DIRECT_SKILLS)) {
        if (lowerIndustry.includes(keyword) || keyword.includes(lowerIndustry)) {
          skillCodes.forEach(s => skills.add(s));
        }
      }
      for (const [keyword, skillCodes] of Object.entries(INDUSTRY_SKILLS)) {
        if (lowerIndustry.includes(keyword) || keyword.includes(lowerIndustry)) {
          skillCodes.forEach(s => skills.add(s));
        }
      }
    }
  }

  // 3. Match from sectors in preferences
  if (preferences?.sectors) {
    for (const sector of preferences.sectors) {
      const lowerSector = sector.toLowerCase();
      for (const [keyword, skillCodes] of Object.entries(SECTOR_SKILLS)) {
        if (lowerSector.includes(keyword) || keyword.includes(lowerSector)) {
          skillCodes.forEach(s => skills.add(s));
        }
      }
    }
  }

  // 4. Match from company name
  const companyLower = contact.company?.toLowerCase() || '';
  for (const [keyword, skillCodes] of Object.entries(INDUSTRY_SKILLS)) {
    if (companyLower.includes(keyword)) {
      skillCodes.forEach(s => skills.add(s));
    }
  }

  // 5. Match from contact location AND extract city name
  const locationLower = contact.location?.toLowerCase() || '';
  for (const [keyword, skillCodes] of Object.entries(LOCATION_SKILLS)) {
    if (locationLower.includes(keyword)) {
      skillCodes.forEach(s => skills.add(s));
    }
  }

  // 5b. ALWAYS add a city identifier (first segment of location)
  if (contact.location) {
    const city = contact.location.split(',')[0]?.trim();
    if (city) skills.add(city.toUpperCase());
  }

  // 6. Match from search preference locations
  if (preferences?.locations) {
    for (const loc of preferences.locations) {
      const lowerLoc = loc.toLowerCase();
      for (const [keyword, skillCodes] of Object.entries(LOCATION_SKILLS)) {
        if (lowerLoc.includes(keyword) || keyword.includes(lowerLoc)) {
          skillCodes.forEach(s => skills.add(s));
        }
      }
    }
  }

  // 7. Match from title (role-based skills)
  const titleLower = contact.title?.toLowerCase() || '';
  for (const [keyword, skillCodes] of Object.entries(ROLE_SKILLS)) {
    if (titleLower.includes(keyword)) {
      skillCodes.forEach(s => skills.add(s));
    }
  }

  // 8. Match from target roles in preferences
  if (preferences?.targetRoles) {
    for (const role of preferences.targetRoles) {
      const lowerRole = role.toLowerCase();
      for (const [keyword, skillCodes] of Object.entries(ROLE_SKILLS)) {
        if (lowerRole.includes(keyword) || keyword.includes(lowerRole)) {
          skillCodes.forEach(s => skills.add(s));
        }
      }
    }
  }

  // Use semicolon separator for Bullhorn compatibility (Skills Count requires semicolons)
  return Array.from(skills).join(' ; ');
}

interface EnrichmentRun {
  id: string;
  created_at: string;
  search_counter: number;
  candidates_count: number;
  processed_count: number;
  status: RunStatus;
  error_message: string | null;
  bullhorn_enabled: boolean;
  bullhorn_errors: Json;
  enriched_data: Json;
  enriched_csv_url: string | null;
  candidates_data: Json;
  preferences_data: Json;
  bullhorn_list_name: string | null;
  bullhorn_list_id: number | null;
  bullhorn_exported_at: string | null;
}

export default function RunsHistory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileName = useProfileName();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRun, setSelectedRun] = useState<EnrichmentRun | null>(null);
  const [removedContacts, setRemovedContacts] = useState<Set<string>>(new Set());
  const [exportingRunId, setExportingRunId] = useState<string | null>(null);

  const selectedRunPreferences = selectedRun
    ? normalizePreferencesData(selectedRun.preferences_data)
    : undefined;
  
  const { data: runs, isLoading } = useQuery({
    queryKey: ['enrichment-runs', statusFilter, profileName],
    queryFn: async () => {
      let query = supabase
        .from('enrichment_runs')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Filter by current user profile
      if (profileName) {
        query = query.eq('uploaded_by', profileName);
      }
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as RunStatus);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as EnrichmentRun[];
    },
  });

  const exportTooBullhornMutation = useMutation({
    mutationFn: async (runId: string) => {
      setExportingRunId(runId);
      const { data, error } = await supabase.functions.invoke('export-to-bullhorn', {
        body: { runId }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const listCreated = data?.listId !== null && data?.listId !== undefined;
      toast({
        title: "Exported to Bullhorn",
        description: listCreated
          ? `Distribution list "${data.listName}" created with ${data.contactsExported} contacts.`
          : `Exported ${data.contactsExported} contacts. (No Distribution List was created — your Bullhorn instance currently doesn’t allow list creation via API.)`,
      });
      queryClient.invalidateQueries({ queryKey: ['enrichment-runs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setExportingRunId(null);
    },
  });

  const downloadCSV = (run: EnrichmentRun, excludedEmails: Set<string> = new Set()) => {
    const contacts = (run.enriched_data as unknown) as ApolloContact[];
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) return;

    // Filter out removed contacts
    const filteredContacts = contacts.filter(c => !excludedEmails.has(c.email));
    if (filteredContacts.length === 0) return;

    // Get preferences for skills generation
    const preferences = normalizePreferencesData(run.preferences_data);
    const dateAdded = format(new Date(run.created_at), 'M/d/yyyy');

    // Bullhorn CSV format with Email column added
    const csvHeader = '"Name","Email","Job Title","Company","Country","Last Note","Skills","Skills Count","ClientCorporation.notes","General Comments","ClientCorporation.companyDescription","Vacancies","Consultant","Date Added","Notes","Status"';
    const csvRows = filteredContacts.map(c => {
      const skills = generateSkillsString(c, preferences);
      const skillsCount = skills ? skills.split(' ; ').length.toString() : '0';
      const country = c.location || '';
      
      // Format: Name, Email, Job Title, Company, Country, Last Note, Skills, Skills Count, 
      // ClientCorporation.notes, General Comments, ClientCorporation.companyDescription,
      // Vacancies, Consultant, Date Added, Notes, Status
      return `"${escapeCSV(c.name)}","${escapeCSV(c.email)}","${escapeCSV(c.title)}","${escapeCSV(c.company)}","${escapeCSV(country)}","","${escapeCSV(skills)}","${skillsCount}","","","","","","${dateAdded}","","Active"`;
    });
    const csvContent = [csvHeader, ...csvRows].join('\n');

    // Generate filename with date, time, and CV name
    const runDate = format(new Date(run.created_at), 'yyyy-MM-dd_HH-mm');
    const cvName = getCandidateName(run).replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${runDate}_${cvName}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const escapeCSV = (value: string | undefined): string => {
    if (!value) return '';
    return value.replace(/"/g, '""');
  };

  const getContactCount = (run: EnrichmentRun, excludedEmails: Set<string> = new Set()): number => {
    const contacts = (run.enriched_data as unknown) as ApolloContact[];
    if (!Array.isArray(contacts)) return 0;
    return contacts.filter(c => !excludedEmails.has(c.email)).length;
  };

  const getTotalContactCount = (run: EnrichmentRun): number => {
    const contacts = (run.enriched_data as unknown) as ApolloContact[];
    if (!Array.isArray(contacts)) return 0;
    return contacts.length;
  };

  const removeContact = (email: string) => {
    setRemovedContacts(prev => new Set([...prev, email]));
  };

  const restoreContact = (email: string) => {
    setRemovedContacts(prev => {
      const next = new Set(prev);
      next.delete(email);
      return next;
    });
  };

  const openRunDetails = (run: EnrichmentRun) => {
    setSelectedRun(run);
    setRemovedContacts(new Set()); // Reset removed contacts when opening a new run
  };

  const getCandidateName = (run: EnrichmentRun): string => {
    const candidates = run.candidates_data as any[];
    return candidates?.[0]?.name || 'Unknown';
  };

  return (
    <AppLayout 
      title="Runs History" 
      description="View past searches and download contact lists"
    >
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Filter className="h-4 w-4" />
                </div>
                <CardTitle className="text-lg">Filters</CardTitle>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        {/* Runs Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <History className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Contact Searches</CardTitle>
                <CardDescription>
                  {runs?.length || 0} searches found
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : runs && runs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Contacts Found</TableHead>
                    <TableHead>Max Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id} className="animate-fade-in">
                      <TableCell className="font-medium">
                        {getCandidateName(run)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(run.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {getTotalContactCount(run)}
                        </div>
                      </TableCell>
                      <TableCell>{run.search_counter}</TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRunDetails(run)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadCSV(run)}
                            disabled={getTotalContactCount(run) === 0}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => exportTooBullhornMutation.mutate(run.id)}
                            disabled={getTotalContactCount(run) === 0 || exportingRunId === run.id}
                            title={run.bullhorn_exported_at ? "Re-export to Bullhorn" : "Export to Bullhorn"}
                            className={run.bullhorn_exported_at ? "text-green-600 hover:text-green-700" : ""}
                          >
                            {exportingRunId === run.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : run.bullhorn_exported_at ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                  <Inbox className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">No searches yet</h3>
                <p className="text-sm text-muted-foreground">
                  Upload a CV and search for contacts to see results here
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Run Details Dialog */}
        <Dialog open={!!selectedRun} onOpenChange={() => { setSelectedRun(null); setRemovedContacts(new Set()); }}>
          <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Search Details</DialogTitle>
              <DialogDescription>
                Contacts found for {selectedRun ? getCandidateName(selectedRun) : ''}
              </DialogDescription>
            </DialogHeader>
            
            {selectedRun && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{getTotalContactCount(selectedRun)}</div>
                      <div className="text-sm text-muted-foreground">Total Found</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-primary">{getContactCount(selectedRun, removedContacts)}</div>
                      <div className="text-sm text-muted-foreground">For Download</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{selectedRun.search_counter}</div>
                      <div className="text-sm text-muted-foreground">Max Requested</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <StatusBadge status={selectedRun.status} />
                      <div className="text-sm text-muted-foreground mt-2">Status</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Error Message */}
                {selectedRun.error_message && (
                  <Card className="border-destructive/50">
                    <CardHeader>
                      <CardTitle className="text-destructive text-sm">Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{selectedRun.error_message}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Contacts Preview */}
                {getTotalContactCount(selectedRun) > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">All Contacts</CardTitle>
                        {removedContacts.size > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemovedContacts(new Set())}
                          >
                            Restore All ({removedContacts.size})
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Skills</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead className="w-[80px]">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {((selectedRun.enriched_data as unknown) as ApolloContact[]).map((contact, i) => {
                            const isRemoved = removedContacts.has(contact.email);
                            const skills = generateSkillsString(contact, selectedRunPreferences);
                            return (
                              <TableRow key={i} className={isRemoved ? 'opacity-40 bg-muted/50' : ''}>
                                <TableCell className="font-medium">{contact.name || '-'}</TableCell>
                                <TableCell>{contact.title || '-'}</TableCell>
                                <TableCell>{contact.company || '-'}</TableCell>
                                <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground" title={skills}>
                                  {skills || '-'}
                                </TableCell>
                                <TableCell className="text-primary">{contact.email || '-'}</TableCell>
                                <TableCell>{contact.phone || '-'}</TableCell>
                                <TableCell>
                                  {isRemoved ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => restoreContact(contact.email)}
                                      className="text-primary hover:text-primary"
                                    >
                                      Restore
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeContact(contact.email)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => downloadCSV(selectedRun, removedContacts)}
                    disabled={getContactCount(selectedRun, removedContacts) === 0}
                    className="flex-1"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV ({getContactCount(selectedRun, removedContacts)})
                  </Button>
                  {selectedRun.bullhorn_exported_at ? (
                    <Button
                      variant="outline"
                      disabled
                      className="flex-1 text-green-600"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Exported: {selectedRun.bullhorn_list_name}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => exportTooBullhornMutation.mutate(selectedRun.id)}
                      disabled={getContactCount(selectedRun, removedContacts) === 0 || exportingRunId === selectedRun.id}
                      className="flex-1"
                    >
                      {exportingRunId === selectedRun.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Export to Bullhorn
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
