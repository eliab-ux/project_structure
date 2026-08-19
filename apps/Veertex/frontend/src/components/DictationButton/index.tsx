'use client';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import MicIcon from '@mui/icons-material/Mic';
import { OnDeviceState } from 'src/hooks/useOnDeviceDictation';

/**
 * O botão do ditado ON-DEVICE. Usado só na Mesa.
 *
 * **Ele não existe quando o reconhecimento local não existe** (`unsupported`) nem quando a consulta
 * de disponibilidade falhou (`error`). Não é botão cinza: é ausência — regra 2 do
 * `useOnDeviceDictation`. Um microfone que aceita o clique e não ouve é pior que microfone nenhum.
 *
 * Os dois estados escondem o botão, e é proposital que sejam estados SEPARADOS: `error` carrega o
 * motivo, e a Mesa o exibe. Sumiço sem explicação era o que impedia distinguir "o Chrome não tem"
 * de "a chamada quebrou".
 *
 * O estado `opening` é o que salva o começo da frase: o motor demora a abrir, e quem fala nesse
 * intervalo perde o verbo — "ativar", "criar", "cadastrar". Por isso ele é visível e diz para
 * esperar, em vez de mostrar um ícone parado que sugere "pode falar".
 *
 * (Existe um `MicButton` no projeto, do caminho de gravação + transcrição no Gemini. Ele está
 * **parado e desligado** — ver `Requisitos/ADR-0005_Captura_de_Voz.md`. Não use os dois.)
 */
export function DictationButton({
  state,
  onStart,
  onStop,
}: {
  state: OnDeviceState;
  onStart: () => void;
  onStop: () => void;
}) {
  if (state === 'unsupported' || state === 'error') {
    return null;
  }

  const ouvindo = state === 'listening';
  const abrindo = state === 'opening';

  const titulo = ouvindo
    ? 'Ouvindo — clique para parar'
    : abrindo
      ? 'Abrindo o microfone… ainda não fale'
      : 'Ditar (fica no seu computador; o texto vem para o campo e você confere antes de enviar)';

  return (
    <Tooltip title={titulo}>
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <IconButton
          // `pointerDown` e não `click`: começa a abrir o microfone antes de o clique completar, o
          // que devolve parte do tempo de abertura — e é esse tempo que come a primeira palavra.
          onPointerDown={(event) => {
            if (state === 'idle') {
              event.preventDefault();
              onStart();
            }
          }}
          onClick={() => {
            if (ouvindo) {
              onStop();
            }
          }}
          aria-label={titulo}
          aria-pressed={ouvindo}
          disabled={abrindo}
          sx={{
            color: ouvindo ? 'error.main' : 'text.secondary',
            ...(ouvindo
              ? {
                  animation: 'vxPulse 1.2s ease-in-out infinite',
                  '@keyframes vxPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.45 } },
                }
              : {}),
          }}
        >
          {abrindo ? (
            <CircularProgress size={20} role="status" aria-label="Abrindo" />
          ) : ouvindo ? (
            <MicIcon fontSize="small" />
          ) : (
            <MicNoneOutlinedIcon fontSize="small" />
          )}
        </IconButton>
      </Box>
    </Tooltip>
  );
}
