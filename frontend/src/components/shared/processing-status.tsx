import * as React from 'react';
import { Loader2, Clock, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProcessingStatusType =
  | 'processing'
  | 'awaiting_review'
  | 'ready'
  | 'error';

const statusConfig: Record<
  ProcessingStatusType,
  { label: string; icon: React.ComponentType<{ className?: string }>; styles: string }
> = {
  processing: {
    label: 'Processing',
    icon: Loader2,
    styles:
      'text-status-active bg-status-active/10 border-status-active/20',
  },
  awaiting_review: {
    label: 'Awaiting review',
    icon: Clock,
    styles:
      'text-status-cooling bg-status-cooling/10 border-status-cooling/20',
  },
  ready: {
    label: 'Ready',
    icon: Check,
    styles: 'text-status-warm bg-status-warm/10 border-status-warm/20',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    styles:
      'text-status-at-risk bg-status-at-risk/10 border-status-at-risk/20',
  },
};

export interface ProcessingStatusProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  status: ProcessingStatusType;
  showIcon?: boolean;
}

const ProcessingStatus = React.forwardRef<HTMLSpanElement, ProcessingStatusProps>(
  (
    { status, showIcon = true, className, ...props },
    ref
  ) => {
    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span
        ref={ref}
        role="status"
        aria-label={config.label}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
          config.styles,
          className
        )}
        {...props}
      >
        {showIcon && (
          <Icon
            className={cn(
              'h-3 w-3 shrink-0',
              status === 'processing' && 'animate-spin'
            )}
            aria-hidden
          />
        )}
        <span>{config.label}</span>
      </span>
    );
  }
);
ProcessingStatus.displayName = 'ProcessingStatus';

export { ProcessingStatus };
