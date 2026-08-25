import { Controller, Get } from '@nestjs/common';

/**
 * PUBLIC endpoint — intentionally NOT guarded by JwtAuthGuard.
 * Required by the Docker HEALTHCHECK / load balancer (CLAUDE.md standard): it exposes no
 * business data, only liveness. Keep the response shape stable ({ status: 'ok', ... }).
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; app: string; timestamp: string; uptime: number } {
    return {
      status: 'ok',
      app: process.env.APP_NAME ?? 'Ecoa',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }
}
