import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  VideoGatewayPort,
  VideoRoom,
} from '../../../contexts/session/application/ports/output/video-gateway.port';

/**
 * Default adapter (Fase 0–5): fakes a video room so the flow works without Daily.co.
 * Replaced by the real DailyCoVideoGateway in Fase 6 (só troca o provider do VIDEO_GATEWAY).
 */
@Injectable()
export class LoggerVideoGateway implements VideoGatewayPort {
  private readonly logger = new Logger(LoggerVideoGateway.name);

  async createRoom(): Promise<VideoRoom> {
    const name = randomUUID();
    this.logger.log('createRoom (stub)', { name });
    return { name, url: `https://example.daily.co/${name}` };
  }

  async deleteRoom(name: string): Promise<void> {
    this.logger.log('deleteRoom (stub)', { name });
  }
}
