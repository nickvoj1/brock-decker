import { useState, useEffect } from "react";
import { Shield, RotateCcw, AlertCircle, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface ResetRequest {
  profile_name: string;
  reset_requested_at: string;
}

interface AdminPinResetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminProfile: string;
}

export function AdminPinReset({ open, onOpenChange, adminProfile }: AdminPinResetProps) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingProfile, setProcessingProfile] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchResetRequests();
    }
  }, [open]);

  const fetchResetRequests = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-profile-pin', {
        body: { action: 'list-reset-requests', adminProfile }
      });

      if (error) throw error;
      setRequests(data.requests || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch reset requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPin = async (profileName: string) => {
    setProcessingProfile(profileName);
    try {
      const { data, error } = await supabase.functions.invoke('verify-profile-pin', {
        body: { action: 'admin-reset', profileName, adminProfile }
      });

      if (error) throw error;

      toast({
        title: "PIN Reset",
        description: data.message,
      });

      // Remove from list
      setRequests(prev => prev.filter(r => r.profile_name !== profileName));
    } catch (error: any) {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingProfile(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Admin: PIN Reset Requests
          </DialogTitle>
          <DialogDescription>
            Team members who forgot their PIN have requested a reset.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 pt-2 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="text-muted-foreground">No pending reset requests</p>
            </div>
          ) : (
            requests.map((request) => (
              <div
                key={request.profile_name}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
              >
                <div>
                  <p className="font-medium">{request.profile_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Requested {formatDistanceToNow(new Date(request.reset_requested_at))} ago
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResetPin(request.profile_name)}
                  disabled={processingProfile === request.profile_name}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {processingProfile === request.profile_name ? "Resetting..." : "Reset PIN"}
                </Button>
              </div>
            ))
          )}
        </div>
        
        {requests.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            After reset, the user will be prompted to create a new PIN on their next sign-in.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
