import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, Loader2, MapPin } from "lucide-react";
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
import { detectRegionFromFeedback, normalizeRegion } from "@/lib/regionDetector";

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
  onFeedbackSubmitted?: (signalId: string, isApproved: boolean, newRegion?: string) => void;
}

const QUICK_REASONS = [
  "Wrong region - London",
  "Wrong region - Europe",
  "Wrong region - UAE",
  "Wrong region - USA",
  "Not relevant industry",
  "Outdated news",
  "Not hiring-related",
];

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
  const [detectedRegion, setDetectedRegion] = useState<string | null>(null);

  if (!signal) return null;

  const canSubmit = feedbackType !== null && comment.trim().length > 0;

  // Detect region changes when comment updates
  const handleCommentChange = (newComment: string) => {
    setComment(newComment);
    
    // Only detect region for reject feedback
    if (feedbackType === "reject") {
      const detection = detectRegionFromFeedback(newComment, signal.region);
      if (detection.confidence === "high" || detection.confidence === "medium") {
        setDetectedRegion(detection.detectedRegion);
      } else {
        setDetectedRegion(null);
      }
    }
  };

  const handleQuickReason = (quickReason: string) => {
    setComment(prev => prev ? `${prev}, ${quickReason}` : quickReason);
    
    // Handle quick region reassignment
    if (quickReason.startsWith("Wrong region - ")) {
      const region = quickReason.replace("Wrong region - ", "").toLowerCase();
      setDetectedRegion(region);
    }
  };

  const handleSubmit = async () => {
    if (!feedbackType) {
      toast.error("Please select Approve or Reject");
      return;
    }

    if (!comment.trim()) {
      toast.error("Please provide a comment explaining your feedback");
      return;
    }

    setIsSubmitting(true);
    try {
      const shouldMoveRegion = feedbackType === "reject" && detectedRegion && detectedRegion !== signal.region.toLowerCase();

      // Log feedback
      const { error: logError } = await supabase
        .from("feedback_log")
        .insert({
          signal_id: signal.id,
          recruiter: profileName,
          action: feedbackType === "approve" ? "APPROVE" : shouldMoveRegion ? "REGION_MOVE" : "REJECT",
          reason: comment.trim() + (shouldMoveRegion ? ` [Auto-moved to ${detectedRegion?.toUpperCase()}]` : ""),
        });

      if (logError) throw logError;

      // Update signal
      const updateData: Record<string, unknown> = {
        user_feedback: feedbackType === "approve" ? "APPROVE" : "REJECT",
        validated_region: feedbackType === "approve" ? signal.region.toUpperCase() : (shouldMoveRegion ? detectedRegion!.toUpperCase() : "REJECTED"),
      };

      // If region detected, move the signal
      if (shouldMoveRegion && detectedRegion) {
        updateData.region = detectedRegion.toLowerCase();
        updateData.detected_region = detectedRegion.toLowerCase();
      }

      const { error: updateError } = await supabase
        .from("signals")
        .update(updateData)
        .eq("id", signal.id);

      if (updateError) throw updateError;

      if (shouldMoveRegion && detectedRegion) {
        toast.success(`Signal moved to ${normalizeRegion(detectedRegion)} - AI will learn from this`);
      } else if (feedbackType === "approve") {
        toast.success("Signal approved - AI will learn from this");
      } else {
        toast.success("Signal rejected - AI will avoid similar signals");
      }
      
      onFeedbackSubmitted?.(signal.id, feedbackType === "approve", shouldMoveRegion ? detectedRegion : undefined);
      onOpenChange(false);
      
      // Reset form
      setFeedbackType(null);
      setComment("");
      setDetectedRegion(null);
    } catch (error) {
      console.error("Feedback error:", error);
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setFeedbackType(null);
      setComment("");
      setDetectedRegion(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                onClick={() => {
                  setFeedbackType("approve");
                  setDetectedRegion(null);
                }}
                disabled={isSubmitting}
              >
                <ThumbsUp className="h-5 w-5" />
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

          {/* Comment Section - Required for both */}
          {feedbackType && (
            <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
              {/* Quick Reasons for Reject */}
              {feedbackType === "reject" && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Quick reasons (click to add)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_REASONS.map((reason) => (
                      <Badge
                        key={reason}
                        variant="outline"
                        className="cursor-pointer hover:bg-muted transition-colors text-xs"
                        onClick={() => handleQuickReason(reason)}
                      >
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  {feedbackType === "approve" ? "Why is this a good signal?" : "Why is this a bad signal?"}
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Textarea
                  value={comment}
                  onChange={(e) => handleCommentChange(e.target.value)}
                  placeholder={
                    feedbackType === "approve"
                      ? "e.g., Perfect match for our PE clients in this region..."
                      : "e.g., Wrong region - this is actually a London company, not Europe..."
                  }
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Region Detection Alert */}
              {detectedRegion && feedbackType === "reject" && detectedRegion !== signal.region.toLowerCase() && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-blue-800 dark:text-blue-200">
                    Signal will be moved to <strong>{normalizeRegion(detectedRegion)}</strong> region
                  </span>
                </div>
              )}

              <Button 
                onClick={handleSubmit} 
                disabled={!canSubmit || isSubmitting}
                className={`w-full ${feedbackType === "reject" ? "bg-red-600 hover:bg-red-700" : ""}`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : detectedRegion && feedbackType === "reject" ? (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Move to {normalizeRegion(detectedRegion)} & Learn
                  </>
                ) : (
                  "Submit Feedback"
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
