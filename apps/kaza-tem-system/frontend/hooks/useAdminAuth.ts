'use client';

import { useAdminAuthContext } from '@/contexts/AdminAuthContext';

export function useAdminAuth() {
  return useAdminAuthContext();
}
