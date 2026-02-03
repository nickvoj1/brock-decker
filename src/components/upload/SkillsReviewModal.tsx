import { useState, useEffect } from "react";
import { X, Loader2, Sparkles, Check, AlertTriangle, Edit2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  name: string;
  email: string;
  title: string;
  company: string;
  location?: string;
}

interface ClassifiedContact extends Contact {
  side: "buy" | "sell" | "consulting" | "corporate" | "other";
  skills: string[];
  confidence: number;
  reasoning: string;
}

interface SkillsReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  preferences?: {
    industries?: string[];
    sectors?: string[];
    locations?: string[];
    targetRoles?: string[];
  };
  onConfirm: (classifiedContacts: ClassifiedContact[]) => void;
}

// Skills that conflict - for display warnings
const CONFLICTING_PAIRS: [string, string][] = [
  ["BUY SIDE", "SELL SIDE"],
  ["BUY SIDE", "CONSULT"],
  ["BUY SIDE", "CORPORATE BANKING"],
  ["SELL SIDE", "PE"],
  ["SELL SIDE", "VC"],
  ["SELL SIDE", "ALT INVESTMENT"],
  ["CONSULT", "PE"],
  ["CONSULT", "VC"],
  ["TIER 1", "BOUTIQUE"],
];

function hasConflicts(skills: string[]): boolean {
  const skillSet = new Set(skills.map(s => s.toUpperCase()));
  for (const [a, b] of CONFLICTING_PAIRS) {
    if (skillSet.has(a) && skillSet.has(b)) return true;
  }
  return false;
}

function getSideColor(side: string): string {
  switch (side) {
    case "buy": return "bg-green-500/10 text-green-700 border-green-500/30";
    case "sell": return "bg-blue-500/10 text-blue-700 border-blue-500/30";
    case "consulting": return "bg-purple-500/10 text-purple-700 border-purple-500/30";
    case "corporate": return "bg-orange-500/10 text-orange-700 border-orange-500/30";
    default: return "bg-gray-500/10 text-gray-700 border-gray-500/30";
  }
}

export function SkillsReviewModal({
  isOpen,
  onClose,
  contacts,
  preferences,
  onConfirm,
}: SkillsReviewModalProps) {
  const { toast } = useToast();
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifiedContacts, setClassifiedContacts] = useState<ClassifiedContact[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editSkillsValue, setEditSkillsValue] = useState("");

  // Auto-classify when modal opens
  useEffect(() => {
    if (isOpen && contacts.length > 0 && classifiedContacts.length === 0) {
      classifyContacts();
    }
  }, [isOpen, contacts]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setClassifiedContacts([]);
      setEditingIndex(null);
      setEditSkillsValue("");
    }
  }, [isOpen]);

  const classifyContacts = async () => {
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-skills-classifier", {
        body: { contacts, preferences }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      // Merge classification results with original contacts
      const classified = contacts.map((contact, i) => ({
        ...contact,
        ...(data.data[i] || {
          side: "other" as const,
          skills: ["BUSINESS", "GLOBAL", "SENIOR", "FINANCE"],
          confidence: 50,
          reasoning: "Fallback",
        }),
      }));

      setClassifiedContacts(classified);
      
      const avgConfidence = Math.round(
        classified.reduce((sum, c) => sum + c.confidence, 0) / classified.length
      );
      
      toast({
        title: "Skills classified",
        description: `${classified.length} contacts analyzed (avg confidence: ${avgConfidence}%)`,
      });
    } catch (err: any) {
      console.error("Classification error:", err);
      toast({
        title: "Classification failed",
        description: err.message || "Failed to classify contacts",
        variant: "destructive",
      });
      
      // Fallback to basic skills
      const fallback = contacts.map(contact => ({
        ...contact,
        side: "other" as const,
        skills: ["BUSINESS", "GLOBAL", "SENIOR", "FINANCE"],
        confidence: 0,
        reasoning: "Classification failed - using fallback",
      }));
      setClassifiedContacts(fallback);
    } finally {
      setIsClassifying(false);
    }
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditSkillsValue(classifiedContacts[index].skills.join(" ; "));
  };

  const saveEditing = () => {
    if (editingIndex === null) return;
    
    const newSkills = editSkillsValue
      .split(/[;,]/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    
    setClassifiedContacts(prev => 
      prev.map((c, i) => 
        i === editingIndex ? { ...c, skills: newSkills } : c
      )
    );
    setEditingIndex(null);
    setEditSkillsValue("");
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditSkillsValue("");
  };

  const conflictCount = classifiedContacts.filter(c => hasConflicts(c.skills)).length;
  const lowConfidenceCount = classifiedContacts.filter(c => c.confidence < 70).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Skills Review
            <Badge variant="secondary" className="ml-2">
              {classifiedContacts.length} contacts
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review AI-generated skills before exporting to Bullhorn. Click on skills to edit them.
          </DialogDescription>
        </DialogHeader>

        {isClassifying ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Analyzing contacts...</p>
              <p className="text-sm text-muted-foreground">
                Using AI to classify {contacts.length} contacts into Buy Side / Sell Side / Consulting
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Bar */}
            <div className="flex items-center gap-4 py-2 text-sm">
              {conflictCount > 0 && (
                <div className="flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  {conflictCount} with skill conflicts
                </div>
              )}
              {lowConfidenceCount > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {lowConfidenceCount} low confidence
                </div>
              )}
              <div className="flex-1" />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={classifyContacts}
                disabled={isClassifying}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Re-classify All
              </Button>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 max-h-[50vh] border rounded-md overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[150px]">Name</TableHead>
                    <TableHead className="w-[180px]">Company</TableHead>
                    <TableHead className="w-[100px]">Side</TableHead>
                    <TableHead className="min-w-[300px]">Skills</TableHead>
                    <TableHead className="w-[80px]">Conf.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classifiedContacts.map((contact, i) => (
                    <TableRow 
                      key={contact.email} 
                      className={hasConflicts(contact.skills) ? "bg-amber-50/50" : ""}
                    >
                      <TableCell className="font-medium">
                        <div className="truncate max-w-[140px]" title={contact.name}>
                          {contact.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                          {contact.title}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="truncate max-w-[170px]" title={contact.company}>
                          {contact.company}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={getSideColor(contact.side)}
                        >
                          {contact.side.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {editingIndex === i ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editSkillsValue}
                              onChange={(e) => setEditSkillsValue(e.target.value)}
                              className="text-xs h-8"
                              placeholder="SKILL1 ; SKILL2 ; SKILL3"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEditing();
                                if (e.key === "Escape") cancelEditing();
                              }}
                              autoFocus
                            />
                            <Button size="sm" variant="ghost" onClick={saveEditing}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditing}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className="flex flex-wrap gap-1 cursor-pointer group"
                            onClick={() => startEditing(i)}
                            title={contact.reasoning}
                          >
                            {contact.skills.slice(0, 6).map((skill, si) => (
                              <Badge 
                                key={si} 
                                variant="secondary" 
                                className="text-[10px] px-1.5 py-0"
                              >
                                {skill}
                              </Badge>
                            ))}
                            {contact.skills.length > 6 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                +{contact.skills.length - 6}
                              </Badge>
                            )}
                            <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 ml-1" />
                            {hasConflicts(contact.skills) && (
                              <AlertTriangle className="h-3 w-3 text-amber-500 ml-1" />
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span 
                          className={
                            contact.confidence >= 80 ? "text-green-600" :
                            contact.confidence >= 60 ? "text-amber-600" :
                            "text-red-500"
                          }
                        >
                          {contact.confidence}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="text-xs text-muted-foreground">
              <strong>Tip:</strong> Click on skills to edit them. Use semicolons to separate skills (e.g., "BUY SIDE ; PE ; LONDON")
            </div>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(classifiedContacts)}
            disabled={isClassifying || classifiedContacts.length === 0}
          >
            <Check className="h-4 w-4 mr-2" />
            Confirm & Export ({classifiedContacts.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
