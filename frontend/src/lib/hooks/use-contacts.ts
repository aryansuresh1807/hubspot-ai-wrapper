'use client';

import { useMemo } from 'react';
import { useContactStore } from '@/lib/store/contact-store';
import type { MockContact } from '@/lib/mock-data';

/** Returns all contacts from the contact store. */
export function useContacts(): MockContact[] {
  return useContactStore((s) => s.contacts);
}

/** Returns a single contact by id, or undefined. */
export function useContactById(id: string | null): MockContact | undefined {
  const contacts = useContactStore((s) => s.contacts);
  return useMemo(
    () => (id ? contacts.find((c) => c.id === id) : undefined),
    [contacts, id]
  );
}

/** Returns contacts filtered by accountId. */
export function useContactsForAccount(accountId: string | null): MockContact[] {
  const contacts = useContactStore((s) => s.contacts);
  return useMemo(
    () =>
      accountId ? contacts.filter((c) => c.accountId === accountId) : [],
    [contacts, accountId]
  );
}
