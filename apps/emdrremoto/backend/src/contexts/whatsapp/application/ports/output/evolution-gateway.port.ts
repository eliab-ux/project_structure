export const EVOLUTION_GATEWAY = Symbol('EVOLUTION_GATEWAY');

export interface EvolutionInstanceCreated {
  apiKey: string;
  qrBase64: string | null;
}

export interface EvolutionConnectInfo {
  qrBase64: string | null;
  connected: boolean;
}

/**
 * Outbound port do Evolution API (WhatsApp). A aplicação nunca fala com o Evolution direto —
 * só por este contrato. Adapter concreto (axios) vive na infraestrutura.
 */
export interface EvolutionGatewayPort {
  /** Cria uma instância nova (usa a chave GLOBAL). Retorna a apikey da instância + QR inicial. */
  createInstance(instanceName: string): Promise<EvolutionInstanceCreated>;
  /** Obtém o QR/estado atual da instância (para parear). */
  connect(instanceName: string, apiKey: string): Promise<EvolutionConnectInfo>;
  /** Estado da conexão (true = pareado/aberto). */
  isConnected(instanceName: string, apiKey: string): Promise<boolean>;
  /** Envia uma mensagem de texto. */
  sendText(instanceName: string, apiKey: string, phone: string, text: string): Promise<void>;
  /** Remove a instância (logout + delete). */
  deleteInstance(instanceName: string, apiKey: string): Promise<void>;
  /** Indica se a criação de instância própria está habilitada (chave global configurada). */
  canCreateInstances(): boolean;
  /** Config da instância compartilhada, se houver. */
  sharedInstance(): { instanceName: string; apiKey: string } | null;
}
