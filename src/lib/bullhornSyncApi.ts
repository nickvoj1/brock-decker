import { supabase } from "@/integrations/supabase/client";

export interface BullhornSyncJob {
  id: string;
  created_at: string;
  updated_at: string;
  requested_by: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  batch_size: number;
  include_deleted: boolean;
  next_start: number;
  total_expected: number | null;
  total_synced: number;
  batches_processed: number;
  last_batch_size: number;
  started_at: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown> | null;
}

export interface BullhornMirrorContact {
  bullhorn_id: number;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  occupation: string | null;
  status: string | null;
  address_city: string | null;
  address_state: string | null;
  client_corporation_name: string | null;
  owner_name: string | null;
  synced_at: string;
  date_last_modified: string | null;
  raw: Record<string, unknown> | null;
}

export type BullhornContactFilterField =
  | "name"
  | "company"
  | "title"
  | "email"
  | "city"
  | "country"
  | "consultant"
  | "status"
  | "skills";

export type BullhornContactFilterOperator = "contains" | "equals";

export interface BullhornContactFilterRow {
  field: BullhornContactFilterField;
  operator?: BullhornContactFilterOperator;
  values: string[];
}

interface BullhornSyncResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function callBullhornSync<T>(
  action: string,
  profileName: string,
  data?: Record<string, unknown>,
): Promise<BullhornSyncResponse<T>> {
  try {
    const { data: response, error } = await supabase.functions.invoke("bullhorn-sync-clientcontacts", {
      body: { action, profileName, data },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return response as BullhornSyncResponse<T>;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function startBullhornClientContactSync(
  profileName: string,
  options: {
    batchSize?: number;
    includeDeleted?: boolean;
    maxBatchesPerInvocation?: number;
    maxContacts?: number;
  } = {},
) {
  return callBullhornSync<BullhornSyncJob>("start-sync", profileName, options);
}

export async function getBullhornSyncJob(profileName: string, jobId: string) {
  return callBullhornSync<BullhornSyncJob>("get-sync-job", profileName, { jobId });
}

export async function listBullhornSyncJobs(profileName: string, limit = 10) {
  return callBullhornSync<BullhornSyncJob[]>("list-sync-jobs", profileName, { limit });
}

export async function getBullhornMirrorStats(profileName: string) {
  return callBullhornSync<{
    totalMirroredContacts: number;
    latestJob: BullhornSyncJob | null;
  }>("get-mirror-stats", profileName);
}

export async function listBullhornMirrorContacts(
  profileName: string,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    filters?: BullhornContactFilterRow[];
  } = {},
) {
  return callBullhornSync<{
    contacts: BullhornMirrorContact[];
    total: number;
    limit: number;
    offset: number;
  }>("list-mirror-contacts", profileName, options);
}
