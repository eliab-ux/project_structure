import { Global, Module } from '@nestjs/common';
import { PACIENTE_PRESENCE } from '../../contexts/paciente/application/ports/output/presence.port';
import { PresenceService } from './presence.service';

/**
 * Presença compartilhada: o SessionGateway (realtime) escreve; o dashboard (HTTP) lê via
 * PACIENTE_PRESENCE. Global para ser a MESMA instância (estado em memória).
 */
@Global()
@Module({
  providers: [PresenceService, { provide: PACIENTE_PRESENCE, useExisting: PresenceService }],
  exports: [PresenceService, PACIENTE_PRESENCE],
})
export class PresenceModule {}
