import { InjectQueue, BullModule } from '@nestjs/bullmq';
import { Injectable, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { CatalogModule } from '../../contexts/catalog/catalog.module';
import { DispatchModule } from '../../contexts/dispatch/dispatch.module';
import { CatalogProcessor } from './catalog.processor';
import { DispatchProcessor } from './dispatch.processor';
import { DispatchRunner } from './dispatch-runner';
import {
  CATALOG_QUEUE,
  DISPATCH_QUEUE,
  JOB_CATALOG_SYNC,
  JOB_DISPATCH_TICK,
} from './jobs.constants';

/** Se o Redis não responder nesse tempo, o boot segue sem os jobs. */
const REGISTRATION_TIMEOUT_MS = 15_000;

/**
 * Registra os jobs repetíveis no start. Idempotente: o BullMQ identifica um repeatable pelo
 * `repeat` + `name`, então reiniciar o processo não duplica agendamento.
 */
@Injectable()
export class JobsBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobsBootstrap.name);

  constructor(
    @InjectQueue(DISPATCH_QUEUE) private readonly dispatchQueue: Queue,
    @InjectQueue(CATALOG_QUEUE) private readonly catalogQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  /**
   * NÃO bloqueia o boot. `onApplicationBootstrap` roda dentro do `app.listen()`, então esperar
   * aqui por um Redis inacessível impede a aplicação de servir HTTP — a API inteira cairia por
   * causa do agendador. Um Redis fora do ar deve custar só o envio automático.
   *
   * Registro roda em paralelo, com timeout e erro logado; nunca propaga.
   */
  onApplicationBootstrap(): void {
    void this.registerRepeatables();
  }

  private async registerRepeatables(): Promise<void> {
    try {
      await Promise.race([
        this.doRegister(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`timeout de ${REGISTRATION_TIMEOUT_MS}ms`)),
            REGISTRATION_TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (error) {
      this.logger.error(
        'Não foi possível registrar os jobs — o envio AUTOMÁTICO fica desligado. ' +
          'A API segue funcionando, e o "Enviar agora" também. Verifique REDIS_HOST/REDIS_PASSWORD.',
        { reason: (error as Error)?.message },
      );
    }
  }

  private async doRegister(): Promise<void> {
    const timezone = this.configService.get<string>('DEFAULT_TIMEZONE', 'America/Sao_Paulo');

    // Tick a cada minuto. Um único job para todos os usuários — trocar de horário não exige
    // reconciliar fila nenhuma.
    await this.dispatchQueue.add(
      JOB_DISPATCH_TICK,
      {},
      {
        repeat: { pattern: '* * * * *' },
        jobId: JOB_DISPATCH_TICK,
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    await this.catalogQueue.add(
      JOB_CATALOG_SYNC,
      {},
      {
        repeat: {
          pattern: this.configService.get<string>('CATALOG_SYNC_CRON', '0 3 * * *'),
          tz: timezone,
        },
        jobId: JOB_CATALOG_SYNC,
        removeOnComplete: 20,
        removeOnFail: 50,
      },
    );

    this.logger.log('Jobs repetíveis registrados', {
      dispatchTick: '* * * * *',
      catalogSync: this.configService.get<string>('CATALOG_SYNC_CRON', '0 3 * * *'),
      timezone,
    });
  }
}

/**
 * Só é importado quando há Redis (ver `isQueueEnabled`). Sem Redis a aplicação sobe sem envio
 * automático, em vez de falhar o boot — o que permite deployar antes de criar o serviço.
 */
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Prefixo próprio: sem ele as chaves seriam `bull:dispatch:*`, que colidiriam com as
        // filas de outro app caso o Redis seja compartilhado (foi o que aconteceu em dev,
        // quando o app pegou o Redis do Ecoa).
        prefix: config.get<string>('REDIS_PREFIX', 'plano-diario'),
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get<string | number>('REDIS_PORT', 6379)),
          username: config.get<string>('REDIS_USERNAME') || undefined,
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          // Exigido pelos workers do BullMQ (eles usam blocking commands).
          maxRetriesPerRequest: null,
          connectTimeout: 10_000,
          // Sem fila offline: um `add()` com Redis inacessível falha rápido em vez de ficar
          // pendurado esperando a conexão voltar.
          enableOfflineQueue: false,
        },
      }),
    }),
    BullModule.registerQueue({ name: DISPATCH_QUEUE }, { name: CATALOG_QUEUE }),
    DispatchModule,
    CatalogModule,
  ],
  providers: [DispatchProcessor, DispatchRunner, CatalogProcessor, JobsBootstrap],
})
export class JobsModule {}
