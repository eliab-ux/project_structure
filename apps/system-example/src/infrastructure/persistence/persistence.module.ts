import { Module, Global } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigService } from '@nestjs/config';
import { UNIT_OF_WORK } from './ports/unit-of-work.port';
import { EVENT_PUBLISHER } from './ports/event-publisher.port';
import { MikroOrmUnitOfWork } from './mikro-orm/unit-of-work';
import { DomainEventPublisher } from '../messaging/publishers/domain-event.publisher';

@Global()
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mssql',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        user: configService.get('DB_USER'),
        password: configService.get('DB_PASSWORD'),
        dbName: configService.get('DB_NAME'),
        entities: ['./dist/**/*-orm.entity.js'],
        entitiesTs: ['./src/**/*-orm.entity.ts'],
        debug: configService.get('DB_LOGGING', false),
        migrations: {
          path: './src/infrastructure/persistence/mikro-orm/migrations',
        },
      }),
    }),
  ],
  providers: [
    {
      provide: UNIT_OF_WORK,
      useClass: MikroOrmUnitOfWork,
    },
    {
      provide: EVENT_PUBLISHER,
      useClass: DomainEventPublisher,
    },
  ],
  exports: [MikroOrmModule, UNIT_OF_WORK, EVENT_PUBLISHER],
})
export class PersistenceModule {}
