import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigService } from '@nestjs/config';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { UNIT_OF_WORK } from './ports/unit-of-work.port';
import { EVENT_PUBLISHER } from './ports/event-publisher.port';
import { MikroOrmUnitOfWork } from './mikro-orm/unit-of-work';
import { ScopedRawQueryService } from './mikro-orm/scoped-raw-query.service';
import { DomainEventPublisher } from '../messaging/publishers/domain-event.publisher';
import { createMikroOrmConfig } from './mikro-orm/config/mikro-orm.config';

@Global()
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      inject: [ConfigService],
      driver: PostgreSqlDriver,
      useFactory: (configService: ConfigService) => ({
        ...createMikroOrmConfig(configService),
        // Wraps every request in a RequestContext, which FORKS the EntityManager. This is what
        // makes the tenant scope safe under concurrency: `setFilterParams` then touches only the
        // current request's fork. Without it, simultaneous requests share one EM and one account's
        // scope leaks into another — a failure that never shows up in a sequential test. It is the
        // default; stated explicitly so nobody "cleans it up" later.
        registerRequestContext: true,
      }),
    }),
  ],
  providers: [
    { provide: UNIT_OF_WORK, useClass: MikroOrmUnitOfWork },
    { provide: EVENT_PUBLISHER, useClass: DomainEventPublisher },
    // The only authorised entry point for raw SQL over tenant data — see its docblock.
    ScopedRawQueryService,
  ],
  exports: [UNIT_OF_WORK, EVENT_PUBLISHER, ScopedRawQueryService],
})
export class PersistenceModule {}
