import { useCallback, useEffect, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, X, Loader2, Eye, ChevronDown, ChevronUp, Download, Plus, Trash2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CVPreviewModal } from "./CVPreviewModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { downloadBrandedSourcePdf, downloadCandidatePdf } from "@/lib/cvPdf";
import { useToast } from "@/hooks/use-toast";

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
  originalFile?: File | null;
  headerImageUrl?: string | null;
  watermarkImageUrl?: string | null;
  headerText?: string | null;
  /** Original PII captured from the parsed CV BEFORE any client-side sanitization.
   *  Used by the PDF redactor to precisely mask name/email/phone in the source PDF. */
  redactionHints?: { name?: string; email?: string; phone?: string };
  sourcePdfExportMode?: "preserve" | "generated";
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
  originalFile,
  headerImageUrl,
  watermarkImageUrl,
  headerText,
  redactionHints,
  sourcePdfExportMode = "preserve",
}: CVUploadZoneProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [expandedWorkHistory, setExpandedWorkHistory] = useState(false);
  const [editorDraft, setEditorDraft] = useState<ParsedCandidate | null>(null);
  const [nameMode, setNameMode] = useState<"real" | "anonymous">("real");
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    setEditorDraft(parsedData);
    setNameMode("real");
    setSkillInput("");
  }, [parsedData]);

  const withSelectedName = (candidate: ParsedCandidate | null): ParsedCandidate | null => {
    if (!candidate) return null;
    if (nameMode === "anonymous") return { ...candidate, name: "CANDIDATE" };
    return candidate;
  };

  const updateDraft = (patch: Partial<ParsedCandidate>) => {
    setEditorDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateWork = (idx: number, patch: Partial<WorkExperience>) => {
    setEditorDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.work_history];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, work_history: next };
    });
  };
  const addWork = () =>
    setEditorDraft((prev) =>
      prev
        ? { ...prev, work_history: [...prev.work_history, { company: "", title: "", duration: "" }] }
        : prev,
    );
  const removeWork = (idx: number) =>
    setEditorDraft((prev) =>
      prev ? { ...prev, work_history: prev.work_history.filter((_, i) => i !== idx) } : prev,
    );

  const updateEdu = (idx: number, patch: Partial<Education>) => {
    setEditorDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.education];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, education: next };
    });
  };
  const addEdu = () =>
    setEditorDraft((prev) =>
      prev
        ? { ...prev, education: [...prev.education, { institution: "", degree: "", year: "" }] }
        : prev,
    );
  const removeEdu = (idx: number) =>
    setEditorDraft((prev) =>
      prev ? { ...prev, education: prev.education.filter((_, i) => i !== idx) } : prev,
    );

  const addSkill = () => {
    const value = skillInput.trim();
    if (!value) return;
    setEditorDraft((prev) => {
      if (!prev) return prev;
      if (prev.skills.includes(value)) return prev;
      return { ...prev, skills: [...prev.skills, value] };
    });
    setSkillInput("");
  };
  const removeSkill = (skill: string) =>
    setEditorDraft((prev) =>
      prev ? { ...prev, skills: prev.skills.filter((s) => s !== skill) } : prev,
    );

  const resetDraft = () => {
    setEditorDraft(parsedData);
    setNameMode("real");
    setSkillInput("");
  };

  const saveDraft = () => {
    if (editorDraft && onParsed) onParsed(editorDraft);
    toast({ title: "CV updated", description: "Edits saved for this session." });
    setShowEditor(false);
  };

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

  const downloadEditedCandidate = async () => {
    try {
      const sourceBase = editorDraft || parsedData;
      if (!sourceBase) return;
      const source = withSelectedName(sourceBase);
      if (!source) return;
      const outName = `${(sourceBase.name || "candidate").replace(/\s+/g, "-")}-edited-cv`;
      const branding = { watermarkImageUrl, headerImageUrl, headerText };
      if (sourcePdfExportMode === "preserve" && originalFile && originalFile.name.toLowerCase().endsWith(".pdf")) {
        // Use the original PII captured at parse-time (before client sanitization)
        // so the redactor can target the real name/email/phone strings in the PDF.
        await downloadBrandedSourcePdf(originalFile, outName, branding, {
          name: redactionHints?.name || sourceBase.name || "",
          email: redactionHints?.email || sourceBase.email || "",
          phone: redactionHints?.phone || sourceBase.phone || "",
          anonymizeName: nameMode === "anonymous",
          replacementName: "CANDIDATE",
          displayName: source.name || sourceBase.name || "",
        });
        return;
      }
      await downloadCandidatePdf(source, outName, branding);
    } catch (error) {
      toast({
        title: "CV export failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to process CV export.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="buttons-3d space-y-2">
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClear}
                  className="h-7 w-7 rounded-full"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedWorkHistory(!expandedWorkHistory)}
                            className="h-auto p-0 text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
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
                          </Button>
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
                    Edit CV
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
        candidate={withSelectedName(parsedData)}
        headerImageUrl={headerImageUrl}
        watermarkImageUrl={watermarkImageUrl}
        headerText={headerText}
      />

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="buttons-3d max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit CV</DialogTitle>
          </DialogHeader>
          {!editorDraft ? (
            <p className="text-sm text-muted-foreground">No parsed CV data to edit yet.</p>
          ) : (
            <div className="grid gap-5 overflow-y-auto pr-2 -mr-2 flex-1">
              {/* Name Mode */}
              <div className="space-y-2">
                <Label>Name Mode</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={nameMode === "real" ? "default" : "outline"}
                    onClick={() => setNameMode("real")}
                  >
                    Use Real Name
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={nameMode === "anonymous" ? "default" : "outline"}
                    onClick={() => setNameMode("anonymous")}
                  >
                    Use CANDIDATE
                  </Button>
                </div>
              </div>

              {/* Basic info */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cv-name">Full name</Label>
                  <Input
                    id="cv-name"
                    value={editorDraft.name}
                    onChange={(e) => updateDraft({ name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cv-title">Current title</Label>
                  <Input
                    id="cv-title"
                    value={editorDraft.current_title}
                    onChange={(e) => updateDraft({ current_title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cv-location">Location</Label>
                  <Input
                    id="cv-location"
                    value={editorDraft.location}
                    onChange={(e) => updateDraft({ location: e.target.value })}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-1.5">
                <Label htmlFor="cv-summary">Summary</Label>
                <Textarea
                  id="cv-summary"
                  rows={4}
                  value={editorDraft.summary || ""}
                  onChange={(e) => updateDraft({ summary: e.target.value })}
                />
              </div>

              {/* Skills */}
              <div className="space-y-2">
                <Label>Skills ({editorDraft.skills.length})</Label>
                <div className="flex flex-wrap gap-1.5">
                  {editorDraft.skills.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-background px-2.5 py-0.5 text-xs"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => removeSkill(s)}
                        className="hover:text-destructive"
                        aria-label={`Remove ${s}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add skill and press Enter"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addSkill}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Work history */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Work history ({editorDraft.work_history.length})</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addWork}>
                    <Plus className="mr-1 h-4 w-4" /> Add role
                  </Button>
                </div>
                <div className="space-y-2">
                  {editorDraft.work_history.map((w, i) => (
                    <div
                      key={i}
                      className="grid gap-2 rounded-md border-2 border-foreground/80 p-3 sm:grid-cols-[1fr_1fr_140px_auto]"
                    >
                      <Input
                        placeholder="Company"
                        value={w.company}
                        onChange={(e) => updateWork(i, { company: e.target.value })}
                      />
                      <Input
                        placeholder="Title"
                        value={w.title}
                        onChange={(e) => updateWork(i, { title: e.target.value })}
                      />
                      <Input
                        placeholder="Duration"
                        value={w.duration || ""}
                        onChange={(e) => updateWork(i, { duration: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeWork(i)}
                        aria-label="Remove role"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Education */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Education ({editorDraft.education.length})</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addEdu}>
                    <Plus className="mr-1 h-4 w-4" /> Add education
                  </Button>
                </div>
                <div className="space-y-2">
                  {editorDraft.education.map((ed, i) => (
                    <div
                      key={i}
                      className="grid gap-2 rounded-md border-2 border-foreground/80 p-3 sm:grid-cols-[1fr_1fr_140px_auto]"
                    >
                      <Input
                        placeholder="Institution"
                        value={ed.institution}
                        onChange={(e) => updateEdu(i, { institution: e.target.value })}
                      />
                      <Input
                        placeholder="Degree"
                        value={ed.degree}
                        onChange={(e) => updateEdu(i, { degree: e.target.value })}
                      />
                      <Input
                        placeholder="Year"
                        value={ed.year || ""}
                        onChange={(e) => updateEdu(i, { year: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEdu(i)}
                        aria-label="Remove education"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={resetDraft} disabled={!editorDraft}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button type="button" variant="outline" onClick={downloadEditedCandidate} disabled={!editorDraft}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button type="button" onClick={saveDraft} disabled={!editorDraft}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
