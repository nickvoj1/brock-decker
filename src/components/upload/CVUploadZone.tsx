import { useCallback, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ParsedCandidate {
  candidate_id: string;
  name: string;
  position: string;
  location: string;
  company?: string;
  email?: string;
  phone?: string;
  skills?: string[];
}

interface CVUploadZoneProps {
  onFileSelect: (file: File) => void;
  onClear: () => void;
  onParsed: (data: ParsedCandidate) => void;
  file: File | null;
  parsedData: ParsedCandidate | null;
  error: string | null;
  isProcessing: boolean;
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
  file,
  parsedData,
  error,
  isProcessing,
}: CVUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

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
                        {parsedData.position} • {parsedData.location}
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
              <div className="mt-4 p-3 rounded-md bg-muted/50 space-y-2 text-sm">
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
                {parsedData.company && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">Company:</span>
                    <span className="text-foreground">{parsedData.company}</span>
                  </div>
                )}
                {parsedData.skills && parsedData.skills.length > 0 && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">Skills:</span>
                    <span className="text-foreground">{parsedData.skills.slice(0, 5).join(', ')}</span>
                  </div>
                )}
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
        AI will extract name, position, location, and contact info
      </p>
    </div>
  );
}
