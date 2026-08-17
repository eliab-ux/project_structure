import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  MACHINE_REPOSITORY,
  MachineRepositoryPort,
} from '../../ports/output/machine-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { MachineDto } from '../../dto/machine.dto';
import { Machine } from '../../../domain/entities/machine.entity';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { Money } from '../../../../../shared/domain/value-objects/money.vo';

export class CreateMachineCommand {
  constructor(
    public readonly accountId: string,
    public readonly name: string,
    public readonly model: string | null,
    public readonly hourPriceCents: number,
  ) {}
}

@Injectable()
export class CreateMachineUseCase implements UseCase<CreateMachineCommand, MachineDto> {
  constructor(
    @Inject(MACHINE_REPOSITORY)
    private readonly machineRepository: MachineRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: CreateMachineCommand): Promise<MachineDto> {
    const machine = Machine.create({
      accountId: AccountId.from(command.accountId),
      name: command.name,
      model: command.model,
      hourPrice: Money.fromCents(command.hourPriceCents),
    });

    return this.unitOfWork.execute(async () => {
      const saved = await this.machineRepository.save(machine);
      return MachineDto.fromDomain(saved);
    });
  }
}
