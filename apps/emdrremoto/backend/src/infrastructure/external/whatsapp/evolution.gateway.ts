import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  EvolutionConnectInfo,
  EvolutionGatewayPort,
  EvolutionInstanceCreated,
} from '../../../contexts/whatsapp/application/ports/output/evolution-gateway.port';

/**
 * Adapter concreto do Evolution API (WhatsApp). Endpoints v2:
 *  - POST   /instance/create               (apikey GLOBAL)  → cria instância + QR
 *  - GET    /instance/connect/{name}        (apikey da inst) → QR/pairing
 *  - GET    /instance/connectionState/{name}(apikey da inst) → estado (open|connecting|close)
 *  - POST   /message/sendText/{name}        (apikey da inst) → { number, text }
 *  - DELETE /instance/logout|delete/{name}  (apikey da inst)
 */
@Injectable()
export class EvolutionGateway implements EvolutionGatewayPort {
  private readonly logger = new Logger(EvolutionGateway.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string | undefined {
    return this.config.get<string>('EVOLUTION_API_URL')?.replace(/\/+$/, '');
  }

  private get globalKey(): string | undefined {
    return this.config.get<string>('EVOLUTION_API_KEY');
  }

  canCreateInstances(): boolean {
    return !!this.baseUrl && !!this.globalKey;
  }

  sharedInstance(): { instanceName: string; apiKey: string } | null {
    const instanceName = this.config.get<string>('EVOLUTION_SHARED_INSTANCE');
    const apiKey = this.config.get<string>('EVOLUTION_SHARED_APIKEY');
    if (!this.baseUrl || !instanceName || !apiKey) {
      return null;
    }
    return { instanceName, apiKey };
  }

  async createInstance(instanceName: string): Promise<EvolutionInstanceCreated> {
    const { data } = await axios.post(
      `${this.baseUrl}/instance/create`,
      { instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true },
      { headers: { apikey: this.globalKey as string } },
    );
    // `hash` pode vir como string ou { apikey }; o QR vem em qrcode.base64.
    const apiKey =
      typeof data?.hash === 'string' ? data.hash : (data?.hash?.apikey ?? data?.instance?.apikey);
    const qrBase64 = data?.qrcode?.base64 ?? null;
    return { apiKey, qrBase64 };
  }

  async connect(instanceName: string, apiKey: string): Promise<EvolutionConnectInfo> {
    const { data } = await axios.get(`${this.baseUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: apiKey },
    });
    const qrBase64 = data?.base64 ?? data?.qrcode?.base64 ?? null;
    return { qrBase64, connected: false };
  }

  async isConnected(instanceName: string, apiKey: string): Promise<boolean> {
    const { data } = await axios.get(
      `${this.baseUrl}/instance/connectionState/${instanceName}`,
      { headers: { apikey: apiKey } },
    );
    return (data?.instance?.state ?? data?.state) === 'open';
  }

  async sendText(instanceName: string, apiKey: string, phone: string, text: string): Promise<void> {
    let number = phone.replace(/\D/g, '');
    if (!number.startsWith('55') && number.length === 11) {
      number = `55${number}`;
    }
    await axios.post(
      `${this.baseUrl}/message/sendText/${instanceName}`,
      { number, text },
      { headers: { apikey: apiKey } },
    );
  }

  async deleteInstance(instanceName: string, apiKey: string): Promise<void> {
    const headers = { apikey: apiKey };
    await axios
      .delete(`${this.baseUrl}/instance/logout/${instanceName}`, { headers })
      .catch(() => undefined);
    await axios
      .delete(`${this.baseUrl}/instance/delete/${instanceName}`, { headers })
      .catch((e) => this.logger.warn('Falha ao deletar instância Evolution', { instanceName, e: e?.message }));
  }
}
