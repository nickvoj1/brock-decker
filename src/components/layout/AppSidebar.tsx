import { Upload, History, Settings, Users, LayoutDashboard, Mail } from "lucide-react";
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

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Upload & Run", url: "/", icon: Upload },
  { title: "Previous CVs", url: "/previous-cvs", icon: Users },
  { title: "Generate Mail", url: "/generate-mail", icon: Mail },
  { title: "Runs History", url: "/history", icon: History },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar" collapsible="icon">
      <SidebarHeader className="px-1 py-1 border-b border-sidebar-border">
        <div className="flex items-center justify-start">
          <img
            src={brockDeckerLogo}
            alt="Brock Decker"
            className={`transition-all duration-200 ${collapsed ? "h-10 w-10 object-contain" : "h-24 w-auto"}`}
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
      </SidebarContent>
    </Sidebar>
  );
}
