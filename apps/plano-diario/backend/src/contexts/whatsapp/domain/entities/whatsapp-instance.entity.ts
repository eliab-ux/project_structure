import { AggregateRoot } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';
import { WhatsappConnectedEvent } from '../events/whatsapp-connected.event';
import { WhatsappDisconnectedEvent } from '../events/whatsapp-disconnected.event';
import { ConnectionStatus } from '../value-objects/connection-status.vo';
import { InstanceName } from '../value-objects/instance-name.vo';

/**
 * A instância da Evolution API de um usuário — o WhatsApp dele, pareado por QR Code.
 * Uma por usuário na v1 (unique em `user_id`).
 *
 * O `token` é a apikey **daquela instância**, devolvida pela Evolution na criação. Ela vive
 * criptografada no banco e nunca sai por HTTP: quem a expusesse daria a um terceiro o poder de
 * enviar mensagens pelo WhatsApp do usuário. A criptografia é responsabilidade da infraestrutura
 * (TokenCryptoPort); o domínio só carrega o valor em claro em memória.
 */
export class WhatsappInstance extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _instanceName: InstanceName,
    private _token: string,
    private _status: ConnectionStatus,
    private _connectedNumber: string | null,
    private _lastStatusAt: Date,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  /** Criada logo após a Evolution devolver o token — o QR ainda não foi escaneado. */
  static create(params: {
    userId: string;
    instanceName: InstanceName;
    token: string;
  }): WhatsappInstance {
    const now = new Date();
    return new WhatsappInstance(
      randomUUID(),
      params.userId,
      params.instanceName,
      params.token,
      ConnectionStatus.PENDING_QR,
      null,
      now,
      now,
      now,
    );
  }

  static reconstitute(params: {
    id: string;
    userId: string;
    instanceName: InstanceName;
    token: string;
    status: ConnectionStatus;
    connectedNumber: string | null;
    lastStatusAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): WhatsappInstance {
    return new WhatsappInstance(
      params.id,
      params.userId,
      params.instanceName,
      params.token,
      params.status,
      params.connectedNumber,
      params.lastStatusAt,
      params.createdAt,
      params.updatedAt,
    );
  }

  /**
   * Registra o estado observado no provider. Emite evento apenas na TRANSIÇÃO — o polling da
   * tela chama isso a cada 3 segundos, e emitir a cada chamada afogaria os handlers.
   */
  syncStatus(status: ConnectionStatus, connectedNumber?: string | null): void {
    const wasConnected = this._status.isConnected;
    const nowConnected = status.isConnected;

    this._status = status;
    if (connectedNumber !== undefined) {
      this._connectedNumber = connectedNumber;
    }
    if (!nowConnected) {
      // Perdeu a conexão: o número deixa de ser verdade e não deve continuar na tela.
      this._connectedNumber = null;
    }
    this._lastStatusAt = new Date();
    this._updatedAt = this._lastStatusAt;

    if (!wasConnected && nowConnected) {
      this.addDomainEvent(
        new WhatsappConnectedEvent(this._userId, this._instanceName.value, this._connectedNumber),
      );
    } else if (wasConnected && !nowConnected) {
      this.addDomainEvent(new WhatsappDisconnectedEvent(this._userId, this._instanceName.value));
    }
  }

  /** Novo QR gerado (o anterior expirou, ~60s). */
  markAwaitingQrCode(): void {
    this.syncStatus(ConnectionStatus.PENDING_QR);
  }

  markError(): void {
    this.syncStatus(ConnectionStatus.ERROR);
  }

  /** A Evolution pode devolver um token novo ao reconectar. */
  replaceToken(token: string): void {
    this._token = token;
    this._updatedAt = new Date();
  }

  get id(): string {
    return this._id;
  }
  get userId(): string {
    return this._userId;
  }
  get instanceName(): InstanceName {
    return this._instanceName;
  }
  /** Em claro apenas em memória — o repositório criptografa antes de persistir. */
  get token(): string {
    return this._token;
  }
  get status(): ConnectionStatus {
    return this._status;
  }
  get connectedNumber(): string | null {
    return this._connectedNumber;
  }
  get lastStatusAt(): Date {
    return this._lastStatusAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}
