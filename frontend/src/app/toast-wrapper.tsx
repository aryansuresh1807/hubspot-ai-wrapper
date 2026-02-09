'use client';

import { ToastProvider, ToastViewport } from '@/components/ui/toast';

export function ToastWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ToastViewport />
      {children}
    </ToastProvider>
  );
}
