import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomUUID } from 'crypto';
import {
  VideoGatewayPort,
  VideoRoom,
} from '../../../contexts/session/application/ports/output/video-gateway.port';

const DAILY_API = 'https://api.daily.co/v1';
const ROOM_TTL_SECONDS = 2 * 60 * 60; // sala expira em 2h

/**
 * Adapter concreto do Daily.co. Se DAILY_CO_API_KEY não estiver configurada (dev/local),
 * cai num modo stub que devolve uma sala fake — a aplicação continua funcionando.
 * Fail Securely: uma falha na API não vaza detalhes ao cliente (só loga internamente).
 */
@Injectable()
export class DailyCoVideoGateway implements VideoGatewayPort {
  private readonly logger = new Logger(DailyCoVideoGateway.name);

  constructor(private readonly config: ConfigService) {}

  async createRoom(): Promise<VideoRoom> {
    const apiKey = this.config.get<string>('DAILY_CO_API_KEY');
    const name = randomUUID();

    if (!apiKey) {
      this.logger.warn('DAILY_CO_API_KEY ausente — usando sala stub (dev).');
      return { name, url: `https://example.daily.co/${name}` };
    }

    const exp = Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS;
    const { data } = await axios.post(
      `${DAILY_API}/rooms`,
      { name, properties: { exp, enable_chat: true, max_participants: 2 } },
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    return { name: data.name, url: data.url };
  }

  async deleteRoom(name: string): Promise<void> {
    const apiKey = this.config.get<string>('DAILY_CO_API_KEY');
    if (!apiKey) {
      return;
    }
    await axios.delete(`${DAILY_API}/rooms/${name}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }
}
