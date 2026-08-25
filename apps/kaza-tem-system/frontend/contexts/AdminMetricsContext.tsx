'use client';

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AdminMetrics, getAdminMetrics } from '@/services/adminDashboardService';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface AdminMetricsContextValue {
  metrics: AdminMetrics | null;
  loading: boolean;
  error?: string;
  refresh(): Promise<void>;
}

const AdminMetricsContext = createContext<AdminMetricsContextValue | undefined>(undefined);

export function AdminMetricsProvider({ children }: { children: ReactNode }) {
  const { accessToken, loading: authLoading } = useAdminAuth();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const loadMetrics = useCallback(async () => {
    if (!accessToken) {
      setMetrics(null);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const data = await getAdminMetrics(accessToken);
      setMetrics(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar métricas');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    void loadMetrics();
  }, [accessToken, authLoading]);

  const value = useMemo(
    () => ({ metrics, loading, error, refresh: loadMetrics }),
    [metrics, loading, error, loadMetrics],
  );

  return <AdminMetricsContext.Provider value={value}>{children}</AdminMetricsContext.Provider>;
}

export function useAdminMetricsContext() {
  const context = useContext(AdminMetricsContext);
  if (!context) {
    throw new Error('useAdminMetricsContext must be used within AdminMetricsProvider');
  }
  return context;
}
