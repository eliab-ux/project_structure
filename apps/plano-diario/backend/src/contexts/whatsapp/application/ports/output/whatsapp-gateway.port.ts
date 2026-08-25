import { ConnectionStatusValue } from '../../../domain/value-objects/connection-status.vo';

export const WHATSAPP_GATEWAY = Symbol('WHATSAPP_GATEWAY');

export interface WhatsappGroup {
  jid: string;
  name: string;
  participantsCount: number | null;
}

export interface InstanceConnection {
  status: ConnectionStatusValue;
  qrCodeBase64?: string;
  pairingCode?: string;
  connectedNumber?: string;
}

/**
 * Fronteira com o provedor de WhatsApp. A escolha "Evolution API" fica isolada atrás deste port:
 * o domínio e os use cases não sabem que existe HTTP, apikey ou Baileys do outro lado.
 */
export interface WhatsappGatewayPort {
  /** Cria a instância no provedor e devolve o token DAQUELA instância. */
  createInstance(instanceName: string): Promise<{ token: string }>;
  /** Inicia o pareamento e devolve o QR Code. */
  connect(instanceName: string, token: string): Promise<InstanceConnection>;
  getConnectionState(instanceName: string, token: string): Promise<InstanceConnection>;
  listGroups(instanceName: string, token: string): Promise<WhatsappGroup[]>;
  /** `jid` é o JID do grupo (`...@g.us`), não um telefone. */
  sendText(
    instanceName: string,
    token: string,
    jid: string,
    text: string,
  ): Promise<{ providerMessageId: string }>;
  /**
   * Envia uma imagem com legenda. É como a leitura do dia chega: a miniatura do vídeo com as duas
   * linhas embaixo, de modo que o vídeo apareça sem depender do provedor conseguir montar a
   * prévia do link por conta própria.
   */
  sendImageWithCaption(
    instanceName: string,
    token: string,
    jid: string,
    image: { base64: string; mimeType: string; caption: string },
  ): Promise<{ providerMessageId: string }>;
  logout(instanceName: string, token: string): Promise<void>;
  deleteInstance(instanceName: string): Promise<void>;
}
