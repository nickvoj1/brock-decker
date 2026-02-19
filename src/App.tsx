import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import TeamDashboard from "./pages/TeamDashboard";
import UploadRun from "./pages/UploadRun";
import RunsHistory from "./pages/RunsHistory";
import PreviousCVs from "./pages/PreviousCVs";
import CVEditor from "./pages/CVEditor";
import GenerateMail from "./pages/GenerateMail";
import SettingsPage from "./pages/Settings";
import AdminPanel from "./pages/AdminPanel";
import SignalsDashboard from "./pages/SignalsDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
