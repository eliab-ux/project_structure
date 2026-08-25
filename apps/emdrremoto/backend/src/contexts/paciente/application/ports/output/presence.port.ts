export const PACIENTE_PRESENCE = Symbol('PACIENTE_PRESENCE');

/** Leitura de presença: quais pacientes estão online (conectados a uma sala de sessão). */
export interface PresencePort {
  isOnline(pacienteId: string): boolean;
  onlineIds(): string[];
}
