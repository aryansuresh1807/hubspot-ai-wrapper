'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Filter,
  Calendar,
  Mail,
  Phone,
  MessageSquare,
  Plus,
  ArrowUpDown,
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
import type { RelationshipStatus } from '@/components/shared/status-chip';
import type { ProcessingStatusType } from '@/components/shared/processing-status';
import { cn } from '@/lib/utils';

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
// Mock data
// ---------------------------------------------------------------------------

const RELATIONSHIP_OPTIONS: RelationshipStatus[] = [
  'Active',
  'Warm',
  'Cooling',
  'Dormant',
  'At-Risk',
];

const PROCESSING_OPTIONS: ProcessingStatusType[] = [
  'processing',
  'awaiting_review',
  'ready',
  'error',
];

function createMockActivities(): DashboardActivityItem[] {
  return [
    {
      activity: {
        id: '1',
        contactName: 'Jane Cooper',
        accountName: 'Acme Corp',
        subject: 'Q1 follow-up and proposal review',
        noteExcerpt:
          'Discussed pricing tiers and timeline. She asked for a formal proposal by end of week. Will send draft Wednesday.',
        lastTouchDate: new Date(Date.now() - 0).toISOString(),
        relationshipStatus: 'Active' as RelationshipStatus,
        opportunityPercentage: 78,
        processingStatus: 'ready' as ProcessingStatusType,
      },
      communicationSummary: {
        totalEmails: 12,
        totalCalls: 3,
        totalTexts: 5,
        lastContact: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        averageResponseTime: '4.2 hours',
        keyPoints: [
          'Interested in Enterprise tier',
          'Decision maker, needs CFO sign-off',
          'Timeline: Q1 close target',
          'Competitor: currently evaluating one other vendor',
          'Budget confirmed for next fiscal',
        ],
      },
      contact: {
        name: 'Jane Cooper',
        phone: '+1 (555) 123-4567',
        email: 'jane.cooper@acmecorp.com',
        recentNotes: [
          {
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            text: 'Sent proposal draft. She will review with team and revert by Friday.',
          },
          {
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            text: 'Call went well. She asked about implementation timeline and support SLA.',
          },
        ],
      },
    },
    {
      activity: {
        id: '2',
        contactName: 'Robert Fox',
        accountName: 'Globex Inc',
        subject: 'Renewal discussion',
        noteExcerpt:
          'Contract up in 90 days. He mentioned possible expansion to EMEA. Need to schedule renewal call.',
        lastTouchDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        relationshipStatus: 'Warm' as RelationshipStatus,
        opportunityPercentage: 65,
        processingStatus: 'awaiting_review' as ProcessingStatusType,
      },
      communicationSummary: {
        totalEmails: 8,
        totalCalls: 2,
        totalTexts: 0,
        lastContact: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        averageResponseTime: '1.5 hours',
        keyPoints: [
          'Renewal likely, expansion under discussion',
          'Wants EMEA pricing and support details',
          'Single point of contact for procurement',
        ],
      },
      contact: {
        name: 'Robert Fox',
        phone: '+1 (555) 987-6543',
        email: 'robert.fox@globex.com',
        recentNotes: [
          {
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            text: 'Sent EMEA pricing sheet. He will loop in regional lead.',
          },
        ],
      },
    },
    {
      activity: {
        id: '3',
        contactName: 'Leslie Alexander',
        accountName: 'Wayne Industries',
        subject: 'Initial discovery call',
        noteExcerpt:
          'New lead from webinar. Pain points: manual reporting, disconnected tools. Demo scheduled for next week.',
        lastTouchDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        relationshipStatus: 'Cooling' as RelationshipStatus,
        opportunityPercentage: 42,
        processingStatus: 'processing' as ProcessingStatusType,
      },
      communicationSummary: {
        totalEmails: 4,
        totalCalls: 1,
        totalTexts: 2,
        lastContact: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        averageResponseTime: '12 hours',
        keyPoints: [
          'Evaluating 3 vendors',
          'Demo scheduled',
          'Budget not yet approved',
        ],
      },
      contact: {
        name: 'Leslie Alexander',
        email: 'leslie.a@wayneindustries.com',
        recentNotes: [
          {
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            text: 'Discovery call notes: focus on reporting and integrations.',
          },
        ],
      },
    },
  ];
}

const MOCK_ACTIVITIES_INITIAL = createMockActivities();

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

// ---------------------------------------------------------------------------
// Skeleton & Empty state
// ---------------------------------------------------------------------------

function ActivityCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-10 bg-muted rounded w-full" />
        <div className="h-6 bg-muted rounded w-1/4" />
      </CardContent>
    </Card>
  );
}

function EmptyActivityList({ hasFilters }: { hasFilters: boolean }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {hasFilters
            ? 'No activities match your filters. Try adjusting or clearing filters.'
            : 'No activities yet. Create one to get started.'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {hasFilters ? 'Use "Clear" in the filter dialog to reset.' : 'Click "New Activity" above.'}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage(): React.ReactElement {
  const router = useRouter();
  const [activities, setActivities] = React.useState<DashboardActivityItem[]>(
    () => createMockActivities()
  );
  const [selectedActivityId, setSelectedActivityId] = React.useState<string | null>(
    MOCK_ACTIVITIES_INITIAL[0]?.activity.id ?? null
  );
  const [sort, setSort] = React.useState<SortOption>('date_newest');
  const [filterDialogOpen, setFilterDialogOpen] = React.useState(false);
  const [filterDraft, setFilterDraft] = React.useState<FilterState>(DEFAULT_FILTER);
  const [filterApplied, setFilterApplied] = React.useState<FilterState>(DEFAULT_FILTER);
  const [datePickerValue, setDatePickerValue] = React.useState<string>('');
  const [completedIds, setCompletedIds] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState>({
    open: false,
    variant: 'default',
    title: '',
    description: undefined,
  });

  const showToast = React.useCallback(
    (variant: ToastState['variant'], title: string, description?: string) => {
      setToast({ open: true, variant, title, description });
    },
    []
  );

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
    (activity: ActivityCardActivity) => {
      const newId = `clone-${activity.id}-${Date.now()}`;
      const newItem: DashboardActivityItem = {
        ...MOCK_ACTIVITIES_INITIAL.find((i) => i.activity.id === activity.id)!,
        activity: {
          ...activity,
          id: newId,
          subject: `${activity.subject} (Copy)`,
        },
      };
      setActivities((prev) => [newItem, ...prev]);
      setSelectedActivityId(newId);
      showToast('success', 'Activity duplicated', 'You can edit the new activity.');
    },
    [showToast]
  );

  const handleComplete = React.useCallback(
    (activity: ActivityCardActivity) => {
      setCompletedIds((prev) => new Set(prev).add(activity.id));
      if (selectedActivityId === activity.id) setSelectedActivityId(null);
      showToast('success', 'Activity completed', `${activity.subject} marked as complete.`);
    },
    [selectedActivityId, showToast]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Dan&apos;s Day
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatPageDate(new Date())}
        </p>
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
            <div className="grid grid-cols-2 gap-4">
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

      {/* Three-column grid */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-[2fr_1.5fr_1.5fr]">
        {/* Left panel - Activity cards */}
        <section className="flex flex-col min-h-0 lg:min-h-[calc(100vh-12rem)] lg:w-[40%] lg:max-w-[40%]">
          <div className="flex flex-wrap items-center gap-2 mb-4">
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
            <Button asChild className="ml-auto h-9">
              <Link href="/activity">
                <Plus className="h-4 w-4 mr-1" />
                New Activity
              </Link>
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {isLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <ActivityCardSkeleton key={i} />
                ))}
              </>
            ) : sortedItems.length === 0 ? (
              <EmptyActivityList hasFilters={hasActiveFilters || !!datePickerValue} />
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

        {/* Middle panel - Communication Summary */}
        <section className="flex flex-col lg:w-[30%] lg:max-w-[30%]">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2">
              <h2 className="text-lg font-semibold">Communication Summary</h2>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 flex-1 min-h-0">
              {selectedSummary ? (
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

        {/* Right panel - Contact preview */}
        <section className="flex flex-col lg:w-[30%] lg:max-w-[30%]">
          <ContactPreview contact={selectedContact} />
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
  );
}
