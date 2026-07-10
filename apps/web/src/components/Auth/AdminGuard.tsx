'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@vinyla/core-api';

// UI gate only — real security lives in the /api/admin routes, which
// verify the Bearer token and app_metadata.role server-side.
export const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();
  const isAdmin = user?.app_metadata?.role === 'admin';

  useEffect(() => {
    if (!isLoading && user && !isAdmin) {
      router.replace('/collection');
    }
  }, [isLoading, user, isAdmin, router]);

  if (isLoading || !user || !isAdmin) return null;
  return <>{children}</>;
};
