'use client';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import { VoiceState } from 'src/hooks/useVoiceDictation';

/**
 * ⚠️ PARADO E DESLIGADO — não use. O botão vivo é `DictationButton`.
 *
 * Pertence ao caminho de gravação + transcrição no Gemini. Ver
 * `Requisitos/ADR-0005_Captura_de_Voz.md`.
 */

/**
 * O botão de ditado, ao lado do enviar.
 *
 * **Ele não existe quando o ditado está desligado** (flag do servidor) ou quando o navegador não
 * grava. Não é botão cinza: é ausência. Controle inerte é promessa de recurso que não existe.
 *
 * Os quatro estados são visíveis porque cada um pede uma coisa diferente do usuário:
 *
 * | Estado | O que ele vê | O que faz |
 * |---|---|---|
 * | `idle` | microfone contornado | aperta e fala |
 * | `recording` | quadrado de parar, com **anel de nível** reagindo à voz | fala; para quando terminar |
 * | `sending` | rodinha | espera o texto chegar no campo |
 * | `error` | seta de repetir | **retenta** — o áudio dele não foi descartado |
 *
 * O anel de nível não é enfeite: sem retorno visual, quem fala não sabe se está sendo captado, e a
 * dúvida vira repetição ou desistência.
 */
export function MicButton({
  state,
  level,
  onStart,
  onStop,
  onRetry,
}: {
  state: VoiceState;
  level: number;
  onStart: () => void;
  onStop: () => void;
  onRetry: () => void;
}) {
  if (state === 'disabled' || state === 'unsupported') {
    return null;
  }

  const gravando = state === 'recording';
  const enviando = state === 'sending';
  const falhou = state === 'error';

  const titulo = gravando
    ? 'Gravando — clique para parar'
    : enviando
      ? 'Transcrevendo…'
      : falhou
        ? 'Falhou ao transcrever. Seu áudio foi guardado — clique para tentar de novo'
        : 'Ditar (o texto vem para o campo; você confere antes de enviar)';

  return (
    <Tooltip title={titulo}>
      <Box component="span" sx={{ display: 'inline-flex', position: 'relative' }}>
        {/* Anel de nível: cresce com a voz. Só durante a gravação. */}
        {gravando ? (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              m: 'auto',
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: '2px solid',
              borderColor: 'error.main',
              transform: `scale(${1 + Math.min(level, 1) * 0.5})`,
              opacity: 0.35 + Math.min(level, 1) * 0.5,
              transition: 'transform .08s linear, opacity .08s linear',
              pointerEvents: 'none',
            }}
          />
        ) : null}

        <IconButton
          onClick={() => {
            if (gravando) onStop();
            else if (falhou) onRetry();
            else if (!enviando) void onStart();
          }}
          aria-label={titulo}
          aria-pressed={gravando}
          disabled={enviando}
          sx={{ color: gravando ? 'error.main' : falhou ? 'vx.warn' : 'text.secondary' }}
        >
          {enviando ? (
            <CircularProgress size={20} role="status" aria-label="Transcrevendo" />
          ) : gravando ? (
            <StopCircleIcon fontSize="small" />
          ) : falhou ? (
            <ReplayIcon fontSize="small" />
          ) : (
            <MicNoneOutlinedIcon fontSize="small" />
          )}
        </IconButton>
      </Box>
    </Tooltip>
  );
}
