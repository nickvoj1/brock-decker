import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { History, Download, Eye, Filter, Inbox, Users, Trash2, Upload, Loader2, CheckCircle2, RefreshCw, Sparkles, Database, MessageSquare, Building2, Copy } from "lucide-react";
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
import {
  countBullhornSkills,
  generateBullhornSkillsString,
  normalizePreferencesData,
} from "@/lib/bullhornSkills";
import { getEnrichmentRuns } from "@/lib/dataApi";
import { SkillsReviewModal } from "@/components/upload/SkillsReviewModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type RunStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed';

interface ApolloContact {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  location?: string;
}

interface BullhornContactDetails {
  lastNoteDate?: string;
  lastNoteText?: string;
  lastNoteBy?: string;
}

interface BullhornOverlapData {
  existing: number;
  recentNotes: number;
  recentNoteEmails: string[];
  existingEmails: string[];
  total: number;
  contactDetails: Record<string, BullhornContactDetails>;
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
  const [checkingRunId, setCheckingRunId] = useState<string | null>(null);
  
  // Skills review modal state
  const [skillsReviewRun, setSkillsReviewRun] = useState<EnrichmentRun | null>(null);
  const [skillsReviewExcludedEmails, setSkillsReviewExcludedEmails] = useState<string[]>([]);
  const [pendingClassifiedContacts, setPendingClassifiedContacts] = useState<any[] | null>(null);
  
  const [bullhornOverlap, setBullhornOverlap] = useState<Record<string, BullhornOverlapData>>(() => {
    try {
      const stored = localStorage.getItem('bullhorn-overlap-cache');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  

  const selectedRunPreferences = selectedRun
    ? normalizePreferencesData(selectedRun.preferences_data)
    : undefined;
  
  const { data: runs, isLoading } = useQuery({
    queryKey: ['enrichment-runs', statusFilter, profileName],
    queryFn: async () => {
      // If no profile selected, return empty array
      if (!profileName) {
        return [];
      }
      
      const response = await getEnrichmentRuns(profileName);
      if (!response.success) throw new Error(response.error);
      
      let data = (response.data || []) as EnrichmentRun[];
      
      // Apply status filter client-side
      if (statusFilter !== 'all') {
        data = data.filter(r => r.status === statusFilter);
      }
      
      // Sort by created_at desc
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return data;
    },
    enabled: !!profileName, // Only run query if profile is selected
  });

  const exportTooBullhornMutation = useMutation({
    mutationFn: async ({ runId, classifiedContacts, excludedEmails }: { runId: string; classifiedContacts?: any[]; excludedEmails?: string[] }) => {
      setExportingRunId(runId);
      const { data, error } = await supabase.functions.invoke('export-to-bullhorn', {
        body: { runId, classifiedContacts, excludedEmails }
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
          ? `Distribution list "${data.listName}" created with ${data.contactsExported} contacts${data.newContacts ? ` (${data.newContacts} new, ${data.existingContacts} existing)` : ''}.`
          : `Exported ${data.contactsExported} contacts. (No Distribution List was created — your Bullhorn instance currently doesn't allow list creation via API.)`,
      });
      queryClient.invalidateQueries({ queryKey: ['enrichment-runs'] });
      setPendingClassifiedContacts(null);
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

  // Handle opening skills review modal
  const openSkillsReview = (run: EnrichmentRun, excludedEmails: string[] = []) => {
    setSkillsReviewRun(run);
    setSkillsReviewExcludedEmails(excludedEmails);
  };

  // Handle confirming AI-classified skills and exporting
  const handleSkillsReviewConfirm = (classifiedContacts: any[]) => {
    if (!skillsReviewRun) return;
    const runId = skillsReviewRun.id;
    const excludedEmails = skillsReviewExcludedEmails;
    setSkillsReviewRun(null);
    setSkillsReviewExcludedEmails([]);
    exportTooBullhornMutation.mutate({ 
      runId, 
      classifiedContacts,
      excludedEmails: excludedEmails.length > 0 ? excludedEmails : undefined
    });
  };

  // Persist bullhorn overlap to localStorage
  useEffect(() => {
    if (Object.keys(bullhornOverlap).length > 0) {
      localStorage.setItem('bullhorn-overlap-cache', JSON.stringify(bullhornOverlap));
    }
  }, [bullhornOverlap]);

  // Auto-fetch Bullhorn overlap only for runs not already in cache
  useEffect(() => {
    if (!runs || runs.length === 0) return;
    
    runs.forEach(async (run) => {
      const contactCount = ((run.enriched_data as unknown) as ApolloContact[])?.length || 0;
      // Skip if already in cache or no contacts
      if (bullhornOverlap[run.id] || contactCount === 0) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('check-bullhorn-overlap', {
          body: { runId: run.id }
        });
        
        if (!error && data?.success) {
          setBullhornOverlap(prev => ({
            ...prev,
            [run.id]: { 
              existing: data.existingCount, 
              recentNotes: data.recentNoteCount || 0, 
              recentNoteEmails: data.recentNoteEmails || [],
              existingEmails: data.existingEmails || [],
              total: data.totalCount,
              contactDetails: data.contactDetails || {},
            }
          }));
        }
      } catch {
        // Silently fail for auto-fetch
      }
    });
  }, [runs]); // Note: intentionally not including bullhornOverlap to prevent re-runs

  const checkBullhornOverlap = async (runId: string) => {
    setCheckingRunId(runId);
    try {
      const { data, error } = await supabase.functions.invoke('check-bullhorn-overlap', {
        body: { runId }
      });
      
      if (error || !data?.success) {
        toast({
          title: "Check failed",
          description: error?.message || data?.error || "Unknown error",
          variant: "destructive",
        });
        return;
      }
      
      setBullhornOverlap(prev => ({
        ...prev,
        [runId]: { 
          existing: data.existingCount, 
          recentNotes: data.recentNoteCount || 0, 
          recentNoteEmails: data.recentNoteEmails || [],
          existingEmails: data.existingEmails || [],
          total: data.totalCount,
          contactDetails: data.contactDetails || {},
        }
      }));
      
      toast({
        title: "Bullhorn Check Complete",
        description: `${data.existingCount} of ${data.totalCount} in Bullhorn${data.recentNoteCount ? `, ${data.recentNoteCount} contacted <2 weeks` : ''}.`,
      });
    } catch (err: any) {
      toast({
        title: "Check failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCheckingRunId(null);
    }
  };

  const downloadCSV = (run: EnrichmentRun, excludedEmails: Set<string> = new Set()) => {
    const contacts = (run.enriched_data as unknown) as ApolloContact[];
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) return;

    // Filter out removed contacts
    const filteredContacts = contacts.filter(c => !excludedEmails.has(c.email));
    if (filteredContacts.length === 0) return;

    // Get preferences for skills generation
    const preferences = normalizePreferencesData(run.preferences_data);
    const dateAdded = format(new Date(run.created_at), 'M/d/yyyy');

    // Match the user's provided Bullhorn CSV template EXACTLY:
    // 1) Header row with display names
    // 2) Header row with Bullhorn field mappings
    // 3) Data rows
    const csvHeaderRow1 =
      '"Name","Job Title","Company","Country","Last Note","Skills","Skills Count","ClientCorporation.notes","General Comments","ClientCorporation.companyDescription","Vacancies","Consultant","Date Added","Notes","Status","Work Email"';
    const csvHeaderRow2 =
      '"name","occupation","clientCorporation","countryID","dateLastComment","skills","skillsCount","clientCorporation.notes","comments","clientCorporation.companyDescription","jobOrders","owner","dateAdded","notes","status","email"';

    const csvCell = (value?: string | number) => {
      if (value === undefined || value === null || value === '') return '';
      return `"${escapeCSV(String(value))}"`;
    };

    const deriveCountry = (location?: string) => {
      if (!location) return '';
      const parts = location
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      // We store location as "City, State, Country" in many cases; take the last segment.
      return parts[parts.length - 1] || location.trim();
    };

    const consultant = profileName?.trim() || 'Webdeveloper API';
    const csvRows = filteredContacts.map((c) => {
      const skills = generateBullhornSkillsString(c, preferences);
      const skillsCount = String(countBullhornSkills(skills));

      const country = deriveCountry(c.location);
      const lastNoteDate = dateAdded;

      // Column order MUST match csvHeaderRow1 exactly.
      const cells: Array<string | number> = [
        c.name,
        c.title,
        c.company,
        country,
        lastNoteDate,
        skills,
        skillsCount,
        '', // ClientCorporation.notes
        '', // General Comments
        '', // ClientCorporation.companyDescription
        '', // Vacancies
        consultant, // Consultant
        dateAdded, // Date Added
        '', // Notes
        'Active', // Status
        c.email, // Work Email
      ];

      return cells.map(csvCell).join(',');
    });

    const csvContent = [csvHeaderRow1, csvHeaderRow2, ...csvRows].join('\n');

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

  const isSpecialRequest = (run: EnrichmentRun): boolean => {
    const prefs = run.preferences_data as any[];
    return prefs?.[0]?.type === 'special_request';
  };

  const isAdditionalRun = (run: EnrichmentRun): boolean => {
    const prefs = run.preferences_data as any[];
    const type = prefs?.[0]?.type;
    return type === 'signal_ta' || type === 'jobboard_contact_search';
  };

  const [activeTab, setActiveTab] = useState<string>("searches");

  const regularRuns = runs?.filter(r => !isSpecialRequest(r) && !isAdditionalRun(r));
  const specialRuns = runs?.filter(r => isSpecialRequest(r));
  const additionalRuns = runs?.filter(r => isAdditionalRun(r));

  const copySpecialEmails = (run: EnrichmentRun) => {
    const contacts = (run.enriched_data as unknown) as ApolloContact[];
    if (!contacts || !Array.isArray(contacts)) return;
    const emails = contacts.map(c => c.email).join('\n');
    navigator.clipboard.writeText(emails);
    toast({ title: "Copied!", description: `${contacts.length} emails copied` });
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="searches" className="gap-2">
              <History className="h-4 w-4" />
              Contact Searches ({regularRuns?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="special" className="gap-2">
              <Building2 className="h-4 w-4" />
              Special Requests ({specialRuns?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="additional" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Additional ({additionalRuns?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="searches">
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
                  {regularRuns?.length || 0} searches found
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!profileName ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">Select a Profile</h3>
                <p className="text-sm text-muted-foreground">
                  Choose your profile from the header to view your search history
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : regularRuns && regularRuns.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Contacts Found</TableHead>
                    <TableHead>In Bullhorn</TableHead>
                    <TableHead>Max Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regularRuns.map((run) => (
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
                      <TableCell>
                        {bullhornOverlap[run.id] ? (
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {bullhornOverlap[run.id].existing}/{bullhornOverlap[run.id].total}
                              </span>
                              {bullhornOverlap[run.id].recentNotes > 0 && (
                                <span className="text-xs text-orange-600" title="Contacts with notes in the last 2 weeks">
                                  ⚠ {bullhornOverlap[run.id].recentNotes} contacted recently
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => checkBullhornOverlap(run.id)}
                            disabled={checkingRunId === run.id || getTotalContactCount(run) === 0}
                          >
                            {checkingRunId === run.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>{run.search_counter}</TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openRunDetails(run)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => downloadCSV(run)}
                            disabled={getTotalContactCount(run) === 0}
                            title="Download CSV"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const overlap = bullhornOverlap[run.id];
                              const excludedEmails = overlap ? [...(overlap.recentNoteEmails || [])] : [];
                              openSkillsReview(run, excludedEmails);
                            }}
                            disabled={getTotalContactCount(run) === 0 || exportingRunId === run.id}
                            title="AI Skills Review → Bullhorn"
                          >
                            {exportingRunId === run.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const overlap = bullhornOverlap[run.id];
                              const excludedEmails = overlap ? [...(overlap.recentNoteEmails || [])] : [];
                              exportTooBullhornMutation.mutate({ runId: run.id, excludedEmails: excludedEmails.length > 0 ? excludedEmails : undefined });
                            }}
                            disabled={getTotalContactCount(run) === 0 || exportingRunId === run.id}
                            title={run.bullhorn_exported_at ? "Re-export to Bullhorn (quick)" : "Export to Bullhorn (quick)"}
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
          </TabsContent>

          <TabsContent value="special">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Special Requests</CardTitle>
                    <CardDescription>
                      Company-specific contact searches
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!profileName ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">Select a Profile</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose your profile from the header to view your special requests
                    </p>
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : specialRuns && specialRuns.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Contacts</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {specialRuns.map((run) => {
                        const prefs = (run.preferences_data as any[])?.[0] || {};
                        return (
                          <TableRow key={run.id} className="animate-fade-in">
                            <TableCell className="font-medium">{getCandidateName(run)}</TableCell>
                            <TableCell>{prefs.company || '-'}</TableCell>
                            <TableCell>{prefs.country || '-'}</TableCell>
                            <TableCell>{format(new Date(run.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                {getTotalContactCount(run)}
                              </div>
                            </TableCell>
                            <TableCell><StatusBadge status={run.status} /></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openRunDetails(run)} title="View details">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => copySpecialEmails(run)} disabled={getTotalContactCount(run) === 0} title="Copy emails">
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => downloadCSV(run)} disabled={getTotalContactCount(run) === 0} title="Download CSV">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                      <Inbox className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">No special requests yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Use the Special Request tab on Upload & Run to search for contacts at a specific company
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="additional">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Additional Searches</CardTitle>
                    <CardDescription>
                      Signal TA and Job Board Apollo contact searches
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!profileName ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">Select a Profile</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose your profile from the header to view additional searches
                    </p>
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : additionalRuns && additionalRuns.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Contacts</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {additionalRuns.map((run) => {
                        const prefs = (run.preferences_data as any[])?.[0] || {};
                        const typeLabel = prefs.type === "signal_ta" ? "Signal TA" : "Job Board Apollo";
                        const target =
                          prefs.company || prefs.targetCompany || getCandidateName(run) || "Unknown";
                        return (
                          <TableRow key={run.id} className="animate-fade-in">
                            <TableCell className="font-medium">{typeLabel}</TableCell>
                            <TableCell>{target}</TableCell>
                            <TableCell>{format(new Date(run.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                {getTotalContactCount(run)}
                              </div>
                            </TableCell>
                            <TableCell><StatusBadge status={run.status} /></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openRunDetails(run)} title="View details">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => downloadCSV(run)} disabled={getTotalContactCount(run) === 0} title="Download CSV">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                      <Inbox className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">No additional searches yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Run TA contacts from Signals or Apollo AI from Job Board to see history here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-sm">All Contacts</CardTitle>
                        <div className="flex items-center gap-2">
                          {bullhornOverlap[selectedRun.id]?.recentNotes > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const recentEmails = bullhornOverlap[selectedRun.id]?.recentNoteEmails || [];
                                setRemovedContacts(prev => new Set([...prev, ...recentEmails]));
                              }}
                              className="text-orange-600 border-orange-300 hover:bg-orange-50"
                            >
                              Remove {bullhornOverlap[selectedRun.id].recentNotes} Recently Contacted
                            </Button>
                          )}
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
                      </div>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">Action</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Bullhorn</TableHead>
                            <TableHead>Skills</TableHead>
                            <TableHead>Email</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {((selectedRun.enriched_data as unknown) as ApolloContact[]).map((contact, i) => {
                            const isRemoved = removedContacts.has(contact.email);
                            const skills = generateBullhornSkillsString(contact, selectedRunPreferences);
                            const overlapData = bullhornOverlap[selectedRun.id];
                            const isInBullhorn = overlapData?.existingEmails?.includes(contact.email);
                            const hasRecentNote = overlapData?.recentNoteEmails?.includes(contact.email);
                            const contactDetail = overlapData?.contactDetails?.[contact.email];
                            
                            return (
                              <TableRow 
                                key={i} 
                                className={`${isRemoved ? 'opacity-40 bg-muted/50' : ''} ${isInBullhorn ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''} ${hasRecentNote ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''}`}
                              >
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
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {contact.name || '-'}
                                    {isInBullhorn && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                        <Database className="h-3 w-3 mr-0.5" />
                                        BH
                                      </span>
                                    )}
                                    {hasRecentNote && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                        Recent
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{contact.title || '-'}</TableCell>
                                <TableCell>{contact.company || '-'}</TableCell>
                                <TableCell className="max-w-[200px]">
                                  {isInBullhorn && contactDetail?.lastNoteText ? (
                                    <div className="flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MessageSquare className="h-3 w-3" />
                                        {contactDetail.lastNoteDate ? (
                                          <span title={format(new Date(contactDetail.lastNoteDate), 'MMM d, yyyy HH:mm')}>
                                            {formatDistanceToNow(new Date(contactDetail.lastNoteDate), { addSuffix: true })}
                                          </span>
                                        ) : null}
                                        {contactDetail.lastNoteBy && (
                                          <span className="text-muted-foreground/70">by {contactDetail.lastNoteBy}</span>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground truncate" title={contactDetail.lastNoteText}>
                                        {contactDetail.lastNoteText}
                                      </p>
                                    </div>
                                  ) : isInBullhorn ? (
                                    <span className="text-xs text-muted-foreground italic">No notes</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={skills}>
                                  {skills || '-'}
                                </TableCell>
                                <TableCell className="text-primary text-sm">{contact.email || '-'}</TableCell>
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
                  <Button
                    variant="outline"
                    onClick={() => {
                      const excludedEmails = Array.from(removedContacts);
                      setSelectedRun(null);
                      openSkillsReview(selectedRun, excludedEmails);
                    }}
                    disabled={getContactCount(selectedRun, removedContacts) === 0 || exportingRunId === selectedRun.id}
                    className="flex-1 text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI Review Skills
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
                      onClick={() => exportTooBullhornMutation.mutate({ runId: selectedRun.id, excludedEmails: Array.from(removedContacts) })}
                      disabled={getContactCount(selectedRun, removedContacts) === 0 || exportingRunId === selectedRun.id}
                      className="flex-1"
                    >
                      {exportingRunId === selectedRun.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Quick Export
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Skills Review Modal */}
        {skillsReviewRun && (
          <SkillsReviewModal
            isOpen={!!skillsReviewRun}
            onClose={() => setSkillsReviewRun(null)}
            contacts={((skillsReviewRun.enriched_data as unknown) as ApolloContact[]) || []}
            preferences={normalizePreferencesData(skillsReviewRun.preferences_data)}
            onConfirm={handleSkillsReviewConfirm}
          />
        )}
      </div>
    </AppLayout>
  );
}
