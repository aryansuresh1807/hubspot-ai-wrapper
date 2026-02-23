'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/shared/sidebar';
import { cn } from '@/lib/utils';

const AUTH_PATH_PREFIXES = ['/login', '/sign-in', '/signin', '/signup', '/forgot-password', '/reset-password', '/auth'];

function isAuthRoute(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Pages that fill the viewport and scroll internally (no outer content-area scrollbar). */
function isViewportConstrainedRoute(pathname: string): boolean {
  return pathname === '/contacts' || pathname.startsWith('/contacts/') ||
    pathname === '/activity' || pathname.startsWith('/activity/');
}

export interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AppShell({
  children,
  className,
}: AppShellProps): React.ReactElement {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isAuth = isAuthRoute(pathname ?? '');

  if (isAuth) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Mobile overlay when sidebar is open */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar: hidden on mobile unless open (hamburger), always visible on md+ */}
      <Sidebar
        className={cn(
          'hidden md:flex',
          mobileMenuOpen && 'max-md:flex'
        )}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Mobile-only hamburger to open sidebar */}
      <button
        type="button"
        onClick={() => setMobileMenuOpen(true)}
        className="fixed left-4 top-4 z-20 flex h-10 w-10 md:hidden items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Main: full width on mobile, margin-left 72px on desktop */}
      <main className="h-screen md:ml-[72px] flex flex-col overflow-hidden">
        <div className={cn(
          'flex-1 min-h-0 flex flex-col p-4 md:p-6',
          isViewportConstrainedRoute(pathname ?? '') ? 'overflow-hidden' : 'overflow-y-auto'
        )}>{children}</div>
      </main>
    </>
  );
}