'use client';

import ProtectedRoute from '@/components/ProtectedRoute';

export default function ActivitiesPage() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Activities</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage activities</p>
        </header>
        <div className="rounded-xl bg-section border border-border p-6">
          <p className="text-sm text-muted-foreground">Activities list coming soon.</p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
