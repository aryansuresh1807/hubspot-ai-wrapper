'use client';

import * as React from 'react';
import { ExternalLink, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { type RelationshipStatus } from '@/components/shared/status-chip';
import { cn } from '@/lib/utils';

export interface ActivityCardActivity {
  id: string;
  contactName: string;
  accountName: string;
  subject: string;
  noteExcerpt: string;
  lastTouchDate: string;
  relationshipStatus: RelationshipStatus;
  /** Optional; not displayed on card until implemented */
  opportunityPercentage?: number;
  /** Optional; not displayed on card until implemented */
  processingStatus?: string;
}

export interface ActivityCardProps {
  activity: ActivityCardActivity;
  isSelected?: boolean;
  onClick?: () => void;
  onOpen?: (activity: ActivityCardActivity) => void;
  onComplete?: (activity: ActivityCardActivity) => void;
  className?: string;
}

const ActivityCard = React.forwardRef<HTMLDivElement, ActivityCardProps>(
  (
    {
      activity,
      isSelected = false,
      onClick,
      onOpen,
      onComplete,
      className,
    },
    ref
  ) => {
    const handleCardClick = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-action-buttons]')) return;
      onClick?.();
    };

    const handleOpen = (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpen?.(activity);
    };

    const handleComplete = (e: React.MouseEvent) => {
      e.stopPropagation();
      onComplete?.(activity);
    };

    return (
      <Card
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={cn(
          'cursor-pointer transition-shadow duration-200',
          'hover:shadow-card-hover',
          isSelected ? 'border-2 border-status-active' : 'border-2 border-border',
          className
        )}
      >
        <CardContent className="p-4 flex flex-col gap-3">
          {/* Top: Contact name (bold) and account name (gray) */}
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground truncate">
              {activity.contactName}
            </span>
            <span className="text-sm text-muted-foreground truncate">
              {activity.accountName}
            </span>
          </div>

          {/* Title (task subject only) */}
          <p className="text-sm font-medium text-foreground line-clamp-2">
            {activity.subject || '—'}
          </p>

          {/* Action buttons row */}
          <div
            data-action-buttons
            className="flex items-center gap-1 pt-1 border-t border-border"
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs gap-1"
              onClick={handleOpen}
            >
              <ExternalLink className="h-3.5 w-3" />
              Open
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs gap-1"
              onClick={handleComplete}
            >
              <Check className="h-3.5 w-3" />
              Complete
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
);
ActivityCard.displayName = 'ActivityCard';

export { ActivityCard };
