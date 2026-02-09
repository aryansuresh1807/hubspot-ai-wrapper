/**
 * Custom React hooks. Use Zustand stores and mock data.
 */

export {
  useActivities,
  useActivityById,
  useCreateActivity,
  useUpdateActivity,
} from './use-activities';

export {
  useContacts,
  useContactById,
  useContactsForAccount,
} from './use-contacts';

export { useToast, type ToastOptions } from './use-toast';

export {
  useProcessNotes,
  useExtractContact,
  useGenerateDrafts,
  type ProcessNotesResult,
  type ExtractContactResult,
  type GenerateDraftsResult,
} from './use-ai-processing';
