import { useState } from "react";
import { Building2, MapPin, Users, Play, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProfileName } from "@/hooks/useProfileName";
import { createEnrichmentRun, startEnrichmentRun, waitForEnrichmentRunCompletion } from "@/lib/dataApi";

const DEPARTMENTS = [
  'HR / Talent Acquisition',
  'Leadership / C-Suite',
  'Finance',
  'Legal',
  'Engineering / IT',
  'Sales / Business Development',
  'Marketing',
  'Operations',
];

const DEPARTMENT_TITLES: Record<string, string[]> = {
  'HR / Talent Acquisition': ['Recruiter', 'Talent Acquisition', 'HR Manager', 'HR Director', 'People Operations', 'Head of Talent'],
  'Leadership / C-Suite': ['CEO', 'CTO', 'CFO', 'COO', 'Managing Director', 'Partner', 'Founder'],
  'Finance': ['Finance Director', 'CFO', 'Financial Controller', 'Head of Finance', 'Investment Director', 'Fund Manager'],
  'Legal': ['General Counsel', 'Head of Legal', 'Legal Director', 'Legal Counsel', 'Attorney', 'Compliance Officer'],
  'Engineering / IT': ['Engineering Manager', 'VP Engineering', 'CTO', 'IT Director', 'Head of Engineering'],
  'Sales / Business Development': ['Sales Director', 'VP Sales', 'Head of Sales', 'Business Development', 'Partnership Manager'],
  'Marketing': ['CMO', 'Marketing Director', 'VP Marketing', 'Head of Marketing', 'Growth Manager'],
  'Operations': ['COO', 'Operations Director', 'VP Operations', 'Head of Operations', 'Operations Manager'],
};

interface SpecialRequestContact {
  name: string;
  title: string;
  company: string;
  email: string;
  location: string;
}

function inferRegionFromLocation(value: string): "london" | "europe" | "uae" | "usa" {
  const t = value.toLowerCase();
  if (t.includes("dubai") || t.includes("abu dhabi") || t.includes("uae")) return "uae";
  if (t.includes("london") || t.includes("uk") || t.includes("united kingdom")) return "london";
  if (
    t.includes("new york") ||
    t.includes("usa") ||
    t.includes("united states") ||
    t.includes("san francisco") ||
    t.includes("los angeles") ||
    t.includes("chicago") ||
    t.includes("boston")
  ) return "usa";
  return "europe";
}

function isCompleteContact(contact: SpecialRequestContact): boolean {
  const nameParts = (contact.name || "").trim().split(/\s+/).filter(Boolean);
  const hasName = nameParts.length >= 2;
  const hasTitle = (contact.title || "").trim().length >= 2;
  const email = (contact.email || "").trim();
  const hasEmail = email.includes("@") && email.length >= 5;
  return hasName && hasTitle && hasEmail;
}

export function SpecialRequestTab() {
  const { toast } = useToast();
  const profileName = useProfileName();
  
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [maxContacts, setMaxContacts] = useState(30);
  const [isRunning, setIsRunning] = useState(false);
  const [contacts, setContacts] = useState<SpecialRequestContact[]>([]);
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [requestName, setRequestName] = useState("");

  const toggleDepartment = (dept: string) => {
    setSelectedDepartments(prev =>
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  const canRun = profileName && company.trim() && country.trim() && selectedDepartments.length > 0 && !isRunning;

  const handleRun = async () => {
    if (!canRun) return;
    setIsRunning(true);
    setContacts([]);
    
    try {
      const targetRoles = Array.from(
        new Set(selectedDepartments.flatMap((dept) => DEPARTMENT_TITLES[dept] || []))
      );
      const searchName = requestName.trim() || `${company.trim()} - ${country.trim()}`;
      const signalRegion = inferRegionFromLocation(country.trim());

      let bullhornEmails: string[] = [];
      try {
        const { data: bhResult } = await supabase.functions.invoke('fetch-bullhorn-emails', {});
        if (bhResult?.success && Array.isArray(bhResult.emails)) {
          bullhornEmails = bhResult.emails as string[];
        }
      } catch {
        // Non-fatal: continue without Bullhorn exclusion.
      }

      const runResult = await createEnrichmentRun(profileName, {
        search_counter: maxContacts,
        candidates_count: 1,
        preferences_count: 1,
        status: 'pending',
        bullhorn_enabled: false,
        candidates_data: [{
          candidate_id: `SR-${Date.now()}`,
          name: searchName,
          current_title: 'Special Request',
          location: country.trim(),
          skills: [],
          work_history: [],
          education: [],
        }],
        preferences_data: [{
          type: 'special_request',
          industry: 'Private Equity',
          companies: company.trim(),
          exclusions: '',
          excludedIndustries: [],
          locations: [country.trim()],
          targetRoles,
          sectors: selectedDepartments,
          targetCompany: company.trim(),
          signalTitle: `Special request: ${company.trim()}`,
          signalRegion,
          country: country.trim(),
          departments: selectedDepartments,
        }],
      });

      if (!runResult.success || !runResult.data?.id) {
        throw new Error(runResult.error || 'Failed to create enrichment run');
      }

      const kickOffResult = await startEnrichmentRun(profileName, runResult.data.id, bullhornEmails);
      if (!kickOffResult.success) {
        throw new Error(kickOffResult.error || "Failed to start enrichment run");
      }

      const completion = await waitForEnrichmentRunCompletion(profileName, runResult.data.id, {
        timeoutMs: 180000,
        intervalMs: 2000,
      });
      if (!completion.success) {
        throw new Error(completion.error || "Failed while waiting for enrichment run");
      }
      if (completion.timedOut) {
        toast({
          title: "Search continues in background",
          description: "You can leave this page. Open Runs History to view final contacts.",
        });
        return;
      }

      const finalRun = completion.data || {};
      const rawContacts = Array.isArray(finalRun?.enriched_data) ? finalRun.enriched_data : [];
      const normalizedContacts: SpecialRequestContact[] = rawContacts.map((c: any) => ({
        name: String(c?.name || ''),
        title: String(c?.title || ''),
        company: String(c?.company || company.trim()),
        email: String(c?.email || ''),
        location: String(c?.location || country.trim()),
      }));
      const completeContacts = normalizedContacts.filter(isCompleteContact);

      setContacts(completeContacts);
      if (completeContacts.length > 0) {
        toast({
          title: `Found ${completeContacts.length} contacts`,
          description: `At ${company} in ${country}`,
        });
      } else {
        const finalStatus = String(finalRun.status || "").toLowerCase();
        toast({
          title: finalStatus === "failed" ? "Search failed" : "No contacts found",
          description: finalRun.error_message || `No complete contacts found at ${company} in ${country}`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Search failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const copyEmails = () => {
    const emails = contacts.map(c => c.email).join('\n');
    navigator.clipboard.writeText(emails);
    setCopiedEmails(true);
    setTimeout(() => setCopiedEmails(false), 2000);
    toast({ title: "Copied!", description: `${contacts.length} emails copied to clipboard` });
  };

  const copyAll = () => {
    const lines = contacts.map(c => `${c.name}\t${c.title}\t${c.company}\t${c.email}\t${c.location}`);
    navigator.clipboard.writeText(`Name\tTitle\tCompany\tEmail\tLocation\n${lines.join('\n')}`);
    toast({ title: "Copied!", description: `${contacts.length} contacts copied (paste into Excel/Sheets)` });
  };

  const downloadCSV = () => {
    if (contacts.length === 0) return;
    const header = "Name,Title,Company,Email,Location\n";
    const rows = contacts.map(c =>
      `"${c.name}","${c.title}","${c.company}","${c.email}","${c.location}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `special-request-${company.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Company & Country */}
      <Card className="animate-slide-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Target Company & Location</CardTitle>
              <CardDescription>Find contacts from a specific company in a specific country</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sr-company">Company Name *</Label>
              <Input
                id="sr-company"
                placeholder="e.g., Blackstone, KKR, Google"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sr-country">Country / Location *</Label>
              <Input
                id="sr-country"
                placeholder="e.g., United Kingdom, Germany, New York"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sr-name">Request Name (optional)</Label>
            <Input
              id="sr-name"
              placeholder="Give this request a name for easy identification"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Departments */}
      <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Department *</CardTitle>
              <CardDescription>Select which departments to search for contacts in</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENTS.map((dept) => (
              <Badge
                key={dept}
                variant={selectedDepartments.includes(dept) ? "default" : "outline"}
                className="cursor-pointer text-sm py-1.5 px-3 transition-colors"
                onClick={() => toggleDepartment(dept)}
              >
                {dept}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Max contacts & Run */}
      <Card className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Play className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Run Special Request</CardTitle>
              <CardDescription>
                {canRun
                  ? `Search for up to ${maxContacts} contacts at ${company} in ${country}`
                  : "Fill in company, country, and select at least one department"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="sr-max">Max Contacts</Label>
              <Input
                id="sr-max"
                type="number"
                min={5}
                max={200}
                step={5}
                value={maxContacts}
                onChange={(e) => setMaxContacts(Math.max(5, Math.min(200, parseInt(e.target.value) || 30)))}
                className="w-[120px]"
              />
            </div>
            <Button onClick={handleRun} disabled={!canRun} className="btn-premium" size="lg">
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Find Contacts
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {contacts.length > 0 && (
        <Card className="animate-slide-up border-success/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Results — {contacts.length} contacts found</CardTitle>
                <CardDescription>At {company} in {country}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyEmails}>
                  {copiedEmails ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                  {copiedEmails ? "Copied!" : "Copy Emails"}
                </Button>
                <Button variant="outline" size="sm" onClick={copyAll}>
                  <Copy className="mr-1 h-3 w-3" />
                  Copy All
                </Button>
                <Button variant="outline" size="sm" onClick={downloadCSV}>
                  CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium">Title</th>
                    <th className="text-left p-2 font-medium">Company</th>
                    <th className="text-left p-2 font-medium">Email</th>
                    <th className="text-left p-2 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-muted-foreground">{c.title}</td>
                      <td className="p-2">{c.company}</td>
                      <td className="p-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.email);
                            toast({ title: "Copied", description: c.email });
                          }}
                          className="text-primary hover:underline cursor-pointer"
                        >
                          {c.email}
                        </button>
                      </td>
                      <td className="p-2 text-muted-foreground">{c.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
