/**
 * Mock data for development.
 * Use realistic variety in statuses, dates, and content.
 */

export type RelationshipStatus =
  | 'Warm'
  | 'Active'
  | 'Cooling'
  | 'Dormant'
  | 'At-Risk';

export type ProcessingStatusType =
  | 'processing'
  | 'awaiting_review'
  | 'ready'
  | 'error';

export type UrgencyLevel = 'low' | 'medium' | 'high';

export type DraftTone = 'formal' | 'concise' | 'warm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MockContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  accountId: string;
  relationshipStatus: RelationshipStatus;
  lastContactDate: string;
  createdAt: string;
}

export interface MockAccount {
  id: string;
  name: string;
  domain: string;
  industry: string;
  createdAt: string;
}

export interface MockActivity {
  id: string;
  contactId: string;
  accountId: string;
  type: string;
  subject: string;
  body: string;
  dueDate: string;
  completed: boolean;
  lastTouchDate: string;
  relationshipStatus: RelationshipStatus;
  opportunityPercentage: number;
  processingStatus: ProcessingStatusType;
  questionsRaised: string;
  urgencyLevel: UrgencyLevel;
}

export interface MockDraft {
  id: string;
  activityId: string;
  draftText: string;
  tone: DraftTone;
  confidence: number;
}

export interface MockTouchDateRecommendation {
  id: string;
  activityId: string;
  recommendedStart: string;
  recommendedDue: string;
  confidence: number;
  rationale: string;
}

export interface MockAIProcessingResult {
  extractedStartDate: string | null;
  extractedDueDate: string | null;
  extractedRelationship: RelationshipStatus | null;
  subjectConfidence: number;
  questionsConfidence: number;
  keyPoints: string[];
}

export interface MockSyncLog {
  id: string;
  action: string;
  status: 'success' | 'error';
  timestamp: string;
  duration: number;
  details?: string;
}

// ---------------------------------------------------------------------------
// Base data: accounts first (referenced by contacts)
// ---------------------------------------------------------------------------

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

export const mockAccounts: MockAccount[] = [
  { id: 'a1', name: 'Acme Corp', domain: 'acme.com', industry: 'Technology', createdAt: new Date(now - 180 * day).toISOString() },
  { id: 'a2', name: 'Globex Inc', domain: 'globex.com', industry: 'Finance', createdAt: new Date(now - 160 * day).toISOString() },
  { id: 'a3', name: 'Wayne Industries', domain: 'wayneindustries.com', industry: 'Manufacturing', createdAt: new Date(now - 140 * day).toISOString() },
  { id: 'a4', name: 'Stark Solutions', domain: 'starksolutions.io', industry: 'Technology', createdAt: new Date(now - 120 * day).toISOString() },
  { id: 'a5', name: 'Umbrella Corp', domain: 'umbrellacorp.com', industry: 'Healthcare', createdAt: new Date(now - 100 * day).toISOString() },
  { id: 'a6', name: 'Cyberdyne Systems', domain: 'cyberdyne.com', industry: 'Technology', createdAt: new Date(now - 90 * day).toISOString() },
  { id: 'a7', name: 'Wonka Industries', domain: 'wonka.com', industry: 'Retail', createdAt: new Date(now - 75 * day).toISOString() },
  { id: 'a8', name: 'Initech', domain: 'initech.com', industry: 'Technology', createdAt: new Date(now - 60 * day).toISOString() },
  { id: 'a9', name: 'Dunder Mifflin', domain: 'dundermifflin.com', industry: 'Retail', createdAt: new Date(now - 45 * day).toISOString() },
  { id: 'a10', name: 'Pied Piper', domain: 'piedpiper.com', industry: 'Technology', createdAt: new Date(now - 30 * day).toISOString() },
  { id: 'a11', name: 'Hooli', domain: 'hooli.xyz', industry: 'Technology', createdAt: new Date(now - 25 * day).toISOString() },
  { id: 'a12', name: 'Massive Dynamic', domain: 'massivedynamic.com', industry: 'Healthcare', createdAt: new Date(now - 15 * day).toISOString() },
];

// ---------------------------------------------------------------------------
// Contacts (20+)
// ---------------------------------------------------------------------------

export const mockContacts: MockContact[] = [
  { id: 'c1', firstName: 'Jane', lastName: 'Cooper', email: 'jane.cooper@acme.com', phone: '+1 555-0101', jobTitle: 'VP of Sales', accountId: 'a1', relationshipStatus: 'Active', lastContactDate: new Date(now - 0 * day).toISOString(), createdAt: new Date(now - 200 * day).toISOString() },
  { id: 'c2', firstName: 'Robert', lastName: 'Fox', email: 'robert.fox@globex.com', phone: '+1 555-0102', jobTitle: 'Director of Operations', accountId: 'a2', relationshipStatus: 'Warm', lastContactDate: new Date(now - 2 * day).toISOString(), createdAt: new Date(now - 150 * day).toISOString() },
  { id: 'c3', firstName: 'Leslie', lastName: 'Alexander', email: 'leslie.a@wayneindustries.com', phone: '+1 555-0103', jobTitle: 'Procurement Lead', accountId: 'a3', relationshipStatus: 'Cooling', lastContactDate: new Date(now - 5 * day).toISOString(), createdAt: new Date(now - 90 * day).toISOString() },
  { id: 'c4', firstName: 'Michael', lastName: 'Scott', email: 'mscott@dundermifflin.com', phone: '+1 555-0104', jobTitle: 'Regional Manager', accountId: 'a9', relationshipStatus: 'Active', lastContactDate: new Date(now - 1 * day).toISOString(), createdAt: new Date(now - 400 * day).toISOString() },
  { id: 'c5', firstName: 'Sarah', lastName: 'Connor', email: 's.connor@cyberdyne.com', phone: '+1 555-0105', jobTitle: 'Security Consultant', accountId: 'a6', relationshipStatus: 'At-Risk', lastContactDate: new Date(now - 45 * day).toISOString(), createdAt: new Date(now - 120 * day).toISOString() },
  { id: 'c6', firstName: 'Tony', lastName: 'Stark', email: 'tony@starksolutions.io', phone: '+1 555-0106', jobTitle: 'CEO', accountId: 'a4', relationshipStatus: 'Warm', lastContactDate: new Date(now - 3 * day).toISOString(), createdAt: new Date(now - 100 * day).toISOString() },
  { id: 'c7', firstName: 'Dana', lastName: 'Scully', email: 'dscully@massivedynamic.com', phone: '+1 555-0107', jobTitle: 'Research Director', accountId: 'a12', relationshipStatus: 'Active', lastContactDate: new Date(now - 0 * day).toISOString(), createdAt: new Date(now - 60 * day).toISOString() },
  { id: 'c8', firstName: 'Richard', lastName: 'Hendricks', email: 'richard@piedpiper.com', phone: '+1 555-0108', jobTitle: 'CEO & Founder', accountId: 'a10', relationshipStatus: 'Warm', lastContactDate: new Date(now - 7 * day).toISOString(), createdAt: new Date(now - 30 * day).toISOString() },
  { id: 'c9', firstName: 'Gavin', lastName: 'Belson', email: 'gavin@hooli.xyz', phone: '+1 555-0109', jobTitle: 'CEO', accountId: 'a11', relationshipStatus: 'Cooling', lastContactDate: new Date(now - 14 * day).toISOString(), createdAt: new Date(now - 80 * day).toISOString() },
  { id: 'c10', firstName: 'Willy', lastName: 'Wonka', email: 'willy@wonka.com', phone: '+1 555-0110', jobTitle: 'Founder', accountId: 'a7', relationshipStatus: 'Dormant', lastContactDate: new Date(now - 90 * day).toISOString(), createdAt: new Date(now - 200 * day).toISOString() },
  { id: 'c11', firstName: 'Alice', lastName: 'Johnson', email: 'alice.j@acme.com', phone: '+1 555-0111', jobTitle: 'Account Manager', accountId: 'a1', relationshipStatus: 'Active', lastContactDate: new Date(now - 1 * day).toISOString(), createdAt: new Date(now - 70 * day).toISOString() },
  { id: 'c12', firstName: 'David', lastName: 'Chen', email: 'd.chen@globex.com', phone: '+1 555-0112', jobTitle: 'CFO', accountId: 'a2', relationshipStatus: 'Warm', lastContactDate: new Date(now - 4 * day).toISOString(), createdAt: new Date(now - 130 * day).toISOString() },
  { id: 'c13', firstName: 'Emily', lastName: 'Watson', email: 'emily.w@wayneindustries.com', phone: '+1 555-0113', jobTitle: 'VP Engineering', accountId: 'a3', relationshipStatus: 'Cooling', lastContactDate: new Date(now - 21 * day).toISOString(), createdAt: new Date(now - 95 * day).toISOString() },
  { id: 'c14', firstName: 'James', lastName: 'Wilson', email: 'jwilson@initech.com', phone: '+1 555-0114', jobTitle: 'IT Director', accountId: 'a8', relationshipStatus: 'Active', lastContactDate: new Date(now - 2 * day).toISOString(), createdAt: new Date(now - 55 * day).toISOString() },
  { id: 'c15', firstName: 'Olivia', lastName: 'Martinez', email: 'olivia.m@umbrellacorp.com', phone: '+1 555-0115', jobTitle: 'Head of R&D', accountId: 'a5', relationshipStatus: 'Warm', lastContactDate: new Date(now - 6 * day).toISOString(), createdAt: new Date(now - 85 * day).toISOString() },
  { id: 'c16', firstName: 'Daniel', lastName: 'Brown', email: 'daniel.b@starksolutions.io', phone: '+1 555-0116', jobTitle: 'CTO', accountId: 'a4', relationshipStatus: 'Active', lastContactDate: new Date(now - 0 * day).toISOString(), createdAt: new Date(now - 110 * day).toISOString() },
  { id: 'c17', firstName: 'Sophia', lastName: 'Lee', email: 'sophia.lee@cyberdyne.com', phone: '+1 555-0117', jobTitle: 'Product Manager', accountId: 'a6', relationshipStatus: 'Cooling', lastContactDate: new Date(now - 12 * day).toISOString(), createdAt: new Date(now - 65 * day).toISOString() },
  { id: 'c18', firstName: 'William', lastName: 'Taylor', email: 'wtaylor@dundermifflin.com', phone: '+1 555-0118', jobTitle: 'Sales Rep', accountId: 'a9', relationshipStatus: 'Warm', lastContactDate: new Date(now - 3 * day).toISOString(), createdAt: new Date(now - 350 * day).toISOString() },
  { id: 'c19', firstName: 'Emma', lastName: 'Anderson', email: 'e.anderson@massivedynamic.com', phone: '+1 555-0119', jobTitle: 'Lab Director', accountId: 'a12', relationshipStatus: 'Active', lastContactDate: new Date(now - 1 * day).toISOString(), createdAt: new Date(now - 40 * day).toISOString() },
  { id: 'c20', firstName: 'Christopher', lastName: 'Davis', email: 'cdavis@piedpiper.com', phone: '+1 555-0120', jobTitle: 'VP Product', accountId: 'a10', relationshipStatus: 'Warm', lastContactDate: new Date(now - 8 * day).toISOString(), createdAt: new Date(now - 28 * day).toISOString() },
  { id: 'c21', firstName: 'Jessica', lastName: 'Garcia', email: 'j.garcia@hooli.xyz', phone: '+1 555-0121', jobTitle: 'Legal Counsel', accountId: 'a11', relationshipStatus: 'Dormant', lastContactDate: new Date(now - 60 * day).toISOString(), createdAt: new Date(now - 100 * day).toISOString() },
  { id: 'c22', firstName: 'Andrew', lastName: 'Clark', email: 'aclark@acme.com', phone: '+1 555-0122', jobTitle: 'Support Lead', accountId: 'a1', relationshipStatus: 'Active', lastContactDate: new Date(now - 0 * day).toISOString(), createdAt: new Date(now - 45 * day).toISOString() },
  { id: 'c23', firstName: 'Nicole', lastName: 'White', email: 'nwhite@globex.com', phone: '+1 555-0123', jobTitle: 'Compliance Officer', accountId: 'a2', relationshipStatus: 'Warm', lastContactDate: new Date(now - 5 * day).toISOString(), createdAt: new Date(now - 140 * day).toISOString() },
  { id: 'c24', firstName: 'Kevin', lastName: 'Moore', email: 'kmoore@wonka.com', phone: '+1 555-0124', jobTitle: 'Supply Chain', accountId: 'a7', relationshipStatus: 'Cooling', lastContactDate: new Date(now - 30 * day).toISOString(), createdAt: new Date(now - 180 * day).toISOString() },
  { id: 'c25', firstName: 'Rachel', lastName: 'Green', email: 'rgreen@initech.com', phone: '+1 555-0125', jobTitle: 'Marketing Manager', accountId: 'a8', relationshipStatus: 'Active', lastContactDate: new Date(now - 2 * day).toISOString(), createdAt: new Date(now - 50 * day).toISOString() },
];

// ---------------------------------------------------------------------------
// Activities (30+)
// ---------------------------------------------------------------------------

const activityTypes = ['meeting', 'email', 'call', 'note', 'task'];
const statuses: RelationshipStatus[] = ['Active', 'Warm', 'Cooling', 'Dormant', 'At-Risk'];
const processingStatuses: ProcessingStatusType[] = ['ready', 'awaiting_review', 'processing', 'error'];
const urgencies: UrgencyLevel[] = ['low', 'medium', 'high'];

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

const activitySubjects = [
  'Q1 follow-up and proposal review',
  'Renewal discussion',
  'Initial discovery call',
  'Contract negotiation',
  'Product demo feedback',
  'Support escalation',
  'Partnership introduction',
  'Budget approval follow-up',
  'Implementation timeline',
  'Integration scope',
  'Security review',
  'Compliance checklist',
  'Upsell opportunity',
  'Reference call',
  'Training schedule',
];

const activityBodies = [
  'Discussed pricing tiers and timeline. She asked for a formal proposal by end of week.',
  'Contract up in 90 days. He mentioned possible expansion to EMEA.',
  'New lead from webinar. Pain points: manual reporting, disconnected tools.',
  'Agreed on terms. Waiting for legal to finalize.',
  'Demo went well. They want to pilot with one team first.',
  'Issue resolved. Sent summary and next steps.',
  'Introduced to their partnerships team. Follow up in two weeks.',
  'Finance needs one more approval. Chasing internally.',
  'Kickoff scheduled for next month. Sending project plan.',
  'Scoped API integration. Technical review next week.',
  'Completed questionnaire. Awaiting sign-off.',
  'Submitted docs. No gaps identified.',
  'Identified add-on that fits their roadmap.',
  'Happy to be a reference. Call set for Thursday.',
  'Onboarding sessions booked. Materials sent.',
];

export const mockActivities: MockActivity[] = Array.from({ length: 35 }, (_, i) => {
  const contact = mockContacts[i % mockContacts.length];
  const account = mockAccounts.find((a) => a.id === contact.accountId) ?? mockAccounts[0];
  const daysAgo = i % 30;
  const touchDate = new Date(now - daysAgo * day);
  const dueDate = new Date(now + (7 + (i % 14)) * day);
  return {
    id: `act-${i + 1}`,
    contactId: contact.id,
    accountId: account.id,
    type: pick(activityTypes, i),
    subject: pick(activitySubjects, i),
    body: pick(activityBodies, i),
    dueDate: dueDate.toISOString(),
    completed: i % 4 === 0,
    lastTouchDate: touchDate.toISOString(),
    relationshipStatus: contact.relationshipStatus,
    opportunityPercentage: 30 + (i % 70),
    processingStatus: pick(processingStatuses, i),
    questionsRaised: 'Implementation timeline and support SLA.',
    urgencyLevel: pick(urgencies, i),
  };
});

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export const mockDrafts: MockDraft[] = [
  { id: 'd1', activityId: 'act-1', draftText: 'Dear Jane, Thank you for your time. Please find attached the proposal we discussed. Best regards.', tone: 'formal', confidence: 92 },
  { id: 'd2', activityId: 'act-1', draftText: 'Hi Jane — Attaching the proposal from our call. Let me know if you have questions.', tone: 'concise', confidence: 88 },
  { id: 'd3', activityId: 'act-1', draftText: 'Hi Jane, It was great connecting! Here’s the proposal we talked about. Happy to jump on a call if needed. Thanks!', tone: 'warm', confidence: 90 },
  { id: 'd4', activityId: 'act-2', draftText: 'Hi Robert, Following up on our renewal discussion. I’ve attached the EMEA pricing sheet. Best,', tone: 'formal', confidence: 85 },
  { id: 'd5', activityId: 'act-3', draftText: 'Hi Leslie, Thanks for the discovery call. Here are the next steps we discussed. Regards,', tone: 'concise', confidence: 78 },
];

// ---------------------------------------------------------------------------
// Touch date recommendations
// ---------------------------------------------------------------------------

export const mockTouchDateRecommendations: MockTouchDateRecommendation[] = [
  { id: 'td1', activityId: 'act-1', recommendedStart: new Date(now + 3 * day).toISOString().slice(0, 10), recommendedDue: new Date(now + 10 * day).toISOString().slice(0, 10), confidence: 88, rationale: 'Aligns with proposal review timeline mentioned in notes.' },
  { id: 'td2', activityId: 'act-1', recommendedStart: new Date(now + 7 * day).toISOString().slice(0, 10), recommendedDue: new Date(now + 14 * day).toISOString().slice(0, 10), confidence: 72, rationale: 'Standard follow-up window if no response.' },
  { id: 'td3', activityId: 'act-2', recommendedStart: new Date(now + 5 * day).toISOString().slice(0, 10), recommendedDue: new Date(now + 12 * day).toISOString().slice(0, 10), confidence: 85, rationale: 'Renewal discussion; typical 1–2 week follow-up.' },
  { id: 'td4', activityId: 'act-3', recommendedStart: new Date(now + 7 * day).toISOString().slice(0, 10), recommendedDue: new Date(now + 21 * day).toISOString().slice(0, 10), confidence: 70, rationale: 'New lead; allow time for internal evaluation.' },
  { id: 'td5', activityId: 'act-4', recommendedStart: new Date(now + 1 * day).toISOString().slice(0, 10), recommendedDue: new Date(now + 7 * day).toISOString().slice(0, 10), confidence: 92, rationale: 'Contract negotiation; quick turnaround expected.' },
];

// ---------------------------------------------------------------------------
// AI processing results (sample with varying confidence)
// ---------------------------------------------------------------------------

export const mockAIProcessingResults: Record<string, MockAIProcessingResult> = {
  'act-1': {
    extractedStartDate: new Date(now).toISOString().slice(0, 10),
    extractedDueDate: new Date(now + 7 * day).toISOString().slice(0, 10),
    extractedRelationship: 'Active',
    subjectConfidence: 92,
    questionsConfidence: 65,
    keyPoints: ['Interested in Enterprise tier', 'Decision maker', 'Q1 close target'],
  },
  'act-2': {
    extractedStartDate: new Date(now - 2 * day).toISOString().slice(0, 10),
    extractedDueDate: new Date(now + 14 * day).toISOString().slice(0, 10),
    extractedRelationship: 'Warm',
    subjectConfidence: 90,
    questionsConfidence: 78,
    keyPoints: ['Renewal likely', 'EMEA expansion under discussion'],
  },
  'act-3': {
    extractedStartDate: null,
    extractedDueDate: new Date(now + 7 * day).toISOString().slice(0, 10),
    extractedRelationship: 'Cooling',
    subjectConfidence: 75,
    questionsConfidence: 55,
    keyPoints: ['New lead', 'Evaluating 3 vendors'],
  },
};

// ---------------------------------------------------------------------------
// Sync logs
// ---------------------------------------------------------------------------

export const mockSyncLogs: MockSyncLog[] = [
  { id: 'sl1', action: 'Contacts sync', status: 'success', timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(), duration: 2400 },
  { id: 'sl2', action: 'Activities sync', status: 'success', timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(), duration: 1800 },
  { id: 'sl3', action: 'Deals sync', status: 'error', timestamp: new Date(now - 3 * 60 * 60 * 1000).toISOString(), duration: 500, details: 'Rate limit exceeded (429)' },
  { id: 'sl4', action: 'Contacts sync', status: 'success', timestamp: new Date(now - 6 * 60 * 60 * 1000).toISOString(), duration: 2100 },
  { id: 'sl5', action: 'Email sync', status: 'error', timestamp: new Date(now - 8 * 60 * 60 * 1000).toISOString(), duration: 100, details: 'Connection timeout' },
  { id: 'sl6', action: 'Activities sync', status: 'success', timestamp: new Date(now - 12 * 60 * 60 * 1000).toISOString(), duration: 1900 },
  { id: 'sl7', action: 'Contacts sync', status: 'success', timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(), duration: 2200 },
  { id: 'sl8', action: 'Deals sync', status: 'success', timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(), duration: 3100 },
  { id: 'sl9', action: 'SMS sync', status: 'error', timestamp: new Date(now - 36 * 60 * 60 * 1000).toISOString(), duration: 50, details: 'Provider unavailable' },
  { id: 'sl10', action: 'Contacts sync', status: 'success', timestamp: new Date(now - 48 * 60 * 60 * 1000).toISOString(), duration: 2050 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getContactById(id: string): MockContact | undefined {
  return mockContacts.find((c) => c.id === id);
}

export function getAccountById(id: string): MockAccount | undefined {
  return mockAccounts.find((a) => a.id === id);
}

export function getActivitiesForContact(contactId: string): MockActivity[] {
  return mockActivities.filter((a) => a.contactId === contactId);
}

export function getContactName(contact: MockContact): string {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

/** Returns last 3 notes (activities with body) for a contact, by lastTouchDate desc. */
export function getRecentNotes(contactId: string): { date: string; text: string }[] {
  return getActivitiesForContact(contactId)
    .filter((a) => a.body)
    .sort((a, b) => new Date(b.lastTouchDate).getTime() - new Date(a.lastTouchDate).getTime())
    .slice(0, 3)
    .map((a) => ({ date: a.lastTouchDate, text: a.body }));
}
