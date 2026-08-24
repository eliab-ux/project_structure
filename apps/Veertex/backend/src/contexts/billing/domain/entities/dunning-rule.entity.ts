import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { DunningRuleInvalidException } from '../exceptions/billing-exceptions';

export const DUNNING_CHANNELS = ['whatsapp', 'email'] as const;
export type DunningChannel = (typeof DUNNING_CHANNELS)[number];

export interface DunningStep {
  id: string;
  /** Negativo = X dias ANTES do vencimento; 0 = no vencimento; positivo = Y dias após. */
  offsetDays: number;
  channel: DunningChannel;
  /** Template com variáveis [NOME], [VALOR], [VENCIMENTO], [LINK]. */
  template: string;
  /**
   * `propose` (default do produto): a etapa PROPÕE na Mesa e um humano aprova cada envio.
   * `auto` (opt-in POR ETAPA): envia sem aprovação individual — a ativação é a aprovação humana,
   * e fica REGISTRADA (quem, quando). Ver 06 §2.3.
   */
  mode: 'propose' | 'auto';
  autoEnabledByUserId: string | null;
  autoEnabledAt: Date | null;
}

/**
 * A RÉGUA de cobrança da conta (06 §2.3): etapas por offset do vencimento, canal e template.
 * Uma régua por conta no V1 (por empresa/segmento é refinamento futuro). Também carrega o limiar
 * da política "perdida" (04 §3.4): 1 cobrança + N recobranças sem recebimento → written_off_pending.
 */
export class DunningRule extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _steps: DunningStep[],
    /** N recobranças da política "perdida" (1+N). Default 3 — o real da operação (04 §3.4). */
    private _maxRebillings: number,
    private _active: boolean,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    steps: Omit<DunningStep, 'id' | 'autoEnabledByUserId' | 'autoEnabledAt'>[];
    maxRebillings?: number | null;
    /** Obrigatório quando alguma etapa nasce `auto` — o opt-in registra QUEM ativou. */
    actorUserId?: string | null;
  }): DunningRule {
    const rule = new DunningRule(
      randomUUID(),
      params.accountId,
      [],
      Math.max(0, Math.min(12, Math.trunc(params.maxRebillings ?? 3))),
      true,
      new Date(),
    );
    rule.replaceSteps(params.steps, params.actorUserId ?? null);
    return rule;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static reconstitute(params: any): DunningRule {
    return new DunningRule(
      params.id,
      params.accountId,
      params.steps,
      params.maxRebillings,
      params.active,
      params.createdAt,
    );
  }

  /**
   * Substitui as etapas. Etapa que JÁ ERA `auto` e continua igual preserva o registro do opt-in;
   * etapa que VIRA `auto` agora exige o ator — a ativação é a aprovação humana e fica registrada.
   */
  replaceSteps(
    steps: Omit<DunningStep, 'id' | 'autoEnabledByUserId' | 'autoEnabledAt'>[],
    actorUserId: string | null,
  ): void {
    if (steps.length === 0) {
      throw new DunningRuleInvalidException('A régua precisa de ao menos uma etapa.');
    }
    const offsets = new Set<number>();
    for (const step of steps) {
      if (!Number.isInteger(step.offsetDays) || step.offsetDays < -60 || step.offsetDays > 365) {
        throw new DunningRuleInvalidException('Offset de etapa fora do intervalo (-60 a 365).');
      }
      const key = step.offsetDays * 10 + (step.channel === 'email' ? 1 : 0);
      if (offsets.has(key)) {
        throw new DunningRuleInvalidException(
          'Duas etapas no mesmo dia e canal — uma delas é engano.',
        );
      }
      offsets.add(key);
      if (step.mode === 'auto' && !actorUserId) {
        throw new DunningRuleInvalidException(
          'Modo automático exige o registro de quem ativou (opt-in).',
        );
      }
    }
    const previousAuto = new Map(
      this._steps
        .filter((step) => step.mode === 'auto')
        .map((step) => [`${step.offsetDays}:${step.channel}`, step]),
    );
    this._steps = steps
      .slice()
      .sort((a, b) => a.offsetDays - b.offsetDays)
      .map((step) => {
        const kept = previousAuto.get(`${step.offsetDays}:${step.channel}`);
        return {
          id: randomUUID(),
          offsetDays: step.offsetDays,
          channel: step.channel,
          template: step.template,
          mode: step.mode,
          autoEnabledByUserId:
            step.mode === 'auto' ? (kept?.autoEnabledByUserId ?? actorUserId) : null,
          autoEnabledAt: step.mode === 'auto' ? (kept?.autoEnabledAt ?? new Date()) : null,
        };
      });
  }

  setMaxRebillings(value: number): void {
    this._maxRebillings = Math.max(0, Math.min(12, Math.trunc(value)));
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get steps(): readonly DunningStep[] {
    return this._steps;
  }
  get maxRebillings(): number {
    return this._maxRebillings;
  }
  get active(): boolean {
    return this._active;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}

export const DUNNING_EVENT_STATUSES = ['proposed', 'sent', 'skipped'] as const;
export type DunningEventStatus = (typeof DUNNING_EVENT_STATUSES)[number];

/**
 * Um evento da régua — APPEND-ONLY (06 aceite 6): o quê, quando, canal, template RESOLVIDO
 * (snapshot — o template da régua pode mudar depois; o que foi enviado não).
 */
export class DunningEvent extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _titleId: string,
    private readonly _stepId: string,
    private readonly _offsetDays: number,
    private readonly _channel: DunningChannel,
    private readonly _renderedMessage: string,
    private _status: DunningEventStatus,
    private _sentAt: Date | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    titleId: string;
    stepId: string;
    offsetDays: number;
    channel: DunningChannel;
    renderedMessage: string;
    status: DunningEventStatus;
  }): DunningEvent {
    return new DunningEvent(
      randomUUID(),
      params.accountId,
      params.titleId,
      params.stepId,
      params.offsetDays,
      params.channel,
      params.renderedMessage,
      params.status,
      params.status === 'sent' ? new Date() : null,
      new Date(),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static reconstitute(params: any): DunningEvent {
    return new DunningEvent(
      params.id,
      params.accountId,
      params.titleId,
      params.stepId,
      params.offsetDays,
      params.channel,
      params.renderedMessage,
      params.status,
      params.sentAt ?? null,
      params.createdAt,
    );
  }

  /** Aprovação humana da proposta → enviado. */
  markSent(): void {
    this._status = 'sent';
    this._sentAt = new Date();
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get titleId(): string {
    return this._titleId;
  }
  get stepId(): string {
    return this._stepId;
  }
  get offsetDays(): number {
    return this._offsetDays;
  }
  get channel(): DunningChannel {
    return this._channel;
  }
  get renderedMessage(): string {
    return this._renderedMessage;
  }
  get status(): DunningEventStatus {
    return this._status;
  }
  get sentAt(): Date | null {
    return this._sentAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
