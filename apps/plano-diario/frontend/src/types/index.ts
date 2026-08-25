export interface User {
  id: string;
  email: string;
  name: string;
  /** WhatsApp de contato, já formatado. `null` em conta criada antes do campo existir. */
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type ConnectionStatus =
  | 'pending_qr'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | null;

export interface WhatsappInstance {
  status: ConnectionStatus;
  connectedNumber: string | null;
  lastStatusAt: string | null;
  connectedSince: string | null;
}

export interface QrCode {
  status: string;
  qrCodeBase64?: string;
  pairingCode?: string;
  expiresInSeconds: number;
}

export interface WhatsappGroup {
  jid: string;
  name: string;
  participantsCount: number | null;
}

export interface GroupList {
  groups: WhatsappGroup[];
  lastSyncedAt: string | null;
  stale: boolean;
}

export interface Schedule {
  configured: boolean;
  groupJid: string | null;
  groupName: string | null;
  sendTime: string | null;
  timezone: string | null;
  planStartDate: string | null;
  dayOffset: number | null;
  messageTemplate: string | null;
  isActive: boolean;
}

export interface CatalogDay {
  /** Posição no plano — é a chave que o sistema usa para escolher o vídeo do dia. */
  dayNumber: number;
  /** Número escrito no título do vídeo no YouTube (não coincide com a posição). */
  titleDayNumber: number;
  scheduledDate: string;
  formattedDate: string;
  title: string;
  videoId: string;
  url: string;
}

export interface CatalogList {
  planStartDate: string;
  dayOffset: number;
  total: number;
  firstDay: number | null;
  lastDay: number | null;
  lastSyncedAt: string | null;
  entries: CatalogDay[];
}

export interface TodayVideo {
  dayNumber: number;
  title: string;
  videoId: string;
  url: string;
  formattedDate: string;
  referenceDate: string;
  messagePreview: string;
}

export type DispatchStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface DispatchLog {
  id: string;
  referenceDate: string;
  dayNumber: number | null;
  url: string | null;
  messageSent: string | null;
  status: DispatchStatus;
  errorReason: string | null;
  attempts: number;
  sentAt: string | null;
  trigger: 'scheduled' | 'manual';
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
