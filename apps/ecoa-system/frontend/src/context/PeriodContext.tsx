'use client';

import { createContext, useContext, useMemo, useState } from 'react';

export type PeriodDays = 7 | 30 | 90;

interface PeriodContextValue {
  days: PeriodDays;
  setDays: (days: PeriodDays) => void;
  /** ISO date-time for the start of the selected window (used as the `from` filter). */
  from: string;
  /** ISO date-time for now (used as the `to` filter). */
  to: string;
}

const PeriodContext = createContext<PeriodContextValue | undefined>(undefined);

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [days, setDays] = useState<PeriodDays>(7);

  const value = useMemo<PeriodContextValue>(() => {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { days, setDays, from: start.toISOString(), to: now.toISOString() };
  }, [days]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) {
    throw new Error('usePeriod must be used within PeriodProvider');
  }
  return ctx;
}
