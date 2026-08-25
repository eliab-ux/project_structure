import { AggregateRoot } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';
import { InvalidPlanStartDateException } from '../exceptions/schedule.exceptions';
import { MessageTemplate } from '../value-objects/message-template.vo';
import { SendTime } from '../value-objects/send-time.vo';
import { Timezone } from '../value-objects/timezone.vo';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A configuração de envio do usuário: para qual grupo, a que hora, em qual fuso, com qual
 * template. Um por usuário na v1.
 *
 * `groupName` é um snapshot de propósito (spec §4.5): se o usuário sair do grupo e o cache for
 * limpo, a tela continua mostrando para onde os envios iam.
 */
export class Schedule extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private _groupJid: string,
    private _groupName: string,
    private _sendTime: SendTime,
    private _timezone: Timezone,
    private _planStartDate: string,
    private _dayOffset: number,
    private _messageTemplate: MessageTemplate,
    private _isActive: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(params: {
    userId: string;
    groupJid: string;
    groupName: string;
    sendTime: SendTime;
    timezone: Timezone;
    planStartDate: string;
    dayOffset?: number;
    messageTemplate: MessageTemplate;
    isActive?: boolean;
  }): Schedule {
    const now = new Date();
    return new Schedule(
      randomUUID(),
      params.userId,
      params.groupJid,
      params.groupName,
      params.sendTime,
      params.timezone,
      Schedule.ensureIsoDate(params.planStartDate),
      params.dayOffset ?? 0,
      params.messageTemplate,
      params.isActive ?? true,
      now,
      now,
    );
  }

  static reconstitute(params: {
    id: string;
    userId: string;
    groupJid: string;
    groupName: string;
    sendTime: SendTime;
    timezone: Timezone;
    planStartDate: string;
    dayOffset: number;
    messageTemplate: MessageTemplate;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Schedule {
    return new Schedule(
      params.id,
      params.userId,
      params.groupJid,
      params.groupName,
      params.sendTime,
      params.timezone,
      params.planStartDate,
      params.dayOffset,
      params.messageTemplate,
      params.isActive,
      params.createdAt,
      params.updatedAt,
    );
  }

  update(params: {
    groupJid: string;
    groupName: string;
    sendTime: SendTime;
    timezone: Timezone;
    planStartDate: string;
    dayOffset: number;
    messageTemplate: MessageTemplate;
  }): void {
    this._groupJid = params.groupJid;
    this._groupName = params.groupName;
    this._sendTime = params.sendTime;
    this._timezone = params.timezone;
    this._planStartDate = Schedule.ensureIsoDate(params.planStartDate);
    this._dayOffset = params.dayOffset;
    this._messageTemplate = params.messageTemplate;
    this._updatedAt = new Date();
  }

  setActive(isActive: boolean): void {
    this._isActive = isActive;
    this._updatedAt = new Date();
  }

  /** A mensagem final, exatamente como sai no grupo. */
  buildMessage(params: { formattedDate: string; url: string }): string {
    return this._messageTemplate.render({ date: params.formattedDate, url: params.url });
  }

  private static ensureIsoDate(value: string): string {
    if (!ISO_DATE.test(value ?? '')) {
      throw new InvalidPlanStartDateException();
    }
    return value;
  }

  get id(): string {
    return this._id;
  }
  get userId(): string {
    return this._userId;
  }
  get groupJid(): string {
    return this._groupJid;
  }
  get groupName(): string {
    return this._groupName;
  }
  get sendTime(): SendTime {
    return this._sendTime;
  }
  get timezone(): Timezone {
    return this._timezone;
  }
  get planStartDate(): string {
    return this._planStartDate;
  }
  get dayOffset(): number {
    return this._dayOffset;
  }
  get messageTemplate(): MessageTemplate {
    return this._messageTemplate;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}
