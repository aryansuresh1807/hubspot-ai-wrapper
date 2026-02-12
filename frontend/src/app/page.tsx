'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';

function RedirectToDashboard() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return null;
}

export default function Home() {
  return (
    <ProtectedRoute>
      <RedirectToDashboard />
    </ProtectedRoute>
  );
}
