import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PacienteOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/paciente-orm.entity';
import { PacienteMapper } from '../../infrastructure/persistence/mikro-orm/mappers/paciente.mapper';
import { MikroOrmPacienteRepository } from '../../infrastructure/persistence/mikro-orm/repositories/paciente.repository';
import { PACIENTE_REPOSITORY } from './application/ports/output/paciente-repository.port';
import { CreatePacienteUseCase } from './application/use-cases/create-paciente/create-paciente.use-case';
import { ListPacientesUseCase } from './application/use-cases/list-pacientes/list-pacientes.use-case';
import { GetPacienteByHashUseCase } from './application/use-cases/get-paciente-by-hash/get-paciente-by-hash.use-case';
import { GetPacienteUseCase } from './application/use-cases/get-paciente/get-paciente.use-case';
import { UpdatePacienteUseCase } from './application/use-cases/update-paciente/update-paciente.use-case';
import { DeletePacienteUseCase } from './application/use-cases/delete-paciente/delete-paciente.use-case';
import { ListOnlinePacientesUseCase } from './application/use-cases/list-online-pacientes/list-online-pacientes.use-case';

@Module({
  imports: [MikroOrmModule.forFeature([PacienteOrmEntity])],
  providers: [
    PacienteMapper,
    { provide: PACIENTE_REPOSITORY, useClass: MikroOrmPacienteRepository },
    CreatePacienteUseCase,
    ListPacientesUseCase,
    GetPacienteByHashUseCase,
    GetPacienteUseCase,
    UpdatePacienteUseCase,
    DeletePacienteUseCase,
    ListOnlinePacientesUseCase,
  ],
  exports: [
    PACIENTE_REPOSITORY,
    CreatePacienteUseCase,
    ListPacientesUseCase,
    GetPacienteByHashUseCase,
    GetPacienteUseCase,
    UpdatePacienteUseCase,
    DeletePacienteUseCase,
    ListOnlinePacientesUseCase,
  ],
})
export class PacienteModule {}
