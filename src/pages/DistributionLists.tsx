import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DistributionLists() {
  return (
    <AppLayout title="Distribution Lists" description="Bullhorn distribution list workspace">
      <Card>
        <CardHeader>
          <CardTitle>Distribution Lists</CardTitle>
          <CardDescription>
            Distribution list management view is reserved for the CRM system workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">This tab is ready for the next distribution-list workflow step.</p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
