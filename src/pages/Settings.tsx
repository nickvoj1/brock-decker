import { AppLayout } from "@/components/layout/AppLayout";
import { ApolloSettingsCard } from "@/components/settings/ApolloSettingsCard";
import { BullhornSettingsCard } from "@/components/settings/BullhornSettingsCard";

export default function SettingsPage() {
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
