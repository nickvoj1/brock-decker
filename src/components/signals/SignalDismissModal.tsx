import { useState } from "react";
import { Trash2, Loader2, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Signal {
  id: string;
  title: string;
  company: string | null;
  tier: string | null;
  signal_type: string | null;
  region: string;
}

interface SignalDismissModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signal: Signal | null;
  profileName: string;
  onDismissed?: (signalId: string) => void;
}

const QUICK_REASONS = [
  "Wrong region",
  "Not relevant industry",
  "Outdated news",
  "Duplicate signal",
  "Not hiring-related",
  "Company too small",
];

export function SignalDismissModal({
  open,
  onOpenChange,
  signal,
  profileName,
  onDismissed,
}: SignalDismissModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!signal) return null;

  const canSubmit = reason.trim().length > 0;

  const handleQuickReason = (quickReason: string) => {
    setReason(prev => prev ? `${prev}, ${quickReason}` : quickReason);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for dismissing this signal");
      return;
    }

    setIsSubmitting(true);
    try {
      // Log feedback for AI learning
      await supabase.from("feedback_log").insert({
        signal_id: signal.id,
        recruiter: profileName,
        action: "DISMISS",
        reason: reason.trim(),
      });

      // Update signal as dismissed
      await supabase
        .from("signals")
        .update({
          is_dismissed: true,
          dismissed_by: profileName,
          user_feedback: "DISMISSED",
        })
        .eq("id", signal.id);

      toast.success("Signal dismissed - AI will learn from this feedback");
      onDismissed?.(signal.id);
      onOpenChange(false);
      setReason("");
    } catch (error) {
      console.error("Dismiss error:", error);
      toast.error("Failed to dismiss signal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setReason("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Dismiss Signal
          </DialogTitle>
          <DialogDescription>
            Help the AI learn by explaining why this signal isn't useful
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Signal Info */}
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="font-medium text-sm">{signal.company || "Unknown Company"}</div>
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{signal.title}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {signal.region?.toUpperCase()}
              </Badge>
              {signal.signal_type && (
                <Badge variant="secondary" className="text-xs">
                  {signal.signal_type.replace("_", " ")}
                </Badge>
              )}
            </div>
          </div>

          {/* Quick Reasons */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick reasons (click to add)</Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((quickReason) => (
                <Badge
                  key={quickReason}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => handleQuickReason(quickReason)}
                >
                  {quickReason}
                </Badge>
              ))}
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label>
              Why are you dismissing this signal? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Wrong region - this is actually a London company, not Europe..."
              rows={3}
              className={!reason.trim() ? "border-destructive/30" : ""}
            />
            <p className="text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3 inline mr-1" />
              Your feedback trains the AI to avoid similar signals in the future
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              variant="destructive"
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Dismissing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Dismiss & Learn
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
