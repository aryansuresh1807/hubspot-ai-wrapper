export {
  api,
  apiRequest,
  getBaseUrl,
  buildApiUrl,
  type ApiError,
  ApiClientError,
  type RequestConfig,
  type ApiUrlParams,
} from './client';

export {
  getActivities,
  getActivity,
  getCommunicationSummary,
  createActivity,
  updateActivity,
  deleteActivity,
  completeActivity,
  syncActivities,
  processActivityNotes,
  createAndSubmitActivity,
  submitActivity,
  regenerateActivityDraft,
  getAuthHeaders,
} from './activities';

export {
  getDashboardState,
  updateDashboardState,
  debouncedUpdateDashboardState,
  DebounceCancelledError,
} from './dashboard';

export {
  getContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  searchContacts,
  getContactsByCompany,
} from './contacts';

export {
  searchCompanies,
  createCompany,
  type CompanySearchResult,
  type CompanyCreate,
  type CompanyDetailResponse,
} from './companies';

export type {
  ActivityQueryParams,
  ActivitySortOption,
  ActivityListResponse,
  DashboardActivity,
  CreateActivityData,
  UpdateActivityData,
  SyncResponse,
  ContactInfo,
  CompanyInfo,
  DashboardState,
  Contact,
  ContactListResponse,
  ContactCreate,
  ContactUpdate,
  ProcessNotesRequest,
  ProcessNotesResponse,
  ActivitySubmitRequest,
  RegenerateDraftRequest,
  DraftOut,
  RecognisedDateOut,
  RecommendedTouchDateOut,
  ExtractedMetadataOut,
  CommunicationSummaryResponse,
} from './types';
