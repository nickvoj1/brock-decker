import { useCallback, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  label: string;
  description: string;
  expectedColumns: string[];
  onFileSelect: (file: File, parsedData: Record<string, string>[]) => void;
  onClear: () => void;
  file: File | null;
  parsedData: Record<string, string>[] | null;
  error: string | null;
}

export function FileUploadZone({
  label,
  description,
  expectedColumns,
  onFileSelect,
  onClear,
  file,
  parsedData,
  error,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const rows: Record<string, string>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }
    
    return rows;
  };

  const validateColumns = (data: Record<string, string>[]): string | null => {
    if (data.length === 0) return "File is empty or invalid";
    
    const headers = Object.keys(data[0]);
    const missingColumns = expectedColumns.filter(
      col => !headers.includes(col.toLowerCase())
    );
    
    if (missingColumns.length > 0) {
      return `Missing columns: ${missingColumns.join(', ')}`;
    }
    
    return null;
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      onFileSelect(file, []);
      return;
    }

    const text = await file.text();
    const parsed = parseCSV(text);
    const validationError = validateColumns(parsed);
    
    if (validationError) {
      onFileSelect(file, []);
    } else {
      onFileSelect(file, parsed);
    }
  }, [expectedColumns, onFileSelect]);

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
  const isValid = hasFile && parsedData && parsedData.length > 0 && !error;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative rounded-lg border-2 border-dashed transition-all duration-200",
          isDragging && "border-primary bg-primary/5",
          hasFile && isValid && "border-success bg-success/5",
          hasFile && error && "border-destructive bg-destructive/5",
          !hasFile && !isDragging && "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        {hasFile ? (
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {isValid ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-foreground">{file.name}</p>
                  {isValid && parsedData && (
                    <p className="text-sm text-success">
                      {parsedData.length} {parsedData.length === 1 ? 'row' : 'rows'} detected
                    </p>
                  )}
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClear}
                className="rounded-full p-1 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center p-8 cursor-pointer">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Drop your file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Expected columns: {expectedColumns.join(', ')}
      </p>
    </div>
  );
}
