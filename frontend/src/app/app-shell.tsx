'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/shared/sidebar';
import { Topbar } from '@/components/shared/topbar';
import { useAuth } from '@/contexts/AuthContext';
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
  /** Optional override for Topbar user (defaults to useAuth().user) */
  user?: { name?: string | null; email?: string | null } | null;
  /** Optional override for Sign Out (defaults to useAuth().signOut) */
  onSignOut?: () => void;
  className?: string;
}

export function AppShell({
  children,
  user: userProp,
  onSignOut: onSignOutProp,
  className,
}: AppShellProps): React.ReactElement {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { user: authUser, signOut } = useAuth();

  const user = userProp ?? (authUser
    ? {
        name: authUser.user_metadata?.full_name ?? null,
        email: authUser.email ?? null,
      }
    : null);
  const onSignOut = onSignOutProp ?? signOut;

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

      {/* Main: full width on mobile, margin-left 72px on desktop */}
      <main className="h-screen md:ml-[72px] flex flex-col overflow-hidden">
        <Topbar
          user={user}
          onSignOut={onSignOut}
          onMenuClick={() => setMobileMenuOpen(true)}
        />
        <div className={cn(
          'flex-1 min-h-0 flex flex-col p-4 md:p-6',
          isViewportConstrainedRoute(pathname ?? '') ? 'overflow-hidden' : 'overflow-y-auto'
        )}>{children}</div>
      </main>
    </>
  );
}
