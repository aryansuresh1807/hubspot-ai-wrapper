import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type DraftTone = 'formal' | 'concise' | 'warm';
export type EmailFrequency = 'immediate' | 'daily' | 'weekly';
export type UrgencyLevel = 'low' | 'medium' | 'high';
export type RelationshipStatus =
  | 'Warm'
  | 'Active'
  | 'Cooling'
  | 'Dormant'
  | 'At-Risk';
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY';

export interface SettingsState {
  // AI Processing
  autoProcessNotes: boolean;
  showConfidenceScores: boolean;
  autoSuggestTouchDates: boolean;
  defaultDraftTone: DraftTone;
  // Notifications
  emailNotifications: boolean;
  activityReminders: boolean;
  processingAlerts: boolean;
  emailFrequency: EmailFrequency;
  // Defaults
  defaultReminderDays: number;
  defaultRelationshipStatus: RelationshipStatus;
  defaultUrgency: UrgencyLevel;
  // Display
  compactView: boolean;
  showOpportunityIndicators: boolean;
  dateFormat: DateFormat;
  timeZone: string;
}

export const DEFAULT_SETTINGS: SettingsState = {
  autoProcessNotes: true,
  showConfidenceScores: true,
  autoSuggestTouchDates: true,
  defaultDraftTone: 'formal',
  emailNotifications: true,
  activityReminders: true,
  processingAlerts: true,
  emailFrequency: 'daily',
  defaultReminderDays: 7,
  defaultRelationshipStatus: 'Active',
  defaultUrgency: 'medium',
  compactView: false,
  showOpportunityIndicators: true,
  dateFormat: 'MM/DD/YYYY',
  timeZone: 'America/New_York',
};

type PersistedState = {
  settings: SettingsState;
  lastSavedSnapshot: string | null;
};

function getSnapshot(s: SettingsState): string {
  return JSON.stringify(s);
}

export const useSettingsStore = create<PersistedState & {
  setSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  save: () => void;
  resetToDefaults: () => void;
  isDirty: () => boolean;
}>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      lastSavedSnapshot: null,

      setSetting(key, value) {
        set((state) => ({
          settings: { ...state.settings, [key]: value },
        }));
      },

      save() {
        const { settings } = get();
        set({ lastSavedSnapshot: getSnapshot(settings) });
      },

      resetToDefaults() {
        set({
          settings: { ...DEFAULT_SETTINGS },
          lastSavedSnapshot: getSnapshot(DEFAULT_SETTINGS),
        });
      },

      isDirty() {
        const { settings, lastSavedSnapshot } = get();
        const current = getSnapshot(settings);
        if (lastSavedSnapshot === null) return current !== getSnapshot(DEFAULT_SETTINGS);
        return current !== lastSavedSnapshot;
      },
    }),
    {
      name: 'crm-settings',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : ({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as Storage)
      ),
      partialize: (state) => ({
        settings: state.settings,
        lastSavedSnapshot: state.lastSavedSnapshot,
      }),
    }
  )
);
