export interface Psicologo {
  id: string;
  email: string;
  nome: string;
  telefone: string;
  emailVerificado: boolean;
  createdAt: string;
}

export interface Paciente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  pais: string | null;
  hash: string;
  createdAt: string;
}

export interface Session {
  id: string;
  sessionCode: string;
  dailyCoName: string | null;
  psicologoId: string;
  pacienteId: string;
  pacienteIn: string | null;
  psicologoIn: string | null;
  sessionOut: string | null;
  active: boolean;
  createdAt: string;
}

export interface SessionInfo {
  sessionCode: string;
  dailyCoName: string | null;
  psicologoId: string;
  pacienteId: string;
  psicologoNome: string;
  pacienteNome: string;
  active: boolean;
}

export type Role = 'psicologo' | 'paciente';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  psicologo: Psicologo;
}

export interface PacienteAccessResult {
  accessToken: string;
  nome: string;
  sessionCode?: string;
}

export type MovementType = 'horizontal' | 'vertical' | 'diagonal1' | 'diagonal2' | 'sacadico';
export type AudioCategory = 'tone' | 'music';
export type MuteTarget = 'psicologo' | 'paciente' | 'ambos' | 'none';

/** Estado do estímulo bilateral (bola) — espelha o BallActionDto do backend. */
export interface BallAction {
  running?: boolean;
  visible?: boolean;
  movement?: MovementType;
  speed?: number;
  color?: string;
  size?: number;
  reset?: boolean;
  maxMovements?: number;
}

/** Estado do áudio — espelha o AudioActionDto do backend. */
export interface AudioAction {
  playing?: boolean;
  category?: AudioCategory;
  track?: string;
  volume?: number;
  muteTarget?: MuteTarget;
}

export interface ChatMessage {
  text: string;
  from: Role;
  at: string;
}
