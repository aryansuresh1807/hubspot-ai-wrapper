'use client';

import ProtectedRoute from '@/components/ProtectedRoute';

export default function ActivitiesPage() {
  return (
    <ProtectedRoute>
      <div>
        <h1>Activities</h1>
      </div>
    </ProtectedRoute>
  );
}
