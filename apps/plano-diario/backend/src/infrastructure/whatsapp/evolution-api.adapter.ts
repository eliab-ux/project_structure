import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  InstanceConnection,
  WhatsappGatewayPort,
  WhatsappGroup,
} from '../../contexts/whatsapp/application/ports/output/whatsapp-gateway.port';
import { ProviderInstanceMissingException } from '../../contexts/whatsapp/domain/exceptions/provider-instance-missing.exception';
import {
  WhatsappGatewayException,
  WhatsappSendFailedException,
} from '../../contexts/whatsapp/domain/exceptions/whatsapp-gateway.exception';
import { ConnectionStatus } from '../../contexts/whatsapp/domain/value-objects/connection-status.vo';

/**
 * Adapter da Evolution API — contrato **v2** (confirmado contra o servidor: `GET /` devolveu
 * `version: 2.3.7`, `clientName: evolution_v2`).
 *
 * A diferença que mais quebra silenciosamente entre v1 e v2 é o envio de texto:
 *   v1: POST /message/sendText/{instance}  { number, textMessage: { text } }
 *   v2: POST /message/sendText/{instance}  { number, text }         ← é este
 *
 * Dois tipos de chave, nunca confundir:
 *   - GLOBAL (`EVOLUTION_API_KEY`): cria e deleta instâncias. É mestra do servidor.
 *   - POR INSTÂNCIA (devolvida na criação): envia mensagem, QR e status daquela instância.
 * Toda operação usa a chave de menor privilégio que resolve.
 */
@Injectable()
export class EvolutionApiAdapter implements WhatsappGatewayPort {
  private readonly logger = new Logger(EvolutionApiAdapter.name);
  private readonly http: AxiosInstance;

  /** Default para as chamadas rápidas (criar, QR, status, envio). */
  private static readonly TIMEOUT_MS = 10_000;
  private static readonly MAX_ATTEMPTS = 3; // 1 tentativa + 2 retries

  /**
   * Listar grupos é genuinamente lento: o Baileys busca os metadados de TODOS os grupos do
   * número. Medido na instância real: **22 segundos**. Com o timeout default de 10s a chamada
   * abortava, era interpretada como falha de rede, repetia 3 vezes e devolvia erro ao usuário —
   * enquanto o provider respondia 200 do outro lado.
   */
  private static readonly LIST_GROUPS_TIMEOUT_MS = 90_000;
  /** Só uma retentativa: repetir uma chamada de 20s+ punia o usuário e o provider. */
  private static readonly LIST_GROUPS_MAX_ATTEMPTS = 2;

  /** Imagem em base64 sobe no corpo do POST: 10s não dá. */
  private static readonly SEND_MEDIA_TIMEOUT_MS = 30_000;

  /**
   * Envio NUNCA é repetido automaticamente. Um POST de envio que devolveu erro de rede pode ter
   * chegado ao WhatsApp de qualquer forma, e repetir postaria a leitura duas vezes no grupo —
   * pior do que falhar. Quem decide repetir é o BullMQ, com o log já marcado como falho.
   */
  private static readonly SEND_MAX_ATTEMPTS = 1;

  constructor(private readonly configService: ConfigService) {
    this.http = axios.create({ timeout: EvolutionApiAdapter.TIMEOUT_MS });
  }

  async createInstance(instanceName: string): Promise<{ token: string }> {
    const data = await this.request<Record<string, unknown>>(
      {
        method: 'POST',
        url: '/instance/create',
        data: {
          instanceName,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
        },
      },
      this.globalKey(),
      'criar a conexão do WhatsApp',
    );

    const token = this.extractToken(data);
    if (!token) {
      this.logger.error('Evolution não devolveu o token da instância', {
        instanceName,
        keys: Object.keys(data ?? {}),
      });
      throw new WhatsappGatewayException('criar a conexão do WhatsApp');
    }
    return { token };
  }

  async connect(instanceName: string, token: string): Promise<InstanceConnection> {
    const data = await this.request<{
      base64?: string;
      code?: string;
      pairingCode?: string;
      instance?: { state?: string };
    }>(
      { method: 'GET', url: `/instance/connect/${encodeURIComponent(instanceName)}` },
      token,
      'gerar o QR Code',
      // 404 aqui não é "provider com problema": é a instância não existir mais no servidor
      // (apagada no Evolution Manager, por exemplo). Distinguir permite ao use case recriá-la
      // em vez de devolver um erro sem saída ao usuário.
      { notFoundError: () => new ProviderInstanceMissingException() },
    );

    // Quando já está pareado, a Evolution devolve o estado em vez do QR.
    if (!data.base64 && data.instance?.state) {
      return { status: ConnectionStatus.fromProviderState(data.instance.state).value };
    }

    return {
      status: 'pending_qr',
      qrCodeBase64: data.base64,
      pairingCode: data.pairingCode ?? undefined,
    };
  }

  async getConnectionState(instanceName: string, token: string): Promise<InstanceConnection> {
    const data = await this.request<{ instance?: { state?: string; owner?: string } }>(
      { method: 'GET', url: `/instance/connectionState/${encodeURIComponent(instanceName)}` },
      token,
      'consultar o status do WhatsApp',
    );

    const status = ConnectionStatus.fromProviderState(data.instance?.state);
    const connection: InstanceConnection = { status: status.value };

    if (status.isConnected) {
      const number = await this.fetchConnectedNumber(instanceName, token);
      if (number) {
        connection.connectedNumber = number;
      }
    }
    return connection;
  }

  async listGroups(instanceName: string, token: string): Promise<WhatsappGroup[]> {
    const data = await this.request<
      Array<{ id?: string; subject?: string; size?: number; participants?: unknown[] }>
    >(
      {
        method: 'GET',
        url: `/group/fetchAllGroups/${encodeURIComponent(instanceName)}`,
        params: { getParticipants: false },
        timeout: EvolutionApiAdapter.LIST_GROUPS_TIMEOUT_MS,
      },
      token,
      'listar os grupos do WhatsApp',
      { maxAttempts: EvolutionApiAdapter.LIST_GROUPS_MAX_ATTEMPTS },
    );

    return (Array.isArray(data) ? data : [])
      .filter((group) => typeof group.id === 'string' && group.id.endsWith('@g.us'))
      .map((group) => ({
        jid: group.id as string,
        name: group.subject ?? '(sem nome)',
        participantsCount: group.size ?? group.participants?.length ?? null,
      }));
  }

  async sendText(
    instanceName: string,
    token: string,
    jid: string,
    text: string,
  ): Promise<{ providerMessageId: string }> {
    try {
      const data = await this.request<{ key?: { id?: string } }>(
        {
          method: 'POST',
          url: `/message/sendText/${encodeURIComponent(instanceName)}`,
          // Contrato v2: `text` na raiz. Em v1 seria `textMessage: { text }`.
          //
          // `linkPreview: true` é declaração de intenção, não garantia: a Evolution só desliga a
          // prévia quando o valor é explicitamente `false`, então isto se comporta igual a omitir
          // o campo. Quem monta o cartão é o Baileys no servidor dela, e quando ele não consegue
          // buscar a página do YouTube a mensagem sai como texto puro. É por isso que o envio da
          // leitura usa `sendImageWithCaption`, e não este método.
          data: { number: jid, text, linkPreview: true },
        },
        token,
        'enviar a mensagem',
        { maxAttempts: EvolutionApiAdapter.SEND_MAX_ATTEMPTS },
      );
      return { providerMessageId: data.key?.id ?? '' };
    } catch {
      // Exceção própria: o dispatch precisa distinguir falha de envio de falha genérica.
      throw new WhatsappSendFailedException();
    }
  }

  async sendImageWithCaption(
    instanceName: string,
    token: string,
    jid: string,
    image: { base64: string; mimeType: string; caption: string },
  ): Promise<{ providerMessageId: string }> {
    try {
      const data = await this.request<{ key?: { id?: string } }>(
        {
          method: 'POST',
          url: `/message/sendMedia/${encodeURIComponent(instanceName)}`,
          // Contrato v2 do sendMedia: `media` aceita URL ou base64 puro. Mandamos base64 porque
          // assim quem busca a imagem é este backend — que comprovadamente alcança o YouTube —
          // e não o container da Evolution.
          data: {
            number: jid,
            mediatype: 'image',
            mimetype: image.mimeType,
            media: image.base64,
            caption: image.caption,
            fileName: 'leitura.jpg',
          },
          // Imagem em base64 é um POST grande: o default de 10s é curto para isso.
          timeout: EvolutionApiAdapter.SEND_MEDIA_TIMEOUT_MS,
        },
        token,
        'enviar a mensagem',
        { maxAttempts: EvolutionApiAdapter.SEND_MAX_ATTEMPTS },
      );
      return { providerMessageId: data.key?.id ?? '' };
    } catch {
      throw new WhatsappSendFailedException();
    }
  }

  async logout(instanceName: string, token: string): Promise<void> {
    await this.request(
      { method: 'DELETE', url: `/instance/logout/${encodeURIComponent(instanceName)}` },
      token,
      'desconectar o WhatsApp',
    );
  }

  async deleteInstance(instanceName: string): Promise<void> {
    await this.request(
      { method: 'DELETE', url: `/instance/delete/${encodeURIComponent(instanceName)}` },
      this.globalKey(),
      'remover a conexão do WhatsApp',
    );
  }

  /** O número aparece como `ownerJid` (`5511999999999@s.whatsapp.net`) no fetchInstances. */
  private async fetchConnectedNumber(instanceName: string, token: string): Promise<string | null> {
    try {
      const data = await this.request<Array<{ name?: string; ownerJid?: string; owner?: string }>>(
        { method: 'GET', url: '/instance/fetchInstances', params: { instanceName } },
        token,
        'consultar o status do WhatsApp',
      );
      const found =
        (Array.isArray(data) ? data : []).find((i) => i.name === instanceName) ?? data?.[0];
      const jid = found?.ownerJid ?? found?.owner;
      return jid ? jid.split('@')[0] : null;
    } catch {
      // O número é só decoração na tela — não vale derrubar a consulta de status por ele.
      return null;
    }
  }

  /**
   * Retry apenas em erro de rede ou 5xx, com backoff exponencial.
   * **Nunca** em 4xx: repetir um payload que o servidor recusou não muda o resultado, e num
   * `POST /instance/create` poderia criar instância duplicada.
   */
  private async request<T>(
    config: AxiosRequestConfig,
    apiKey: string,
    operation: string,
    options: { maxAttempts?: number; notFoundError?: () => Error } = {},
  ): Promise<T> {
    const baseURL = this.baseUrl();
    const maxAttempts = options.maxAttempts ?? EvolutionApiAdapter.MAX_ATTEMPTS;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await this.http.request<T>({
          ...config,
          baseURL,
          headers: { ...(config.headers ?? {}), apikey: apiKey },
        });
        return response.data;
      } catch (error) {
        lastError = error;
        const status = (error as AxiosError)?.response?.status;

        // 404 mapeado é resposta de negócio, não falha de comunicação: sai na hora, sem retry
        // (repetir não faz a instância voltar a existir) e sem virar erro genérico.
        if (status === 404 && options.notFoundError) {
          this.logger.warn('Instância não existe no provider', { operation });
          throw options.notFoundError();
        }

        const retriable = status === undefined || status >= 500;

        this.logger.warn('Chamada à Evolution API falhou', {
          operation,
          // A URL não carrega a apikey (ela vai no header), mas o log é explícito sobre o que
          // pode e não pode aparecer: nunca o header, nunca o token.
          url: `${config.method} ${config.url}`,
          status: status ?? 'network',
          attempt,
          retriable,
        });

        if (!retriable || attempt === maxAttempts) {
          break;
        }
        await this.delay(2 ** (attempt - 1) * 500);
      }
    }

    this.logger.error('Evolution API indisponível após as tentativas', { operation });
    void lastError; // detalhe cru fica fora da exceção que sobe para o cliente
    throw new WhatsappGatewayException(operation);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * O token da instância pode vir como `hash` string (v2) ou `hash.apikey` (v1) — aceitamos
   * os dois para não quebrar numa atualização do servidor.
   */
  private extractToken(data: Record<string, unknown>): string | null {
    const hash = data?.hash;
    if (typeof hash === 'string' && hash.length > 0) {
      return hash;
    }
    if (hash && typeof hash === 'object') {
      const apikey = (hash as { apikey?: unknown }).apikey;
      if (typeof apikey === 'string' && apikey.length > 0) {
        return apikey;
      }
    }
    const direct = (data as { apikey?: unknown })?.apikey;
    return typeof direct === 'string' && direct.length > 0 ? direct : null;
  }

  private baseUrl(): string {
    const url = this.configService.get<string>('EVOLUTION_API_URL');
    if (!url) {
      throw new Error('EVOLUTION_API_URL não configurada');
    }
    return url.replace(/\/+$/, '');
  }

  private globalKey(): string {
    const key = this.configService.get<string>('EVOLUTION_API_KEY');
    if (!key) {
      throw new Error('EVOLUTION_API_KEY (chave global) não configurada');
    }
    return key;
  }
}
