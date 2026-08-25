'use client';

import { useResellerAuth as useResellerAuthContext } from '@/contexts/ResellerAuthContext';

export function useResellerAuth() {
  return useResellerAuthContext();
}
