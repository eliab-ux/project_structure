import { AggregateRoot } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';
import { DispatchStatus, DispatchTriggerValue } from '../value-objects/dispatch-status.vo';

/**
 * Registro de um envio. É também o mecanismo de idempotência: a constraint
 * `UNIQUE(schedule_id, reference_date) WHERE trigger = 'scheduled'` garante no BANCO que existe
 * no máximo um envio agendado por dia — não confiamos em lógica de aplicação para isso, porque
 * dois workers concorrentes passariam por qualquer verificação feita em memória.
 */
export class DispatchLog extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _scheduleId: string,
    private readonly _referenceDate: string,
    private readonly _trigger: DispatchTriggerValue,
    private _dayNumber: number | null,
    private _videoId: string | null,
    private _messageSent: string | null,
    private _status: DispatchStatus,
    private _errorReason: string | null,
    private _attempts: number,
    private _sentAt: Date | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static createPending(params: {
    userId: string;
    scheduleId: string;
    referenceDate: string;
    trigger: DispatchTriggerValue;
  }): DispatchLog {
    const now = new Date();
    return new DispatchLog(
      randomUUID(),
      params.userId,
      params.scheduleId,
      params.referenceDate,
      params.trigger,
      null,
      null,
      null,
      DispatchStatus.PENDING,
      null,
      0,
      null,
      now,
      now,
    );
  }

  static reconstitute(params: {
    id: string;
    userId: string;
    scheduleId: string;
    referenceDate: string;
    trigger: DispatchTriggerValue;
    dayNumber: number | null;
    videoId: string | null;
    messageSent: string | null;
    status: DispatchStatus;
    errorReason: string | null;
    attempts: number;
    sentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): DispatchLog {
    return new DispatchLog(
      params.id,
      params.userId,
      params.scheduleId,
      params.referenceDate,
      params.trigger,
      params.dayNumber,
      params.videoId,
      params.messageSent,
      params.status,
      params.errorReason,
      params.attempts,
      params.sentAt,
      params.createdAt,
      params.updatedAt,
    );
  }

  resolveVideo(params: { dayNumber: number; videoId: string }): void {
    this._dayNumber = params.dayNumber;
    this._videoId = params.videoId;
    this._updatedAt = new Date();
  }

  markSent(message: string): void {
    this._messageSent = message;
    this._status = DispatchStatus.SENT;
    this._sentAt = new Date();
    this._errorReason = null;
    this._updatedAt = this._sentAt;
  }

  /**
   * O retry do BullMQ reaproveita a MESMA linha (spec §8.1) — daí `attempts` incrementar aqui
   * em vez de um log novo por tentativa.
   */
  markFailed(reason: string): void {
    this._status = DispatchStatus.FAILED;
    this._errorReason = DispatchLog.sanitize(reason);
    this._attempts += 1;
    this._updatedAt = new Date();
  }

  markSkipped(reason: string): void {
    this._status = DispatchStatus.SKIPPED;
    this._errorReason = DispatchLog.sanitize(reason);
    this._updatedAt = new Date();
  }

  /**
   * Remove qualquer coisa que pareça credencial antes de gravar o motivo do erro: o histórico
   * é exibido na tela, e uma mensagem de erro do provider pode carregar apikey ou token.
   */
  private static sanitize(reason: string): string {
    return (reason ?? '')
      .replace(/(apikey|api_key|token|authorization|secret|password)\s*[:=]\s*\S+/gi, '$1=***')
      .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '***')
      .slice(0, 500);
  }

  get id(): string {
    return this._id;
  }
  get userId(): string {
    return this._userId;
  }
  get scheduleId(): string {
    return this._scheduleId;
  }
  get referenceDate(): string {
    return this._referenceDate;
  }
  get trigger(): DispatchTriggerValue {
    return this._trigger;
  }
  get dayNumber(): number | null {
    return this._dayNumber;
  }
  get videoId(): string | null {
    return this._videoId;
  }
  get messageSent(): string | null {
    return this._messageSent;
  }
  get status(): DispatchStatus {
    return this._status;
  }
  get errorReason(): string | null {
    return this._errorReason;
  }
  get attempts(): number {
    return this._attempts;
  }
  get sentAt(): Date | null {
    return this._sentAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}
