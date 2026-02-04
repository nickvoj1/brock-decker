import { useState } from "react";
import { Sparkles, Check, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Signal {
  id: string;
  title: string;
  company: string | null;
  tier: string | null;
  signal_type: string | null;
  ai_confidence?: number;
  ai_insight?: string | null;
}

interface SignalRetrainModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signal: Signal | null;
  profileName: string;
  onRetrained?: () => void;
}

const TIER_OPTIONS = [
  { value: "tier_1", label: "Tier 1 – Immediate Intent", color: "bg-red-500" },
  { value: "tier_2", label: "Tier 2 – Medium Intent", color: "bg-amber-500" },
  { value: "tier_3", label: "Tier 3 – Early Interest", color: "bg-green-500" },
];

const SIGNAL_TYPES = [
  { value: "funding", label: "Funding/Fund Close" },
  { value: "hiring", label: "Hiring" },
  { value: "expansion", label: "Expansion/Acquisition" },
  { value: "c_suite", label: "C-Suite Change" },
  { value: "team_growth", label: "Team Growth" },
];

export function SignalRetrainModal({
  open,
  onOpenChange,
  signal,
  profileName,
  onRetrained,
}: SignalRetrainModalProps) {
  const [userLabel, setUserLabel] = useState<"correct" | "irrelevant" | null>(null);
  const [correctTier, setCorrectTier] = useState<string>("");
  const [correctSignalType, setCorrectSignalType] = useState<string>("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!signal) return null;

  const canSubmit = userLabel !== null && feedbackNote.trim().length > 0;

  const handleSubmit = async () => {
    if (!userLabel) {
      toast.error("Please select Correct or Irrelevant");
      return;
    }
    
    if (!feedbackNote.trim()) {
      toast.error("Please provide a comment explaining your feedback");
      return;
    }

    setIsSubmitting(true);

    try {
      // Determine the label to send based on selections
      let labelToSend = userLabel;
      if (correctTier && userLabel === "irrelevant") {
        labelToSend = "irrelevant"; // Still mark as needing correction
      }

      const { error } = await supabase.functions.invoke("retrain-signal", {
        body: {
          signalId: signal.id,
          userLabel: labelToSend,
          correctTier: correctTier || undefined,
          correctSignalType: correctSignalType || undefined,
          feedbackNote: feedbackNote.trim(),
          profileName,
        },
      });

      if (error) throw error;

      // Also log to feedback_log for self-learning
      await supabase.from("feedback_log").insert({
        signal_id: signal.id,
        recruiter: profileName,
        action: userLabel === "correct" ? "APPROVE" : "REJECT",
        reason: feedbackNote.trim(),
      });

      // Update signal with feedback
      await supabase.from("signals").update({
        user_feedback: userLabel === "correct" ? "CORRECT" : "IRRELEVANT",
        retrain_flag: true,
        feedback_count: (signal as any).feedback_count ? (signal as any).feedback_count + 1 : 1,
      }).eq("id", signal.id);

      toast.success("Feedback submitted! AI classifier will learn from this.");
      onOpenChange(false);
      onRetrained?.();
      
      // Reset form
      resetForm();
    } catch (error) {
      console.error("Retrain error:", error);
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setUserLabel(null);
    setCorrectTier("");
    setCorrectSignalType("");
    setFeedbackNote("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const currentTier = TIER_OPTIONS.find(t => t.value === signal.tier);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Train AI Classifier
          </DialogTitle>
          <DialogDescription>
            Help improve signal classification accuracy by providing detailed feedback
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Classification */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="text-sm font-medium text-muted-foreground mb-2">Current Classification</div>
            <div className="font-medium">{signal.title}</div>
            <div className="text-sm text-muted-foreground mt-1">{signal.company}</div>
            
            <div className="flex items-center gap-2 mt-3">
              {currentTier && (
                <Badge className={`${currentTier.color} text-white`}>
                  {currentTier.label}
                </Badge>
              )}
              <Badge variant="outline">
                {signal.signal_type?.replace("_", " ")}
              </Badge>
              {signal.ai_confidence !== undefined && signal.ai_confidence > 0 && (
                <Badge variant="secondary">
                  {signal.ai_confidence}% confidence
                </Badge>
              )}
            </div>
            
            {signal.ai_insight && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                "{signal.ai_insight}"
              </p>
            )}
          </div>

          {/* Classification Selection - Required */}
          <div className="space-y-2">
            <Label>
              Was this classification correct? <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={userLabel === "correct" ? "default" : "outline"}
                className={`h-auto py-4 flex-col gap-2 ${
                  userLabel === "correct"
                    ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                    : "border-green-500/30 hover:bg-green-500/10 hover:border-green-500/50"
                }`}
                onClick={() => setUserLabel("correct")}
              >
                <ThumbsUp className={`h-6 w-6 ${userLabel === "correct" ? "text-white" : "text-green-500"}`} />
                <span className="text-sm font-medium">Correct</span>
              </Button>
              <Button
                type="button"
                variant={userLabel === "irrelevant" ? "default" : "outline"}
                className={`h-auto py-4 flex-col gap-2 ${
                  userLabel === "irrelevant"
                    ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                    : "border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50"
                }`}
                onClick={() => setUserLabel("irrelevant")}
              >
                <ThumbsDown className={`h-6 w-6 ${userLabel === "irrelevant" ? "text-white" : "text-red-500"}`} />
                <span className="text-sm font-medium">Irrelevant</span>
              </Button>
            </div>
          </div>

          {/* Optional Corrections - only show when "irrelevant" selected */}
          {userLabel === "irrelevant" && (
            <div className="space-y-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/30 animate-in slide-in-from-top-2 duration-200">
              <div className="text-sm font-medium text-red-800 dark:text-red-200">
                Optional: Suggest corrections
              </div>
              
              {/* Tier Correction */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Correct Tier</Label>
                <Select value={correctTier} onValueChange={setCorrectTier}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select correct tier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIER_OPTIONS.map((tier) => (
                      <SelectItem key={tier.value} value={tier.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${tier.color}`} />
                          {tier.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Signal Type Correction */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Correct Signal Type</Label>
                <Select value={correctSignalType} onValueChange={setCorrectSignalType}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select correct type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SIGNAL_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Comment - Required */}
          <div className="space-y-2">
            <Label>
              Comment <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
              placeholder={
                userLabel === "correct" 
                  ? "Why is this a good signal? What makes it relevant?"
                  : userLabel === "irrelevant"
                  ? "Why is this irrelevant? Wrong region, wrong industry, outdated?"
                  : "Select Correct or Irrelevant first, then explain your reasoning..."
              }
              rows={3}
              className={!feedbackNote.trim() && userLabel ? "border-destructive/50" : ""}
            />
            {userLabel && !feedbackNote.trim() && (
              <p className="text-xs text-destructive">Comment is required to help the AI learn</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting Feedback...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Submit Feedback & Train AI
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Your detailed feedback helps the AI classify future signals more accurately
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
