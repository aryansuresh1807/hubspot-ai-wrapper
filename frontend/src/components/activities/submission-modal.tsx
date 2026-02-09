'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface SubmissionModalActivityData {
  id?: string;
  subject?: string;
  contactName?: string;
  [key: string]: unknown;
}

export interface SubmissionChecklistOptions {
  clonePriorNotes: boolean;
  updateActivityRecord: boolean;
  markAsComplete: boolean;
  createOpportunity: boolean;
}

const DEFAULT_CHECKLIST: SubmissionChecklistOptions = {
  clonePriorNotes: true,
  updateActivityRecord: true,
  markAsComplete: false,
  createOpportunity: false,
};

const CHECKLIST_ITEMS: {
  key: keyof SubmissionChecklistOptions;
  label: string;
  helperText: string;
}[] = [
  {
    key: 'clonePriorNotes',
    label: 'Clone prior notes',
    helperText: 'Copy notes from the last activity with this contact into the new record.',
  },
  {
    key: 'updateActivityRecord',
    label: 'Update activity record',
    helperText: 'Save this activity to the CRM and link it to the selected contact and account.',
  },
  {
    key: 'markAsComplete',
    label: 'Mark as complete',
    helperText: 'Mark the current activity as completed in your pipeline.',
  },
  {
    key: 'createOpportunity',
    label: 'Create opportunity',
    helperText: 'Create a new opportunity linked to this activity and contact.',
  },
];

export interface SubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: SubmissionChecklistOptions) => void;
  activity?: SubmissionModalActivityData | null;
  className?: string;
}

export function SubmissionModal({
  isOpen,
  onClose,
  onConfirm,
  activity,
  className,
}: SubmissionModalProps): React.ReactElement {
  const [options, setOptions] = React.useState<SubmissionChecklistOptions>(DEFAULT_CHECKLIST);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose]
  );

  const handleToggle = React.useCallback((key: keyof SubmissionChecklistOptions, checked: boolean) => {
    setOptions((prev) => ({ ...prev, [key]: checked }));
  }, []);

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onConfirm(options);
      onClose();
    },
    [onConfirm, onClose, options]
  );

  const handleCancel = React.useCallback(() => {
    onClose();
  }, [onClose]);

  React.useEffect(() => {
    if (isOpen) setOptions(DEFAULT_CHECKLIST);
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={cn('max-w-md', className)} showClose>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Confirm Activity Submission</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {activity?.subject && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Activity:</span>{' '}
                {activity.subject}
              </p>
            )}
            <div className="space-y-4" role="group" aria-label="Submission options">
              {CHECKLIST_ITEMS.map(({ key, label, helperText }) => (
                <div
                  key={key}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor={`submission-${key}`}
                      className="text-sm font-medium cursor-pointer flex-1"
                    >
                      {label}
                    </Label>
                    <Switch
                      id={`submission-${key}`}
                      checked={options[key]}
                      onCheckedChange={(checked) =>
                        handleToggle(key, checked === true)
                      }
                      aria-describedby={`submission-${key}-hint`}
                    />
                  </div>
                  <p
                    id={`submission-${key}-hint`}
                    className="text-xs text-muted-foreground"
                  >
                    {helperText}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">Confirm</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
