import { create } from 'zustand';
import { mockContacts, type MockContact } from '@/lib/mock-data';

export interface ContactState {
  contacts: MockContact[];
  selectedContact: MockContact | null;
  addContact: (contact: MockContact) => void;
  updateContact: (id: string, updates: Partial<MockContact>) => void;
  deleteContact: (id: string) => void;
  setSelectedContact: (contact: MockContact | null) => void;
}

export const useContactStore = create<ContactState>((set) => ({
  contacts: [...mockContacts],
  selectedContact: null,

  addContact: (contact) =>
    set((state) => ({
      contacts: [contact, ...state.contacts],
    })),

  updateContact: (id, updates) =>
    set((state) => {
      const index = state.contacts.findIndex((c) => c.id === id);
      if (index === -1) return state;
      const next = [...state.contacts];
      next[index] = { ...next[index], ...updates };
      const selectedContact =
        state.selectedContact?.id === id
          ? { ...state.selectedContact, ...updates }
          : state.selectedContact;
      return { contacts: next, selectedContact };
    }),

  deleteContact: (id) =>
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
      selectedContact: state.selectedContact?.id === id ? null : state.selectedContact,
    })),

  setSelectedContact: (selectedContact) => set({ selectedContact }),
}));
