/**
 * API types matching backend schemas (app/schemas/).
 * API uses snake_case in JSON.
 */

// -----------------------------------------------------------------------------
// Activity list query params (GET /api/v1/activities/)
// -----------------------------------------------------------------------------

export type ActivitySortOption =
  | 'date_newest'
  | 'date_oldest'
  | 'priority_high_low'
  | 'opportunity_pct'
  | 'relationship_status';

export interface ActivityQueryParams {
  date?: string; // YYYY-MM-DD
  relationship_status?: string[];
  processing_status?: string[];
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  sort?: ActivitySortOption;
}

// -----------------------------------------------------------------------------
// Contact / Company info (embedded in activity response)
// -----------------------------------------------------------------------------

export interface ContactInfo {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  hubspot_id?: string | null;
}

export interface CompanyInfo {
  id: string;
  name?: string | null;
  domain?: string | null;
  hubspot_id?: string | null;
}

// -----------------------------------------------------------------------------
// Activity (single activity with optional contact/company details)
// -----------------------------------------------------------------------------

export interface DashboardActivity {
  id: string;
  type?: string | null;
  subject?: string | null;
  body?: string | null;
  due_date?: string | null;
  completed?: boolean;
  contact_ids?: string[];
  company_ids?: string[];
  created_at?: string | null;
  updated_at?: string | null;
  hubspot_id?: string | null;
  contacts?: ContactInfo[];
  companies?: CompanyInfo[];
}

// -----------------------------------------------------------------------------
// List response
// -----------------------------------------------------------------------------

export interface ActivityListResponse {
  activities: DashboardActivity[];
}

// -----------------------------------------------------------------------------
// Create / Update payloads
// -----------------------------------------------------------------------------

export interface CreateActivityData {
  type?: string | null;
  subject?: string | null;
  body?: string | null;
  due_date?: string | null;
  completed?: boolean;
  contact_ids?: string[];
  company_ids?: string[];
  hubspot_id?: string | null;
}

export interface UpdateActivityData {
  type?: string | null;
  subject?: string | null;
  body?: string | null;
  due_date?: string | null;
  completed?: boolean | null;
  contact_ids?: string[] | null;
  company_ids?: string[] | null;
}

// -----------------------------------------------------------------------------
// Sync response
// -----------------------------------------------------------------------------

export interface SyncResponse {
  synced: boolean;
  message: string;
  tasks_count?: number;
}

// -----------------------------------------------------------------------------
// Dashboard state (GET/PUT /api/v1/dashboard/state)
// -----------------------------------------------------------------------------

export interface DashboardState {
  selected_activity_id?: string | null;
  sort_option: string;
  filter_state: Record<string, unknown>;
  date_picker_value?: string | null;
  updated_at?: string | null;
}

// -----------------------------------------------------------------------------
// Contact (GET/POST/PUT /api/v1/contacts)
// -----------------------------------------------------------------------------

export interface Contact {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_id?: string | null;
  hubspot_id?: string | null;
  phone?: string | null;
  job_title?: string | null;
  relationship_status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ContactListResponse {
  contacts: Contact[];
}

export interface ContactCreate {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  job_title?: string | null;
  company_id?: string | null;
  relationship_status?: string | null;
  notes?: string | null;
}

export interface ContactUpdate {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  company_id?: string | null;
  relationship_status?: string | null;
  notes?: string | null;
}
