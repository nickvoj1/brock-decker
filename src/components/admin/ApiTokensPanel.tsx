import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Eye, EyeOff, RefreshCw, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { getAllApiTokens } from "@/lib/dataApi";

interface Props {
  profileName: string;
}

type TokenRow = { key: string; value: string; source: "db" | "env"; updatedAt?: string };

export function ApiTokensPanel({ profileName }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [allVisible, setAllVisible] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAllApiTokens(profileName);
      if (!res.success || !res.data) {
        toast.error(res.error || "Failed to load API tokens");
        return;
      }
      const dbRows: TokenRow[] = (res.data.dbSettings || []).map((s) => ({
        key: s.setting_key,
        value: s.setting_value || "",
        source: "db",
        updatedAt: s.updated_at,
      }));
      const envRows: TokenRow[] = (res.data.envSecrets || []).map((s) => ({
        key: s.name,
        value: s.value || "",
        source: "env",
      }));
      setRows([...envRows, ...dbRows]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileName]);

  const toggleOne = (k: string) => setVisible((v) => ({ ...v, [k]: !v[k] }));
  const toggleAll = () => {
    const next = !allVisible;
    setAllVisible(next);
    const map: Record<string, boolean> = {};
    rows.forEach((r) => (map[r.key] = next));
    setVisible(map);
  };

  const copy = async (val: string, label: string) => {
    if (!val) {
      toast.error("Empty value");
      return;
    }
    await navigator.clipboard.writeText(val);
    toast.success(`${label} copied`);
  };

  const mask = (v: string) => (v ? `${"•".repeat(Math.min(24, Math.max(8, v.length)))}` : "(empty)");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> API Tokens
            </CardTitle>
            <CardDescription>
              Plaintext view of all stored API tokens and edge function secrets. Admin only.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {allVisible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {allVisible ? "Hide all" : "Show all"}
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const isVisible = visible[r.key] ?? allVisible;
                return (
                  <TableRow key={`${r.source}:${r.key}`}>
                    <TableCell className="font-mono text-xs">{r.key}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {r.source === "env" ? "Edge Secret" : "DB Setting"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[420px]">
                      <code className="block break-all rounded bg-muted px-2 py-1 text-xs">
                        {isVisible ? r.value || "(empty)" : mask(r.value)}
                      </code>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => toggleOne(r.key)}>
                          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copy(r.value, r.key)}
                          disabled={!r.value}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    No tokens found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
