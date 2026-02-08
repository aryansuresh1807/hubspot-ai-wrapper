import { create } from 'zustand';

/**
 * Example store. Replace with your app state (e.g. sidebar, selected contact).
 */
interface AppState {
  // example: sidebarOpen: boolean;
  // setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>(() => ({}));
