'use client';

import ProtectedRoute from '@/components/ProtectedRoute';

export default function AccountsPage() {
  return (
    <ProtectedRoute>
      <div>
        <h1>Accounts</h1>
      </div>
    </ProtectedRoute>
  );
}
