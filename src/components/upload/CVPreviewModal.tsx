import { User, Briefcase, GraduationCap, Mail, Phone, MapPin, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WorkExperience {
  company: string;
  title: string;
  duration?: string;
}

interface Education {
  institution: string;
  degree: string;
  year?: string;
}

interface ParsedCandidate {
  candidate_id: string;
  name: string;
  current_title: string;
  location: string;
  email?: string;
  phone?: string;
  summary?: string;
  skills: string[];
  work_history: WorkExperience[];
  education: Education[];
}

interface CVPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: ParsedCandidate | null;
}

export function CVPreviewModal({ isOpen, onClose, candidate }: CVPreviewModalProps) {
  if (!candidate) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CV Preview
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Header Section */}
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-foreground">{candidate.name}</h2>
                <p className="text-muted-foreground">{candidate.current_title}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                  {candidate.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {candidate.location}
                    </span>
                  )}
                  {candidate.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {candidate.email}
                    </span>
                  )}
                  {candidate.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {candidate.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Summary */}
            {candidate.summary && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Summary</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{candidate.summary}</p>
              </div>
            )}

            {/* Work History */}
            {candidate.work_history && candidate.work_history.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Work Experience ({candidate.work_history.length})
                </h3>
                <div className="space-y-3">
                  {candidate.work_history.map((job, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-foreground">{job.title}</p>
                          <p className="text-sm text-muted-foreground">{job.company}</p>
                        </div>
                        {job.duration && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            {job.duration}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {candidate.education && candidate.education.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Education ({candidate.education.length})
                </h3>
                <div className="space-y-3">
                  {candidate.education.map((edu, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-foreground">{edu.degree}</p>
                          <p className="text-sm text-muted-foreground">{edu.institution}</p>
                        </div>
                        {edu.year && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            {edu.year}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {candidate.skills && candidate.skills.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Skills ({candidate.skills.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {candidate.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
