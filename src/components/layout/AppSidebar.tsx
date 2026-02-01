import { Upload, History, Settings, Users, LayoutDashboard, Mail, ShieldCheck, UsersRound, Sparkles } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
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
import brockDeckerLogo from "@/assets/brock-decker-logo.png";
import { useProfileName } from "@/hooks/useProfileName";

const ADMIN_PROFILE = "Nikita Vojevoda";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Team Dashboard", url: "/team-dashboard", icon: UsersRound },
  { title: "Signals", url: "/signals", icon: Sparkles },
  { title: "Upload & Run", url: "/", icon: Upload },
  { title: "Previous CVs", url: "/previous-cvs", icon: Users },
  { title: "Generate Mail", url: "/generate-mail", icon: Mail },
  { title: "Runs History", url: "/history", icon: History },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Admin Panel", url: "/admin", icon: ShieldCheck },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const profileName = useProfileName();
  const collapsed = state === "collapsed";
  const isAdmin = profileName === ADMIN_PROFILE;

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar" collapsible="icon">
      <SidebarHeader className="px-2 py-2 border-b-2 border-foreground/20">
        <div className="flex items-center justify-start">
          <img
            src={brockDeckerLogo}
            alt="Brock Decker"
            className={`transition-all duration-200 ${collapsed ? "h-8 w-8 object-contain" : "h-16 w-auto"}`}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section - Only visible to admin */}
        {isAdmin && (
          <SidebarGroup className="mt-4 pt-4 border-t border-sidebar-border">
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <NavLink
                          to={item.url}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-primary/70 hover:bg-primary/5 hover:text-primary"
                          }`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
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
