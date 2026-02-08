/**
 * Shared TypeScript types for the frontend.
 * Kept in sync with backend app/schemas/ for API contracts.
 * API uses snake_case; these interfaces match response/request JSON.
 */

// -----------------------------------------------------------------------------
// Activity (HubSpot activities / tasks / engagements)
// -----------------------------------------------------------------------------

export interface Activity {
  id: string;
  type?: string;
  subject?: string;
  body?: string;
  due_date?: string | null;
  completed?: boolean;
  contact_ids?: string[];
  company_ids?: string[];
  created_at?: string | null;
  updated_at?: string | null;
  hubspot_id?: string;
}

// -----------------------------------------------------------------------------
// Contact (HubSpot contacts)
// -----------------------------------------------------------------------------

export interface Contact {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  hubspot_id?: string;
}

// -----------------------------------------------------------------------------
// Account (HubSpot companies)
// -----------------------------------------------------------------------------

export interface Account {
  id: string;
  name?: string | null;
  domain?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  hubspot_id?: string;
}

// -----------------------------------------------------------------------------
// AI Processing Result (from process_notes)
// -----------------------------------------------------------------------------

export interface ExtractedDate {
  date: string;
  label?: string | null;
}

export interface ExtractedRelationship {
  type?: string | null;
  name?: string | null;
  identifier?: string | null;
}

export interface AIProcessingResult {
  dates: ExtractedDate[];
  relationships: ExtractedRelationship[];
  metadata: Record<string, unknown>;
  confidence: number;
}

// -----------------------------------------------------------------------------
// Draft (AI-generated draft per activity)
// -----------------------------------------------------------------------------

export interface Draft {
  id?: string;
  activity_id?: string;
  draft_text: string;
  tone: string;
  confidence: number;
  selected?: boolean;
  created_at?: string | null;
}

// -----------------------------------------------------------------------------
// Touch Date Recommendation
// -----------------------------------------------------------------------------

export interface TouchDateRecommendation {
  id?: string;
  activity_id?: string;
  recommended_start: string | null;
  recommended_due: string | null;
  confidence: number;
  applied: boolean;
  created_at?: string | null;
}

// -----------------------------------------------------------------------------
// API response wrappers (optional, for paginated/list endpoints)
// -----------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  items: T[];
  total?: number;
  after?: string | null;
}
