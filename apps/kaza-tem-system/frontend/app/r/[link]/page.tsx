'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';

const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api').replace(
  /\/api\/?$/,
  '',
);

type ResellerLandingPageProps = {
  params: { link: string };
};

export default function ResellerLandingPage({ params }: ResellerLandingPageProps) {
  const [status, setStatus] = useState('Registrando visita...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.link) {
      setError('Link inválido');
      return;
    }

    let mounted = true;
    let redirectTimer: number | null = null;

    const getCookieValue = (name: string): string | null => {
      if (typeof document === 'undefined') return null;
      const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
      return match ? decodeURIComponent(match[2]) : null;
    };

    const deleteCookie = (name: string) => {
      if (typeof document === 'undefined') return;
      document.cookie = `${name}=; Max-Age=0; path=/`;
    };

    const scheduleRedirect = () => {
      if (!mounted) return;
      setStatus('Redirecionando para o catálogo...');
      redirectTimer = window.setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/products';
        }
      }, 1500);
    };

    const syncVisitorId = (visitorId: string | null | undefined) => {
      if (typeof window === 'undefined' || !visitorId) return;
      localStorage.setItem('kazaTemVisitorId', visitorId);
    };

    if (getCookieValue('kazaTemVisitRecorded') === '1') {
      syncVisitorId(getCookieValue('kazaTemVisitorId'));
      deleteCookie('kazaTemVisitRecorded');
      scheduleRedirect();
      return () => {
        mounted = false;
        if (redirectTimer) {
          clearTimeout(redirectTimer);
        }
      };
    }

    async function recordVisit() {
      try {
        const storedVisitor = localStorage.getItem('kazaTemVisitorId');
        const response = await fetch(`${BACKEND_BASE}/tracking/visit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            link: params.link,
            visitorId: storedVisitor,
            pageUrl: window.location.href,
          }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.message ?? 'Não foi possível registrar a visita.');
        }

        const visitorId = payload?.visitorId ?? storedVisitor ?? null;

        if (visitorId) {
          syncVisitorId(visitorId);
          document.cookie = `kazaTemVisitorId=${visitorId};path=/;max-age=${60 * 60 * 24 * 30}`;
        }

        if (payload?.resellerId) {
          document.cookie = `kazaTemResellerId=${payload.resellerId};path=/;max-age=${60 * 60 * 24 * 30}`;
        }

        if (mounted) {
          scheduleRedirect();
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Erro inesperado ao registrar visita.');
        }
      }
    }

    recordVisit();

    return () => {
      mounted = false;
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, [params.link]);

  return (
    <Box
      sx={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
      }}
    >
      <Stack spacing={2} alignItems="center" textAlign="center" maxWidth={480}>
        <Typography variant="h4">Bem-vindo(a) ao universo Kaza Tem</Typography>
        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            <CircularProgress />
            <Typography>{status}</Typography>
          </>
        )}
        <Button component={Link} href="/products" variant="outlined" color="inherit">
          Ir ao catálogo manualmente
        </Button>
      </Stack>
    </Box>
  );
}
