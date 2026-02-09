'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  AlertTriangle,
  RotateCw,
  Mail,
  FileText,
  UserPlus,
  Building2,
} from 'lucide-react';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProcessingStep = 'idle' | 'sent' | 'extracting' | 'ready';
type UrgencyLevel = 'low' | 'medium' | 'high';
type DraftTone = 'formal' | 'concise' | 'warm';

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

const MOCK_DRAFTS: Record<DraftTone, string> = {
  formal:
    'Dear [Contact], Thank you for your time on our recent call. Please find attached the proposal we discussed. I would welcome the opportunity to address any questions at your convenience. Best regards.',
  concise:
    'Hi — Attaching the proposal from our call. Let me know if you have questions or want to schedule a follow-up.',
  warm:
    'Hi [Contact], It was great connecting! As promised, here’s the proposal we talked about. Happy to jump on a quick call if anything needs clarification. Thanks!',
};

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
    [options, value]
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
// Confidence badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ value }: { value: number }) {
  const isLow = value < LOW_CONFIDENCE_THRESHOLD;
  return (
    <span
      className={cn(
        'text-xs font-medium px-1.5 py-0.5 rounded',
        isLow ? 'bg-status-cooling/20 text-status-cooling' : 'bg-status-warm/20 text-status-warm'
      )}
    >
      {value}%
    </span>
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
  const [selectedContactId, setSelectedContactId] = React.useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);
  const [emailImportQuery, setEmailImportQuery] = React.useState('');
  const [textImportQuery, setTextImportQuery] = React.useState('');
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
  const [selectedDraftTone, setSelectedDraftTone] = React.useState<DraftTone>('formal');
  const [summaryDraft, setSummaryDraft] = React.useState(MOCK_AI_SUMMARY);
  const [submitConfirmOpen, setSubmitConfirmOpen] = React.useState(false);
  const [previewEditOpen, setPreviewEditOpen] = React.useState(false);
  const [previewContent, setPreviewContent] = React.useState(MOCK_DRAFTS.formal);
  const [isRegenerating, setIsRegenerating] = React.useState(false);

  const lowConfidenceFields = React.useMemo(() => {
    const list: string[] = [];
    if (MOCK_EXTRACTED.questionsRaisedConfidence < LOW_CONFIDENCE_THRESHOLD)
      list.push('Questions Raised');
    if (dueDateConfidence < LOW_CONFIDENCE_THRESHOLD) list.push('Due Date');
    return list;
  }, [dueDateConfidence]);

  const showErrorBanner = lowConfidenceFields.length > 0 && processingStep === 'ready';

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

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setPreviewContent(MOCK_DRAFTS[selectedDraftTone]);
      setIsRegenerating(false);
    }, 1200);
  };

  const openPreview = () => {
    setPreviewContent(MOCK_DRAFTS[selectedDraftTone]);
    setPreviewEditOpen(true);
  };

  const charCount = noteContent.length;
  const CHAR_LIMIT = 10000;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-8">
      {/* LEFT COLUMN - 40% */}
      <div className="flex flex-col gap-6 lg:w-[40%]">
        {/* 1. Note Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Meeting Notes / Email Thread / Handwritten Notes
            </CardTitle>
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
            <div className="flex gap-2">
              <Button
                onClick={handleSendForProcessing}
                disabled={processingStep !== 'idle' && processingStep !== 'ready'}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Send for Processing
              </Button>
              <Button variant="secondary">Save Draft</Button>
            </div>
            {processingStep !== 'idle' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span
                  className={cn(
                    processingStep === 'sent' && 'text-status-active',
                    processingStep === 'extracting' && 'text-status-active animate-pulse',
                    processingStep === 'ready' && 'text-status-warm'
                  )}
                >
                  {processingStep === 'sent' && 'Sent'}
                  {processingStep === 'extracting' && 'Extracting…'}
                  {processingStep === 'ready' && 'Ready'}
                </span>
                <span className="text-muted-foreground/70">
                  {processingStep === 'sent' && '→'}
                  {processingStep === 'extracting' && '→'}
                  {processingStep === 'ready' && '✓'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Import from Communication */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import from Communication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Import from Email</Label>
              <div className="flex gap-2 mt-1">
                <AutocompleteInput
                  value={emailImportQuery}
                  onChange={setEmailImportQuery}
                  placeholder="Search emails..."
                  options={[]}
                  getOptionLabel={() => ''}
                  onSelect={() => {}}
                  className="flex-1"
                />
                <Button variant="secondary" size="sm" className="gap-1 shrink-0">
                  <Mail className="h-4 w-4" />
                  Generate Note from Email
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Import from Text</Label>
              <div className="flex gap-2 mt-1">
                <AutocompleteInput
                  value={textImportQuery}
                  onChange={setTextImportQuery}
                  placeholder="Search or paste text..."
                  options={[]}
                  getOptionLabel={() => ''}
                  onSelect={() => {}}
                  className="flex-1"
                />
                <Button variant="secondary" size="sm" className="gap-1 shrink-0">
                  <FileText className="h-4 w-4" />
                  Generate Note from Text
                </Button>
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
            <div>
              <Label>Contact</Label>
              <AutocompleteInput
                value={contactSearch}
                onChange={setContactSearch}
                placeholder="Search contacts..."
                options={MOCK_CONTACTS}
                getOptionLabel={(o) => (o as { name: string }).name}
                onSelect={(o) => setSelectedContactId(o.id)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Account</Label>
              <AutocompleteInput
                value={accountSearch}
                onChange={setAccountSearch}
                placeholder="Search accounts..."
                options={MOCK_ACCOUNTS}
                getOptionLabel={(o) => (o as { name: string }).name}
                onSelect={(o) => setSelectedAccountId(o.id)}
                className="mt-1"
              />
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

      {/* RIGHT COLUMN - 60%, scrollable */}
      <div className="flex flex-col gap-6 overflow-y-auto lg:max-h-[calc(100vh-8rem)]">
        {/* 1. Error Banner */}
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

        {/* 2. Communication History Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Communication History Summary</CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm">Use Draft</Button>
              <Button variant="ghost" size="sm">Edit</Button>
              <Button variant="ghost" size="sm" className="text-status-at-risk">Discard</Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {summaryDraft}
            </p>
          </CardContent>
        </Card>

        {/* 3. Recognized Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recognized Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <Label>Start Date</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={cn(
                      startDateConfidence < LOW_CONFIDENCE_THRESHOLD &&
                        'border-status-cooling'
                    )}
                  />
                  <ConfidenceBadge value={startDateConfidence} />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleApplyStartDate}>
                Apply
              </Button>
              <Button variant="ghost" size="sm">Override</Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <Label>Due Date</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={cn(
                      dueDateConfidence < LOW_CONFIDENCE_THRESHOLD &&
                        'border-status-cooling'
                    )}
                  />
                  <ConfidenceBadge value={dueDateConfidence} />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleApplyDueDate}>
                Apply
              </Button>
              <Button variant="ghost" size="sm">Override</Button>
            </div>
          </CardContent>
        </Card>

        {/* 4. Recommended Touch Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended Touch Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_RECOMMENDED_DATES.map((rec) => (
              <div
                key={rec.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <div>
                  <p className="font-medium text-sm">{rec.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{rec.rationale}</p>
                </div>
                <Button variant="outline" size="sm">
                  Apply
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 5. Extracted Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extracted Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Input
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                Questions Raised
                <ConfidenceBadge
                  value={MOCK_EXTRACTED.questionsRaisedConfidence}
                />
              </Label>
              <Input
                value={questionsRaised}
                onChange={(e) => setQuestionsRaised(e.target.value)}
                className={cn(
                  'mt-1',
                  MOCK_EXTRACTED.questionsRaisedConfidence <
                    LOW_CONFIDENCE_THRESHOLD && 'border-status-cooling'
                )}
              />
            </div>
            <div>
              <Label>Urgency Level</Label>
              <Select
                value={urgency}
                onValueChange={(v) => setUrgency(v as UrgencyLevel)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 6. AI-Generated Drafts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI-Generated Drafts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2" role="radiogroup" aria-label="Draft tone">
              {(['formal', 'concise', 'warm'] as const).map((tone) => (
                <label
                  key={tone}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                    selectedDraftTone === tone
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <input
                    type="radio"
                    name="draftTone"
                    value={tone}
                    checked={selectedDraftTone === tone}
                    onChange={() => setSelectedDraftTone(tone)}
                    className="mt-1"
                  />
                  <span className="capitalize font-medium">{tone}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={openPreview} className="gap-1">
                Preview & Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="gap-1"
              >
                <RotateCw
                  className={cn('h-4 w-4', isRegenerating && 'animate-spin')}
                />
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submit confirmation modal */}
      <Dialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit activity?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will save the activity and sync to your CRM. You can edit it later from the
            dashboard.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSubmitConfirmOpen(false);
                // TODO: submit
              }}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview & Edit modal */}
      <Dialog open={previewEditOpen} onOpenChange={setPreviewEditOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview & Edit Draft</DialogTitle>
          </DialogHeader>
          <Textarea
            value={previewContent}
            onChange={(e) => setPreviewContent(e.target.value)}
            className="min-h-[200px] flex-1 resize-y"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setPreviewEditOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
