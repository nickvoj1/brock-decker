import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, Loader2 } from "lucide-react";
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

interface SignalFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signal: Signal | null;
  profileName: string;
  onFeedbackSubmitted?: (signalId: string, isApproved: boolean) => void;
}

export function SignalFeedbackModal({
  open,
  onOpenChange,
  signal,
  profileName,
  onFeedbackSubmitted,
}: SignalFeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!signal) return null;

  const handleSubmit = async () => {
    if (!feedbackType) {
      toast.error("Please select Approve or Reject");
      return;
    }

    setIsSubmitting(true);
    try {
      // Log feedback
      const { error: logError } = await supabase
        .from("feedback_log")
        .insert({
          signal_id: signal.id,
          recruiter: profileName,
          action: feedbackType === "approve" ? "APPROVE" : "REJECT",
          reason: comment || null,
        });

      if (logError) throw logError;

      // Update signal
      const { error: updateError } = await supabase
        .from("signals")
        .update({
          user_feedback: feedbackType === "approve" ? "APPROVE" : "REJECT",
          validated_region: feedbackType === "approve" ? signal.region.toUpperCase() : "REJECTED",
        })
        .eq("id", signal.id);

      if (updateError) throw updateError;

      toast.success(
        feedbackType === "approve" 
          ? "Signal approved - AI will learn from this" 
          : "Signal rejected - AI will avoid similar signals"
      );
      
      onFeedbackSubmitted?.(signal.id, feedbackType === "approve");
      onOpenChange(false);
      
      // Reset form
      setFeedbackType(null);
      setComment("");
    } catch (error) {
      console.error("Feedback error:", error);
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFeedback = async (type: "approve" | "reject") => {
    setFeedbackType(type);
    // If no comment needed, submit immediately
    if (type === "approve") {
      setIsSubmitting(true);
      try {
        await supabase
          .from("feedback_log")
          .insert({
            signal_id: signal.id,
            recruiter: profileName,
            action: "APPROVE",
            reason: null,
          });

        await supabase
          .from("signals")
          .update({
            user_feedback: "APPROVE",
            validated_region: signal.region.toUpperCase(),
          })
          .eq("id", signal.id);

        toast.success("Signal approved ✓");
        onFeedbackSubmitted?.(signal.id, true);
        onOpenChange(false);
        setFeedbackType(null);
      } catch (error) {
        console.error("Feedback error:", error);
        toast.error("Failed to submit feedback");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Signal Feedback
          </DialogTitle>
          <DialogDescription>
            Help improve AI accuracy by rating this signal
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

          {/* Quick Feedback Buttons */}
          <div className="space-y-2">
            <Label>Is this a good signal?</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={feedbackType === "approve" ? "default" : "outline"}
                className={`h-16 flex-col gap-2 ${
                  feedbackType === "approve" 
                    ? "bg-green-600 hover:bg-green-700 text-white" 
                    : "border-green-500/30 hover:bg-green-500/10 hover:border-green-500/50"
                }`}
                onClick={() => handleQuickFeedback("approve")}
                disabled={isSubmitting}
              >
                {isSubmitting && feedbackType === "approve" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ThumbsUp className="h-5 w-5" />
                )}
                <span className="text-sm font-medium">Good Signal</span>
              </Button>
              <Button
                variant={feedbackType === "reject" ? "default" : "outline"}
                className={`h-16 flex-col gap-2 ${
                  feedbackType === "reject" 
                    ? "bg-red-600 hover:bg-red-700 text-white" 
                    : "border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50"
                }`}
                onClick={() => setFeedbackType("reject")}
                disabled={isSubmitting}
              >
                <ThumbsDown className="h-5 w-5" />
                <span className="text-sm font-medium">Bad Signal</span>
              </Button>
            </div>
          </div>

          {/* Comment Section - Only shown for reject */}
          {feedbackType === "reject" && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <Label>Why is this a bad signal? (optional)</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g., Wrong region, not relevant industry, outdated news..."
                rows={2}
                className="resize-none"
              />
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  "Submit Rejection"
                )}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Your feedback trains the AI to find better signals
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
