import {
  Upload,
  History,
  Settings,
  Users,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  UsersRound,
  Sparkles,
  Database,
  ChevronDown,
  ListChecks,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import brockDeckerLogo from "@/assets/brock-decker-logo.png";
import { useProfileName } from "@/hooks/useProfileName";
import { getEnrichmentRuns } from "@/lib/dataApi";

const ADMIN_PROFILE = "Nikita Vojevoda";
const RUNS_HISTORY_VIEWED_KEY_PREFIX = "runs-history-last-viewed-at";
const CONSOLE_MODE_STORAGE_KEY = "sidebar-console-mode";
type ConsoleMode = "Operator Console" | "CRM System";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Team Dashboard", url: "/team-dashboard", icon: UsersRound },
  { title: "Signals", url: "/signals", icon: Sparkles },
  { title: "Upload & Run", url: "/", icon: Upload },
  { title: "CVs", url: "/previous-cvs", icon: Users },
  { title: "Generate Mail", url: "/generate-mail", icon: Mail },
  { title: "Runs History", url: "/history", icon: History },
];

const adminItems = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Admin Panel", url: "/admin", icon: ShieldCheck },
];

const crmItems = [
  { title: "Contact Sync", url: "/crm/contact-sync", icon: Database },
  { title: "Distribution Lists", url: "/crm/distribution-lists", icon: ListChecks },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const profileName = useProfileName();
  const collapsed = state === "collapsed";
  const isAdmin = profileName === ADMIN_PROFILE;
  const viewedKey = useMemo(
    () => (profileName ? `${RUNS_HISTORY_VIEWED_KEY_PREFIX}:${profileName}` : null),
    [profileName],
  );
  const [lastViewedAt, setLastViewedAt] = useState<string>("");
  const [consoleMode, setConsoleMode] = useState<ConsoleMode>(() => {
    if (typeof window === "undefined") return "Operator Console";
    const stored = window.localStorage.getItem(CONSOLE_MODE_STORAGE_KEY);
    return stored === "CRM System" ? "CRM System" : "Operator Console";
  });

  const setConsoleModeAndPersist = (mode: ConsoleMode) => {
    setConsoleMode(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CONSOLE_MODE_STORAGE_KEY, mode);
    }
  };

  useEffect(() => {
    if (!viewedKey) {
      setLastViewedAt("");
      return;
    }
    setLastViewedAt(localStorage.getItem(viewedKey) || "");
  }, [viewedKey]);

  useEffect(() => {
    if (location.pathname.startsWith("/crm/")) {
      setConsoleModeAndPersist("CRM System");
      return;
    }
    setConsoleModeAndPersist("Operator Console");
  }, [location.pathname]);

  useEffect(() => {
    const refreshFromStorage = () => {
      if (!viewedKey) {
        setLastViewedAt("");
        return;
      }
      setLastViewedAt(localStorage.getItem(viewedKey) || "");
    };

    window.addEventListener("runs-history-viewed", refreshFromStorage);
    window.addEventListener("profile-name-changed", refreshFromStorage);
    window.addEventListener("storage", refreshFromStorage);
    return () => {
      window.removeEventListener("runs-history-viewed", refreshFromStorage);
      window.removeEventListener("profile-name-changed", refreshFromStorage);
      window.removeEventListener("storage", refreshFromStorage);
    };
  }, [viewedKey]);

  const { data: sidebarRuns = [] } = useQuery({
    queryKey: ["sidebar-runs-alert", profileName],
    queryFn: async () => {
      if (!profileName) return [];
      const response = await getEnrichmentRuns(profileName);
      if (!response.success || !Array.isArray(response.data)) return [];
      return response.data as Array<{
        id: string;
        status: string;
        created_at?: string;
        updated_at?: string;
      }>;
    },
    enabled: Boolean(profileName),
    refetchInterval: location.pathname.startsWith("/history") ? 30000 : 12000,
    refetchIntervalInBackground: true,
    staleTime: 5000,
  });

  const unreadCompletedRuns = useMemo(() => {
    if (!profileName) return 0;
    if (location.pathname.startsWith("/history")) return 0;
    const viewedTs = Date.parse(lastViewedAt || "");
    if (!Number.isFinite(viewedTs)) return 0;

    const terminalStatuses = new Set(["success", "partial", "failed"]);
    return sidebarRuns.filter((run) => {
      const status = String(run?.status || "").toLowerCase();
      if (!terminalStatuses.has(status)) return false;
      const ts = Date.parse(String(run?.updated_at || run?.created_at || ""));
      return Number.isFinite(ts) && ts > viewedTs;
    }).length;
  }, [sidebarRuns, profileName, location.pathname, lastViewedAt]);

  const isRouteActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname === url || location.pathname.startsWith(`${url}/`);
  };

  const handleConsoleModeChange = (value: string) => {
    const nextMode: ConsoleMode = value === "CRM System" ? "CRM System" : "Operator Console";
    setConsoleModeAndPersist(nextMode);
    if (nextMode === "CRM System") {
      navigate("/crm/contact-sync");
      return;
    }
    if (location.pathname.startsWith("/crm/")) {
      navigate("/dashboard");
    }
  };

  return (
    <Sidebar className="depth-sidebar border-r border-sidebar-border bg-sidebar/95" collapsible="icon">
      <SidebarHeader className="px-2 py-2 border-b border-sidebar-border/70">
        <div className="flex items-center justify-start">
          <img
            src={brockDeckerLogo}
            alt="Brock Decker"
            className={`transition-all duration-200 ${collapsed ? "h-8 w-8 object-contain" : "h-14 w-auto"}`}
          />
        </div>
        {!collapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="mt-1 flex w-full items-center justify-between rounded-md border border-sidebar-border/60 bg-sidebar-accent/30 px-2 py-1 text-left transition-colors hover:bg-sidebar-accent/50"
              >
                <span className="mono-label text-[9px] text-sidebar-foreground/80">{consoleMode}</span>
                <ChevronDown className="h-3 w-3 text-sidebar-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuRadioGroup value={consoleMode} onValueChange={handleConsoleModeChange}>
                <DropdownMenuRadioItem value="Operator Console">Operator Console</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="CRM System">CRM System</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarHeader>

      <SidebarContent className="p-2">
        {consoleMode === "Operator Console" ? (
          <SidebarGroup>
            {!collapsed && <p className="mono-label px-2 pb-2">Navigation</p>}
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive = isRouteActive(item.url);
                  const isRunsHistoryItem = item.url === "/history";
                  const showRunsAlert = isRunsHistoryItem && unreadCompletedRuns > 0;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <NavLink
                          to={item.url}
                          className={`interactive-lift group relative flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-200 ${
                            isActive
                              ? "border-primary/30 bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                              : "border-transparent text-sidebar-foreground/70 hover:border-sidebar-border/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          }`}
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground"}`} />
                          {!collapsed && <span>{item.title}</span>}
                          {showRunsAlert && (
                            <span
                              className={`inline-flex h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background ${
                                collapsed ? "absolute right-2 top-2" : "ml-auto"
                              }`}
                              aria-label={`${unreadCompletedRuns} completed run updates`}
                              title={`${unreadCompletedRuns} completed run updates`}
                            />
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            {!collapsed && <p className="mono-label px-2 pb-2">CRM System</p>}
            <SidebarGroupContent>
              <SidebarMenu>
                {crmItems.map((item) => {
                  const isActive = isRouteActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <NavLink
                          to={item.url}
                          className={`interactive-lift group relative flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-200 ${
                            isActive
                              ? "border-primary/30 bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                              : "border-transparent text-sidebar-foreground/70 hover:border-sidebar-border/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          }`}
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground"}`} />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Admin Section - Only visible to admin */}
        {isAdmin && consoleMode === "Operator Console" && (
          <SidebarGroup className="mt-4 pt-4 border-t border-sidebar-border/70">
            {!collapsed && <p className="mono-label px-2 pb-2 text-primary/80">Admin</p>}
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
                  const isActive = isRouteActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <NavLink
                          to={item.url}
                          className={`interactive-lift group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-200 ${
                            isActive
                              ? "border-primary/40 bg-primary/10 text-primary font-medium"
                              : "border-transparent text-primary/70 hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                          }`}
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-primary/70 group-hover:text-primary"}`} />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
