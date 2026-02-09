'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/shared/sidebar';
import { Topbar } from '@/components/shared/topbar';
import { cn } from '@/lib/utils';

const AUTH_PATH_PREFIXES = ['/login', '/sign-in', '/signin', '/auth'];

function isAuthRoute(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export interface AppShellProps {
  children: React.ReactNode;
  /** Optional user for Topbar (name, email) */
  user?: { name?: string | null; email?: string | null } | null;
  /** Called when user clicks Sign Out in Topbar */
  onSignOut?: () => void;
  className?: string;
}

export function AppShell({
  children,
  user,
  onSignOut,
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

      {/* Sidebar: hidden on mobile unless open, always visible on md+ */}
      <Sidebar
        className={cn(
          'hidden md:flex',
          mobileMenuOpen && 'flex md:hidden'
        )}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main: full width on mobile, margin-left 72px on desktop */}
      <main className="min-h-screen md:ml-[72px] flex flex-col">
        <Topbar
          user={user}
          onSignOut={onSignOut}
          onMenuClick={() => setMobileMenuOpen(true)}
        />
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </main>
    </>
  );
}
