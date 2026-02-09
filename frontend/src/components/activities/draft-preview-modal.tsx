'use client';

import * as React from 'react';
import { Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface DraftPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (editedText: string) => void;
  draftText: string;
  tone: string;
  className?: string;
}

export function DraftPreviewModal({
  isOpen,
  onClose,
  onSave,
  draftText,
  tone,
  className,
}: DraftPreviewModalProps): React.ReactElement {
  const [editedText, setEditedText] = React.useState(draftText);
  const [copied, setCopied] = React.useState(false);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose]
  );

  const handleDiscard = React.useCallback(() => {
    setEditedText(draftText);
    onClose();
  }, [draftText, onClose]);

  const handleSave = React.useCallback(() => {
    onSave(editedText);
    onClose();
  }, [onSave, onClose, editedText]);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [editedText]);

  React.useEffect(() => {
    if (isOpen) setEditedText(draftText);
  }, [isOpen, draftText]);

  const charCount = editedText.length;
  const displayTone = tone ? tone.charAt(0).toUpperCase() + tone.slice(1) : 'Draft';

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={cn('max-w-2xl max-h-[85vh] flex flex-col', className)} showClose>
        <DialogHeader>
          <DialogTitle>Edit Draft ({displayTone})</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 flex-1 min-h-0 py-2">
          <Textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="min-h-[200px] flex-1 resize-y"
            placeholder="Enter or paste your draft..."
            aria-label="Draft content"
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">
              {charCount.toLocaleString()} characters
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Copied' : 'Copy to clipboard'}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={handleDiscard}>
            Discard Changes
          </Button>
          <Button type="button" onClick={handleSave}>
            Save & Use
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
