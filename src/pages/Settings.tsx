import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ApolloSettingsCard } from "@/components/settings/ApolloSettingsCard";
import { BullhornSettingsCard } from "@/components/settings/BullhornSettingsCard";
import { useProfileName } from "@/hooks/useProfileName";

const ADMIN_PROFILE = "Nikita Vojevoda";

export default function SettingsPage() {
  const profileName = useProfileName();
  const navigate = useNavigate();
  const isAdmin = profileName === ADMIN_PROFILE;

  useEffect(() => {
    // Redirect non-admin users to dashboard
    if (profileName && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [profileName, isAdmin, navigate]);

  // Show nothing while checking or redirecting
  if (!profileName || !isAdmin) {
    return (
      <AppLayout 
        title="Settings" 
        description="Configure API keys and integration credentials"
      >
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Access Denied</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Settings are only accessible to administrators.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      title="Settings" 
      description="Configure API keys and integration credentials"
    >
      <div className="max-w-2xl space-y-6">
        <ApolloSettingsCard />
        <BullhornSettingsCard />
      </div>
    </AppLayout>
  );
}
