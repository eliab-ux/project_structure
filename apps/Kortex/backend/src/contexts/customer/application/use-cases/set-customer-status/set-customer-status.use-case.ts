import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CUSTOMER_REPOSITORY,
  CustomerRepositoryPort,
} from '../../ports/output/customer-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { CustomerDetailDto } from '../../dto/customer.dto';
import { CustomerNotFoundException } from '../../../domain/exceptions/customer-not-found.exception';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../domain/value-objects/customer-id.vo';

export class SetCustomerStatusCommand {
  constructor(
    public readonly accountId: string,
    public readonly customerId: string,
    public readonly active: boolean,
  ) {}
}

/** Ativa ou inativa. Nunca exclui: os cortes do cliente são o histórico do mês em que ele cortava. */
@Injectable()
export class SetCustomerStatusUseCase implements UseCase<
  SetCustomerStatusCommand,
  CustomerDetailDto
> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: SetCustomerStatusCommand): Promise<CustomerDetailDto> {
    const accountId = AccountId.from(command.accountId);

    const customer = await this.customerRepository.findById(
      accountId,
      CustomerId.from(command.customerId),
    );
    if (!customer) {
      throw new CustomerNotFoundException();
    }

    if (command.active) {
      customer.activate();
    } else {
      customer.deactivate();
    }

    return this.unitOfWork.execute(async () => {
      const saved = await this.customerRepository.save(customer);
      return CustomerDetailDto.fromDomain(saved);
    });
  }
}
