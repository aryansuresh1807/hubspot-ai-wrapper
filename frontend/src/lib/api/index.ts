export {
  api,
  apiRequest,
  type ApiError,
  ApiClientError,
  type RequestConfig,
} from './client';

export {
  getActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
  completeActivity,
  syncActivities,
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
} from './contacts';

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
} from './types';
