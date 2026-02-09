'use client';

import { useMemo } from 'react';
import {
  useActivityStore,
  type ActivitySortOption,
  type ActivityFilters,
} from '@/lib/store/activity-store';
import type { MockActivity } from '@/lib/mock-data';

const RELATIONSHIP_ORDER = ['Active', 'Warm', 'Cooling', 'Dormant', 'At-Risk'] as const;

function isDateInRange(iso: string, from: string, to: string): boolean {
  const t = new Date(iso).getTime();
  if (from && t < new Date(from + 'T00:00:00').getTime()) return false;
  if (to && t > new Date(to + 'T23:59:59').getTime()) return false;
  return true;
}

function sortActivities(
  items: MockActivity[],
  sortBy: ActivitySortOption
): MockActivity[] {
  const copy = [...items];
  switch (sortBy) {
    case 'date_newest':
      copy.sort(
        (a, b) =>
          new Date(b.lastTouchDate).getTime() -
          new Date(a.lastTouchDate).getTime()
      );
      break;
    case 'date_oldest':
      copy.sort(
        (a, b) =>
          new Date(a.lastTouchDate).getTime() -
          new Date(b.lastTouchDate).getTime()
      );
      break;
    case 'opportunity_pct':
    case 'priority_high_low':
      copy.sort(
        (a, b) => b.opportunityPercentage - a.opportunityPercentage
      );
      break;
    case 'relationship_status':
      copy.sort(
        (a, b) =>
          RELATIONSHIP_ORDER.indexOf(a.relationshipStatus as (typeof RELATIONSHIP_ORDER)[number]) -
          RELATIONSHIP_ORDER.indexOf(b.relationshipStatus as (typeof RELATIONSHIP_ORDER)[number])
      );
      break;
    default:
      break;
  }
  return copy;
}

/** Returns filtered and sorted activities from the activity store. */
export function useActivities(): MockActivity[] {
  const activities = useActivityStore((s) => s.activities);
  const filters = useActivityStore((s) => s.filters);
  const sortBy = useActivityStore((s) => s.sortBy);

  return useMemo(() => {
    const filtered = activities.filter((a) => {
      if (
        filters.relationshipStatus.length > 0 &&
        !filters.relationshipStatus.includes(a.relationshipStatus)
      )
        return false;
      if (
        filters.processingStatus.length > 0 &&
        !filters.processingStatus.includes(a.processingStatus)
      )
        return false;
      if (!isDateInRange(a.lastTouchDate, filters.dateFrom, filters.dateTo))
        return false;
      return true;
    });
    return sortActivities(filtered, sortBy);
  }, [activities, filters, sortBy]);
}

/** Returns a single activity by id, or undefined. */
export function useActivityById(id: string | null): MockActivity | undefined {
  const activities = useActivityStore((s) => s.activities);
  return useMemo(
    () => (id ? activities.find((a) => a.id === id) : undefined),
    [activities, id]
  );
}

/** Returns a function to create (add) an activity. */
export function useCreateActivity(): (activity: MockActivity) => void {
  return useActivityStore((s) => s.addActivity);
}

/** Returns a function to update an activity by id. */
export function useUpdateActivity(): (
  id: string,
  updates: Partial<MockActivity>
) => void {
  return useActivityStore((s) => s.updateActivity);
}
