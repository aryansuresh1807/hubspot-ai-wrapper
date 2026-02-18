'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  Sparkles,
  AlertTriangle,
  RotateCw,
  Mail,
  User,
  UserPlus,
  Building2,
  Loader2,
  Check,
  Search,
  CalendarIcon,
  RefreshCw,
  CheckCircle2,
  Pencil,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/shared/skeleton';
import { StatusChip } from '@/components/crm/StatusChip';
import { OpportunityIndicator } from '@/components/crm/OpportunityIndicator';
import { cn } from '@/lib/utils';
import {
  getActivity,
  getCommunicationSummary,
  processActivityNotes,
  processDraft,
  createAndSubmitActivity,
  submitActivity,
  getContactsByCompany,
  searchContacts,
  searchCompanies,
  completeActivity,
} from '@/lib/api';
import type { CommunicationSummaryResponse } from '@/lib/api/types';
import type { Contact } from '@/lib/api/types';
import type { CompanySearchResult } from '@/lib/api/companies';
import {
  gmailSearchEmails,
  gmailExtractContact,
  gmailGenerateActivityNote,
  type GmailSearchMessage,
  type ExtractedContact,
  type GmailSearchFolder,
} from '@/lib/api/gmail';

const DEBOUNCE_MS = 300;

/** Filter messages by All / Inbox / Sent using each message's folder tag (from backend). */
function filterMessagesByFolder(
  messages: GmailSearchMessage[],
  folder: GmailSearchFolder,
): GmailSearchMessage[] {
  if (folder === 'all') return messages;
  if (folder === 'inbox') return messages.filter((m) => m.folder === 'inbox' || m.folder === 'both');
  return messages.filter((m) => m.folder === 'sent' || m.folder === 'both');
}

/** Format email date for display. */
function formatEmailDate(msg: GmailSearchMessage): string {
  const raw = msg.date_iso || msg.date;
  if (!raw || !raw.trim()) return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return msg.date?.trim() || '—';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (dDate.getTime() === today.getTime()) return `Today, ${time}`;
    if (dDate.getTime() === yesterday.getTime()) return `Yesterday, ${time}`;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + time;
  } catch {
    return msg.date?.trim() || '—';
  }
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProcessingStep = 'idle' | 'sent' | 'extracting' | 'ready';
type UrgencyLevel = 'low' | 'medium' | 'high';
type DraftTone = 'original' | 'formal' | 'concise' | 'warm' | 'detailed';

interface RecommendedTouchDate {
  id: string;
  label: string;
  date: string;
  rationale: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_AI_SUMMARY =
  'Discussion covered Q1 goals and proposal timeline. Contact requested formal proposal by end of week. Follow-up call scheduled for next Wednesday.';

const MOCK_EXTRACTED = {
  subject: 'Q1 follow-up and proposal review',
  subjectConfidence: 92,
  nextSteps: 'Send proposal draft by Wednesday; schedule follow-up call.',
  nextStepsConfidence: 88,
  questionsRaised: 'Implementation timeline and support SLA details.',
  questionsRaisedConfidence: 65,
};

const MOCK_RECOMMENDED_DATES: RecommendedTouchDate[] = [
  {
    id: 'r1',
    label: '1 week from now',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    rationale: 'Aligns with proposal review timeline mentioned in notes.',
  },
  {
    id: 'r2',
    label: '2 weeks from now',
    date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    rationale: 'Good buffer after initial follow-up if no response.',
  },
];

const MOCK_DRAFTS: Record<DraftTone, { text: string; confidence: number }> = {
  original:
    { text: 'Summary of our discussion: Q1 goals, proposal timeline, and next steps. Contact asked for formal proposal by end of week. Follow-up call scheduled for Wednesday.', confidence: 92 },
  formal:
    { text: 'Dear [Contact], Thank you for your time on our recent call. Please find attached the proposal we discussed. I would welcome the opportunity to address any questions at your convenience. Best regards.', confidence: 88 },
  concise:
    { text: 'Hi — Attaching the proposal from our call. Let me know if you have questions or want to schedule a follow-up.', confidence: 85 },
  warm:
    { text: "Hi [Contact], It was great connecting! As promised, here’s the proposal we talked about. Happy to jump on a quick call if anything needs clarification. Thanks!", confidence: 82 },
  detailed:
    { text: 'Following our discussion on Q1 goals and the proposal timeline: we agreed to send the formal proposal by end of week and schedule a follow-up call for Wednesday.', confidence: 85 },
};

const DRAFT_TONE_LABELS: Record<DraftTone, string> = {
  original: 'Original',
  formal: 'Formal',
  concise: 'Concise',
  warm: 'Warm',
  detailed: 'Detailed',
};

const ACTIVITY_TYPES = [
  'Call',
  'Email',
  'Meeting',
  'Note',
  'Task',
  'SMS',
  'Other',
] as const;

const ACTIVITY_OUTCOMES = [
  'Completed',
  'Scheduled',
  'No answer',
  'Left message',
  'Wrong number',
  'Rescheduled',
  'Other',
] as const;

const LOW_CONFIDENCE_THRESHOLD = 70;

// ---------------------------------------------------------------------------
// Autocomplete input (simple)
// ---------------------------------------------------------------------------

function AutocompleteInput({
  value,
  onChange,
  placeholder,
  options,
  getOptionLabel,
  onSelect,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { id: string; [k: string]: unknown }[];
  getOptionLabel: (opt: { id: string; [k: string]: unknown }) => string;
  onSelect: (opt: { id: string; [k: string]: unknown }) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const filtered = React.useMemo(
    () =>
      !value.trim()
        ? options
        : options.filter((o) =>
            getOptionLabel(o).toLowerCase().includes(value.toLowerCase())
          ),
    [options, value, getOptionLabel]
  );
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <div ref={ref} className={cn('relative', className)}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <ul
          className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover py-1 shadow-soft-lg max-h-48 overflow-auto"
          role="listbox"
        >
          {filtered.slice(0, 8).map((opt) => (
            <li
              key={opt.id}
              role="option"
              aria-selected={false}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
              onClick={() => {
                onChange(getOptionLabel(opt));
                onSelect(opt);
                setOpen(false);
              }}
            >
              {getOptionLabel(opt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step indicator (processing steps)
// ---------------------------------------------------------------------------

function StepIndicator({
  step,
  active,
  label,
}: {
  step: number;
  active: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div
        className={cn(
          'rounded-full w-7 h-7 flex items-center justify-center text-xs font-medium transition-colors',
          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}
      >
        {active ? <Check className="h-4 w-4" /> : step}
      </div>
      <span
        className={cn(
          'text-xs transition-colors',
          active ? 'text-foreground font-medium' : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Urgency button (for button group)
// ---------------------------------------------------------------------------

function UrgencyButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-md border transition-colors',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-foreground border-border hover:border-primary/50'
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ value }: { value: number }) {
  const isLow = value < LOW_CONFIDENCE_THRESHOLD;
  return (
    <span
      className={cn(
        'text-xs font-medium px-1.5 py-0.5 rounded transition-colors',
        isLow ? 'bg-status-cooling/20 text-status-cooling' : 'bg-status-warm/20 text-status-warm'
      )}
    >
      {value}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Confirm checkbox (for submit confirmation dialog)
// ---------------------------------------------------------------------------

function ConfirmCheckbox({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="w-4 h-4"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Date field with calendar popover
// ---------------------------------------------------------------------------

function DateFieldWithCalendar({
  label,
  date,
  onDateChange,
  confidence,
  warning,
}: {
  label: string;
  date: string;
  onDateChange: (date: Date | undefined) => void;
  confidence: number;
  warning: boolean;
}) {
  const dateObj = date ? new Date(date + 'T00:00:00') : undefined;
  const isValidDate = dateObj && !Number.isNaN(dateObj.getTime());

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <ConfidenceBadge value={confidence} />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal transition-colors',
              warning && 'border-status-cooling'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {isValidDate ? format(dateObj, 'MMM d, yyyy') : 'Pick a date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={isValidDate ? dateObj : undefined}
            onSelect={onDateChange}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import from communication (trimmed for activity page; same rules & lookup as contacts)
// ---------------------------------------------------------------------------

interface EmailSnapshotForActivity {
  subject: string;
  snippet: string;
}

function ImportFromCommunicationSection({
  onUseExtractedData,
  onNoteGenerated,
}: {
  onUseExtractedData: (data: ExtractedContact, emailSnapshot: EmailSnapshotForActivity) => void;
  onNoteGenerated: (note: string) => void;
}): React.ReactElement {
  const [emailSearchQuery, setEmailSearchQuery] = React.useState('');
  const [emailSearchFolder, setEmailSearchFolder] = React.useState<GmailSearchFolder>('all');
  const [emailSearchResults, setEmailSearchResults] = React.useState<GmailSearchMessage[]>([]);
  const [emailSearchLoading, setEmailSearchLoading] = React.useState(false);
  const [emailSearchFullCache, setEmailSearchFullCache] = React.useState<GmailSearchMessage[] | null>(null);
  const [emailSearchFullCacheQuery, setEmailSearchFullCacheQuery] = React.useState('');
  const [selectedEmailForImport, setSelectedEmailForImport] = React.useState<GmailSearchMessage | null>(null);
  const [confirmSendOpen, setConfirmSendOpen] = React.useState(false);
  const [extractLoading, setExtractLoading] = React.useState(false);
  const [extractedData, setExtractedData] = React.useState<ExtractedContact | null>(null);
  const [extractedDialogOpen, setExtractedDialogOpen] = React.useState(false);
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const debouncedEmailQuery = useDebouncedValue(emailSearchQuery.trim(), 400);

  React.useEffect(() => {
    if (!debouncedEmailQuery) {
      setEmailSearchResults([]);
      setEmailSearchFullCache(null);
      setEmailSearchFullCacheQuery('');
      return;
    }
    const haveFullCacheForQuery =
      emailSearchFullCache !== null && emailSearchFullCacheQuery === debouncedEmailQuery;
    if (haveFullCacheForQuery) {
      setEmailSearchResults(filterMessagesByFolder(emailSearchFullCache, emailSearchFolder));
      return;
    }
    let cancelled = false;
    setEmailSearchLoading(true);
    gmailSearchEmails(debouncedEmailQuery, 'all')
      .then((list) => {
        if (cancelled) return;
        setEmailSearchFullCache(list);
        setEmailSearchFullCacheQuery(debouncedEmailQuery);
        setEmailSearchResults(filterMessagesByFolder(list, emailSearchFolder));
      })
      .catch(() => {
        if (!cancelled) {
          setEmailSearchResults([]);
          setEmailSearchFullCache(null);
          setEmailSearchFullCacheQuery('');
        }
      })
      .finally(() => {
        if (!cancelled) setEmailSearchLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedEmailQuery, emailSearchFolder, emailSearchFullCache, emailSearchFullCacheQuery]);

  const handleSelectEmailForImport = (msg: GmailSearchMessage) => {
    setSelectedEmailForImport(msg);
    setConfirmSendOpen(true);
  };

  const handleConfirmSendForProcessing = async () => {
    if (!selectedEmailForImport) return;
    setNoteError(null);
    setExtractLoading(true);
    try {
      const { note } = await gmailGenerateActivityNote(selectedEmailForImport.id);
      onNoteGenerated(note || '');
      setConfirmSendOpen(false);
      setSelectedEmailForImport(null);
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to generate note. Try again.');
    } finally {
      setExtractLoading(false);
    }
  };

  const handleUseExtractedData = () => {
    if (!extractedData) return;
    const snapshot: EmailSnapshotForActivity = {
      subject: selectedEmailForImport?.subject ?? '',
      snippet: selectedEmailForImport?.snippet ?? '',
    };
    onUseExtractedData(extractedData, snapshot);
    setExtractedDialogOpen(false);
    setExtractedData(null);
    setSelectedEmailForImport(null);
  };

  const handleCloseExtractedDialog = (open: boolean) => {
    if (!open) {
      setExtractedDialogOpen(false);
      setExtractedData(null);
      setSelectedEmailForImport(null);
    }
  };

  return (
    <Card className="border-[1.5px]">
      <CardHeader className="py-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Import from communication
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Search Gmail and import contact/details from an email into this activity.
        </p>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="flex rounded-md border border-border p-0.5 bg-muted" role="group" aria-label="Search in">
          {(['all', 'inbox', 'sent'] as const).map((f) => (
            <Button
              key={f}
              type="button"
              variant="ghost"
              size="sm"
              className={`flex-1 rounded-sm text-xs font-medium capitalize ${emailSearchFolder === f ? '!bg-muted-foreground/25 !text-foreground font-semibold' : ''}`}
              onClick={() => setEmailSearchFolder(f)}
            >
              {f === 'all' ? 'All' : f === 'inbox' ? 'Inbox' : 'Sent'}
            </Button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            placeholder="Search email by keywords..."
            value={emailSearchQuery}
            onChange={(e) => setEmailSearchQuery(e.target.value)}
            className="pl-9 h-9"
            aria-label="Search Gmail"
          />
          {emailSearchLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          )}
        </div>
        {extractLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analysing email...
          </div>
        )}
        {!extractLoading && emailSearchResults.length > 0 && (
          <ul
            className="border border-border rounded-md divide-y divide-border max-h-[200px] overflow-y-auto"
            aria-label="Email search results"
          >
            {emailSearchResults.map((msg) => (
              <li key={msg.id}>
                <button
                  type="button"
                  className="w-full text-left px-2.5 py-1.5 hover:bg-muted/50 transition-colors text-sm"
                  onClick={() => handleSelectEmailForImport(msg)}
                >
                  <p className="font-medium text-xs truncate">{msg.subject || '(no subject)'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatEmailDate(msg)}</p>
                  {(emailSearchFolder === 'all' || emailSearchFolder === 'inbox') && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">From: {msg.from || '—'}</p>
                  )}
                  {(emailSearchFolder === 'all' || emailSearchFolder === 'sent') && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">To: {msg.to || '—'}</p>
                  )}
                  {msg.snippet && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.snippet}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!extractLoading && debouncedEmailQuery && emailSearchResults.length === 0 && !emailSearchLoading && (
          <p className="text-xs text-muted-foreground py-1">No emails found. Try different keywords.</p>
        )}
      </CardContent>

      <Dialog open={confirmSendOpen} onOpenChange={(open) => !open && (setConfirmSendOpen(false), setSelectedEmailForImport(null), setNoteError(null))}>
        <DialogContent className="max-w-md" showClose={true}>
          <DialogHeader>
            <DialogTitle>Send for processing?</DialogTitle>
            <DialogDescription>
              The selected email will be sent to an AI agent to generate a brief activity note. The note will be placed in the Notes field so you don&apos;t have to write it manually.
            </DialogDescription>
          </DialogHeader>
          {selectedEmailForImport && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">From:</span> {selectedEmailForImport.from}</p>
              <p><span className="text-muted-foreground">Subject:</span> {selectedEmailForImport.subject || '(no subject)'}</p>
            </div>
          )}
          {noteError && (
            <p className="text-sm text-status-at-risk">{noteError}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => (setConfirmSendOpen(false), setSelectedEmailForImport(null), setNoteError(null))}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmSendForProcessing} disabled={extractLoading}>
              {extractLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {extractLoading ? 'Generating note...' : 'Send for processing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={extractedDialogOpen} onOpenChange={handleCloseExtractedDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" showClose={true}>
          <DialogHeader>
            <DialogTitle>Recognised fields</DialogTitle>
            <DialogDescription>
              Review the extracted contact and company details, then use them to fill this activity (contact, subject, notes).
            </DialogDescription>
          </DialogHeader>
          {extractedData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 text-sm">
                {([
                  ['First name', extractedData.first_name],
                  ['Last name', extractedData.last_name],
                  ['Email', extractedData.email],
                  ['Phone', extractedData.phone],
                  ['Job title', extractedData.job_title],
                  ['Company', extractedData.company_name],
                  ['Company domain', extractedData.company_domain],
                  ['City', extractedData.city],
                  ['State / Region', extractedData.state_region],
                  ['Company owner', extractedData.company_owner],
                ] as const).map(([label, value]) => (
                  <div key={label}>
                    <span className="text-muted-foreground">{label}:</span>{' '}
                    <span className="font-medium">{value || '—'}</span>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleCloseExtractedDialog(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleUseExtractedData}>
                  Use extracted data
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function contactDisplayName(c: Contact): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
  return name || c.email || c.id;
}

function ActivityPageContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activityId = searchParams.get('id');
  const urlContactId = searchParams.get('contact_id');
  const urlCompanyId = searchParams.get('company_id');
  const urlContactName = searchParams.get('contact_name');
  const urlAccountName = searchParams.get('account_name');

  const [noteContent, setNoteContent] = React.useState('');
  const [processingStep, setProcessingStep] = React.useState<ProcessingStep>('idle');
  const [contactSearch, setContactSearch] = React.useState('');
  const [accountSearch, setAccountSearch] = React.useState('');
  const [contactFocused, setContactFocused] = React.useState(false);
  const [accountFocused, setAccountFocused] = React.useState(false);
  const contactRef = React.useRef<HTMLDivElement>(null);
  const accountRef = React.useRef<HTMLDivElement>(null);
  const [selectedContact, setSelectedContact] = React.useState<Contact | null>(null);
  const [selectedAccount, setSelectedAccount] = React.useState<CompanySearchResult | null>(null);
  const [contactOptions, setContactOptions] = React.useState<Contact[]>([]);
  const [accountOptions, setAccountOptions] = React.useState<CompanySearchResult[]>([]);
  const [contactsByCompany, setContactsByCompany] = React.useState<Contact[]>([]);
  const [activity, setActivity] = React.useState<Awaited<ReturnType<typeof getActivity>> | null>(null);
  const [activityLoading, setActivityLoading] = React.useState(true);
  const [processingError, setProcessingError] = React.useState<string | null>(null);
  const [activityType, setActivityType] = React.useState<string>('');
  const [activityOutcome, setActivityOutcome] = React.useState<string>('');
  const [activityDate, setActivityDate] = React.useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = React.useState('');
  const [recognisedDate, setRecognisedDate] = React.useState<{ date: string | null; label: string | null; confidence: number }>({ date: null, label: null, confidence: 0 });
  const [recommendedTouch, setRecommendedTouch] = React.useState<{ date: string; label: string; rationale: string } | null>(null);
  const [urgency, setUrgency] = React.useState<UrgencyLevel>('medium');
  const [subject, setSubject] = React.useState('');
  const [nextSteps, setNextSteps] = React.useState('');
  const [questionsRaised, setQuestionsRaised] = React.useState('');
  const [subjectConfidence, setSubjectConfidence] = React.useState(0);
  const [nextStepsConfidence, setNextStepsConfidence] = React.useState(0);
  const [questionsConfidence, setQuestionsConfidence] = React.useState(0);
  const [selectedDraftTone, setSelectedDraftTone] = React.useState<DraftTone>('original');
  const [drafts, setDrafts] = React.useState<Record<string, { text: string; confidence: number }>>(MOCK_DRAFTS);
  const [summaryDraft, setSummaryDraft] = React.useState('');
  const [submitConfirmOpen, setSubmitConfirmOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [markCompleteSelected, setMarkCompleteSelected] = React.useState(false);
  const [previewEditOpen, setPreviewEditOpen] = React.useState(false);
  const [previewContent, setPreviewContent] = React.useState('');
  const [editingDraftTone, setEditingDraftTone] = React.useState<DraftTone | null>(null);
  const [isRegeneratingInPreview, setIsRegeneratingInPreview] = React.useState(false);
  const [previousNotesForSubmit, setPreviousNotesForSubmit] = React.useState('');
  const [commSummary, setCommSummary] = React.useState<CommunicationSummaryResponse | null>(null);
  const [commSummaryLoading, setCommSummaryLoading] = React.useState(false);
  const [commSummaryError, setCommSummaryError] = React.useState<string | null>(null);
  const [processConfirmOpen, setProcessConfirmOpen] = React.useState(false);
  const draftSentForProcessingRef = React.useRef<string>('');

  // Pre-fill contact and account from URL (dashboard Open passes these)
  React.useEffect(() => {
    if (urlContactName || urlContactId) {
      setContactSearch(decodeURIComponent(urlContactName ?? ''));
      if (urlContactId) {
        setSelectedContact({
          id: urlContactId,
          first_name: decodeURIComponent(urlContactName ?? ''),
          last_name: undefined,
          email: undefined,
          company_id: urlCompanyId ?? undefined,
          company_name: urlAccountName ? decodeURIComponent(urlAccountName) : undefined,
        } as Contact);
      }
    }
    if (urlAccountName || urlCompanyId) {
      setAccountSearch(decodeURIComponent(urlAccountName ?? ''));
      if (urlCompanyId) {
        setSelectedAccount({
          id: urlCompanyId,
          name: decodeURIComponent(urlAccountName ?? ''),
          domain: undefined,
          city: undefined,
          state: undefined,
        });
      }
    }
  }, [urlContactId, urlCompanyId, urlContactName, urlAccountName]);

  // Load activity when opening from dashboard (id in URL); merges with URL pre-fill
  React.useEffect(() => {
    if (!activityId) {
      setActivityLoading(false);
      return;
    }
    let cancelled = false;
    setActivityLoading(true);
    getActivity(activityId)
      .then((a) => {
        if (cancelled) return;
        setActivity(a);
        const bodyTrimmed = (a.body ?? '').trim();
        setPreviousNotesForSubmit(bodyTrimmed);
        // Leave noteContent empty: meeting notes field is for NEW notes the user will add, not existing history
        if (a.subject) setSubject(a.subject);
        const contact = a.contacts?.[0];
        const company = a.companies?.[0];
        if (contact) {
          setSelectedContact({
            id: contact.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email ?? undefined,
            company_id: company?.id ?? undefined,
            company_name: company?.name ?? undefined,
          } as Contact);
          setContactSearch([contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || '');
        }
        if (company) {
          setSelectedAccount({ id: company.id, name: company.name ?? undefined, domain: undefined, city: undefined, state: undefined });
          setAccountSearch(company.name ?? '');
        }
        setActivityLoading(false);
      })
      .catch(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => { cancelled = true; };
  }, [activityId]);

  // When account is selected, load contacts for that company
  React.useEffect(() => {
    if (!selectedAccount?.id) {
      setContactsByCompany([]);
      return;
    }
    getContactsByCompany(selectedAccount.id).then(setContactsByCompany).catch(() => setContactsByCompany([]));
  }, [selectedAccount?.id]);

  // Fetch communication summary when viewing an existing task (backend generates if empty or notes changed, stores in Supabase)
  React.useEffect(() => {
    if (!activityId) {
      setCommSummary(null);
      setCommSummaryError(null);
      return;
    }
    let cancelled = false;
    setCommSummaryLoading(true);
    setCommSummaryError(null);
    getCommunicationSummary(activityId)
      .then((data) => {
        if (!cancelled) {
          setCommSummary(data);
          setCommSummaryError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCommSummary(null);
          setCommSummaryError(err instanceof Error ? err.message : 'Failed to load communication summary');
        }
      })
      .finally(() => {
        if (!cancelled) setCommSummaryLoading(false);
      });
    return () => { cancelled = true; };
  }, [activityId]);

  const lowConfidenceFields = React.useMemo(() => {
    const list: string[] = [];
    if (subjectConfidence > 0 && subjectConfidence < LOW_CONFIDENCE_THRESHOLD) list.push('Task Title');
    return list;
  }, [subjectConfidence]);

  const showErrorBanner = lowConfidenceFields.length > 0 && processingStep === 'ready';

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setContactFocused(false);
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUseExtractedDataFromImport = React.useCallback(
    async (data: ExtractedContact, emailSnapshot: EmailSnapshotForActivity) => {
      const namePart = [data.first_name, data.last_name].filter(Boolean).join(' ');
      const display = namePart || data.email || '';
      setContactSearch(display);
      setSubject(emailSnapshot.subject || '');
      if (emailSnapshot.snippet?.trim()) {
        setNoteContent((prev) => (prev.trim() ? prev + '\n\n' + emailSnapshot.snippet!.trim() : emailSnapshot.snippet.trim()));
      }
      if (data.email?.trim()) {
        try {
          const contacts = await searchContacts(data.email.trim());
          if (contacts.length > 0) {
            const c = contacts[0];
            setSelectedContact({
              id: c.id,
              first_name: c.first_name,
              last_name: c.last_name,
              email: c.email ?? undefined,
              company_id: c.company_id ?? undefined,
              company_name: c.company_name ?? undefined,
            } as Contact);
            setContactSearch(contactDisplayName(c));
            if (c.company_id && c.company_name) {
              setSelectedAccount({ id: c.company_id, name: c.company_name, domain: undefined, city: undefined, state: undefined });
              setAccountSearch(c.company_name);
            }
          }
        } catch {
          // keep contact search as display name/email
        }
      }
      if (data.company_name?.trim() && !selectedAccount?.id) {
        try {
          const companies = await searchCompanies(data.company_name.trim());
          if (companies.length > 0) {
            const co = companies[0];
            setSelectedAccount(co);
            setAccountSearch(co.name ?? co.id);
          }
        } catch {
          // ignore
        }
      }
    },
    [selectedAccount?.id]
  );

  const debouncedContactQuery = useDebouncedValue(contactSearch.trim(), DEBOUNCE_MS);
  const debouncedAccountQuery = useDebouncedValue(accountSearch.trim(), DEBOUNCE_MS);

  const [contactSearchLoading, setContactSearchLoading] = React.useState(false);
  const [accountSearchLoading, setAccountSearchLoading] = React.useState(false);

  // Contact search: when account selected use contactsByCompany (filtered); else API search. Skip search when value matches current selection (seamless pre-fill).
  React.useEffect(() => {
    if (selectedAccount?.id) {
      setContactOptions([]);
      return;
    }
    if (!debouncedContactQuery) {
      setContactOptions([]);
      return;
    }
    const selectedDisplay = selectedContact ? contactDisplayName(selectedContact) : '';
    if (selectedContact && debouncedContactQuery === selectedDisplay.trim()) {
      setContactOptions([]);
      return;
    }
    let cancelled = false;
    setContactSearchLoading(true);
    searchContacts(debouncedContactQuery)
      .then((list) => {
        if (!cancelled) setContactOptions(list);
      })
      .catch(() => {
        if (!cancelled) setContactOptions([]);
      })
      .finally(() => {
        if (!cancelled) setContactSearchLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedContactQuery, selectedAccount?.id, selectedContact]);

  const contactSuggestions = React.useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (selectedAccount?.id) {
      if (!q) return contactsByCompany.slice(0, 10);
      return contactsByCompany.filter(
        (c) =>
          contactDisplayName(c).toLowerCase().includes(q) ||
          (c.email?.toLowerCase().includes(q))
      ).slice(0, 10);
    }
    return contactOptions.slice(0, 10);
  }, [contactSearch, selectedAccount?.id, contactsByCompany, contactOptions]);

  // Account search: API-backed debounced. Skip search when value matches current selection (seamless pre-fill).
  React.useEffect(() => {
    if (!debouncedAccountQuery) {
      setAccountOptions([]);
      return;
    }
    const selectedName = (selectedAccount?.name ?? '').trim();
    if (selectedAccount && debouncedAccountQuery === selectedName) {
      setAccountOptions([]);
      return;
    }
    let cancelled = false;
    setAccountSearchLoading(true);
    searchCompanies(debouncedAccountQuery)
      .then((list) => {
        if (!cancelled) setAccountOptions(list);
      })
      .catch(() => {
        if (!cancelled) setAccountOptions([]);
      })
      .finally(() => {
        if (!cancelled) setAccountSearchLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedAccountQuery, selectedAccount]);

  const accountSuggestions = React.useMemo(() => accountOptions.slice(0, 10), [accountOptions]);

  const handleSendForProcessing = async () => {
    if (!noteContent.trim()) return;
    draftSentForProcessingRef.current = noteContent;
    setProcessConfirmOpen(false);
    setProcessingError(null);
    setProcessingStep('sent');
    setProcessingStep('extracting');
    try {
      const res = activityId
        ? await processActivityNotes(activityId, { note_text: noteContent })
        : await processDraft({ note_text: noteContent, previous_notes: previousNotesForSubmit || '' });
      setProcessingStep('ready');
      setSummaryDraft(res.summary);
      setRecognisedDate({
        date: res.recognised_date.date,
        label: res.recognised_date.label,
        confidence: res.recognised_date.confidence,
      });
      setRecommendedTouch(res.recommended_touch_date ?? null);
      setSubject(res.metadata.subject);
      setNextSteps(res.metadata.next_steps);
      setQuestionsRaised(res.metadata.questions_raised);
      setUrgency(res.metadata.urgency);
      setSubjectConfidence(res.metadata.subject_confidence);
      setNextStepsConfidence(res.metadata.next_steps_confidence);
      setQuestionsConfidence(res.metadata.questions_confidence);
      const draftMap: Record<string, { text: string; confidence: number }> = {};
      const userDraft = draftSentForProcessingRef.current;
      draftMap.original = { text: userDraft, confidence: 100 };
      Object.entries(res.drafts ?? {}).forEach(([k, v]) => {
        if (k !== 'original') draftMap[k] = { text: v.text, confidence: v.confidence };
      });
      setDrafts(draftMap);
    } catch (e) {
      setProcessingError(e instanceof Error ? e.message : 'Processing failed');
      setProcessingStep('idle');
    }
  };

  const handleApplyRecognisedDate = () => {
    if (recognisedDate.date) setDueDate(recognisedDate.date);
  };

  const handleApplyRecommendedDate = () => {
    if (recommendedTouch?.date) setDueDate(recommendedTouch.date);
  };

  const openPreview = (tone: DraftTone) => {
    setEditingDraftTone(tone);
    setPreviewContent(drafts[tone].text);
    setPreviewEditOpen(true);
  };

  const closePreviewAndSave = () => {
    if (editingDraftTone !== null) {
      setDrafts((prev) => ({
        ...prev,
        [editingDraftTone]: { ...prev[editingDraftTone], text: previewContent },
      }));
      setEditingDraftTone(null);
    }
    setPreviewEditOpen(false);
  };

  const handleRegenerateInPreview = () => {
    setIsRegeneratingInPreview(true);
    setTimeout(() => {
      setPreviewContent((prev) => prev + ' (regenerated)');
      setIsRegeneratingInPreview(false);
    }, 1200);
  };

  const charCount = noteContent.length;
  const CHAR_LIMIT = 10000;

  return (
    <ProtectedRoute>
    <div className="h-full flex overflow-hidden gap-0">
      {/* Left column - expands to fill space up to the right column (min 400px) */}
      <div className="flex-1 min-w-[400px] overflow-y-auto bg-surface border-r border-border">
        <div className="flex flex-col gap-6 p-4">
        {/* 1. Note Editor */}
        <Card className="border-[1.5px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <Textarea
              placeholder="Paste or type your notes here..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="min-h-[200px] resize-y"
              maxLength={CHAR_LIMIT}
              disabled={processingStep === 'sent' || processingStep === 'extracting'}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {charCount.toLocaleString()} / {CHAR_LIMIT.toLocaleString()} characters
              </span>
            </div>
            {processingStep !== 'idle' && (
              <div className="flex items-center gap-4 py-1">
                <StepIndicator
                  step={1}
                  active={['sent', 'extracting', 'ready'].includes(processingStep)}
                  label="Sent"
                />
                <div className="flex-1 h-px min-w-2 bg-border" aria-hidden />
                <StepIndicator
                  step={2}
                  active={['extracting', 'ready'].includes(processingStep)}
                  label="Extracting"
                />
                <div className="flex-1 h-px min-w-2 bg-border" aria-hidden />
                <StepIndicator
                  step={3}
                  active={processingStep === 'ready'}
                  label="Ready"
                />
              </div>
            )}
            {processingError && (
              <p className="text-sm text-status-at-risk">{processingError}</p>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => setProcessConfirmOpen(true)}
                disabled={!noteContent.trim() || (processingStep !== 'idle' && processingStep !== 'ready')}
                className="gap-2"
              >
                {(processingStep === 'sent' || processingStep === 'extracting') ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Send for Processing
              </Button>
              <Button variant="secondary">Save Draft</Button>
            </div>
            <Dialog open={processConfirmOpen} onOpenChange={(open) => !open && setProcessConfirmOpen(false)}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" showClose={true}>
                <DialogHeader>
                  <DialogTitle>Send for processing?</DialogTitle>
                  <DialogDescription>
                    Your draft and client notes will be sent to the AI to recognise due date, subject, next steps, and to generate formal, concise, and detailed note drafts. The results will appear in their sections below.
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <p className="text-muted-foreground text-xs font-medium mb-1.5">Draft to process:</p>
                  <div className="max-h-48 overflow-y-auto whitespace-pre-wrap text-foreground">{noteContent || '—'}</div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setProcessConfirmOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleSendForProcessing}>
                    Confirm and send
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* 2. Import from Communication (same rules & lookup as contacts; trimmed layout) */}
        <ImportFromCommunicationSection
          onUseExtractedData={handleUseExtractedDataFromImport}
          onNoteGenerated={(note) => setNoteContent(note)}
        />

        {/* 3. Contact & Account */}
        <Card className="border-[1.5px]">
          <CardHeader>
            <CardTitle className="text-base">Contact & Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div ref={contactRef} className="relative">
              <Label className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                Contact
              </Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  onFocus={() => setContactFocused(true)}
                  placeholder="Search contacts..."
                  className="pl-8"
                />
                {contactFocused && (contactSearchLoading || contactSuggestions.length > 0) && (
                  <ul
                    className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover py-1 shadow-soft-lg max-h-48 overflow-auto"
                    role="listbox"
                  >
                    {contactSearchLoading && !selectedAccount?.id ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching...
                      </li>
                    ) : contactSuggestions.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground">
                        {selectedAccount?.id
                          ? 'No contacts for this account. Type to filter.'
                          : 'No results. Type to search contacts.'}
                      </li>
                    ) : (
                      contactSuggestions.map((contact, i) => (
                        <li
                          key={contact.id}
                          role="option"
                          aria-selected={selectedContact?.id === contact.id}
                          className="cursor-pointer px-3 py-2 text-sm hover:bg-accent w-full text-left"
                          onClick={() => {
                            setContactSearch(contactDisplayName(contact));
                            setSelectedContact(contact);
                            if (contact.company_id && contact.company_name) {
                              setSelectedAccount({ id: contact.company_id, name: contact.company_name, domain: undefined, city: undefined, state: undefined });
                              setAccountSearch(contact.company_name);
                            }
                            setContactFocused(false);
                          }}
                        >
                          <p className="font-medium">{contactDisplayName(contact)}</p>
                          {contact.email ? (
                            <p className="text-xs text-muted-foreground">{contact.email}</p>
                          ) : null}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>
            <div ref={accountRef} className="relative">
              <Label className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                Account
              </Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  onFocus={() => setAccountFocused(true)}
                  placeholder="Search accounts..."
                  className="pl-8"
                />
                {accountFocused && (accountSearchLoading || accountSuggestions.length > 0) && (
                  <ul
                    className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover py-1 shadow-soft-lg max-h-48 overflow-auto"
                    role="listbox"
                  >
                    {accountSearchLoading ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching...
                      </li>
                    ) : accountSuggestions.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground">
                        No accounts found. Type to search.
                      </li>
                    ) : (
                      accountSuggestions.map((account) => (
                        <li
                          key={account.id}
                          role="option"
                          aria-selected={selectedAccount?.id === account.id}
                          className="cursor-pointer px-3 py-2 text-sm hover:bg-accent w-full text-left"
                          onClick={() => {
                            setAccountSearch(account.name ?? '');
                            setSelectedAccount(account);
                            // Only clear contact if it's not associated with the selected account
                            if (selectedContact?.company_id !== account.id) {
                              setSelectedContact(null);
                              setContactSearch('');
                            }
                            setAccountFocused(false);
                          }}
                        >
                          {account.name ?? account.id}
                          {account.domain ? (
                            <span className="text-muted-foreground ml-1 text-xs">({account.domain})</span>
                          ) : null}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <Link
                href="/contacts?tab=contact"
                className="text-primary hover:underline flex items-center gap-1"
              >
                <UserPlus className="h-4 w-4" />
                Create Contact
              </Link>
              <Link
                href="/contacts?tab=account"
                className="text-primary hover:underline flex items-center gap-1"
              >
                <Building2 className="h-4 w-4" />
                Create Account
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 4. Quick Actions */}
        <Card className="border-[1.5px]">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activityId ? (
              <Button
                variant={markCompleteSelected ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setMarkCompleteSelected((v) => !v)}
              >
                <CheckCircle2 className={cn('h-4 w-4 mr-2', markCompleteSelected && 'opacity-90')} />
                Mark Complete
              </Button>
            ) : null}
            <Button
              className="w-full"
              onClick={() => setSubmitConfirmOpen(true)}
              disabled={
                activityLoading ||
                (activityId
                  ? false
                  : !(
                      noteContent.trim() &&
                      subject.trim() &&
                      selectedContact &&
                      selectedAccount
                    ))
              }
            >
              {activityId ? 'Submit Activity' : 'Create Activity'}
            </Button>
            {!activityId && !activityLoading && !(noteContent.trim() && subject.trim() && selectedContact && selectedAccount) ? (
              <p className="text-xs text-muted-foreground mt-2">
                Fill in meeting notes, subject, contact, and account to create a new activity.
              </p>
            ) : null}
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Right column - fixed content width (48rem = max-w-3xl), fills rest of screen */}
      <div className="w-[48rem] shrink-0 flex flex-col overflow-y-auto p-4 min-w-0">
        <div className="w-full max-w-3xl flex flex-col gap-6">
        {/* 1. Communication summary (from client notes; stored per task in Supabase) */}
        <Card className="border-[1.5px] border-primary/30 bg-primary/5">
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Communication summary
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {activityId
                ? 'Summary of client notes for this task. Regenerated when notes change.'
                : 'Open a task to see the communication summary from its client notes.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activityId ? (
              <p className="text-sm text-muted-foreground">
                Select or create an activity to see its communication summary.
              </p>
            ) : commSummaryLoading ? (
              <div className="space-y-3">
                <Skeleton variant="text" className="h-3 w-full" />
                <Skeleton variant="text" className="h-3 w-full" />
                <Skeleton variant="text" className="h-3 w-4/5" />
                <div className="flex gap-4 pt-2">
                  <Skeleton variant="rectangle" className="h-8 w-32" />
                  <Skeleton variant="rectangle" className="h-8 w-40" />
                </div>
              </div>
            ) : commSummaryError ? (
              <p className="text-sm text-status-at-risk">{commSummaryError}</p>
            ) : commSummary ? (
              <>
                <div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {commSummary.summary || 'No summary available.'}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Times contacted</span>
                    <p className="text-sm text-foreground mt-0.5">
                      {commSummary.times_contacted || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Relationship status</span>
                    <p className="text-sm text-foreground mt-0.5">
                      {commSummary.relationship_status || '—'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No communication summary yet.</p>
            )}
          </CardContent>
        </Card>

        {/* 2. Error Banner - only when low confidence fields */}
        {showErrorBanner && (
          <Card className="border-[1.5px] border-status-at-risk/50 bg-status-at-risk/10">
            <CardContent className="flex gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-status-at-risk shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-status-at-risk">Low confidence detected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Review and correct: {lowConfidenceFields.join(', ')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3. Dates (Activity Date + Due Date) */}
        <Card className="border-[1.5px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {processingStep === 'extracting' ? (
              <div className="space-y-4">
                <Skeleton variant="text" className="h-4 w-20 mb-2" />
                <Skeleton variant="rectangle" className="h-9 w-full max-w-[180px]" />
              </div>
            ) : (
            <>
            <div className="space-y-1">
              <Label>Activity Date</Label>
              <p className="text-xs text-muted-foreground">Date the task was performed (used for notes)</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {activityDate ? format(new Date(activityDate + 'T00:00:00'), 'MMM d, yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={activityDate ? new Date(activityDate + 'T00:00:00') : undefined}
                    onSelect={(d) => setActivityDate(d ? format(d, 'yyyy-MM-dd') : '')}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {dueDate ? format(new Date(dueDate + 'T00:00:00'), 'MMM d, yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ? new Date(dueDate + 'T00:00:00') : undefined}
                    onSelect={(d) => setDueDate(d ? format(d, 'yyyy-MM-dd') : '')}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {recognisedDate.date && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Recognised due date: {recognisedDate.label ?? recognisedDate.date}
                </span>
                <Button variant="outline" size="sm" onClick={handleApplyRecognisedDate}>
                  Apply
                </Button>
              </div>
            )}
            {recommendedTouch && (
              <div className="flex flex-wrap justify-between items-start gap-2 rounded-md border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">Recommended touch date</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{recommendedTouch.rationale}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="default" size="sm" onClick={handleApplyRecommendedDate}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Apply
                  </Button>
                </div>
              </div>
            )}
            </>
            )}
          </CardContent>
        </Card>

        {/* 4. Extracted Metadata */}
        <Card className="border-[1.5px]">
          <CardHeader>
            <CardTitle className="text-base">Extracted Metadata - Upcoming Task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {processingStep === 'extracting' ? (
              <div className="space-y-4">
                <div>
                  <Skeleton variant="text" className="h-4 w-16 mb-2" />
                  <Skeleton variant="rectangle" className="h-9 w-full" />
                </div>
                <div>
                  <Skeleton variant="text" className="h-4 w-24 mb-2" />
                  <Skeleton variant="rectangle" className="h-[4.5rem] w-full" />
                </div>
                <div>
                  <Skeleton variant="text" className="h-4 w-24 mb-2" />
                  <div className="flex gap-2 mt-1">
                    <Skeleton variant="rectangle" className="h-9 w-16" />
                    <Skeleton variant="rectangle" className="h-9 w-20" />
                    <Skeleton variant="rectangle" className="h-9 w-16" />
                  </div>
                </div>
              </div>
            ) : (
            <>
            <div>
              <Label className="flex items-center gap-2">
                Task Title
                {subjectConfidence > 0 && <ConfidenceBadge value={subjectConfidence} />}
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                Next Steps
                {nextStepsConfidence > 0 && <ConfidenceBadge value={nextStepsConfidence} />}
              </Label>
              <Textarea
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                className="mt-2"
                rows={2}
              />
            </div>
            <div>
              <Label>Urgency Level</Label>
              <div className="flex gap-2 mt-2">
                <UrgencyButton
                  label="Low"
                  active={urgency === 'low'}
                  onClick={() => setUrgency('low')}
                />
                <UrgencyButton
                  label="Medium"
                  active={urgency === 'medium'}
                  onClick={() => setUrgency('medium')}
                />
                <UrgencyButton
                  label="High"
                  active={urgency === 'high'}
                  onClick={() => setUrgency('high')}
                />
              </div>
            </div>
            </>
            )}
          </CardContent>
        </Card>

        {/* 5. AI-Generated Drafts */}
        <Card className="border-[1.5px]">
          <CardHeader>
            <CardTitle className="text-base">AI-Generated Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {processingStep === 'extracting' ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="rectangle" className="h-24 w-full rounded-md" />
                ))}
              </div>
            ) : (
              <>
                {(['original', 'formal', 'concise', 'detailed'] as const).map((tone) => {
                  const draft = drafts[tone];
                  if (!draft) return null;
                  const isSelected = selectedDraftTone === tone;
                  return (
                    <div
                      key={tone}
                      className={cn(
                        'rounded-md border p-3 transition-colors',
                        isSelected ? 'border-primary bg-primary/5' : 'border-border'
                      )}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary">
                          {DRAFT_TONE_LABELS[tone]}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {draft.confidence}%
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {draft.text}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedDraftTone(tone);
                            setNoteContent(draft.text);
                          }}
                        >
                          Select
                        </Button>
                        {tone !== 'original' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            onClick={() => openPreview(tone)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>

        {/* Relationship & Opportunity */}
        <Card className="border-[1.5px]">
          <CardContent className="pt-6 space-y-4">
            <div>
              <div className="flex justify-between items-center">
                <Label className="text-sm text-muted-foreground">
                  Relationship Status
                </Label>
                <Button variant="ghost" size="sm" className="gap-1">
                  <ChevronDown className="h-4 w-4" />
                  Adjust
                </Button>
              </div>
              <div className="mt-2">
                <StatusChip status="Active" />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center">
                <Label className="text-sm text-muted-foreground">
                  Opportunity Probability
                </Label>
                <Button variant="outline" size="sm">
                  Create Opportunity
                </Button>
              </div>
              <div className="mt-2">
                <OpportunityIndicator percentage={75} />
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Submit confirmation modal */}
      <Dialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activityId ? 'Confirm Submission' : 'Create Activity'}</DialogTitle>
          </DialogHeader>
          {activityId && markCompleteSelected ? (
            <p className="text-sm text-muted-foreground">
              This will mark the activity as complete in HubSpot.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {activityId
                ? 'This will update the task in HubSpot with your meeting notes, subject, contact, and account.'
                : 'This will create a new task in HubSpot with your meeting notes, subject, contact, and account.'}
              {(() => {
                const effectiveContactId = activityId
                  ? selectedContact?.id ?? activity?.contacts?.[0]?.id
                  : selectedContact?.id;
                const effectiveCompanyId = activityId
                  ? selectedAccount?.id ?? activity?.companies?.[0]?.id
                  : selectedAccount?.id;
                const hasRequired = noteContent.trim() && subject.trim() && effectiveContactId && effectiveCompanyId;
                return !hasRequired ? (
                  <span className="block mt-2 text-status-at-risk">
                    Please fill in meeting notes, subject, contact, and account before submitting.
                  </span>
                ) : null;
              })()}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitConfirmOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const effectiveContactId = activityId
                  ? selectedContact?.id ?? activity?.contacts?.[0]?.id
                  : selectedContact?.id;
                const effectiveCompanyId = activityId
                  ? selectedAccount?.id ?? activity?.companies?.[0]?.id
                  : selectedAccount?.id;
                if (!noteContent.trim() || !subject.trim() || !effectiveContactId || !effectiveCompanyId) return;
                if (activityId && markCompleteSelected) {
                  setIsSubmitting(true);
                  try {
                    await submitActivity(activityId, { mark_complete: true });
                    setSubmitConfirmOpen(false);
                    setMarkCompleteSelected(false);
                  } finally {
                    setIsSubmitting(false);
                  }
                  return;
                }
                setIsSubmitting(true);
                try {
                  if (activityId) {
                    await submitActivity(activityId, {
                      mark_complete: false,
                      meeting_notes: noteContent.trim(),
                      activity_date: activityDate || undefined,
                      due_date: dueDate || undefined,
                      subject: subject.trim(),
                      contact_id: effectiveContactId,
                      company_id: effectiveCompanyId,
                    });
                    setSubmitConfirmOpen(false);
                    getCommunicationSummary(activityId).then(setCommSummary).catch(() => {});
                  } else {
                    const res = await createAndSubmitActivity({
                      meeting_notes: noteContent.trim(),
                      activity_date: activityDate || undefined,
                      due_date: dueDate || undefined,
                      subject: subject.trim(),
                      contact_id: effectiveContactId,
                      company_id: effectiveCompanyId,
                    });
                    setSubmitConfirmOpen(false);
                    router.push(`/activity?id=${encodeURIComponent(res.id)}`);
                  }
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={
                isSubmitting ||
                (activityId && markCompleteSelected
                  ? false
                  : !(
                      noteContent.trim() &&
                      subject.trim() &&
                      (activityId
                        ? (selectedContact?.id ?? activity?.contacts?.[0]?.id) &&
                          (selectedAccount?.id ?? activity?.companies?.[0]?.id)
                        : selectedContact?.id && selectedAccount?.id)
                    ))
              }
              className="gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {activityId ? 'Confirm & Submit' : 'Create Activity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview & Edit modal */}
      <Dialog open={previewEditOpen} onOpenChange={setPreviewEditOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview & Edit Draft</DialogTitle>
            <DialogDescription>
              Review and customize this AI-generated draft
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={previewContent}
            onChange={(e) => setPreviewContent(e.target.value)}
            className="min-h-[200px] flex-1 resize-y"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditingDraftTone(null); setPreviewEditOpen(false); }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleRegenerateInPreview}
              disabled={isRegeneratingInPreview}
              className="gap-2"
            >
              <RotateCw
                className={cn('h-4 w-4', isRegeneratingInPreview && 'animate-spin')}
              />
              Regenerate
            </Button>
            <Button onClick={closePreviewAndSave}>
              Use This Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ProtectedRoute>
  );
}

function ActivityPageFallback(): React.ReactElement {
  return (
    <ProtectedRoute>
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </ProtectedRoute>
  );
}

export default function ActivityPage(): React.ReactElement {
  return (
    <React.Suspense fallback={<ActivityPageFallback />}>
      <ActivityPageContent />
    </React.Suspense>
  );
}