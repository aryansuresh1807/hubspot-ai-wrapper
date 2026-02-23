'use client';

import ProtectedRoute from '@/components/ProtectedRoute';

export default function AccountsPage() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your accounts</p>
        </header>
        <div className="rounded-xl bg-section border border-border p-6">
          <p className="text-sm text-muted-foreground">Account management coming soon.</p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
