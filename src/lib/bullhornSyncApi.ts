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
  phone: string | null;
  mobile: string | null;
  address_city: string | null;
  address_state: string | null;
  address_country_id: number | null;
  client_corporation_id: number | null;
  client_corporation_name: string | null;
  owner_id: number | null;
  owner_name: string | null;
  date_added: string | null;
  synced_at: string;
  date_last_modified: string | null;
  is_deleted: boolean;
  linkedin_url?: string | null;
  work_phone_secondary?: string | null;
  preferred_contact?: string | null;
  mass_mail_opt_out?: boolean | null;
  sms_opt_in?: boolean | null;
  do_not_contact?: boolean | null;
  email_bounced?: boolean | null;
  comm_status_label?: string | null;
  last_email_received_at?: string | null;
  last_email_sent_at?: string | null;
  last_contacted_at?: string | null;
  timeline_event_count?: number | null;
  documents_count?: number | null;
  has_resume?: boolean | null;
  custom_field_summary?: Record<string, unknown> | null;
  latest_note?: string | null;
  latest_note_date?: string | null;
  latest_note_action?: string | null;
  raw: Record<string, unknown> | null;
}

export interface BullhornTimelineEvent {
  id: number;
  created_at: string;
  updated_at: string;
  bullhorn_contact_id: number;
  event_source: string;
  event_type: string;
  event_at: string | null;
  summary: string | null;
  details: string | null;
  actor_name: string | null;
  entity_name: string | null;
  entity_id: number | null;
  external_key: string;
  payload: Record<string, unknown> | null;
  last_synced_job_id: string | null;
}

export interface BullhornContactDocument {
  id: number;
  created_at: string;
  updated_at: string;
  bullhorn_contact_id: number;
  bullhorn_file_id: number | null;
  file_name: string | null;
  file_type: string | null;
  content_type: string | null;
  file_size: number | null;
  is_resume: boolean;
  is_deleted: boolean;
  date_added: string | null;
  date_last_modified: string | null;
  external_key: string;
  payload: Record<string, unknown> | null;
  last_synced_job_id: string | null;
}

export interface BullhornContactCommsStatus {
  bullhorn_contact_id: number;
  created_at: string;
  updated_at: string;
  email_primary: string | null;
  email_secondary: string | null;
  preferred_contact: string | null;
  mass_mail_opt_out: boolean | null;
  sms_opt_in: boolean | null;
  do_not_contact: boolean | null;
  email_bounced: boolean | null;
  status_label: string | null;
  last_email_received_at: string | null;
  last_email_sent_at: string | null;
  last_call_at: string | null;
  last_task_at: string | null;
  last_note_at: string | null;
  last_contacted_at: string | null;
  raw: Record<string, unknown> | null;
  last_synced_job_id: string | null;
}

export interface BullhornCustomFieldDictionaryEntry {
  id: number;
  created_at: string;
  updated_at: string;
  synced_at: string;
  entity_name: string;
  field_name: string;
  field_label: string | null;
  data_type: string | null;
  field_type: string | null;
  required: boolean | null;
  hidden: boolean | null;
  is_custom: boolean;
  options: unknown[] | null;
  raw: Record<string, unknown> | null;
  last_synced_job_id: string | null;
}

export interface BullhornLiveNote {
  id: number | null;
  action: string | null;
  comments: string | null;
  dateAdded: string | null;
  personName: string | null;
  targetEntityName: string | null;
  targetEntityId: number | null;
}

export interface BullhornLiveContactDetail {
  contact: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  notes: BullhornLiveNote[];
}

export interface BullhornLiveCompanyDetail {
  company: Record<string, unknown> | null;
  contacts: Record<string, unknown>[];
  notes: BullhornLiveNote[];
}

export interface DistributionListSummary {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  contact_count: number;
}

export interface DistributionListContact {
  list_id: string;
  bullhorn_id: number;
  added_at: string;
  added_by: string;
  name: string | null;
  email: string | null;
  occupation: string | null;
  company_name: string | null;
  contact_snapshot: Record<string, unknown> | null;
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
  | "skills"
  | "preferred_contact"
  | "comm_status"
  | "last_contacted"
  | "has_resume"
  | "mass_mail_opt_out";

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

export async function getBullhornLiveContactDetail(profileName: string, contactId: number) {
  return callBullhornSync<BullhornLiveContactDetail>("get-contact-detail", profileName, { contactId });
}

export async function getBullhornLiveCompanyDetail(profileName: string, companyId: number) {
  return callBullhornSync<BullhornLiveCompanyDetail>("get-company-detail", profileName, { companyId });
}

export async function getBullhornContactTimeline(
  profileName: string,
  contactId: number,
  options: { limit?: number; offset?: number; source?: string } = {},
) {
  return callBullhornSync<{
    rows: BullhornTimelineEvent[];
    total: number;
    limit: number;
    offset: number;
  }>("get-contact-timeline", profileName, { contactId, ...options });
}

export async function getBullhornContactDocuments(
  profileName: string,
  contactId: number,
  options: { limit?: number; offset?: number; includeDeleted?: boolean } = {},
) {
  return callBullhornSync<{
    rows: BullhornContactDocument[];
    total: number;
    limit: number;
    offset: number;
  }>("get-contact-documents", profileName, { contactId, ...options });
}

export async function getBullhornContactCommsStatus(profileName: string, contactId: number) {
  return callBullhornSync<BullhornContactCommsStatus | null>("get-contact-comms-status", profileName, { contactId });
}

export async function listBullhornCustomFieldDictionary(
  profileName: string,
  options: {
    limit?: number;
    offset?: number;
    entityName?: string;
    search?: string;
    customOnly?: boolean;
  } = {},
) {
  return callBullhornSync<{
    rows: BullhornCustomFieldDictionaryEntry[];
    total: number;
    limit: number;
    offset: number;
  }>("list-custom-field-dictionary", profileName, options);
}

export async function syncBullhornContactParity(
  profileName: string,
  contactIds: number[],
  jobId?: string,
) {
  return callBullhornSync<{
    contactCount: number;
    contactIds: number[];
  }>("sync-contact-parity", profileName, { contactIds, ...(jobId ? { jobId } : {}) });
}

export async function listDistributionLists(profileName: string) {
  return callBullhornSync<DistributionListSummary[]>("list-distribution-lists", profileName);
}

export async function createDistributionList(profileName: string, name: string) {
  return callBullhornSync<DistributionListSummary>("create-distribution-list", profileName, { name });
}

export async function deleteDistributionList(profileName: string, listId: string) {
  return callBullhornSync<{
    listId: string;
    name: string;
    removedContacts: number;
  }>("delete-distribution-list", profileName, { listId });
}

export async function addContactsToDistributionList(
  profileName: string,
  listId: string,
  contactIds: number[],
) {
  return callBullhornSync<{
    listId: string;
    inserted: number;
    skipped: number;
    totalInList: number;
  }>("add-contacts-to-distribution-list", profileName, { listId, contactIds });
}

export async function listDistributionListContacts(
  profileName: string,
  listId: string,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {},
) {
  return callBullhornSync<{
    contacts: DistributionListContact[];
    total: number;
    limit: number;
    offset: number;
  }>("list-distribution-list-contacts", profileName, { listId, ...options });
}

export async function removeContactsFromDistributionList(
  profileName: string,
  listId: string,
  contactIds: number[],
) {
  return callBullhornSync<{
    listId: string;
    removed: number;
    requested: number;
    skipped: number;
    totalInList: number;
  }>("remove-contacts-from-distribution-list", profileName, { listId, contactIds });
}
