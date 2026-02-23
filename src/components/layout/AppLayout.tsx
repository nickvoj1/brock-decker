import { useState, useCallback } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ProfileSelector } from "./ProfileSelector";
import { AuthGate } from "./AuthGate";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AppLayout({ children, title, description }: AppLayoutProps) {
  const [, setAuthenticatedProfile] = useState<string>("");

  const handleAuthenticated = useCallback((profileName: string) => {
    setAuthenticatedProfile(profileName);
  }, []);

  return (
    <AuthGate onAuthenticated={handleAuthenticated}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full tech-grid-bg">
          <AppSidebar />
          <SidebarInset className="flex-1 min-w-0">
            <header className="sticky top-0 z-30 flex h-16 md:h-[4.5rem] items-center justify-between gap-4 border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 px-4 md:px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="-ml-1 h-8 w-8 rounded-lg border border-border/60 bg-card hover:bg-accent/80" />
                <div className="flex flex-col gap-0.5">
                  <p className="mono-label">Brock & Decker Intelligence Layer</p>
                  <h1 className="text-base md:text-lg font-semibold text-foreground leading-tight">{title}</h1>
                  {description && (
                    <p className="text-xs md:text-sm text-muted-foreground">{description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden md:flex meta-chip">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  <span className="mono-label text-[10px] text-foreground/80">Live Session</span>
                </div>
                <ProfileSelector />
              </div>
            </header>
            <main className="flex-1 p-4 md:p-6 lg:p-7 animate-fade-in">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AuthGate>
  );
}
