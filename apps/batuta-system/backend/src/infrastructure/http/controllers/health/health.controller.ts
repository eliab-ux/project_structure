import { Controller, Get } from '@nestjs/common';
import { HealthResponseDto } from './dto/health-response.dto';

/**
 * PUBLIC endpoint — intentionally NOT guarded (no JwtAuthGuard).
 * Required by the Docker HEALTHCHECK and by the Traefik/Dokploy probe: it exposes only
 * liveness (no tenant data, no counts, no configuration). Keep the response shape stable.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponseDto {
    return HealthResponseDto.ok(process.env.BATUTA_APP_NAME ?? 'Batuta');
  }
}
