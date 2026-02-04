import { ExternalLink, Building2, MapPin, Users, Copy, Check, Mail } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { JobSignal } from "@/lib/signalsApi";

interface JobSignalCardProps {
  job: JobSignal;
  onDismiss?: (id: string) => void;
  onEmailTA?: (job: JobSignal) => void;
}

export function JobSignalCard({ job, onDismiss, onEmailTA }: JobSignalCardProps) {
  const [copied, setCopied] = useState(false);
  
  const tierColors: Record<string, string> = {
    tier_1: "bg-destructive/10 text-destructive border-destructive/20",
    tier_2: "bg-warning/10 text-warning border-warning/20",
    tier_3: "bg-success/10 text-success border-success/20",
  };
  
  const tierLabels: Record<string, string> = {
    tier_1: "Hot",
    tier_2: "Active",
    tier_3: "Watching",
  };
  
  const handleCopySpec = () => {
    const spec = `Company: ${job.company}
Role: ${job.job_title}
Location: ${job.location || "Global"}
Link: ${job.job_url || "N/A"}

TA Contacts:
${job.contacts.map(c => `• ${c.name} - ${c.title}${c.email ? ` (${c.email})` : ""}`).join("\n")}

— Brock & Decker Signals`;
    
    navigator.clipboard.writeText(spec);
    setCopied(true);
    toast.success("Spec template copied!");
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleEmailAll = () => {
    const emails = job.contacts.filter(c => c.email).map(c => c.email).join(",");
    if (emails) {
      window.location.href = `mailto:${emails}?subject=Regarding ${job.job_title} at ${job.company}`;
    } else {
      toast.error("No emails available for these contacts");
    }
  };
  
  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={tierColors[job.tier] || tierColors.tier_2}>
                {tierLabels[job.tier] || job.tier}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                {job.contacts_count} contacts
              </Badge>
              <span className="text-xs text-muted-foreground">
                Score: {job.score}
              </span>
            </div>
            <h3 className="font-semibold text-base leading-tight">
              {job.company}: {job.job_title.replace(`Active Hiring - ${job.company}`, "Active Hiring")}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {job.job_url && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => window.open(job.job_url, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Location & Company Info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {job.company}
          </span>
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {job.location}
            </span>
          )}
        </div>
        
        {/* Description */}
        {job.job_description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {job.job_description}
          </p>
        )}
        
        {/* Contacts Preview */}
        {job.contacts.length > 0 && (
          <div className="bg-muted/30 rounded-md p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">TA Contacts:</p>
            <div className="space-y-1.5">
              {job.contacts.slice(0, 3).map((contact, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{contact.name}</span>
                    <span className="text-muted-foreground ml-2">{contact.title}</span>
                  </div>
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-primary hover:underline text-xs ml-2 flex-shrink-0"
                    >
                      {contact.email}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleCopySpec}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Spec"}
          </Button>
          <Button
            size="sm"
            variant="default"
            className="gap-1.5"
            onClick={handleEmailAll}
            disabled={job.contacts.filter(c => c.email).length === 0}
          >
            <Mail className="h-3.5 w-3.5" />
            Email TA ({job.contacts.filter(c => c.email).length})
          </Button>
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-muted-foreground"
              onClick={() => onDismiss(job.id)}
            >
              Dismiss
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
