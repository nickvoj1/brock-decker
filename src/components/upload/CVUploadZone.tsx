import { useCallback, useEffect, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, X, Loader2, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CVPreviewModal } from "./CVPreviewModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

interface CVUploadZoneProps {
  onFileSelect: (file: File) => void;
  onClear: () => void;
  onParsed?: (data: ParsedCandidate | null) => void;
  file: File | null;
  parsedData: ParsedCandidate | null;
  error: string | null;
  isProcessing: boolean;
  headerImageUrl?: string | null;
  watermarkImageUrl?: string | null;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc'];

export function CVUploadZone({
  onFileSelect,
  onClear,
  onParsed,
  file,
  parsedData,
  error,
  isProcessing,
  headerImageUrl,
  watermarkImageUrl,
}: CVUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [expandedWorkHistory, setExpandedWorkHistory] = useState(false);
  const [editorDraft, setEditorDraft] = useState<ParsedCandidate | null>(null);

  useEffect(() => {
    setEditorDraft(parsedData);
  }, [parsedData]);

  const isValidFile = (file: File): boolean => {
    const hasValidType = ACCEPTED_TYPES.includes(file.type);
    const hasValidExtension = ACCEPTED_EXTENSIONS.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    return hasValidType || hasValidExtension;
  };

  const handleFile = useCallback((file: File) => {
    if (!isValidFile(file)) {
      return;
    }
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  }, [handleFile]);

  const hasFile = file !== null;
  const isValid = hasFile && parsedData && !error;

  const saveEditedCandidate = () => {
    if (!editorDraft || !onParsed) {
      setShowEditor(false);
      return;
    }
    const normalizedSkills = Array.from(
      new Set(
        (editorDraft.skills || [])
          .map((s) => String(s || "").trim())
          .filter(Boolean),
      ),
    );
    onParsed({ ...editorDraft, skills: normalizedSkills });
    setShowEditor(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Candidate CV</label>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative rounded-lg border-2 border-dashed transition-all duration-200",
          isDragging && "border-primary bg-primary/5",
          hasFile && isValid && "border-success bg-success/5",
          hasFile && error && "border-destructive bg-destructive/5",
          hasFile && isProcessing && "border-primary bg-primary/5",
          !hasFile && !isDragging && "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        {hasFile ? (
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {isProcessing ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  </div>
                ) : isValid ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-foreground">{file.name}</p>
                  {isProcessing && (
                    <p className="text-sm text-primary">
                      Extracting candidate information with AI...
                    </p>
                  )}
                  {isValid && parsedData && (
                    <div className="text-sm text-success space-y-0.5">
                      <p className="font-medium">{parsedData.name}</p>
                      <p className="text-muted-foreground">
                        {parsedData.current_title} • {parsedData.location}
                      </p>
                    </div>
                  )}
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                </div>
              </div>
              {!isProcessing && (
                <button
                  onClick={onClear}
                  className="rounded-full p-1 hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {isValid && parsedData && (
              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-md bg-muted/50 space-y-2 text-sm">
                  {parsedData.email && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="text-foreground">{parsedData.email}</span>
                    </div>
                  )}
                  {parsedData.phone && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="text-foreground">{parsedData.phone}</span>
                    </div>
                  )}
                  {parsedData.work_history && parsedData.work_history.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Work History ({parsedData.work_history.length}):</span>
                      <div className="pl-2 space-y-1">
                        {(expandedWorkHistory ? parsedData.work_history : parsedData.work_history.slice(0, 2)).map((exp, i) => (
                          <div key={i} className="text-xs">
                            <span className="font-medium">{exp.title}</span>
                            <span className="text-muted-foreground"> @ {exp.company}</span>
                          </div>
                        ))}
                        {parsedData.work_history.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setExpandedWorkHistory(!expandedWorkHistory)}
                            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                          >
                            {expandedWorkHistory ? (
                              <>
                                <ChevronUp className="h-3 w-3" />
                                Show less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" />
                                +{parsedData.work_history.length - 2} more
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(true)}
                    className="w-full gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Preview Full CV
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowEditor(true)}
                    className="w-full"
                  >
                    Edit Parsed CV
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center p-8 cursor-pointer">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Drop your CV here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">PDF or Word document</p>
            <input
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={handleInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        AI will extract full profile including work history
      </p>
      
      <CVPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        candidate={parsedData}
        headerImageUrl={headerImageUrl}
        watermarkImageUrl={watermarkImageUrl}
      />

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Parsed CV</DialogTitle>
          </DialogHeader>
          {!editorDraft ? (
            <p className="text-sm text-muted-foreground">No parsed CV data to edit yet.</p>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="cv-edit-name">Full Name</Label>
                  <Input
                    id="cv-edit-name"
                    value={editorDraft.name || ""}
                    onChange={(e) => setEditorDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cv-edit-title">Current Title</Label>
                  <Input
                    id="cv-edit-title"
                    value={editorDraft.current_title || ""}
                    onChange={(e) => setEditorDraft((prev) => (prev ? { ...prev, current_title: e.target.value } : prev))}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="cv-edit-location">Location</Label>
                  <Input
                    id="cv-edit-location"
                    value={editorDraft.location || ""}
                    onChange={(e) => setEditorDraft((prev) => (prev ? { ...prev, location: e.target.value } : prev))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cv-edit-email">Email</Label>
                  <Input
                    id="cv-edit-email"
                    value={editorDraft.email || ""}
                    onChange={(e) => setEditorDraft((prev) => (prev ? { ...prev, email: e.target.value } : prev))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cv-edit-phone">Phone</Label>
                <Input
                  id="cv-edit-phone"
                  value={editorDraft.phone || ""}
                  onChange={(e) => setEditorDraft((prev) => (prev ? { ...prev, phone: e.target.value } : prev))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cv-edit-skills">Skills (comma-separated)</Label>
                <Input
                  id="cv-edit-skills"
                  value={(editorDraft.skills || []).join(", ")}
                  onChange={(e) =>
                    setEditorDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            skills: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cv-edit-summary">Summary</Label>
                <Textarea
                  id="cv-edit-summary"
                  rows={4}
                  value={editorDraft.summary || ""}
                  onChange={(e) => setEditorDraft((prev) => (prev ? { ...prev, summary: e.target.value } : prev))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveEditedCandidate}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
