import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigService } from '@nestjs/config';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { UNIT_OF_WORK } from './ports/unit-of-work.port';
import { MikroOrmUnitOfWork } from './mikro-orm/unit-of-work';
import { createMikroOrmConfig } from './mikro-orm/config/mikro-orm.config';

@Global()
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      inject: [ConfigService],
      driver: PostgreSqlDriver,
      useFactory: (configService: ConfigService) => ({
        ...createMikroOrmConfig(configService),
        // Envolve cada requisição num RequestContext, o que FORKA o EntityManager. É isso que
        // torna o escopo por conta seguro sob concorrência: sem o fork, requisições simultâneas
        // compartilham um EM e o escopo de uma conta vaza para outra — a falha que nunca aparece
        // num teste sequencial. É o default; explicitado para ninguém "limpar" depois.
        registerRequestContext: true,
      }),
    }),
  ],
  providers: [{ provide: UNIT_OF_WORK, useClass: MikroOrmUnitOfWork }],
  exports: [UNIT_OF_WORK],
})
export class PersistenceModule {}
