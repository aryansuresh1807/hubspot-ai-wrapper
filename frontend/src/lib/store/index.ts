/**
 * Zustand stores and shared state types.
 * Initialize with mock data on first load where applicable.
 */

// Activity store
export {
  useActivityStore,
  type ActivityState,
  type ActivityFilters,
  type ActivitySortOption,
} from './activity-store';

// Contact store
export {
  useContactStore,
  type ContactState,
} from './contact-store';

// Settings store (persisted)
export {
  useSettingsStore,
  DEFAULT_SETTINGS,
  type SettingsState,
  type SettingsStoreState,
  type DraftTone,
  type EmailFrequency,
  type UrgencyLevel,
  type RelationshipStatus as SettingsRelationshipStatus,
  type DateFormat,
} from './settings-store';

// UI store
export {
  useUIStore,
  type UIState,
  type ToastItem,
  type ToastVariant,
} from './ui-store';

