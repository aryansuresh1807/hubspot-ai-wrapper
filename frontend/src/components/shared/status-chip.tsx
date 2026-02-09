import * as React from 'react';
import { cn } from '@/lib/utils';

export type RelationshipStatus =
  | 'Warm'
  | 'Active'
  | 'Cooling'
  | 'Dormant'
  | 'At-Risk';

const statusStyles: Record<
  RelationshipStatus,
  { bg: string; text: string }
> = {
  Warm: { bg: '#dcfce7', text: '#166534' },
  Active: { bg: '#dbeafe', text: '#1e40af' },
  Cooling: { bg: '#fed7aa', text: '#9a3412' },
  Dormant: { bg: '#e5e7eb', text: '#374151' },
  'At-Risk': { bg: '#fee2e2', text: '#991b1b' },
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-sm',
} as const;

export interface StatusChipProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: RelationshipStatus;
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

const StatusChip = React.forwardRef<HTMLSpanElement, StatusChipProps>(
  ({ status, size = 'md', className, style, children, ...props }, ref) => {
    const colors = statusStyles[status];
    return (
      <span
        ref={ref}
        role="status"
        className={cn(
          'inline-flex items-center font-medium rounded-full shadow-sm',
          sizeStyles[size],
          className
        )}
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
          ...style,
        }}
        {...props}
      >
        {children ?? status}
      </span>
    );
  }
);
StatusChip.displayName = 'StatusChip';

export { StatusChip };
