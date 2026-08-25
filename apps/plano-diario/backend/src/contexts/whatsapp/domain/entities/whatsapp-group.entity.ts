import { randomUUID } from 'crypto';
import { GroupJid } from '../value-objects/group-jid.vo';

/** Idade máxima do cache antes de valer a pena revalidar contra o provider (spec §4.3). */
export const GROUP_CACHE_MAX_AGE_DAYS = 7;

/**
 * Um grupo do WhatsApp do usuário. É **cache**: a fonte de verdade é sempre a Evolution API.
 * Existe para a tela de seleção não depender de uma chamada externa a cada abertura, e para
 * validar o `group_jid` que o cliente informa no agendamento.
 */
export class WhatsappGroup {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _instanceId: string,
    private readonly _jid: GroupJid,
    private _name: string,
    private _participantsCount: number | null,
    private _syncedAt: Date,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(params: {
    userId: string;
    instanceId: string;
    jid: GroupJid;
    name: string;
    participantsCount: number | null;
  }): WhatsappGroup {
    const now = new Date();
    return new WhatsappGroup(
      randomUUID(),
      params.userId,
      params.instanceId,
      params.jid,
      WhatsappGroup.normalizeName(params.name),
      params.participantsCount,
      now,
      now,
      now,
    );
  }

  static reconstitute(params: {
    id: string;
    userId: string;
    instanceId: string;
    jid: GroupJid;
    name: string;
    participantsCount: number | null;
    syncedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): WhatsappGroup {
    return new WhatsappGroup(
      params.id,
      params.userId,
      params.instanceId,
      params.jid,
      params.name,
      params.participantsCount,
      params.syncedAt,
      params.createdAt,
      params.updatedAt,
    );
  }

  /** Reflete o que o provider devolveu agora (o nome do grupo pode ter sido alterado lá). */
  refreshFrom(params: { name: string; participantsCount: number | null }): void {
    this._name = WhatsappGroup.normalizeName(params.name);
    this._participantsCount = params.participantsCount;
    this._syncedAt = new Date();
    this._updatedAt = this._syncedAt;
  }

  isStale(now: Date = new Date(), maxAgeDays = GROUP_CACHE_MAX_AGE_DAYS): boolean {
    const ageMs = now.getTime() - this._syncedAt.getTime();
    return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
  }

  /** Nome vem do WhatsApp e vai para a tela — limitar tamanho evita estourar a coluna. */
  private static normalizeName(name: string): string {
    const trimmed = (name ?? '').trim();
    return (trimmed.length > 0 ? trimmed : '(sem nome)').slice(0, 255);
  }

  get id(): string {
    return this._id;
  }
  get userId(): string {
    return this._userId;
  }
  get instanceId(): string {
    return this._instanceId;
  }
  get jid(): GroupJid {
    return this._jid;
  }
  get name(): string {
    return this._name;
  }
  get participantsCount(): number | null {
    return this._participantsCount;
  }
  get syncedAt(): Date {
    return this._syncedAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}
