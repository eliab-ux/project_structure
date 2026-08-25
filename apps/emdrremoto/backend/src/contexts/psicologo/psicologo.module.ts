import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PsicologoOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/psicologo-orm.entity';
import { PsicologoMapper } from '../../infrastructure/persistence/mikro-orm/mappers/psicologo.mapper';
import { MikroOrmPsicologoRepository } from '../../infrastructure/persistence/mikro-orm/repositories/psicologo.repository';
import { PSICOLOGO_REPOSITORY } from './application/ports/output/psicologo-repository.port';
import { RegisterPsicologoUseCase } from './application/use-cases/register-psicologo/register-psicologo.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email/verify-email.use-case';

@Module({
  imports: [ConfigModule, MikroOrmModule.forFeature([PsicologoOrmEntity])],
  providers: [
    PsicologoMapper,
    { provide: PSICOLOGO_REPOSITORY, useClass: MikroOrmPsicologoRepository },
    RegisterPsicologoUseCase,
    VerifyEmailUseCase,
  ],
  exports: [PSICOLOGO_REPOSITORY, RegisterPsicologoUseCase, VerifyEmailUseCase],
})
export class PsicologoModule {}
