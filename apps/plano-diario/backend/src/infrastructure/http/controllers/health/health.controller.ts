import { Controller, Get } from '@nestjs/common';
import { isQueueEnabled } from '../../../jobs/jobs.constants';
import { readSchedulerState } from '../../../jobs/scheduler-state';

interface SchedulerHealth {
  /** O módulo de jobs foi carregado? `false` = não há Redis configurado no ambiente. */
  enabled: boolean;
  ticks: number;
  lastTickAt: string | null;
  lastDue: number;
  lastErrorAt: string | null;
}

/**
 * Endpoint PÚBLICO — intencionalmente SEM guard.
 * Necessário para o HEALTHCHECK do Docker / load balancer (padrão do CLAUDE.md): não expõe
 * nenhum dado de negócio, apenas liveness. Manter o shape da resposta estável.
 *
 * O bloco `scheduler` existe porque "o envio automático está rodando?" era impossível de responder
 * sem entrar no container e ler log. Três estados, e cada um aponta uma causa diferente:
 *   enabled=false            → REDIS_HOST ausente no ambiente; o agendador nem foi carregado;
 *   enabled=true, ticks=0    → módulo carregado mas o worker não consome (Redis inacessível);
 *   lastTickAt recente       → agendador vivo; se não enviou, a causa está no agendamento.
 *
 * Nada sensível: contadores e horários. Sem id de usuário, sem telefone, sem mensagem.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): {
    status: string;
    app: string;
    timestamp: string;
    uptime: number;
    scheduler: SchedulerHealth;
  } {
    return {
      status: 'ok',
      app: process.env.APP_NAME ?? 'Plano Diário',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      scheduler: { enabled: isQueueEnabled(), ...readSchedulerState() },
    };
  }
}
