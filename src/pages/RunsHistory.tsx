import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { History, Download, Eye, Filter, Inbox } from "lucide-react";
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
}

export default function RunsHistory() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRun, setSelectedRun] = useState<EnrichmentRun | null>(null);

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

  const downloadCSV = (run: EnrichmentRun) => {
    const enrichedData = run.enriched_data as Record<string, string>[];
    if (!enrichedData || enrichedData.length === 0) return;

    const headers = Object.keys(enrichedData[0]);
    const csvContent = [
      headers.join(','),
      ...enrichedData.map(row => 
        headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enriched-run-${run.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout 
      title="Runs History" 
      description="View past enrichment runs and download results"
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
                <CardTitle className="text-lg">Enrichment Runs</CardTitle>
                <CardDescription>
                  {runs?.length || 0} runs found
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
                    <TableHead>Run ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Counter</TableHead>
                    <TableHead>Candidates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id} className="animate-fade-in">
                      <TableCell className="font-mono text-sm">
                        {run.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {format(new Date(run.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>{run.search_counter}</TableCell>
                      <TableCell>
                        {run.processed_count}/{run.candidates_count}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRun(run)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadCSV(run)}
                            disabled={run.status !== 'success' && run.status !== 'partial'}
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
                <h3 className="font-medium text-foreground mb-1">No runs yet</h3>
                <p className="text-sm text-muted-foreground">
                  Upload files and run an enrichment to see results here
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Run Details Dialog */}
        <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Run Details</DialogTitle>
              <DialogDescription>
                Run ID: {selectedRun?.id}
              </DialogDescription>
            </DialogHeader>
            
            {selectedRun && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{selectedRun.candidates_count}</div>
                      <div className="text-sm text-muted-foreground">Total Candidates</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{selectedRun.processed_count}</div>
                      <div className="text-sm text-muted-foreground">Processed</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <StatusBadge status={selectedRun.status} />
                      <div className="text-sm text-muted-foreground mt-2">Status</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{selectedRun.search_counter}</div>
                      <div className="text-sm text-muted-foreground">Search Counter</div>
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

                {/* Preview */}
                {selectedRun.enriched_data && (selectedRun.enriched_data as any[]).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Preview (First 10 rows)</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys((selectedRun.enriched_data as Record<string, string>[])[0]).map((key) => (
                              <TableHead key={key} className="whitespace-nowrap">{key}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(selectedRun.enriched_data as Record<string, string>[]).slice(0, 10).map((row, i) => (
                            <TableRow key={i}>
                              {Object.values(row).map((val, j) => (
                                <TableCell key={j} className="whitespace-nowrap max-w-[200px] truncate">
                                  {val || '-'}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Bullhorn Errors */}
                {selectedRun.bullhorn_enabled && (selectedRun.bullhorn_errors as any[])?.length > 0 && (
                  <Card className="border-warning/50">
                    <CardHeader>
                      <CardTitle className="text-warning text-sm">Bullhorn Errors</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm space-y-1">
                        {(selectedRun.bullhorn_errors as string[]).map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Download Button */}
                <Button
                  onClick={() => downloadCSV(selectedRun)}
                  disabled={selectedRun.status !== 'success' && selectedRun.status !== 'partial'}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Enriched CSV
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
