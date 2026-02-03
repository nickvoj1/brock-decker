import { useState } from "react";
import { Sparkles, Check, X, AlertTriangle, ThumbsUp, ThumbsDown } from "lucide-react";
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
  const [userLabel, setUserLabel] = useState<string>("");
  const [correctTier, setCorrectTier] = useState<string>("");
  const [correctSignalType, setCorrectSignalType] = useState<string>("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!signal) return null;

  const handleSubmit = async (label: string) => {
    setIsSubmitting(true);
    setUserLabel(label);

    try {
      const { data, error } = await supabase.functions.invoke("retrain-signal", {
        body: {
          signalId: signal.id,
          userLabel: label,
          correctTier: label === "wrong_tier" ? correctTier : undefined,
          correctSignalType: label === "wrong_type" ? correctSignalType : undefined,
          feedbackNote: feedbackNote || undefined,
          profileName,
        },
      });

      if (error) throw error;

      toast.success("Feedback recorded! AI will learn from this.");
      onOpenChange(false);
      onRetrained?.();
      
      // Reset form
      setUserLabel("");
      setCorrectTier("");
      setCorrectSignalType("");
      setFeedbackNote("");
    } catch (error) {
      console.error("Retrain error:", error);
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTier = TIER_OPTIONS.find(t => t.value === signal.tier);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Train AI Classifier
          </DialogTitle>
          <DialogDescription>
            Help improve signal classification accuracy
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
              {signal.ai_confidence && (
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

          {/* Quick Feedback Buttons */}
          <div className="space-y-2">
            <Label>Was this classification correct?</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-auto py-3 flex-col gap-1 border-green-500/30 hover:bg-green-500/10"
                onClick={() => handleSubmit("correct")}
                disabled={isSubmitting}
              >
                <ThumbsUp className="h-5 w-5 text-green-500" />
                <span className="text-sm">Correct</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-3 flex-col gap-1 border-red-500/30 hover:bg-red-500/10"
                onClick={() => handleSubmit("irrelevant")}
                disabled={isSubmitting}
              >
                <ThumbsDown className="h-5 w-5 text-red-500" />
                <span className="text-sm">Irrelevant</span>
              </Button>
            </div>
          </div>

          {/* Tier Correction */}
          <div className="space-y-2">
            <Label>Wrong Tier? Select correct one:</Label>
            <Select value={correctTier} onValueChange={setCorrectTier}>
              <SelectTrigger>
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
            {correctTier && (
              <Button
                size="sm"
                onClick={() => handleSubmit("wrong_tier")}
                disabled={isSubmitting}
              >
                <Check className="h-4 w-4 mr-1" />
                Submit Tier Correction
              </Button>
            )}
          </div>

          {/* Signal Type Correction */}
          <div className="space-y-2">
            <Label>Wrong Signal Type? Select correct one:</Label>
            <Select value={correctSignalType} onValueChange={setCorrectSignalType}>
              <SelectTrigger>
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
            {correctSignalType && (
              <Button
                size="sm"
                onClick={() => handleSubmit("wrong_type")}
                disabled={isSubmitting}
              >
                <Check className="h-4 w-4 mr-1" />
                Submit Type Correction
              </Button>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Additional Notes (optional)</Label>
            <Textarea
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
              placeholder="Why was this classification wrong? What should the AI learn?"
              rows={2}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
