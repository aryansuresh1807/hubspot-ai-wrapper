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
  autoProcessNotes: boolean;
  showConfidenceScores: boolean;
  autoSuggestTouchDates: boolean;
  defaultDraftTone: DraftTone;
  emailNotifications: boolean;
  activityReminders: boolean;
  processingAlerts: boolean;
  emailFrequency: EmailFrequency;
  defaultReminderDays: number;
  defaultRelationshipStatus: RelationshipStatus;
  defaultUrgency: UrgencyLevel;
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

export interface SettingsStoreState extends SettingsState {
  updateSettings: (partial: Partial<SettingsState>) => void;
  resetToDefaults: () => void;
}

const noopStorage: Storage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  key: () => null,
  length: 0,
  clear: () => {},
};

export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      updateSettings: (partial) =>
        set((state) => ({
          ...state,
          ...partial,
        })),

      resetToDefaults: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'crm-settings-store',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : noopStorage
      ),
      partialize: (state) => {
        const { updateSettings, resetToDefaults, ...rest } = state;
        return rest;
      },
      merge: (persisted, current) => ({ ...current, ...persisted }),
    }
  )
);
