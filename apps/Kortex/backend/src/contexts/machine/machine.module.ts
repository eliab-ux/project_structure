import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MachineOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/machine-orm.entity';
import { MachineMapper } from '../../infrastructure/persistence/mikro-orm/mappers/machine.mapper';
import { MikroOrmMachineRepository } from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-machine.repository';
import { MACHINE_REPOSITORY } from './application/ports/output/machine-repository.port';
import { ListMachinesUseCase } from './application/use-cases/list-machines/list-machines.use-case';
import { CreateMachineUseCase } from './application/use-cases/create-machine/create-machine.use-case';
import { UpdateMachineUseCase } from './application/use-cases/update-machine/update-machine.use-case';

@Module({
  imports: [MikroOrmModule.forFeature([MachineOrmEntity])],
  providers: [
    MachineMapper,
    { provide: MACHINE_REPOSITORY, useClass: MikroOrmMachineRepository },
    ListMachinesUseCase,
    CreateMachineUseCase,
    UpdateMachineUseCase,
  ],
  // MACHINE_REPOSITORY sai para a Fase 4 buscar o preço da máquina no ato da venda (2.9).
  exports: [ListMachinesUseCase, CreateMachineUseCase, UpdateMachineUseCase, MACHINE_REPOSITORY],
})
export class MachineModule {}
