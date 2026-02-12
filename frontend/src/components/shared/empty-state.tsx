'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EmptyStateAction = {
  label: string;
  onClick: () => void;
};

export interface EmptyStateProps {
  /** Lucide icon component (e.g. Inbox, Search, Filter) */
  icon: LucideIcon;
  /** Short heading */
  title: string;
  /** Optional supporting text */
  description?: string;
  /** Optional action button: EmptyStateAction or React node */
  action?: React.ReactNode | EmptyStateAction;
  className?: string;
}

function isEmptyStateAction(
  a: React.ReactNode | EmptyStateAction
): a is EmptyStateAction {
  return (
    typeof a === 'object' && a !== null && 'label' in a && 'onClick' in a
  );
}

/**
 * Generic empty state: center-aligned icon, title, description, and optional action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6 text-center',
        className
      )}
    >
      <div
        className="flex items-center justify-center w-14 h-14 rounded-full bg-muted text-muted-foreground mb-4"
        aria-hidden
      >
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action != null && (
        <div className="mt-4">
          {isEmptyStateAction(action) ? (
            <Button onClick={action.onClick} size="sm">
              {action.label}
            </Button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}
