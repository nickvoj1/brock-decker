import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import TeamDashboard from "./pages/TeamDashboard";
import UploadRun from "./pages/UploadRun";
import RunsHistory from "./pages/RunsHistory";
import PreviousCVs from "./pages/PreviousCVs";
import CVEditor from "./pages/CVEditor";
import GenerateMail from "./pages/GenerateMail";
import SettingsPage from "./pages/Settings";
import AdminPanel from "./pages/AdminPanel";
import BullhornSyncAdmin from "./pages/BullhornSyncAdmin";
import DistributionLists from "./pages/DistributionLists";
import SignalsDashboard from "./pages/SignalsDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const LAST_ROUTE_STORAGE_KEY = "bd:last-route";

const RoutePersistence = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const didRestoreRef = useRef(false);

  useEffect(() => {
    const fullPath = `${location.pathname}${location.search}${location.hash}`;
    if (location.pathname !== "/") {
      sessionStorage.setItem(LAST_ROUTE_STORAGE_KEY, fullPath);
    }
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;

    if (location.pathname !== "/" || location.search || location.hash) return;

    const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const isReload = navigationEntry?.type === "reload";
    if (!isReload) return;

    const savedRoute = sessionStorage.getItem(LAST_ROUTE_STORAGE_KEY);
    if (!savedRoute || savedRoute === "/") return;
    navigate(savedRoute, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RoutePersistence />
        <Routes>
          <Route path="/" element={<UploadRun />} />
          <Route path="/upload" element={<UploadRun />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/team-dashboard" element={<TeamDashboard />} />
          <Route path="/signals" element={<SignalsDashboard />} />
          <Route path="/previous-cvs" element={<PreviousCVs />} />
          <Route path="/cvs/editor" element={<CVEditor />} />
          <Route path="/generate-mail" element={<GenerateMail />} />
          <Route path="/history" element={<RunsHistory />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/bullhorn-sync" element={<BullhornSyncAdmin />} />
          <Route path="/crm/contact-sync" element={<BullhornSyncAdmin tableOnly />} />
          <Route path="/crm/distribution-lists" element={<DistributionLists />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
