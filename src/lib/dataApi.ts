import { supabase } from "@/integrations/supabase/client";

// Secure data API that proxies all database operations through edge functions
// This ensures RLS policies are enforced via service role

export interface DataApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function callDataApi<T>(action: string, profileName: string, data?: Record<string, unknown>): Promise<DataApiResponse<T>> {
  try {
    const { data: response, error } = await supabase.functions.invoke("data-api", {
      body: {
        action,
        profileName,
        data,
      },
    });

    if (error) {
      console.error("Data API error:", error);
      return { success: false, error: error.message };
    }

    return response as DataApiResponse<T>;
  } catch (err) {
    console.error("Data API call failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// === Candidate Profiles ===
export async function getCandidateProfiles(profileName: string) {
  return callDataApi<any[]>("get-candidate-profiles", profileName);
}

export async function saveCandidateProfile(profileName: string, candidateData: Record<string, unknown>) {
  return callDataApi("save-candidate-profile", profileName, { candidateData });
}

export async function deleteCandidateProfile(profileName: string, candidateId: string) {
  return callDataApi("delete-candidate-profile", profileName, { candidateId });
}

// === Enrichment Runs ===
export async function getEnrichmentRuns(profileName: string) {
  return callDataApi<any[]>("get-enrichment-runs", profileName);
}

export async function getEnrichmentRun(profileName: string, runId: string) {
  return callDataApi<any>("get-enrichment-run", profileName, { runId });
}

export async function createEnrichmentRun(profileName: string, runData: Record<string, unknown>) {
  return callDataApi<any>("create-enrichment-run", profileName, { runData });
}

export async function updateEnrichmentRun(profileName: string, runId: string, updates: Record<string, unknown>) {
  return callDataApi("update-enrichment-run", profileName, { runId, updates });
}

export async function deleteEnrichmentRun(profileName: string, runId: string) {
  return callDataApi("delete-enrichment-run", profileName, { runId });
}

// === Pitch Templates ===
export async function getPitchTemplates(profileName: string) {
  return callDataApi<any[]>("get-pitch-templates", profileName);
}

export async function savePitchTemplate(profileName: string, template: Record<string, unknown>) {
  return callDataApi<any>("save-pitch-template", profileName, { template });
}

export async function deletePitchTemplate(profileName: string, templateId: string) {
  return callDataApi("delete-pitch-template", profileName, { templateId });
}

export async function setDefaultTemplate(profileName: string, templateId: string) {
  return callDataApi("set-default-template", profileName, { templateId });
}

// === Pitch History ===
export async function getPitchHistory(profileName: string) {
  return callDataApi<any[]>("get-pitch-history", profileName);
}

export async function savePitch(profileName: string, pitch: Record<string, unknown>) {
  return callDataApi("save-pitch", profileName, { pitch });
}

// === Generated Pitches ===
export async function getGeneratedPitches(profileName: string) {
  return callDataApi<any[]>("get-generated-pitches", profileName);
}

export async function saveGeneratedPitch(profileName: string, pitch: Record<string, unknown>) {
  return callDataApi("save-generated-pitch", profileName, { pitch });
}

// === API Settings ===
export async function getApiSettings(profileName: string) {
  return callDataApi<{ setting_key: string; is_configured: boolean }[]>("get-api-settings", profileName);
}

export async function saveApiSetting(profileName: string, settingKey: string, settingValue: string) {
  return callDataApi("save-api-setting", profileName, { settingKey, settingValue });
}

// === Bullhorn Status ===
export async function getBullhornStatus(profileName: string) {
  return callDataApi<{ connected: boolean; expired?: boolean; hasRefreshToken?: boolean; restUrl?: string; expiresAt?: string }>("get-bullhorn-status", profileName);
}

export async function refreshBullhornTokens(profileName: string) {
  return callDataApi<{ connected: boolean; restUrl?: string; expiresAt?: string }>("refresh-bullhorn-tokens", profileName);
}

export async function clearBullhornTokens(profileName: string) {
  return callDataApi("clear-bullhorn-tokens", profileName);
}

// === Admin Panel ===
export interface AdminActivityData {
  runs: Array<{
    id: string;
    uploaded_by: string;
    status: string;
    candidates_count: number;
    processed_count: number;
    created_at: string;
    updated_at: string;
    preferences_data: any;
  }>;
  pitches: Array<{
    id: string;
    profile_name: string;
    candidate_name: string;
    candidate_title: string | null;
    created_at: string;
  }>;
  candidates: Array<{
    id: string;
    profile_name: string;
    name: string;
    current_title: string | null;
    created_at: string;
  }>;
  userStats: Record<string, { runs: number; pitches: number; candidates: number }>;
}

export async function getAdminActivity(profileName: string) {
  return callDataApi<AdminActivityData>("admin-get-all-activity", profileName);
}

// === Team Dashboard ===
export interface TeamMemberStats {
  profile_name: string;
  total_runs: number;
  runs_today: number;
  runs_week: number;
  total_contacts: number;
  contacts_today: number;
  contacts_week: number;
  success_rate: number;
  avg_contacts_per_run: number;
  bullhorn_exported: number;
}

export interface HourlyDataPoint {
  hour: string;
  contacts: number;
}

export interface TeamDashboardData {
  stats: TeamMemberStats[];
  hourlyData: HourlyDataPoint[];
}

export async function getTeamDashboardStats(profileName: string) {
  return callDataApi<TeamDashboardData>("get-team-dashboard-stats", profileName);
}

// === Skill Patterns ===
export interface SkillPattern {
  id: string;
  pattern_type: 'company' | 'title' | 'location';
  pattern_value: string;
  skills: string[];
  frequency: number;
  confidence: number;
  last_analyzed_at: string;
}

export interface SkillPatternsStats {
  totalPatterns: number;
  companyPatterns: number;
  titlePatterns: number;
  locationPatterns: number;
  lastAnalyzedAt: string | null;
}

export async function getSkillPatterns(profileName: string) {
  return callDataApi<SkillPattern[]>("get-skill-patterns", profileName);
}

export async function getSkillPatternsStats(profileName: string) {
  return callDataApi<SkillPatternsStats>("get-skill-patterns-stats", profileName);
}

export async function clearSkillPatterns(profileName: string) {
  return callDataApi("clear-skill-patterns", profileName);
}
