import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  MACHINE_REPOSITORY,
  MachineRepositoryPort,
} from '../../ports/output/machine-repository.port';
import { MachineDto } from '../../dto/machine.dto';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';

export class ListMachinesQuery {
  constructor(public readonly accountId: string) {}
}

@Injectable()
export class ListMachinesUseCase implements UseCase<ListMachinesQuery, MachineDto[]> {
  constructor(
    @Inject(MACHINE_REPOSITORY)
    private readonly machineRepository: MachineRepositoryPort,
  ) {}

  async execute(query: ListMachinesQuery): Promise<MachineDto[]> {
    const machines = await this.machineRepository.listByAccount(AccountId.from(query.accountId));
    return machines.map(MachineDto.fromDomain);
  }
}
