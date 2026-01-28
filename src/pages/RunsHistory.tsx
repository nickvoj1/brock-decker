import { useState, useEffect } from "react";
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
import {
  countBullhornSkills,
  generateBullhornSkillsString,
  normalizePreferencesData,
} from "@/lib/bullhornSkills";

type RunStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed';

interface ApolloContact {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  location?: string;
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
  const [bullhornOverlap, setBullhornOverlap] = useState<Record<string, { existing: number; recentNotes: number; recentNoteEmails: string[]; total: number; loading: boolean }>>({});

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
      
      let query = supabase
        .from('enrichment_runs')
        .select('*')
        .eq('uploaded_by', profileName)
        .order('created_at', { ascending: false });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as RunStatus);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as EnrichmentRun[];
    },
    enabled: !!profileName, // Only run query if profile is selected
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

  // Auto-fetch Bullhorn overlap for all runs
  useEffect(() => {
    if (!runs || runs.length === 0) return;
    
    runs.forEach(async (run) => {
      if (bullhornOverlap[run.id] || getTotalContactCount(run) === 0) return;
      
      // Mark as loading
      setBullhornOverlap(prev => ({
        ...prev,
        [run.id]: { existing: 0, recentNotes: 0, recentNoteEmails: [], total: 0, loading: true }
      }));
      
      try {
        const { data, error } = await supabase.functions.invoke('check-bullhorn-overlap', {
          body: { runId: run.id }
        });
        
        if (error || !data?.success) {
          setBullhornOverlap(prev => ({
            ...prev,
            [run.id]: { existing: 0, recentNotes: 0, recentNoteEmails: [], total: getTotalContactCount(run), loading: false }
          }));
          return;
        }
        
        setBullhornOverlap(prev => ({
          ...prev,
          [run.id]: { 
            existing: data.existingCount, 
            recentNotes: data.recentNoteCount || 0, 
            recentNoteEmails: data.recentNoteEmails || [],
            total: data.totalCount,
            loading: false 
          }
        }));
      } catch {
        setBullhornOverlap(prev => ({
          ...prev,
          [run.id]: { existing: 0, recentNotes: 0, recentNoteEmails: [], total: getTotalContactCount(run), loading: false }
        }));
      }
    });
  }, [runs]);

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
            ) : runs && runs.length > 0 ? (
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
                      <TableCell>
                        {bullhornOverlap[run.id] ? (
                          bullhornOverlap[run.id].loading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {bullhornOverlap[run.id].existing}/{bullhornOverlap[run.id].total}
                              </span>
                              {bullhornOverlap[run.id].recentNotes > 0 && (
                                <span className="text-xs text-orange-600" title="Contacts with notes in the last 2 weeks">
                                  {bullhornOverlap[run.id].recentNotes} recent
                                </span>
                              )}
                            </div>
                          )
                        ) : getTotalContactCount(run) === 0 ? (
                          <span className="text-sm text-muted-foreground">-</span>
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
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
                             const skills = generateBullhornSkillsString(contact, selectedRunPreferences);
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
