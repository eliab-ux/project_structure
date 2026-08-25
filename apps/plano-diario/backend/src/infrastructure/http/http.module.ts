import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../contexts/auth/auth.module';
import { CatalogModule } from '../../contexts/catalog/catalog.module';
import { DispatchModule } from '../../contexts/dispatch/dispatch.module';
import { ScheduleModule } from '../../contexts/schedule/schedule.module';
import { UserModule } from '../../contexts/user/user.module';
import { WhatsappModule } from '../../contexts/whatsapp/whatsapp.module';
import { PlanSettings } from '../../shared/plan/plan-settings';
import { AuthController } from './controllers/auth/auth.controller';
import {
  AdminCatalogController,
  CatalogController,
} from './controllers/catalog/catalog.controller';
import { DispatchController } from './controllers/dispatch/dispatch.controller';
import { HealthController } from './controllers/health/health.controller';
import { ScheduleController } from './controllers/schedule/schedule.controller';
import { WhatsappController } from './controllers/whatsapp/whatsapp.controller';

/**
 * HTTP adapter: liga cada controller aos use cases exportados pelos bounded contexts.
 * Rotas públicas: `/api/health` e os endpoints de entrada do auth (register, login, refresh,
 * forgot-password, reset-password) — cada um com o motivo documentado no próprio método.
 * Todo o resto exige JWT.
 */
@Module({
  imports: [
    ConfigModule,
    UserModule,
    AuthModule,
    CatalogModule,
    WhatsappModule,
    ScheduleModule,
    DispatchModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    CatalogController,
    AdminCatalogController,
    WhatsappController,
    ScheduleController,
    DispatchController,
  ],
  providers: [PlanSettings],
})
export class HttpModule {}
