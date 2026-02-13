'use client';

import * as React from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';
import {
  Filter,
  Mail,
  Phone,
  MessageSquare,
  Plus,
  ArrowUpDown,
  ClipboardList,
  SearchX,
  User,
  RefreshCw,
  Clock,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from '@/components/ui/toast';
import { ActivityCard, type ActivityCardActivity } from '@/components/shared/activity-card';
import {
  ContactPreview,
  type ContactPreviewContact,
} from '@/components/shared/contact-preview';
import { Skeleton } from '@/components/shared/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import type { RelationshipStatus } from '@/components/shared/status-chip';
import type { ProcessingStatusType } from '@/components/shared/processing-status';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getActivities,
  completeActivity,
  createActivity,
  syncActivities,
  type DashboardActivity,
  type ActivitySortOption,
} from '@/lib/api';
import {
  getDashboardState,
  debouncedUpdateDashboardState,
  DebounceCancelledError,
} from '@/lib/api/dashboard';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommunicationSummary {
  totalEmails: number;
  totalCalls: number;
  totalTexts: number;
  lastContact: string;
  averageResponseTime: string;
  keyPoints: string[];
}

export interface DashboardActivityItem {
  activity: ActivityCardActivity;
  communicationSummary: CommunicationSummary;
  contact: ContactPreviewContact;
}

export type SortOption =
  | 'date_newest'
  | 'date_oldest'
  | 'priority_high_low'
  | 'opportunity_pct'
  | 'relationship_status';

export interface FilterState {
  relationshipStatus: RelationshipStatus[];
  processingStatus: ProcessingStatusType[];
  dateFrom: string;
  dateTo: string;
}

interface ToastState {
  open: boolean;
  variant: 'default' | 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_SYNC_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

const RELATIONSHIP_OPTIONS: RelationshipStatus[] = [
  'Active',
  'Warm',
  'Cooling',
  'Dormant',
  'At-Risk',
];

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === 'Failed to fetch') return true;
  if (err instanceof Error && /network|fetch|unreachable/i.test(err.message)) return true;
  return false;
}

function formatLastSynced(ts: number | null): string {
  if (ts == null) return 'Never';
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return 'Just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const hours = Math.floor(diffMins / 60);
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}

const PROCESSING_OPTIONS: ProcessingStatusType[] = [
  'processing',
  'awaiting_review',
  'ready',
  'error',
];

/** Map API DashboardActivity to UI DashboardActivityItem */
function apiActivityToDashboardItem(api: DashboardActivity): DashboardActivityItem {
  const contact = api.contacts?.[0];
  const company = api.companies?.[0];
  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'Unknown'
    : 'Unknown';
  const lastTouch = api.due_date ?? api.updated_at ?? api.created_at ?? new Date().toISOString();
  const activity: ActivityCardActivity = {
    id: api.id,
    contactName,
    accountName: company?.name ?? '',
    subject: api.subject ?? 'Untitled',
    noteExcerpt: api.body ?? '',
    lastTouchDate: lastTouch,
    relationshipStatus: 'Active',
    opportunityPercentage: 0,
    processingStatus: 'ready',
  };
  const communicationSummary: CommunicationSummary = {
    totalEmails: 0,
    totalCalls: 0,
    totalTexts: 0,
    lastContact: lastTouch,
    averageResponseTime: '-',
    keyPoints: api.body ? [api.body.slice(0, 120)] : [],
  };
  const contactPreview: ContactPreviewContact = {
    name: contactName,
    email: contact?.email ?? undefined,
    phone: undefined,
    recentNotes: api.body ? [{ date: lastTouch, text: api.body.slice(0, 200) }] : [],
  };
  return { activity, communicationSummary, contact: contactPreview };
}

/** Serialize local FilterState to API filter_state */
function filterStateToApi(filter: FilterState): Record<string, unknown> {
  return {
    relationshipStatus: filter.relationshipStatus,
    processingStatus: filter.processingStatus,
    dateFrom: filter.dateFrom || undefined,
    dateTo: filter.dateTo || undefined,
  };
}

/** Parse API filter_state to local FilterState */
function filterStateFromApi(state: Record<string, unknown> | undefined): FilterState {
  if (!state) return DEFAULT_FILTER;
  return {
    relationshipStatus: Array.isArray(state.relationshipStatus)
      ? (state.relationshipStatus as RelationshipStatus[])
      : [],
    processingStatus: Array.isArray(state.processingStatus)
      ? (state.processingStatus as ProcessingStatusType[])
      : [],
    dateFrom: typeof state.dateFrom === 'string' ? state.dateFrom : '',
    dateTo: typeof state.dateTo === 'string' ? state.dateTo : '',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPageDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatLastContact(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

function isSameDay(iso: string, dateStr: string): boolean {
  if (!dateStr) return true;
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}` === dateStr;
}

function isDateInRange(iso: string, from: string, to: string): boolean {
  const t = new Date(iso).getTime();
  if (from && t < new Date(from + 'T00:00:00').getTime()) return false;
  if (to && t > new Date(to + 'T23:59:59').getTime()) return false;
  return true;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date_newest', label: 'Date Newest' },
  { value: 'date_oldest', label: 'Date Oldest' },
  { value: 'priority_high_low', label: 'Priority High to Low' },
  { value: 'opportunity_pct', label: 'Opportunity %' },
  { value: 'relationship_status', label: 'Relationship Status' },
];

const RELATIONSHIP_ORDER: RelationshipStatus[] = [
  'Active',
  'Warm',
  'Cooling',
  'Dormant',
  'At-Risk',
];

function sortActivities(
  items: DashboardActivityItem[],
  sort: SortOption
): DashboardActivityItem[] {
  const copy = [...items];
  switch (sort) {
    case 'date_newest':
      copy.sort(
        (a, b) =>
          new Date(b.activity.lastTouchDate).getTime() -
          new Date(a.activity.lastTouchDate).getTime()
      );
      break;
    case 'date_oldest':
      copy.sort(
        (a, b) =>
          new Date(a.activity.lastTouchDate).getTime() -
          new Date(b.activity.lastTouchDate).getTime()
      );
      break;
    case 'opportunity_pct':
    case 'priority_high_low':
      copy.sort(
        (a, b) =>
          b.activity.opportunityPercentage - a.activity.opportunityPercentage
      );
      break;
    case 'relationship_status':
      copy.sort(
        (a, b) =>
          RELATIONSHIP_ORDER.indexOf(a.activity.relationshipStatus) -
          RELATIONSHIP_ORDER.indexOf(b.activity.relationshipStatus)
      );
      break;
    default:
      break;
  }
  return copy;
}

const DEFAULT_FILTER: FilterState = {
  relationshipStatus: [],
  processingStatus: [],
  dateFrom: '',
  dateTo: '',
};

/** Today as YYYY-MM-DD (local date) for default activity list filter. */
function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Skeleton & Empty state
// ---------------------------------------------------------------------------

function ActivityCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-3">
        <Skeleton variant="text" className="h-4 w-3/4" />
        <Skeleton variant="text" className="h-3 w-1/2" />
        <Skeleton variant="text" className="h-3 w-full" />
        <Skeleton variant="rectangle" className="h-10 w-full" />
        <Skeleton variant="text" className="h-6 w-1/4" />
      </CardContent>
    </Card>
  );
}

function CommunicationSummarySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center rounded-md border border-border bg-muted/30 p-3">
            <Skeleton variant="circle" className="h-4 w-4 mb-1" />
            <Skeleton variant="text" className="h-6 w-8 mb-1" />
            <Skeleton variant="text" className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton variant="text" className="h-4 w-full" />
        <Skeleton variant="text" className="h-4 w-4/5" />
      </div>
      <div>
        <Skeleton variant="text" className="h-4 w-24 mb-2" />
        <ul className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <li key={i}>
              <Skeleton variant="text" className="h-3 w-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ContactPreviewSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <Skeleton variant="text" className="h-6 w-2/3" />
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-0">
        <div className="flex flex-col gap-2">
          <Skeleton variant="text" className="h-4 w-40" />
          <Skeleton variant="text" className="h-4 w-48" />
        </div>
        <section className="flex flex-col gap-3">
          <Skeleton variant="text" className="h-4 w-28" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-1">
                <Skeleton variant="text" className="h-3 w-16" />
                <Skeleton variant="text" className="h-4 w-full" />
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ACTIVITIES_QUERY_KEY = 'activities';
const DASHBOARD_STATE_QUERY_KEY = 'dashboardState';

export default function DashboardPage(): React.ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth() as { user: unknown };
  const [selectedActivityId, setSelectedActivityId] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<SortOption>('date_newest');
  const [filterDialogOpen, setFilterDialogOpen] = React.useState(false);
  const [filterDraft, setFilterDraft] = React.useState<FilterState>(DEFAULT_FILTER);
  const [filterApplied, setFilterApplied] = React.useState<FilterState>(DEFAULT_FILTER);
  const [datePickerValue, setDatePickerValue] = React.useState<string>(getTodayDateString);
  const [completingId, setCompletingId] = React.useState<string | null>(null);
  const [cloningId, setCloningId] = React.useState<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const [isOffline, setIsOffline] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState>({
    open: false,
    variant: 'default',
    title: '',
    description: undefined,
  });
  const hasSyncedStateFromServer = React.useRef(false);

  const showToast = React.useCallback(
    (variant: ToastState['variant'], title: string, description?: string) => {
      setToast({ open: true, variant, title, description });
    },
    []
  );

  // Dashboard state from API (cached by React Query – instant when navigating back)
  const dashboardStateQuery = useQuery({
    queryKey: [DASHBOARD_STATE_QUERY_KEY],
    queryFn: getDashboardState,
    enabled: !!user,
    retry: false,
  });

  // Sync local UI state from server/cache once when dashboard state is available
  React.useEffect(() => {
    const state = dashboardStateQuery.data;
    if (!state || hasSyncedStateFromServer.current) return;
    hasSyncedStateFromServer.current = true;
    setSort((state.sort_option as SortOption) || 'date_newest');
    const filter = filterStateFromApi(state.filter_state as Record<string, unknown>);
    setFilterApplied(filter);
    setFilterDraft(filter);
    setDatePickerValue(state.date_picker_value ?? getTodayDateString());
    if (state.selected_activity_id) setSelectedActivityId(state.selected_activity_id);
  }, [dashboardStateQuery.data]);

  // Activities from API (cached by React Query – instant when navigating back)
  const activitiesParams = React.useMemo(
    () => ({
      sort: sort as ActivitySortOption,
      date: datePickerValue || undefined,
      date_from: filterApplied.dateFrom || undefined,
      date_to: filterApplied.dateTo || undefined,
      relationship_status: filterApplied.relationshipStatus.length ? filterApplied.relationshipStatus : undefined,
      processing_status: filterApplied.processingStatus.length ? filterApplied.processingStatus : undefined,
    }),
    [sort, datePickerValue, filterApplied]
  );

  const activitiesQuery = useQuery({
    queryKey: [ACTIVITIES_QUERY_KEY, activitiesParams],
    queryFn: () => getActivities(activitiesParams),
    enabled: !!user && dashboardStateQuery.isFetched,
  });

  // Derive list and completed set from query data (so UI shows cached data when returning)
  const activities = React.useMemo(
    () => (activitiesQuery.data?.activities ?? []).map(apiActivityToDashboardItem),
    [activitiesQuery.data]
  );
  const completedIds = React.useMemo(
    () => new Set((activitiesQuery.data?.activities ?? []).filter((a) => a.completed).map((a) => a.id)),
    [activitiesQuery.data]
  );

  const isInitialLoad = !dashboardStateQuery.isFetched;
  const isActivitiesLoading = activitiesQuery.isLoading;

  // Set selected activity when activities load and we don't have one
  React.useEffect(() => {
    const list = activitiesQuery.data?.activities ?? [];
    if (list.length === 0) return;
    if (selectedActivityId && list.some((a) => a.id === selectedActivityId)) return;
    setSelectedActivityId((id) => (id && list.some((a) => a.id === id)) ? id : list[0].id);
  }, [activitiesQuery.data, selectedActivityId]);

  // Track last synced and offline from query result
  React.useEffect(() => {
    if (activitiesQuery.isSuccess) {
      setLastSyncedAt(Date.now());
      setIsOffline(false);
    }
  }, [activitiesQuery.isSuccess]);
  React.useEffect(() => {
    if (activitiesQuery.isError && isNetworkError(activitiesQuery.error)) setIsOffline(true);
  }, [activitiesQuery.isError, activitiesQuery.error]);

  // Show error toast when activities query fails
  React.useEffect(() => {
    if (activitiesQuery.isError && activitiesQuery.error && !activitiesQuery.data) {
      showToast('error', 'Failed to load activities', activitiesQuery.error instanceof Error ? activitiesQuery.error.message : 'Try again.');
    }
  }, [activitiesQuery.isError, activitiesQuery.error, activitiesQuery.data, showToast]);
  React.useEffect(() => {
    if (dashboardStateQuery.isError && !dashboardStateQuery.data) {
      showToast('error', 'Failed to load dashboard', dashboardStateQuery.error instanceof Error ? dashboardStateQuery.error.message : 'Please try again.');
    }
  }, [dashboardStateQuery.isError, dashboardStateQuery.error, dashboardStateQuery.data, showToast]);

  // Persist dashboard state (debounced) when selection, sort, filter, or date changes
  React.useEffect(() => {
    if (!user || isInitialLoad) return;
    const state = {
      selected_activity_id: selectedActivityId ?? null,
      sort_option: sort,
      filter_state: filterStateToApi(filterApplied),
      date_picker_value: datePickerValue || null,
    };
    debouncedUpdateDashboardState(state).catch((err) => {
      if (err instanceof DebounceCancelledError) return;
      showToast('error', 'Failed to save dashboard state', err instanceof Error ? err.message : undefined);
    });
  }, [user, isInitialLoad, selectedActivityId, sort, filterApplied, datePickerValue, showToast]);

  const selectedItem = React.useMemo(
    () => activities.find((item) => item.activity.id === selectedActivityId) ?? null,
    [activities, selectedActivityId]
  );

  const filteredByDate = React.useMemo(() => {
    if (!datePickerValue) return activities;
    return activities.filter((item) =>
      isSameDay(item.activity.lastTouchDate, datePickerValue)
    );
  }, [activities, datePickerValue]);

  const filtered = React.useMemo(() => {
    return filteredByDate.filter((item) => {
      if (completedIds.has(item.activity.id)) return false;
      const a = item.activity;
      if (
        filterApplied.relationshipStatus.length > 0 &&
        !filterApplied.relationshipStatus.includes(a.relationshipStatus)
      )
        return false;
      if (
        filterApplied.processingStatus.length > 0 &&
        !filterApplied.processingStatus.includes(a.processingStatus)
      )
        return false;
      if (!isDateInRange(a.lastTouchDate, filterApplied.dateFrom, filterApplied.dateTo))
        return false;
      return true;
    });
  }, [filteredByDate, filterApplied, completedIds]);

  const sortedItems = React.useMemo(
    () => sortActivities(filtered, sort),
    [filtered, sort]
  );

  const selectedContact: ContactPreviewContact | null = selectedItem
    ? selectedItem.contact
    : null;
  const selectedSummary: CommunicationSummary | null = selectedItem
    ? selectedItem.communicationSummary
    : null;

  const hasActiveFilters =
    filterApplied.relationshipStatus.length > 0 ||
    filterApplied.processingStatus.length > 0 ||
    !!filterApplied.dateFrom ||
    !!filterApplied.dateTo;

  const handleApplyFilter = () => {
    setFilterApplied(filterDraft);
    setFilterDialogOpen(false);
  };

  const handleClearFilter = () => {
    setFilterDraft(DEFAULT_FILTER);
    setFilterApplied(DEFAULT_FILTER);
  };

  const handleOpen = React.useCallback(
    (activity: ActivityCardActivity) => {
      router.push(`/activity?id=${activity.id}`);
    },
    [router]
  );

  const handleClone = React.useCallback(
    async (activity: ActivityCardActivity) => {
      if (isOffline) {
        showToast('warning', 'Working offline', 'Create and update are disabled until you\'re back online.');
        return;
      }
      setCloningId(activity.id);
      try {
        const created = await createActivity({
          subject: `${activity.subject} (Copy)`,
          body: activity.noteExcerpt,
          due_date: activity.lastTouchDate,
          completed: false,
        });
        await queryClient.invalidateQueries({ queryKey: [ACTIVITIES_QUERY_KEY] });
        setSelectedActivityId(created.id);
        showToast('success', 'Activity duplicated', 'You can edit the new activity.');
      } catch (err) {
        showToast('error', 'Failed to duplicate activity', err instanceof Error ? err.message : 'Try again.');
      } finally {
        setCloningId(null);
      }
    },
    [showToast, isOffline, queryClient]
  );

  const handleComplete = React.useCallback(
    async (activity: ActivityCardActivity) => {
      if (isOffline) {
        showToast('warning', 'Working offline', 'Create and update are disabled until you\'re back online.');
        return;
      }
      setCompletingId(activity.id);
      try {
        await completeActivity(activity.id);
        if (selectedActivityId === activity.id) {
          const next = activities.find((i) => i.activity.id !== activity.id && !completedIds.has(i.activity.id));
          setSelectedActivityId(next?.activity.id ?? null);
        }
        await queryClient.invalidateQueries({ queryKey: [ACTIVITIES_QUERY_KEY] });
        showToast('success', 'Activity completed', `${activity.subject} marked as complete.`);
      } catch (err) {
        showToast('error', 'Failed to complete activity', err instanceof Error ? err.message : 'Try again.');
      } finally {
        setCompletingId(null);
      }
    },
    [selectedActivityId, activities, completedIds, showToast, isOffline, queryClient]
  );

  const handleRefresh = React.useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await syncActivities();
      if (res.synced) {
        setIsOffline(false);
        setLastSyncedAt(Date.now());
        showToast('success', 'Sync complete', `${res.tasks_count ?? 0} activities synced from HubSpot.`);
        await queryClient.invalidateQueries({ queryKey: [ACTIVITIES_QUERY_KEY] });
      } else {
        showToast('warning', 'Sync failed', res.message);
      }
    } catch (err) {
      if (isNetworkError(err)) setIsOffline(true);
      showToast('error', 'Sync failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [showToast, queryClient]);

  // Auto-refresh activities every 5 minutes
  React.useEffect(() => {
    if (!user || isOffline) return;
    const interval = setInterval(() => {
      handleRefresh();
    }, AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, isOffline, handleRefresh]);

  const isLoading = isInitialLoad || isActivitiesLoading;
  const isStale = lastSyncedAt != null && Date.now() - lastSyncedAt > STALE_SYNC_THRESHOLD_MS;

  return (
    <ProtectedRoute>
    <TooltipProvider>
    <div className="flex flex-col gap-6 h-full min-h-0">
      {/* Offline banner */}
      {isOffline && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          <span className="font-medium">Working offline</span>
          <span className="text-muted-foreground">— Create and update are disabled until the API is reachable.</span>
        </div>
      )}

      {/* Page Header */}
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dan&apos;s Day
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatPageDate(new Date())}
          </p>
          {/* Sync status */}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Last synced: {formatLastSynced(lastSyncedAt)}</span>
            {isStale && lastSyncedAt != null && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                Data may be stale
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={handleRefresh}
          disabled={isSyncing || isLoading || isOffline}
          aria-label="Refresh activities from HubSpot"
        >
          <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing…' : 'Refresh'}
        </Button>
      </header>

      {/* Filter Dialog */}
      <Dialog
        open={filterDialogOpen}
        onOpenChange={(open) => {
          setFilterDialogOpen(open);
          if (open) setFilterDraft(filterApplied);
        }}
      >
        <DialogContent className="max-w-md" showClose>
          <DialogHeader>
            <DialogTitle>Filter activities</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Relationship Status</Label>
              <div className="flex flex-wrap gap-3">
                {RELATIONSHIP_OPTIONS.map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={filterDraft.relationshipStatus.includes(status)}
                      onCheckedChange={(checked) =>
                        setFilterDraft((prev) => ({
                          ...prev,
                          relationshipStatus: checked
                            ? [...prev.relationshipStatus, status]
                            : prev.relationshipStatus.filter((s) => s !== status),
                        }))
                      }
                    />
                    {status}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Processing Status</Label>
              <div className="flex flex-wrap gap-3">
                {PROCESSING_OPTIONS.map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={filterDraft.processingStatus.includes(status)}
                      onCheckedChange={(checked) =>
                        setFilterDraft((prev) => ({
                          ...prev,
                          processingStatus: checked
                            ? [...prev.processingStatus, status]
                            : prev.processingStatus.filter((s) => s !== status),
                        }))
                      }
                    />
                    {status.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="date-from">Date from</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={filterDraft.dateFrom}
                  onChange={(e) =>
                    setFilterDraft((prev) => ({ ...prev, dateFrom: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date-to">Date to</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={filterDraft.dateTo}
                  onChange={(e) =>
                    setFilterDraft((prev) => ({ ...prev, dateTo: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClearFilter}>
              Clear
            </Button>
            <Button onClick={handleApplyFilter}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Responsive: mobile stack, tablet 2-col, desktop 12-col grid; only activity list scrolls on desktop */}
      <div className="flex-1 min-h-0 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-12 lg:items-stretch">
        {/* Left panel - Activity cards (6 cols on desktop), only this section scrolls */}
        <section className="flex flex-col min-h-0 lg:col-span-6 lg:flex-1 lg:overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 mb-4 shrink-0">
            <Button
              variant="outline"
              size="icon"
              className={cn('h-9 w-9', hasActiveFilters && 'border-status-active bg-status-active/10')}
              aria-label="Filter"
              onClick={() => setFilterDialogOpen(true)}
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              className="h-9 w-[140px]"
              value={datePickerValue}
              onChange={(e) => setDatePickerValue(e.target.value)}
              aria-label="Filter by date"
            />
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="w-[200px] h-9">
                <ArrowUpDown className="h-4 w-4 opacity-50 mr-1 shrink-0" aria-hidden />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('inline-flex', isOffline && 'cursor-not-allowed')}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={handleRefresh}
                    disabled={isSyncing || isLoading || isOffline}
                    aria-label="Sync activities from HubSpot"
                  >
                    <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
                    {isSyncing ? 'Syncing…' : 'Refresh'}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {lastSyncedAt != null
                  ? `Last synced ${formatLastSynced(lastSyncedAt)}. Click to sync from HubSpot.`
                  : 'Sync activities from HubSpot.'}
              </TooltipContent>
            </Tooltip>
            {isOffline ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button variant="default" className="ml-auto h-9 gap-1" disabled aria-hidden>
                      <Plus className="h-4 w-4" />
                      New Activity
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Create and update are disabled while offline.</TooltipContent>
              </Tooltip>
            ) : (
              <Button asChild className="ml-auto h-9">
                <Link href="/activity">
                  <Plus className="h-4 w-4 mr-1" />
                  New Activity
                </Link>
              </Button>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2">
            {isLoading ? (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <ActivityCardSkeleton key={i} />
                ))}
              </>
            ) : sortedItems.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-0">
                  <EmptyState
                    icon={hasActiveFilters || datePickerValue ? SearchX : ClipboardList}
                    title={
                      hasActiveFilters || datePickerValue
                        ? 'No activities match your filters.'
                        : 'No activities yet. Create your first activity!'
                    }
                    description={
                      hasActiveFilters || datePickerValue
                        ? 'Try adjusting or clearing filters to see more results.'
                        : 'Add a note or activity to get started.'
                    }
                    action={
                      hasActiveFilters || datePickerValue
                        ? { label: 'Clear filters', onClick: () => { handleClearFilter(); setFilterDialogOpen(false); } }
                        : isOffline
                          ? { label: 'New Activity', onClick: () => showToast('warning', 'Working offline', 'Create and update are disabled until you\'re back online.') }
                          : { label: 'New Activity', onClick: () => router.push('/activity') }
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              sortedItems.map((item) => (
                <ActivityCard
                  key={item.activity.id}
                  activity={item.activity}
                  isSelected={selectedActivityId === item.activity.id}
                  onClick={() => setSelectedActivityId(item.activity.id)}
                  onOpen={handleOpen}
                  onClone={handleClone}
                  onComplete={handleComplete}
                />
              ))
            )}
          </div>
        </section>

        {/* Middle panel - Communication Summary + Communication history (task notes) */}
        <section className="flex flex-col min-h-0 lg:col-span-3 lg:flex-shrink-0 lg:overflow-hidden">
          <Card className="h-full min-h-0 overflow-hidden flex flex-col">
            <CardHeader className="pb-2 shrink-0">
              <h2 className="text-lg font-semibold">Communication Summary</h2>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
              {isLoading ? (
                <CommunicationSummarySkeleton />
              ) : selectedSummary ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center rounded-md border border-border bg-muted/50 p-3">
                      <Mail className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-lg font-semibold">
                        {selectedSummary.totalEmails}
                      </span>
                      <span className="text-xs text-muted-foreground">Emails</span>
                    </div>
                    <div className="flex flex-col items-center rounded-md border border-border bg-muted/50 p-3">
                      <Phone className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-lg font-semibold">
                        {selectedSummary.totalCalls}
                      </span>
                      <span className="text-xs text-muted-foreground">Calls</span>
                    </div>
                    <div className="flex flex-col items-center rounded-md border border-border bg-muted/50 p-3">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-lg font-semibold">
                        {selectedSummary.totalTexts}
                      </span>
                      <span className="text-xs text-muted-foreground">Texts</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Last contact:</span>{' '}
                      {formatLastContact(selectedSummary.lastContact)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Avg response:</span>{' '}
                      {selectedSummary.averageResponseTime}
                    </p>
                  </div>
                  {/* Communication history: task notes (HubSpot task body) */}
                  {selectedItem && (selectedItem.activity.noteExcerpt || selectedSummary.keyPoints?.length) ? (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Communication history</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedItem.activity.noteExcerpt || (selectedSummary.keyPoints ?? []).join('\n') || 'No notes saved for this task.'}
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Key Points</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {(selectedSummary.keyPoints ?? []).slice(0, 5).map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select an activity to see the communication summary.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Right panel - Contact preview (full width on tablet below the 2 cols, 3 cols on desktop), fixed; scrolls internally if needed */}
        <section className="flex flex-col min-h-0 md:col-span-2 lg:col-span-3 lg:flex-shrink-0 lg:overflow-hidden">
          {isLoading ? (
            <ContactPreviewSkeleton />
          ) : (
            <Card className="h-full min-h-0 overflow-hidden flex flex-col">
              <CardHeader className="pb-3 shrink-0">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Contact Preview
                </h2>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto">
                <ContactPreview contact={selectedContact} />
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      {/* Toast */}
      <Toast
        open={toast.open}
        onOpenChange={(open) => !open && setToast((p) => ({ ...p, open: false }))}
        variant={toast.variant}
      >
        <ToastTitle>{toast.title}</ToastTitle>
        {toast.description && (
          <ToastDescription>{toast.description}</ToastDescription>
        )}
        <ToastClose />
      </Toast>
    </div>
    </TooltipProvider>
    </ProtectedRoute>
  );
}