/**
 * Shapes the API actually returns.
 *
 * Hand-written rather than generated, and kept in ONE file per §8 of the frontend guidelines ("tipos
 * reutilizáveis em src/types"). They mirror the backend ResponseDtos — which is the contract, not the
 * domain entities. Where the backend deliberately withholds something (a full phone, a token hash, an
 * operator id on a list), the type withholds it too, so a component cannot render what it never received.
 */

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ---- auth -----------------------------------------------------------------------------------------

export type UserRole = 'ACCOUNT_ADMIN' | 'OPERATOR';

/**
 * Exactly the fields of the backend's `UserResponseDto` — no more.
 *
 * There is no `accountId` and no `accountName` here, and that is not an omission: the API returns the
 * account as a SIBLING object (`{ user, account }`), never folded into the user. Inventing the fields
 * on this type made components render `undefined` where they expected the tenant's name.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  /**
   * WhatsApp in E.164 — where a password-recovery code is sent. `null` only for accounts created
   * before the field existed; everyone created since has one.
   */
  phone: string | null;
  role: UserRole;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

/** The tenant the signed-in user belongs to. Comes alongside the user, never inside it. */
export interface AuthAccount {
  id: string;
  name: string;
  documentMasked: string;
  plan: string;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  dailySendCeiling: number;
  timezone: string;
  suspendedAt: string | null;
  suspensionReason: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
  account: AuthAccount;
}

/** `GET /auth/me` — the same pair, without tokens. */
export interface MeResponse {
  user: AuthUser;
  account: AuthAccount;
}

// ---- channels -------------------------------------------------------------------------------------

export type ChannelStatus =
  'PROVISIONING' | 'AWAITING_QR' | 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED' | 'BANNED' | 'RETIRED';

export interface Channel {
  id: string;
  label: string;
  phoneMasked: string;
  status: ChannelStatus;
  currentQuota: number;
  quotaFloor: number;
  quotaCeiling: number;
  consecutiveFailures: number;
  contactsAllocated?: number;
  warmupStartedAt: string | null;
  lastSendAt: string | null;
  createdAt: string;
}

export interface QrCode {
  status: ChannelStatus;
  /** Empty while provisioning, or once already connected. The UI polls until it fills or clears. */
  qrCodeBase64: string;
  pairingCode: string | null;
}

// ---- sender migration -----------------------------------------------------------------------------

export type MigrationStrategy = 'ALL_TO_ONE' | 'REDISTRIBUTE';

export interface MigrationPreview {
  fromChannelId: string;
  fromChannelLabel: string;
  fromChannelStatus: string;
  strategy: MigrationStrategy;
  toChannelId: string | null;
  contactsToMigrate: number;
  /** Load per channel before and after, so the operator sees where the contacts land. */
  loadsBefore: ChannelLoad[];
  loadsAfter: ChannelLoad[];
  /** Non-null → the screen explains why migration is unavailable instead of failing after a click. */
  blockedReason: string | null;
}

export interface SenderMigration {
  id: string;
  fromChannelId: string;
  strategy: MigrationStrategy;
  toChannelId: string | null;
  contactsAffected: number;
  status: string;
  requestedBy: string;
  approvedBy: string;
  executedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

// ---- contacts -------------------------------------------------------------------------------------

export interface Contact {
  id: string;
  phoneMasked: string;
  name: string | null;
  firstName: string | null;
  /** True when this contact will render the merge-field fallback instead of a name (§7.4). */
  willUseFirstNameFallback: boolean;
  tags: string[];
  currentChannelId: string;
  active: boolean;
  optedOutAt: string | null;
  createdAt: string;
}

export interface ChannelLoad {
  channelId: string;
  channelLabel: string;
  channelStatus: ChannelStatus;
  /** False for a terminal or degraded chip: the allocator skips it, and the screen says why. */
  acceptsNewContacts: boolean;
  contacts: number;
}

/**
 * As quatro bases do enum `ConsentBasis` da API. Um union de literais, não `string`: assim um valor
 * inventado é erro de compilação aqui, em vez de um 400 na cara do operador depois do upload.
 */
export type ConsentBasis =
  'EXPLICIT_OPT_IN' | 'EXISTING_RELATIONSHIP' | 'PUBLIC_SOURCE' | 'THIRD_PARTY';

export interface ContactImport {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  importedCount: number;
  duplicatedCount: number;
  invalidCount: number;
  missingFirstNameCount: number;
  consentBasis: string;
  originNote: string | null;
  createdAt: string;
  finishedAt: string | null;
}

// ---- content --------------------------------------------------------------------------------------

export type ContentClassification = 'INSTITUTIONAL' | 'ELECTORAL';
export type ContentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface ContentVariant {
  id: string;
  label: string;
  body: string;
  position: number;
  reviewedBy: string | null;
}

export interface MediaAsset {
  id: string;
  kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  variantId: string | null;
}

export interface Content {
  id: string;
  title: string;
  classification: ContentClassification;
  origin: 'MANUAL' | 'PDF';
  bodyBase: string;
  sourceUrl: string | null;
  /** Liga o link ao final da mensagem enviada. Ligado, o link entra no contentHash. */
  includeSourceUrl: boolean;
  status: ContentStatus;
  /** The version identifier. Editing changes it and invalidates approvals (§8.5). */
  contentHash: string;
  approvedAt: string | null;
  createdAt: string;
  variants: ContentVariant[];
  media: MediaAsset[];
}

export interface RenderedSample {
  contactName: string | null;
  label: string;
  renderedBody: string;
  usedFallback: boolean;
}

export interface ContentPreview {
  contentId: string;
  samples: RenderedSample[];
  fallbackCount: number;
  sampledContacts: number;
}

// ---- approval -------------------------------------------------------------------------------------

export interface ApprovalSettings {
  requiredForInstitutional: number;
  requiredForElectoral: number;
  notifyChannel: 'EMAIL' | 'WHATSAPP' | 'BOTH';
}

export interface Approver {
  id: string;
  name: string;
  email: string | null;
  phoneMasked: string | null;
  active: boolean;
  createdAt: string;
}

export interface ApprovalRequestSummary {
  id: string;
  approverId: string;
  approverName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'INVALIDATED';
  contentHash: string;
  expiresAt: string;
  decidedAt: string | null;
  comment: string | null;
}

export interface ApprovalProgress {
  contentId: string;
  contentStatus: ContentStatus;
  contentHash: string;
  requiredApprovals: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  requests: ApprovalRequestSummary[];
}

export interface SubmissionResult {
  contentId: string;
  contentHash: string;
  status: ContentStatus;
  requiredApprovals: number;
  requestsCreated: number;
  notifiedApprovers: string[];
  /** Non-empty when a magic link failed to go out. Shown, never swallowed. */
  notificationFailures: string[];
}

/** The public magic-link page (§8 item 4). No account data, by design. */
export interface ApprovalPage {
  approverName: string;
  contentTitle: string;
  classification: string;
  contentHash: string;
  bodyBase: string;
  /** Procedência do texto. Para conteúdo eleitoral, conferir a fonte faz parte de julgá-lo. */
  sourceUrl: string | null;
  /** True quando esse link também vai NA mensagem — aprovar passa a ser aprovar um destino. */
  includeSourceUrl: boolean;
  variants: { label: string; body: string }[];
  /**
   * `downloadUrl` é servida por ESTE backend (`/api/public/approvals/<token>/media/<id>`), não pelo
   * storage: a URL assinada é gerada com o endpoint interno do MinIO e o navegador não a resolve.
   */
  media: { id: string; kind: string; originalName: string; downloadUrl: string | null }[];
  renderedSamples: RenderedSample[];
  expiresAt: string;
  requiredApprovals: number;
  approvalsSoFar: number;
}

export interface ApprovalDecisionResult {
  decision: 'APPROVED' | 'REJECTED';
  contentTitle: string;
  contentApproved: boolean;
  contentRejected: boolean;
  approvalsSoFar: number;
  requiredApprovals: number;
}

// ---- distribution ---------------------------------------------------------------------------------

export type DistributionStatus =
  'DRAFT' | 'PLANNED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface Distribution {
  id: string;
  contentId: string;
  contentTitle: string;
  status: DistributionStatus;
  windowStart: string;
  windowEnd: string;
  tags: string[];
  confirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface DistributionPreview {
  distributionId: string | null;
  contentId: string;
  contentTitle: string;
  contentHash: string;
  classification: string;
  status: DistributionStatus | null;
  windowStart: string;
  windowEnd: string;
  timeZone: string;
  audienceMatched: number;
  excludedOptedOut: number;
  excludedInactive: number;
  scheduledCount: number;
  /** Did not fit in the window. Never truncated silently (§9.2). */
  overflowCount: number;
  blockedCount: number;
  estimatedDays: number;
  firstSendAt: string | null;
  lastSendAt: string | null;
  perChannel: {
    channelId: string;
    channelLabel: string;
    scheduled: number;
    overflow: number;
    firstDayLoad: number;
    dailyQuota: number;
    campaignAllowance: number;
    alreadySentToday: number;
  }[];
  perVariant: {
    variantId: string | null;
    label: string;
    contacts: number;
    fromManualMapping: number;
  }[];
  perDay: { date: string; scheduled: number; accountCapacity: number }[];
  blocked: {
    contactId: string;
    phoneMasked: string;
    contactName: string | null;
    reason: string;
    detail: string;
  }[];
  fallbackCount: number;
  samples: RenderedSample[];
  /** The file that travels with each body. Empty when the campaign is text only. */
  attachments: { label: string; kind: string; fileName: string }[];
  /** Qual dos cinco tetos produziu a estimativa (Adendo 02 §3.2). */
  bindingConstraint: 'ACCOUNT_CEILING' | 'CHANNEL_QUOTA' | 'HOURLY_CAP' | 'WINDOW' | 'QUIET_HOURS';
  /** Envios que o teto amarrante permitiu no PRIMEIRO dia — não é a vazão diária estável. */
  bindingCapacityFirstDay: number;
  /** True quando o resto não tinha para onde ir porque a janela acabou antes. */
  bindingWindowExhausted: boolean;
  /** A causa em português, com o número que a produziu. */
  bindingReason: string;
  /** Ações que de fato destravam ESTE caso — derivadas do teto que amarrou. */
  overflowOptions: string[];
}

/**
 * O que a Evolution tem configurado de verdade para a instância do canal.
 *
 * `problem` vem em português e pronto para exibir: os campos crus só significam algo para quem já sabe
 * o que deveria estar lá, e quem está olhando uma caixa de entrada vazia normalmente não sabe.
 */
export interface WebhookDiagnosis {
  channelId: string;
  channelLabel: string;
  /** Null quando só leu; true/false quando pediu para reconfigurar antes. */
  reconfigured: boolean | null;
  configured: boolean;
  enabled: boolean;
  url: string | null;
  events: string[];
  /** Só a presença do cabeçalho — o token nunca sai do backend. */
  hasAuthHeader: boolean;
  receivesInbound: boolean;
  receivesAcks: boolean;
  /**
   * O resto da cadeia, depois do POST.
   *
   * Tudo acima descreve o que o PROVEDOR tem configurado, e pode estar inteiro verde sem que nenhuma
   * resposta chegue no inbox. Estes campos são os elos seguintes.
   */
  instanceName: string;
  instanceNameAttributable: boolean;
  inboundCount: number;
  lastInboundAt: string | null;
  contactsTotal: number;
  contactsWithoutNinthDigit: number;
  invalidTokenRejections: number;
  lastInvalidTokenAt: string | null;
  problem: string | null;
}

/** Uma tag existente na base, com o público que ela alcança hoje. */
export interface ContactTag {
  tag: string;
  /** Só contatos alcançáveis: quem saiu ou está inativo não conta. */
  contacts: number;
}

export interface DistributionProgress {
  id: string;
  contentId: string;
  contentTitle: string;
  /** True when the content was edited after planning — what is going out is the approved text (§4). */
  contentChangedSincePlanning: boolean;
  status: DistributionStatus;
  windowStart: string;
  windowEnd: string;
  tags: string[];
  confirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  cancelled: number;
  blocked: number;
  progressPercent: number;
  /** Quando o próximo envio pendente vence. Null quando não há pendente. */
  nextSendAt: string | null;
  perChannel: {
    channelId: string;
    channelLabel: string;
    scheduled: number;
    sent: number;
    failed: number;
  }[];
  blockedByReason: { reason: string; count: number }[];
}

// ---- inbox ----------------------------------------------------------------------------------------

export type ConversationStatus = 'PENDING_REPLY' | 'IN_PROGRESS' | 'RESOLVED' | 'ARCHIVED';
export type IntentClass =
  'OPT_OUT' | 'ACKNOWLEDGMENT' | 'WRONG_NUMBER' | 'QUESTION' | 'COMPLAINT' | 'OTHER';

export interface ConversationSummary {
  id: string;
  contactId: string;
  contactName: string | null;
  contactPhoneMasked: string;
  status: ConversationStatus;
  priority: 'NORMAL' | 'HIGH';
  intentClass: IntentClass | null;
  /** §10.3 item 2: the number that says whether the team is keeping up. */
  ageMinutes: number;
  unreadCount: number;
  lastMessagePreview: string | null;
  lastMessageKind: string | null;
  lastInboundAt: string | null;
  locked: boolean;
}

export interface InboxMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  kind: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'STICKER' | 'OTHER';
  body: string | null;
  /** Signed and short-lived, so audio plays inline (§10.2 item 3). */
  mediaUrl: string | null;
  sentBy: string | null;
  fromDistribution: boolean;
  deliveryStatus: string | null;
  occurredAt: string;
}

export interface ConversationDetail {
  id: string;
  contactId: string;
  contactName: string | null;
  contactPhoneMasked: string;
  contactTags: string[];
  /** Which chip received it. Visible, never selectable (§10.4). */
  channelLabel: string;
  status: ConversationStatus;
  priority: 'NORMAL' | 'HIGH';
  intentClass: IntentClass | null;
  ageMinutes: number;
  lockedBy: string | null;
  messages: InboxMessage[];
}

export interface InboxCounters {
  pendingReply: number;
  inProgress: number;
  highPriority: number;
  averageAgeMinutes: number;
  oldestAgeMinutes: number;
}

export interface QuickReply {
  id: string;
  title: string;
  body: string;
  tags: string[];
  usageCount: number;
  createdAt: string;
}

// ---- audit and health -----------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  actorType: 'USER' | 'PLATFORM_ADMIN' | 'SYSTEM';
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface ChannelHealth {
  channelId: string;
  label: string;
  status: ChannelStatus;
  currentQuota: number;
  quotaFloor: number;
  quotaCeiling: number;
  daily: { date: string; campaignSends: number; replySends: number }[];
  lastDecision: {
    date: string;
    decision: string;
    reason: string;
    computedQuota: number;
  } | null;
  /** Sends the rates were computed over. "0% of 3" and "0% of 400" are not the same news. */
  sentCount: number;
  deliveryRate: number | null;
  inboundRate: number | null;
  optOutRate: number | null;
  failureRate: number | null;
  consecutiveFailures: number;
  /** UNKNOWN = not enough traffic to judge; deliberately not folded into HEALTHY or AT_RISK. */
  assessment: 'HEALTHY' | 'WATCH' | 'AT_RISK' | 'STOPPED' | 'UNKNOWN';
  assessmentReason: string;
}

export interface HealthPanel {
  windowDays: number;
  channels: ChannelHealth[];
  inboundPerDay: { date: string; count: number }[];
  optOutsInWindow: number;
  contactsTotal: number;
  contactsRoutable: number;
  dailyCapacity: number;
  /** §15 risco 3, as a number: days to cover the base at the current capacity. */
  daysToCoverBase: number | null;
}

// ---- platform -------------------------------------------------------------------------------------

export interface PlatformAccount {
  id: string;
  name: string;
  /** Masked by the API — the raw CPF/CNPJ is never sent to a browser. */
  documentMasked: string;
  plan: string;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  dailySendCeiling: number;
  timezone: string;
  hasDedicatedEvolutionServer: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
}

/**
 * The platform login answers with `admin`, NOT `user`: a platform admin is not a user of any account
 * (§4 keeps them in separate tables), so it carries no accountId and no role.
 */
export interface PlatformSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  admin: { id: string; name: string; email: string };
}

/**
 * Abuse signals as the API actually returns them: raw daily counters and derived rates for ONE
 * account, with **no verdict attached** — what counts as abuse is DECISÃO PENDENTE (§14 item 10) and
 * a person reads the numbers. A `null` rate means there were no sends that day, which is different
 * from a rate of zero.
 */
export interface AbuseSignalDay {
  date: string;
  sentCount: number;
  failedCount: number;
  deliveredCount: number;
  optOutCount: number;
  inboundCount: number;
  failureRate: number | null;
  deliveryRate: number | null;
  optOutRate: number | null;
  inboundRate: number | null;
  volumeJump: number | null;
}

export interface AbuseSignals {
  accountId: string;
  from: string;
  to: string;
  days: AbuseSignalDay[];
  totals: { sent: number; failed: number; delivered: number; optOut: number; inbound: number };
}
