import { useEffect, useMemo, useState } from "react";
import { Briefcase, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_CAREER_ACTOR_ID,
  DEFAULT_LINKEDIN_ACTOR_ID,
  loadJobBoardSettings,
  saveJobBoardSettings,
} from "@/lib/jobBoardSettings";

export function FantasticJobsSettingsCard() {
  const { toast } = useToast();
  const [apifyToken, setApifyToken] = useState("");
  const [linkedinActorId, setLinkedinActorId] = useState(DEFAULT_LINKEDIN_ACTOR_ID);
  const [careerActorId, setCareerActorId] = useState(DEFAULT_CAREER_ACTOR_ID);
  const [useDirectApify, setUseDirectApify] = useState(true);
  const [showApifyToken, setShowApifyToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    const settings = loadJobBoardSettings();
    setApifyToken(settings.apifyToken);
    setLinkedinActorId(settings.linkedinActorId);
    setCareerActorId(settings.careerActorId);
    setUseDirectApify(settings.useDirectApify);
  }, []);

  const isConfigured = useMemo(() => {
    return apifyToken.trim().length > 0 && linkedinActorId.trim().length > 0 && careerActorId.trim().length > 0;
  }, [apifyToken, linkedinActorId, careerActorId]);

  const handleSave = () => {
    saveJobBoardSettings({
      useDirectApify,
      apifyToken: apifyToken.trim(),
      linkedinActorId: linkedinActorId.trim() || DEFAULT_LINKEDIN_ACTOR_ID,
      careerActorId: careerActorId.trim() || DEFAULT_CAREER_ACTOR_ID,
    });

    toast({
      title: "Job board settings saved",
      description: "Signals -> Job Board will now use these credentials and actor IDs.",
    });
  };

  const testConnection = async () => {
    if (!apifyToken.trim() || !linkedinActorId.trim()) return;
    setTesting(true);
    setTestStatus("idle");

    try {
      const endpoint =
        `https://api.apify.com/v2/acts/${encodeURIComponent(linkedinActorId.trim())}` +
        `/run-sync-get-dataset-items?token=${encodeURIComponent(apifyToken.trim())}&format=json&clean=true&maxItems=10`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeRange: "7d",
          limit: 10,
          includeAi: true,
          descriptionType: "text",
          titleSearch: ["private equity"],
          locationSearch: ["London"],
          removeAgency: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Unexpected response");
      setTestStatus("success");
      toast({
        title: "Connection successful",
        description: `Fetched ${data.length} sample jobs from LinkedIn actor.`,
      });
    } catch (error) {
      setTestStatus("error");
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Apify rejected the request.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="animate-slide-up">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">Fantastic.jobs</CardTitle>
              <CardDescription>Configure Job Board credentials and data sources</CardDescription>
            </div>
          </div>
          {isConfigured && (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              Configured
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="direct-apify-mode"
            checked={useDirectApify}
            onCheckedChange={(checked) => setUseDirectApify(Boolean(checked))}
          />
          <label htmlFor="direct-apify-mode" className="text-sm cursor-pointer">
            Use Direct Apify mode (works without Supabase function deployment)
          </label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apifyToken">Apify Token</Label>
          <div className="relative">
            <Input
              id="apifyToken"
              type={showApifyToken ? "text" : "password"}
              value={apifyToken}
              onChange={(e) => setApifyToken(e.target.value)}
              placeholder="Enter your Apify token"
            />
            <button
              type="button"
              onClick={() => setShowApifyToken(!showApifyToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Create token in{" "}
            <a
              href="https://console.apify.com/account/integrations"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Apify Console
            </a>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="linkedinActorId">LinkedIn Actor ID</Label>
            <Input
              id="linkedinActorId"
              value={linkedinActorId}
              onChange={(e) => setLinkedinActorId(e.target.value)}
              placeholder={DEFAULT_LINKEDIN_ACTOR_ID}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="careerActorId">Career Actor ID</Label>
            <Input
              id="careerActorId"
              value={careerActorId}
              onChange={(e) => setCareerActorId(e.target.value)}
              placeholder={DEFAULT_CAREER_ACTOR_ID}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!isConfigured}>
            Save
          </Button>
          <Button variant="outline" onClick={testConnection} disabled={testing || !isConfigured}>
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : testStatus === "success" ? (
              <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
            ) : testStatus === "error" ? (
              <XCircle className="mr-2 h-4 w-4 text-destructive" />
            ) : null}
            Test Connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
