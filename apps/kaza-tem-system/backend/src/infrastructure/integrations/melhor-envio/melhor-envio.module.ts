import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MelhorEnvioClient } from './melhor-envio.client';
import { MelhorEnvioService } from './melhor-envio.service';
import { MELHOR_ENVIO_CLIENT } from './melhor-envio-client.port';

@Module({
  imports: [ConfigModule],
  providers: [
    MelhorEnvioClient,
    MelhorEnvioService,
    {
      provide: MELHOR_ENVIO_CLIENT,
      useClass: MelhorEnvioClient,
    },
  ],
  exports: [MelhorEnvioService, MELHOR_ENVIO_CLIENT],
})
export class MelhorEnvioModule {}
