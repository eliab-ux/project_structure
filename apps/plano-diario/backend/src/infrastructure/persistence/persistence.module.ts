import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigService } from '@nestjs/config';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { DomainEventPublisher } from '../messaging/publishers/domain-event.publisher';
import { createMikroOrmConfig } from './mikro-orm/config/mikro-orm.config';
import { EVENT_PUBLISHER } from './ports/event-publisher.port';
import { UNIT_OF_WORK } from './ports/unit-of-work.port';
import { MikroOrmUnitOfWork } from './mikro-orm/unit-of-work';

@Global()
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      inject: [ConfigService],
      driver: PostgreSqlDriver,
      useFactory: (configService: ConfigService) =>
        createMikroOrmConfig((key) => configService.get<string>(key)),
    }),
  ],
  providers: [
    { provide: UNIT_OF_WORK, useClass: MikroOrmUnitOfWork },
    { provide: EVENT_PUBLISHER, useClass: DomainEventPublisher },
  ],
  exports: [UNIT_OF_WORK, EVENT_PUBLISHER],
})
export class PersistenceModule {}
