'use client';

import * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const sizeStyles = {
  sm: {
    track: 'h-1.5',
    label: 'text-xs',
  },
  md: {
    track: 'h-2',
    label: 'text-sm',
  },
} as const;

export interface OpportunityIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Value from 0 to 100 */
  percentage: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const OpportunityIndicator = React.forwardRef<
  HTMLDivElement,
  OpportunityIndicatorProps
>(
  (
    {
      percentage,
      showLabel = true,
      size = 'md',
      className,
      ...props
    },
    ref
  ) => {
    const value = Math.min(100, Math.max(0, Number(percentage)));
    const sizes = sizeStyles[size];

    const root = (
      <div
        ref={ref}
        className={cn(
          'flex w-full min-w-0 flex-col gap-1 cursor-default outline-none',
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'w-full overflow-hidden rounded-full bg-muted',
            sizes.track
          )}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Opportunity score: ${value}%`}
        >
          <div
            className={cn(
              'h-full rounded-full bg-gradient-to-r from-status-active via-status-cooling to-status-warm',
              'transition-[width] duration-300 ease-out'
            )}
            style={{ width: `${value}%` }}
          />
        </div>
        {showLabel && (
          <span
            className={cn('font-medium text-muted-foreground', sizes.label)}
          >
            {Math.round(value)}%
          </span>
        )}
      </div>
    );

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{root}</TooltipTrigger>
          <TooltipContent side="top">
            <span>{value.toFixed(1)}%</span> opportunity score
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);
OpportunityIndicator.displayName = 'OpportunityIndicator';

export { OpportunityIndicator };
