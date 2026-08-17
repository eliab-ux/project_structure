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
import { DocumentAlreadyInUseException } from '../../../domain/exceptions/document-already-in-use.exception';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../domain/value-objects/customer-id.vo';
import { CustomerInput, toCustomerData } from '../customer-input';

export class UpdateCustomerCommand {
  constructor(
    public readonly accountId: string,
    public readonly customerId: string,
    public readonly input: CustomerInput,
  ) {}
}

@Injectable()
export class UpdateCustomerUseCase implements UseCase<UpdateCustomerCommand, CustomerDetailDto> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateCustomerCommand): Promise<CustomerDetailDto> {
    const accountId = AccountId.from(command.accountId);

    const customer = await this.customerRepository.findById(
      accountId,
      CustomerId.from(command.customerId),
    );
    if (!customer) {
      throw new CustomerNotFoundException();
    }

    const data = toCustomerData(command.input);

    // Só checa duplicidade se o documento mudou — senão o próprio cliente seria o "duplicado".
    if (!data.document.equals(customer.document)) {
      const existing = await this.customerRepository.findByDocument(accountId, data.document);
      if (existing) {
        throw new DocumentAlreadyInUseException();
      }
    }

    customer.update(data);

    return this.unitOfWork.execute(async () => {
      const saved = await this.customerRepository.save(customer);
      return CustomerDetailDto.fromDomain(saved);
    });
  }
}
