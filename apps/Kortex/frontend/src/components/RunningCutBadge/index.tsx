'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import cutService from 'src/services/cutService';
import { RunningCut } from 'src/types/cut';
import { FONT_MONO } from 'src/theme/theme';

/**
 * O aviso de que existe matriz rodando — flutuante, em toda tela do Modelista.
 *
 * O cronômetro vive na tela da matriz, mas o Modelista sai dela o tempo todo: consulta a fila,
 * abre um pré-pedido, confere a agenda. Sem este lembrete, o corte fica aberto até alguém reparar
 * — e a duração registrada, que é o que o sistema vende, sai errada.
 *
 * Some sozinho na própria tela da matriz: lembrete do que já está na sua frente é ruído.
 */

function elapsed(startedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function RunningCutBadge() {
  const router = useRouter();
  const pathname = usePathname();
  const [running, setRunning] = useState<RunningCut | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      setRunning(await cutService.runningCut());
    } catch {
      // Lembrete é acessório: falha de rede não pode virar erro na cara de quem está cortando.
      setRunning(null);
    }
  }, []);

  // Reconsulta ao trocar de tela. Start e stop acontecem dentro do próprio app, então a navegação
  // já é o momento em que o estado pode ter mudado — não há por que consultar por tempo.
  useEffect(() => {
    void load();
  }, [load, pathname]);

  // O relógio anda localmente, a partir de `startedAt`. Um segundo de precisão basta e não custa
  // requisição nenhuma.
  useEffect(() => {
    if (!running) {
      return undefined;
    }
    const timer = setInterval(() => tick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const destino = running ? `/m/matriz/${running.reservationId}` : null;
  if (!running || !destino || pathname === destino) {
    return null;
  }

  return (
    <Box
      component="button"
      type="button"
      onClick={() => router.push(destino)}
      aria-label={`Matriz ${running.sequence} em andamento há ${elapsed(running.startedAt)}. Voltar ao cronômetro.`}
      sx={{
        position: 'fixed',
        // Acima da barra inferior do navegador no celular, que é onde esta tela vive.
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
        right: 16,
        zIndex: (theme) => theme.zIndex.snackbar,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        border: 0,
        cursor: 'pointer',
        px: 1.75,
        py: 1.25,
        borderRadius: 999,
        bgcolor: 'error.main',
        color: 'common.white',
        boxShadow: 4,
        // Alvo de toque confortável: quem clica aqui está de pé, na máquina, às vezes de luva.
        minHeight: 48,
        '&:active': { transform: 'translateY(1px)' },
      }}
    >
      <TimerOutlinedIcon fontSize="small" />
      <Box component="span" sx={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 600 }}>
        {elapsed(running.startedAt)}
      </Box>
      <Box
        component="span"
        sx={{ fontSize: 12, opacity: 0.85, display: { xs: 'none', sm: 'inline' } }}
      >
        Matriz {running.sequence}
      </Box>
    </Box>
  );
}
