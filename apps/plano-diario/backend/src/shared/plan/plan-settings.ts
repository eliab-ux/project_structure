import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Configuração default do plano, usada enquanto o usuário não tem agendamento próprio
 * (o `schedules` da Fase 5 passa a ser a fonte de verdade por usuário).
 *
 * O default (2026-01-01) foi confirmado contra seis pontos do histórico real do grupo. O plano
 * tem 365 leituras: 28/07 é "Dia 209 - Isaías 29-31" e 31/12 é "Dia 365 - Apocalipse 20-22".
 */
@Injectable()
export class PlanSettings {
  constructor(private readonly configService: ConfigService) {}

  get planStartDate(): string {
    return this.configService.get<string>('PLAN_START_DATE', '2026-01-01');
  }

  get dayOffset(): number {
    return Number(this.configService.get<string | number>('PLAN_DAY_OFFSET', 0));
  }

  get timezone(): string {
    return this.configService.get<string>('DEFAULT_TIMEZONE', 'America/Sao_Paulo');
  }
}
