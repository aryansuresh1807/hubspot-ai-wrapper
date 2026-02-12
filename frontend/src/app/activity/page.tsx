'use client';

import * as React from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  Sparkles,
  AlertTriangle,
  RotateCw,
  Mail,
  FileText,
  User,
  UserPlus,
  Building2,
  Loader2,
  Check,
  Search,
  MessageSquare,
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProcessingStep = 'idle' | 'sent' | 'extracting' | 'ready';
type UrgencyLevel = 'low' | 'medium' | 'high';
type DraftTone = 'original' | 'formal' | 'concise' | 'warm';

interface RecommendedTouchDate {
  id: string;
  label: string;
  date: string;
  rationale: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_CONTACTS = [
  { id: 'c1', name: 'Jane Cooper', email: 'jane@acme.com' },
  { id: 'c2', name: 'Robert Fox', email: 'robert@globex.com' },
  { id: 'c3', name: 'Leslie Alexander', email: 'leslie@wayne.com' },
];

const MOCK_ACCOUNTS = [
  { id: 'a1', name: 'Acme Corp' },
  { id: 'a2', name: 'Globex Inc' },
  { id: 'a3', name: 'Wayne Industries' },
];

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
};

const DRAFT_TONE_LABELS: Record<DraftTone, string> = {
  original: 'Original',
  formal: 'Formal',
  concise: 'Concise',
  warm: 'Warm',
};

const MOCK_EMAILS = [
  { id: 'e1', subject: 'Q1 follow-up and proposal review', from: 'jane@acme.com', date: 'Feb 5, 2025', preview: 'Thanks for the call today. Please send the proposal by end of week.' },
  { id: 'e2', subject: 'Re: Implementation timeline', from: 'robert@globex.com', date: 'Feb 4, 2025', preview: 'Can we schedule a follow-up to discuss the implementation details?' },
  { id: 'e3', subject: 'Intro - Wayne Industries', from: 'leslie@wayne.com', date: 'Feb 3, 2025', preview: 'Hi, connecting you with the team regarding the project scope.' },
];

const MOCK_TEXTS = [
  { id: 't1', from: 'Jane Cooper', date: 'Feb 6, 2025', preview: 'Can you send the proposal draft by Wednesday? Would love to review before our call.' },
  { id: 't2', from: 'Robert Fox', date: 'Feb 5, 2025', preview: 'Thanks for the update. Let me know when the contract is ready for signature.' },
  { id: 't3', from: 'Leslie Alexander', date: 'Feb 4, 2025', preview: 'Quick question about the support SLA — can we go over it on the next call?' },
];

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
// Page
// ---------------------------------------------------------------------------

export default function ActivityPage(): React.ReactElement {
  const [noteContent, setNoteContent] = React.useState('');
  const [processingStep, setProcessingStep] = React.useState<ProcessingStep>('idle');
  const [contactSearch, setContactSearch] = React.useState('');
  const [accountSearch, setAccountSearch] = React.useState('');
  const [contactFocused, setContactFocused] = React.useState(false);
  const [accountFocused, setAccountFocused] = React.useState(false);
  const contactRef = React.useRef<HTMLDivElement>(null);
  const accountRef = React.useRef<HTMLDivElement>(null);
  const [selectedContactId, setSelectedContactId] = React.useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);
  const [activityType, setActivityType] = React.useState<string>('');
  const [activityOutcome, setActivityOutcome] = React.useState<string>('');
  const [emailImportQuery, setEmailImportQuery] = React.useState('');
  const [textImportQuery, setTextImportQuery] = React.useState('');
  const [emailImportFocused, setEmailImportFocused] = React.useState(false);
  const [textImportFocused, setTextImportFocused] = React.useState(false);
  const emailImportRef = React.useRef<HTMLDivElement>(null);
  const textImportRef = React.useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = React.useState('');
  const [startDateConfidence, setStartDateConfidence] = React.useState(85);
  const [dueDate, setDueDate] = React.useState('');
  const [dueDateConfidence, setDueDateConfidence] = React.useState(78);
  const [urgency, setUrgency] = React.useState<UrgencyLevel>('medium');
  const [subject, setSubject] = React.useState(MOCK_EXTRACTED.subject);
  const [nextSteps, setNextSteps] = React.useState(MOCK_EXTRACTED.nextSteps);
  const [questionsRaised, setQuestionsRaised] = React.useState(
    MOCK_EXTRACTED.questionsRaised
  );
  const [selectedDraftTone, setSelectedDraftTone] = React.useState<DraftTone>('original');
  const [drafts, setDrafts] = React.useState<Record<DraftTone, { text: string; confidence: number }>>(MOCK_DRAFTS);
  const [regeneratingTone, setRegeneratingTone] = React.useState<DraftTone | null>(null);
  const [summaryDraft, setSummaryDraft] = React.useState(MOCK_AI_SUMMARY);
  const [submitConfirmOpen, setSubmitConfirmOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmUpdateActivity, setConfirmUpdateActivity] = React.useState(true);
  const [confirmClonePriorNotes, setConfirmClonePriorNotes] = React.useState(false);
  const [confirmMarkComplete, setConfirmMarkComplete] = React.useState(true);
  const [confirmCreateOpportunity, setConfirmCreateOpportunity] = React.useState(false);
  const [confirmLinkContact, setConfirmLinkContact] = React.useState(true);
  const [confirmLinkAccount, setConfirmLinkAccount] = React.useState(true);
  const [previewEditOpen, setPreviewEditOpen] = React.useState(false);
  const [previewContent, setPreviewContent] = React.useState(MOCK_DRAFTS.original.text);
  const [editingDraftTone, setEditingDraftTone] = React.useState<DraftTone | null>(null);
  const [isRegeneratingInPreview, setIsRegeneratingInPreview] = React.useState(false);

  const lowConfidenceFields = React.useMemo(() => {
    const list: string[] = [];
    if (MOCK_EXTRACTED.questionsRaisedConfidence < LOW_CONFIDENCE_THRESHOLD)
      list.push('Questions Raised');
    if (startDateConfidence < LOW_CONFIDENCE_THRESHOLD) list.push('Start Date');
    if (dueDateConfidence < LOW_CONFIDENCE_THRESHOLD) list.push('Due Date');
    return list;
  }, [startDateConfidence, dueDateConfidence]);

  const showErrorBanner = lowConfidenceFields.length > 0 && processingStep === 'ready';

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emailImportRef.current && !emailImportRef.current.contains(e.target as Node)) {
        setEmailImportFocused(false);
      }
      if (textImportRef.current && !textImportRef.current.contains(e.target as Node)) {
        setTextImportFocused(false);
      }
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

  const filteredEmails = React.useMemo(() => {
    const q = emailImportQuery.trim().toLowerCase();
    if (!q) return MOCK_EMAILS;
    return MOCK_EMAILS.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        e.from.toLowerCase().includes(q) ||
        e.preview.toLowerCase().includes(q)
    );
  }, [emailImportQuery]);

  const filteredTexts = React.useMemo(() => {
    const q = textImportQuery.trim().toLowerCase();
    if (!q) return MOCK_TEXTS;
    return MOCK_TEXTS.filter(
      (t) =>
        t.from.toLowerCase().includes(q) || t.preview.toLowerCase().includes(q)
    );
  }, [textImportQuery]);

  const filteredContacts = React.useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return MOCK_CONTACTS;
    return MOCK_CONTACTS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [contactSearch]);

  const filteredAccounts = React.useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return MOCK_ACCOUNTS;
    return MOCK_ACCOUNTS.filter((a) => a.name.toLowerCase().includes(q));
  }, [accountSearch]);

  const handleSendForProcessing = () => {
    setProcessingStep('sent');
    setTimeout(() => setProcessingStep('extracting'), 800);
    setTimeout(() => setProcessingStep('ready'), 2500);
  };

  const handleApplyStartDate = () => {
    setStartDate(
      new Date().toISOString().slice(0, 10)
    );
    setStartDateConfidence(100);
  };
  const handleApplyDueDate = () => {
    setDueDate(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    );
    setDueDateConfidence(100);
  };

  const handleRegenerate = (tone: DraftTone) => {
    setRegeneratingTone(tone);
    setTimeout(() => {
      setDrafts((prev) => ({
        ...prev,
        [tone]: { ...prev[tone], text: prev[tone].text + ' (regenerated)' },
      }));
      setRegeneratingTone(null);
    }, 1200);
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Meeting Notes / Email Thread / Handwritten Notes
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 transition-colors">
              {processingStep === 'sent' || processingStep === 'extracting'
                ? 'Saving…'
                : 'Last saved 12:42 PM'}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Paste or type your notes here..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="min-h-[200px] resize-y"
              maxLength={CHAR_LIMIT}
              disabled={processingStep !== 'idle'}
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
            <div className="flex gap-2">
              <Button
                onClick={handleSendForProcessing}
                disabled={processingStep !== 'idle' && processingStep !== 'ready'}
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
          </CardContent>
        </Card>

        {/* 2. Import from Communication */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import from Communication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div ref={emailImportRef} className="relative">
              <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                Email Inbox
              </Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={emailImportQuery}
                    onChange={(e) => setEmailImportQuery(e.target.value)}
                    onFocus={() => setEmailImportFocused(true)}
                    placeholder="Search emails..."
                    className="pl-8"
                  />
                  {(emailImportFocused || emailImportQuery) && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-border rounded-lg bg-card shadow-lg max-h-40 overflow-auto">
                      {filteredEmails.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No emails found
                        </div>
                      ) : (
                        filteredEmails.map((email, i) => (
                          <button
                            key={email.id}
                            type="button"
                            onClick={() => {
                              setEmailImportQuery(email.subject);
                              setEmailImportFocused(false);
                            }}
                            className={cn(
                              'w-full text-left px-3 py-2 hover:bg-muted transition-colors',
                              i < filteredEmails.length - 1 && 'border-b border-border'
                            )}
                          >
                            <p className="font-medium text-sm">{email.subject}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {email.from} • {email.date}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {emailImportQuery.trim() && (
                  <Button variant="secondary" size="sm" className="gap-1 shrink-0">
                    <Mail className="h-4 w-4" />
                    Generate Note from Email
                  </Button>
                )}
              </div>
            </div>
            <div ref={textImportRef} className="relative">
              <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Text Messages
              </Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={textImportQuery}
                    onChange={(e) => setTextImportQuery(e.target.value)}
                    onFocus={() => setTextImportFocused(true)}
                    placeholder="Search text messages..."
                    className="pl-8"
                  />
                  {(textImportFocused || textImportQuery) && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-border rounded-lg bg-card shadow-lg max-h-40 overflow-auto">
                      {filteredTexts.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No messages found
                        </div>
                      ) : (
                        filteredTexts.map((text, i) => (
                          <button
                            key={text.id}
                            type="button"
                            onClick={() => {
                              setTextImportQuery(text.from);
                              setTextImportFocused(false);
                            }}
                            className={cn(
                              'w-full text-left px-3 py-2 hover:bg-muted transition-colors',
                              i < filteredTexts.length - 1 && 'border-b border-border'
                            )}
                          >
                            <p className="text-sm text-muted-foreground">
                              {text.from} • {text.date}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {text.preview}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {textImportQuery.trim() && (
                  <Button variant="secondary" size="sm" className="gap-1 shrink-0">
                    <FileText className="h-4 w-4" />
                    Generate Note from Text
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Contact & Account */}
        <Card>
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
                {(contactFocused || contactSearch) && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-border rounded-lg bg-card shadow-lg max-h-40 overflow-auto">
                    {filteredContacts.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No contacts found
                      </div>
                    ) : (
                      filteredContacts.map((contact, i) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => {
                            setContactSearch(contact.name);
                            setSelectedContactId(contact.id);
                            setContactFocused(false);
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2 hover:bg-muted transition-colors',
                            i < filteredContacts.length - 1 && 'border-b border-border'
                          )}
                        >
                          <p className="font-medium text-sm">{contact.name}</p>
                          <p className="text-xs text-muted-foreground">{contact.email}</p>
                        </button>
                      ))
                    )}
                  </div>
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
                {(accountFocused || accountSearch) && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-border rounded-lg bg-card shadow-lg max-h-40 overflow-auto">
                    {filteredAccounts.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No accounts found
                      </div>
                    ) : (
                      filteredAccounts.map((account, i) => (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => {
                            setAccountSearch(account.name);
                            setSelectedAccountId(account.id);
                            setAccountFocused(false);
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2 hover:bg-muted transition-colors',
                            i < filteredAccounts.length - 1 && 'border-b border-border'
                          )}
                        >
                          <p className="font-medium text-sm">{account.name}</p>
                        </button>
                      ))
                    )}
                  </div>
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

        {/* Activity Type & Outcome */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm text-muted-foreground">
                Activity Type
              </Label>
              <Select
                value={activityType}
                onValueChange={setActivityType}
              >
                <SelectTrigger className="mt-1 h-9 rounded-md border border-border bg-background text-sm font-normal text-foreground">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">
                Activity Outcome
              </Label>
              <Select
                value={activityOutcome}
                onValueChange={setActivityOutcome}
              >
                <SelectTrigger className="mt-1 h-9 rounded-md border border-border bg-background text-sm font-normal text-foreground">
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_OUTCOMES.map((outcome) => (
                    <SelectItem key={outcome} value={outcome}>
                      {outcome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 4. Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full">
              Mark Complete
            </Button>
            <div>
              <Label className="text-sm text-muted-foreground">Reminder</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {['Next Week', 'After 2 Weeks', 'After 4 Weeks'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="px-3 py-1.5 rounded-full border border-border bg-background text-sm hover:bg-accent transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => setSubmitConfirmOpen(true)}
            >
              Submit Activity
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Right column - fixed content width (48rem = max-w-3xl), fills rest of screen */}
      <div className="w-[48rem] shrink-0 flex flex-col overflow-y-auto p-4 min-w-0">
        <div className="w-full max-w-3xl flex flex-col gap-6">
        {/* 1. Summary of Communication History - first section */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Summary of Communication History
            </CardTitle>
            {processingStep !== 'extracting' && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm">Use Draft</Button>
                <Button variant="ghost" size="sm">Edit</Button>
                <Button variant="ghost" size="sm" className="text-status-at-risk">Discard</Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {processingStep === 'extracting' ? (
              <div className="space-y-2">
                <Skeleton variant="text" className="h-3 w-full" />
                <Skeleton variant="text" className="h-3 w-full" />
                <Skeleton variant="text" className="h-3 w-4/5" />
                <Skeleton variant="text" className="h-3 w-3/4" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {summaryDraft}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 2. Error Banner - only when low confidence fields */}
        {showErrorBanner && (
          <Card className="border-status-at-risk/50 bg-status-at-risk/10">
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

        {/* 3. Recognized Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recognized Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {processingStep === 'extracting' ? (
              <div className="space-y-4">
                <div>
                  <Skeleton variant="text" className="h-4 w-20 mb-2" />
                  <Skeleton variant="rectangle" className="h-9 w-full max-w-[180px]" />
                </div>
                <div>
                  <Skeleton variant="text" className="h-4 w-20 mb-2" />
                  <Skeleton variant="rectangle" className="h-9 w-full max-w-[180px]" />
                </div>
              </div>
            ) : (
            <>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[180px]">
                <DateFieldWithCalendar
                  label="Start Date"
                  date={startDate}
                  onDateChange={(d) =>
                    setStartDate(d ? format(d, 'yyyy-MM-dd') : '')
                  }
                  confidence={startDateConfidence}
                  warning={startDateConfidence < LOW_CONFIDENCE_THRESHOLD}
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleApplyStartDate}>
                Apply
              </Button>
              <Button variant="ghost" size="sm">Override</Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[180px]">
                <DateFieldWithCalendar
                  label="Due Date"
                  date={dueDate}
                  onDateChange={(d) =>
                    setDueDate(d ? format(d, 'yyyy-MM-dd') : '')
                  }
                  confidence={dueDateConfidence}
                  warning={dueDateConfidence < LOW_CONFIDENCE_THRESHOLD}
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleApplyDueDate}>
                Apply
              </Button>
              <Button variant="ghost" size="sm">Override</Button>
            </div>
            </>
            )}
          </CardContent>
        </Card>

        {/* 4. Recommended Touch Dates */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Recommended Touch Dates
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Based on relationship health and prior patterns, we suggest:
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {processingStep === 'extracting' ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-md border border-border p-3 flex flex-col gap-2">
                    <Skeleton variant="text" className="h-4 w-32" />
                    <Skeleton variant="text" className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {MOCK_RECOMMENDED_DATES.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex flex-wrap justify-between items-start gap-2 rounded-md border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{rec.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{rec.rationale}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="default" size="sm" className="gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Apply
                      </Button>
                      <Button variant="outline" size="sm">
                        Override
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* 6. AI-Generated Drafts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI-Generated Drafts</CardTitle>
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
                {(['original', 'formal', 'concise', 'warm'] as const).map((tone) => {
                  const draft = drafts[tone];
                  const isSelected = selectedDraftTone === tone;
                  const isRegeneratingThis = regeneratingTone === tone;
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
                          onClick={() => setSelectedDraftTone(tone)}
                        >
                          Select
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1"
                          onClick={() => openPreview(tone)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1"
                          onClick={() => handleRegenerate(tone)}
                          disabled={isRegeneratingThis}
                        >
                          <RotateCw
                            className={cn('h-4 w-4', isRegeneratingThis && 'animate-spin')}
                          />
                          Regenerate
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>

        {/* Relationship & Opportunity */}
        <Card>
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

        {/* 5. Extracted Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extracted Metadata</CardTitle>
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
                  <Skeleton variant="text" className="h-4 w-28 mb-2" />
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
                Subject
                <ConfidenceBadge value={MOCK_EXTRACTED.subjectConfidence} />
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                Next Steps
                <ConfidenceBadge value={MOCK_EXTRACTED.nextStepsConfidence} />
              </Label>
              <Textarea
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                Questions Raised
                <ConfidenceBadge
                  value={MOCK_EXTRACTED.questionsRaisedConfidence}
                />
              </Label>
              <Textarea
                value={questionsRaised}
                onChange={(e) => setQuestionsRaised(e.target.value)}
                className={cn(
                  'mt-1',
                  MOCK_EXTRACTED.questionsRaisedConfidence <
                    LOW_CONFIDENCE_THRESHOLD && 'border-status-cooling'
                )}
                rows={2}
              />
            </div>
            <div>
              <Label>Urgency Level</Label>
              <div className="flex gap-2 mt-1">
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
        </div>
      </div>

      {/* Submit confirmation modal */}
      <Dialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Submission</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Review the actions that will be performed
          </p>
          <div className="space-y-3">
            <ConfirmCheckbox
              label="Update Activity in CRM"
              checked={confirmUpdateActivity}
              onCheckedChange={setConfirmUpdateActivity}
            />
            <ConfirmCheckbox
              label="Clone prior notes"
              checked={confirmClonePriorNotes}
              onCheckedChange={setConfirmClonePriorNotes}
            />
            <ConfirmCheckbox
              label="Mark previous Activity as Complete"
              checked={confirmMarkComplete}
              onCheckedChange={setConfirmMarkComplete}
            />
            <ConfirmCheckbox
              label="Create Opportunity (75%)"
              checked={confirmCreateOpportunity}
              onCheckedChange={setConfirmCreateOpportunity}
            />
            <ConfirmCheckbox
              label="Link Contact: Sarah Johnson"
              checked={confirmLinkContact}
              onCheckedChange={setConfirmLinkContact}
            />
            <ConfirmCheckbox
              label="Link Account: TechCorp Industries"
              checked={confirmLinkAccount}
              onCheckedChange={setConfirmLinkAccount}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitConfirmOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await new Promise((r) => setTimeout(r, 800));
                  setSubmitConfirmOpen(false);
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm & Submit
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