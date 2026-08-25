import { AggregateRoot } from '@gitspread/domain-primitives';

export type WhatsappMode = 'shared' | 'own';

/**
 * Configuração de WhatsApp de um psicólogo: usa a instância compartilhada (`shared`, ex.: emdr)
 * ou uma instância própria (`own`) criada no Evolution e pareada por QR com o celular dele.
 * A `apiKey` é a credencial da instância (nunca exposta em Response DTO).
 */
export class WhatsappInstance extends AggregateRoot {
  private constructor(
    private readonly _psicologoId: string,
    private _mode: WhatsappMode,
    private _instanceName: string,
    private _apiKey: string,
    private _connected: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static shared(psicologoId: string, instanceName: string, apiKey: string): WhatsappInstance {
    const now = new Date();
    return new WhatsappInstance(psicologoId, 'shared', instanceName, apiKey, true, now, now);
  }

  static own(psicologoId: string, instanceName: string, apiKey: string): WhatsappInstance {
    const now = new Date();
    return new WhatsappInstance(psicologoId, 'own', instanceName, apiKey, false, now, now);
  }

  // eslint-disable-next-line max-params
  static reconstitute(
    psicologoId: string,
    mode: WhatsappMode,
    instanceName: string,
    apiKey: string,
    connected: boolean,
    createdAt: Date,
    updatedAt: Date,
  ): WhatsappInstance {
    return new WhatsappInstance(
      psicologoId,
      mode,
      instanceName,
      apiKey,
      connected,
      createdAt,
      updatedAt,
    );
  }

  setConnected(connected: boolean): void {
    this._connected = connected;
    this._updatedAt = new Date();
  }

  get psicologoId(): string {
    return this._psicologoId;
  }
  get mode(): WhatsappMode {
    return this._mode;
  }
  get instanceName(): string {
    return this._instanceName;
  }
  get apiKey(): string {
    return this._apiKey;
  }
  get connected(): boolean {
    return this._connected;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}
