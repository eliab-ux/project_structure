import { MovementType } from 'src/types';

export interface SoundTrack {
  label: string;
  src: string;
}

/** Tons bilaterais (bipes curtos) — servidos de public/sounds/tons. */
export const TONES: SoundTrack[] = [
  { label: 'Som 1', src: '/sounds/tons/104242970.mp3' },
  { label: 'Som 2', src: '/sounds/tons/108001370.mp3' },
  { label: 'Som 3', src: '/sounds/tons/108001386.mp3' },
  { label: 'Som 4', src: '/sounds/tons/115054166.mp3' },
  { label: 'Som 5', src: '/sounds/tons/147775842.mp3' },
  { label: 'Som 6', src: '/sounds/tons/218248983.mp3' },
  { label: 'Som 7', src: '/sounds/tons/88495192.mp3' },
  { label: 'Som 8', src: '/sounds/tons/89096439.mp3' },
  { label: 'Som 9', src: '/sounds/tons/90586315.mp3' },
];

/** Músicas/sons ambiente de fundo — servidos de public/sounds/musicas. */
export const MUSICS: SoundTrack[] = [
  { label: 'Gotas', src: '/sounds/musicas/dripping-faucet-no-3-drop.mp3' },
  { label: 'Bica de Água', src: '/sounds/musicas/gently-rippling-stream-in-the.mp3' },
  { label: 'Ondas', src: '/sounds/musicas/ocean-waves-light-surf-on.mp3' },
  { label: 'Chuveiro', src: '/sounds/musicas/shower-in-filled-bathtub.mp3' },
  { label: 'Córrego', src: '/sounds/musicas/sparkling-stream-in-the-quiet.mp3' },
  { label: 'Pardal', src: '/sounds/musicas/sparrow-chirps-3-times-in-a.mp3' },
  { label: 'Pedra na Água', src: '/sounds/musicas/stone-throwing-in-water.mp3' },
  { label: 'Água Corrente', src: '/sounds/musicas/underwater-image-of-a-river.mp3' },
];

export const MOVEMENTS: { value: MovementType; label: string; symbol: string }[] = [
  { value: 'horizontal', label: 'Horizontal', symbol: '↔' },
  { value: 'vertical', label: 'Vertical', symbol: '↕' },
  { value: 'diagonal1', label: 'Diagonal ⤡', symbol: '⤡' },
  { value: 'diagonal2', label: 'Diagonal ⤢', symbol: '⤢' },
  { value: 'sacadico', label: 'Sacádico', symbol: '• •' },
];

/** Nº de movimentos (0 = infinito). */
export const MOVEMENT_COUNTS: { value: number; label: string }[] = [
  { value: 0, label: '∞' },
  { value: 8, label: '8' },
  { value: 16, label: '16' },
  { value: 30, label: '30' },
  { value: 44, label: '44' },
  { value: 62, label: '62' },
];
