/**
 * Contrato de eventos do tempo real (nomes preservados do sistema legado).
 * Constantes compartilhadas — o frontend deve usar exatamente os mesmos nomes.
 * Sem string mágica solta (regra do Real-time Adapter no CLAUDE.md).
 */
export const REALTIME_EVENTS = {
  JOIN_SESSION: 'join-session',
  USER_JOINED: 'user-joined',
  PEER_PRESENT: 'peer-present',
  START_CRON: 'start-cron',
  END_CALL: 'end-call',
  DISCONNECT_USER: 'disconnect_user',
  BALL_HANDLER: 'ball-handler',
  AUDIO_HANDLER: 'audio-handler',
  NEW_MESSAGE: 'new-message',
  RTC_READY: 'rtc-ready',
  RTC_OFFER: 'webrtc-offer',
  RTC_ANSWER: 'webrtc-answer',
  RTC_ICE: 'webrtc-ice',
} as const;

/** Prefixo da room por sessão. Roteamento é por room — nunca por socket id persistido. */
export function sessionRoom(sessionCode: string): string {
  return `session:${sessionCode}`;
}
