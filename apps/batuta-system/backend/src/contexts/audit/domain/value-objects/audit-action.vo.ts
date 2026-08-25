/**
 * Auditable actions. An enum on purpose: an audit trail whose `action` is free text becomes
 * unqueryable within a month. Every phase appends its own actions here.
 *
 * BATUTA_SPEC §5 (FASE 1 item 7) requires: login, channel change, import, sender migration,
 * approval, distribution creation and execution, suspension, manual reply. The ones whose
 * subject does not exist yet arrive with their phase — adding a member is additive.
 */
export enum AuditAction {
  // Auth (FASE 1)
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  PLATFORM_ADMIN_LOGIN = 'PLATFORM_ADMIN_LOGIN',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  // Tenant lifecycle (FASE 1)
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_REACTIVATED = 'ACCOUNT_REACTIVATED',
  ACCOUNT_CEILING_CHANGED = 'ACCOUNT_CEILING_CHANGED',
  ACCOUNT_EVOLUTION_SERVER_CHANGED = 'ACCOUNT_EVOLUTION_SERVER_CHANGED',
  USER_CREATED = 'USER_CREATED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  /**
   * Security-relevant, not a profile edit: whoever controls the WhatsApp number can take the
   * account over through the recovery flow, so the change has to be visible in the trail.
   */
  USER_PHONE_CHANGED = 'USER_PHONE_CHANGED',
  USER_DISABLED = 'USER_DISABLED',
  // Channels (FASE 2). "Alteração de canal" of §5 FASE 1 item 7, itemised.
  CHANNEL_CREATED = 'CHANNEL_CREATED',
  CHANNEL_DISCONNECTED = 'CHANNEL_DISCONNECTED',
  CHANNEL_REINSTATED = 'CHANNEL_REINSTATED',
  CHANNEL_QUOTA_BAND_CHANGED = 'CHANNEL_QUOTA_BAND_CHANGED',
  /** Automatic, actor SYSTEM: recorded only when the daily review actually moved the quota. */
  CHANNEL_THROTTLE_DECISION = 'CHANNEL_THROTTLE_DECISION',
  /** Circuit breaker or throttle PAUSE. Automatic, and deliberately NOT terminal (§10 item 7). */
  CHANNEL_DEGRADED = 'CHANNEL_DEGRADED',
  // Terminal states — always human-declared (§4).
  CHANNEL_RETIRED = 'CHANNEL_RETIRED',
  CHANNEL_BANNED = 'CHANNEL_BANNED',
  // Audience (FASE 3).
  CONTACT_IMPORT_STARTED = 'CONTACT_IMPORT_STARTED',
  /** Actor SYSTEM: written by the import worker with the final counters. */
  CONTACT_IMPORT_COMPLETED = 'CONTACT_IMPORT_COMPLETED',
  /** Actor USER for a manual opt-out; SYSTEM when the contact asked by keyword (§6.5). */
  CONTACT_OPTED_OUT = 'CONTACT_OPTED_OUT',
  CONTACT_DELETED = 'CONTACT_DELETED',
  /**
   * Operator took the contact out of routing without claiming they asked to leave.
   *
   * Distinct from CONTACT_OPTED_OUT on purpose, and not a synonym for it: `opt_out_rate` feeds the
   * throttle, so filing an operator's decision as an opt-out would cut a healthy chip's quota. Distinct
   * from CONTACT_FLAGGED_FOR_REVIEW too — that one is the SYSTEM reacting to a wrong number.
   */
  CONTACT_DEACTIVATED = 'CONTACT_DEACTIVATED',
  CONTACT_REACTIVATED = 'CONTACT_REACTIVATED',
  SENDER_MIGRATION_EXECUTED = 'SENDER_MIGRATION_EXECUTED',
  // Content (FASE 4). The classification is in the payload of CONTENT_CREATED because it is the
  // fact that matters legally (§15 risco 6).
  CONTENT_CREATED = 'CONTENT_CREATED',
  CONTENT_UPDATED = 'CONTENT_UPDATED',
  CONTENT_ARCHIVED = 'CONTENT_ARCHIVED',
  /**
   * A copy of an existing content. The payload carries `sourceContentId` because that is the question
   * asked later: two similar messages went out — which came from which.
   */
  CONTENT_DUPLICATED = 'CONTENT_DUPLICATED',
  /** Rejeitado devolvido a rascunho SEM mudar o texto — o autor discordou e vai reenviar igual. */
  CONTENT_REOPENED = 'CONTENT_REOPENED',
  CONTENT_VARIANT_ADDED = 'CONTENT_VARIANT_ADDED',
  CONTENT_VARIANT_UPDATED = 'CONTENT_VARIANT_UPDATED',
  /** A human reviewed the wording of a variant (§7 item 5). */
  CONTENT_VARIANT_REVIEWED = 'CONTENT_VARIANT_REVIEWED',
  CONTENT_VARIANT_REMOVED = 'CONTENT_VARIANT_REMOVED',
  CONTENT_MEDIA_ATTACHED = 'CONTENT_MEDIA_ATTACHED',
  CONTENT_MEDIA_REMOVED = 'CONTENT_MEDIA_REMOVED',
  // Approval (FASE 5). Every payload here carries the `content_hash`, which is what turns the trail
  // from "Ana aprovou" into "Ana aprovou ESTA versão" — the difference between decoration and evidence.
  APPROVAL_SETTINGS_CHANGED = 'APPROVAL_SETTINGS_CHANGED',
  APPROVER_CREATED = 'APPROVER_CREATED',
  APPROVER_UPDATED = 'APPROVER_UPDATED',
  CONTENT_SUBMITTED_FOR_APPROVAL = 'CONTENT_SUBMITTED_FOR_APPROVAL',
  /** Actor SYSTEM: the approver decided from a magic link and may have no user account (§8 item 2). */
  CONTENT_APPROVAL_GRANTED = 'CONTENT_APPROVAL_GRANTED',
  CONTENT_APPROVAL_REJECTED = 'CONTENT_APPROVAL_REJECTED',
  /** An edit changed the hash, so pending approvals died with the version they referred to (§8.5). */
  CONTENT_APPROVALS_INVALIDATED = 'CONTENT_APPROVALS_INVALIDATED',
  // Distribuição (FASE 6). O payload de PLANNED carrega o content_hash: é o que liga o plano à versão
  // exata que foi aprovada, e sem isso o relatório exportável não fecha o ciclo (§11 item 2).
  DISTRIBUTION_PLANNED = 'DISTRIBUTION_PLANNED',
  DISTRIBUTION_CONFIRMED = 'DISTRIBUTION_CONFIRMED',
  // Despacho (FASE 7). Envio individual NÃO gera audit_log: 10 mil linhas por campanha afogariam a
  // trilha, e cada envio já é uma linha em `dispatches` com status, horário e rendered_body — que é o
  // artefato que o relatório exportável usa (§11 item 2). Aqui ficam só os atos de operação.
  DISTRIBUTION_PAUSED = 'DISTRIBUTION_PAUSED',
  DISTRIBUTION_RESUMED = 'DISTRIBUTION_RESUMED',
  DISTRIBUTION_CANCELLED = 'DISTRIBUTION_CANCELLED',
  DISTRIBUTION_COMPLETED = 'DISTRIBUTION_COMPLETED',
  /** Contato tirado do roteamento por falha permanente de envio (§10 item 6). */
  CONTACT_FLAGGED_FOR_REVIEW = 'CONTACT_FLAGGED_FOR_REVIEW',
  // Caixa de entrada (FASE 8). Mensagem RECEBIDA não gera audit_log — o volume afogaria a trilha e cada
  // uma já é uma linha em `messages`. O que fica aqui é o que um humano DECIDIU.
  INBOX_REPLY_SENT = 'INBOX_REPLY_SENT',
  INBOX_CONVERSATION_RESOLVED = 'INBOX_CONVERSATION_RESOLVED',
  INBOX_CONVERSATION_ARCHIVED = 'INBOX_CONVERSATION_ARCHIVED',
  INBOX_CONVERSATION_REASSIGNED = 'INBOX_CONVERSATION_REASSIGNED',
  QUICK_REPLY_CREATED = 'QUICK_REPLY_CREATED',
  QUICK_REPLY_UPDATED = 'QUICK_REPLY_UPDATED',
  QUICK_REPLY_DELETED = 'QUICK_REPLY_DELETED',
}

/** Who performed the action. */
export enum AuditActorType {
  USER = 'USER',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  /** Scheduled job / worker — no human actor. */
  SYSTEM = 'SYSTEM',
}
