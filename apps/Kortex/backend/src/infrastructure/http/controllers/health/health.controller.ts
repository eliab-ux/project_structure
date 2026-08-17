import { Controller, Get } from '@nestjs/common';
import { HealthResponseDto } from './dto/health-response.dto';

/**
 * Endpoint PÚBLICO — intencionalmente SEM guard.
 * Exigido pelo HEALTHCHECK do Docker e pela probe do Traefik/Dokploy: expõe apenas liveness
 * (nenhum dado de conta, nenhuma contagem, nenhuma configuração). Manter o formato estável.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponseDto {
    return HealthResponseDto.ok(process.env.KORTEX_APP_NAME ?? 'Kortex');
  }
}
