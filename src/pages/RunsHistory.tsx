import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { History, Download, Eye, Filter, Inbox, Users, Trash2 } from "lucide-react";
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
import type { Json } from "@/integrations/supabase/types";

type RunStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed';

interface ApolloContact {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
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
}

export default function RunsHistory() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRun, setSelectedRun] = useState<EnrichmentRun | null>(null);
  const [removedContacts, setRemovedContacts] = useState<Set<string>>(new Set());
  const { data: runs, isLoading } = useQuery({
    queryKey: ['enrichment-runs', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('enrichment_runs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as RunStatus);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as EnrichmentRun[];
    },
  });

  const downloadCSV = (run: EnrichmentRun, excludedEmails: Set<string> = new Set()) => {
    const contacts = (run.enriched_data as unknown) as ApolloContact[];
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) return;

    // Filter out removed contacts
    const filteredContacts = contacts.filter(c => !excludedEmails.has(c.email));
    if (filteredContacts.length === 0) return;

    const csvHeader = 'Name,Title,Company,Email,Phone';
    const csvRows = filteredContacts.map(c => 
      `"${escapeCSV(c.name)}","${escapeCSV(c.title)}","${escapeCSV(c.company)}","${escapeCSV(c.email)}","${escapeCSV(c.phone)}"`
    );
    const csvContent = [csvHeader, ...csvRows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${run.id.slice(0, 8)}.csv`;
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
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead className="w-[80px]">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {((selectedRun.enriched_data as unknown) as ApolloContact[]).map((contact, i) => {
                            const isRemoved = removedContacts.has(contact.email);
                            return (
                              <TableRow key={i} className={isRemoved ? 'opacity-40 bg-muted/50' : ''}>
                                <TableCell className="font-medium">{contact.name || '-'}</TableCell>
                                <TableCell>{contact.title || '-'}</TableCell>
                                <TableCell>{contact.company || '-'}</TableCell>
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

                {/* Download Button */}
                <Button
                  onClick={() => downloadCSV(selectedRun, removedContacts)}
                  disabled={getContactCount(selectedRun, removedContacts) === 0}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Contacts CSV ({getContactCount(selectedRun, removedContacts)} contacts)
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
