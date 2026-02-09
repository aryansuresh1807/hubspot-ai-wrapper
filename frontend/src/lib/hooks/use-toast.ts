'use client';

import { useCallback } from 'react';
import { useUIStore } from '@/lib/store/ui-store';

export interface ToastOptions {
  title: string;
  description?: string;
}

/** Returns toast helpers (success, error, info, warning) backed by the UI store. */
export function useToast(): {
  success: (options: ToastOptions) => void;
  error: (options: ToastOptions) => void;
  info: (options: ToastOptions) => void;
  warning: (options: ToastOptions) => void;
  show: (options: ToastOptions & { variant?: 'default' | 'success' | 'error' | 'warning' | 'info' }) => void;
} {
  const showToast = useUIStore((s) => s.showToast);

  const success = useCallback(
    (options: ToastOptions) => showToast({ ...options, variant: 'success' }),
    [showToast]
  );
  const error = useCallback(
    (options: ToastOptions) => showToast({ ...options, variant: 'error' }),
    [showToast]
  );
  const info = useCallback(
    (options: ToastOptions) => showToast({ ...options, variant: 'info' }),
    [showToast]
  );
  const warning = useCallback(
    (options: ToastOptions) => showToast({ ...options, variant: 'warning' }),
    [showToast]
  );
  const show = useCallback(
    (options: ToastOptions & { variant?: 'default' | 'success' | 'error' | 'warning' | 'info' }) =>
      showToast({
        title: options.title,
        description: options.description,
        variant: options.variant ?? 'default',
      }),
    [showToast]
  );

  return { success, error, info, warning, show };
}
