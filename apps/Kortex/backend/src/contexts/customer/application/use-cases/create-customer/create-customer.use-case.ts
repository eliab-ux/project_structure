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
import { Customer } from '../../../domain/entities/customer.entity';
import { DocumentAlreadyInUseException } from '../../../domain/exceptions/document-already-in-use.exception';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { CustomerInput, toCustomerData } from '../customer-input';

export class CreateCustomerCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: CustomerInput,
  ) {}
}

@Injectable()
export class CreateCustomerUseCase implements UseCase<CreateCustomerCommand, CustomerDetailDto> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: CreateCustomerCommand): Promise<CustomerDetailDto> {
    const accountId = AccountId.from(command.accountId);
    const data = toCustomerData(command.input);

    // Consulta antes de inserir para dar um 400 explicado em vez de deixar o índice único
    // estourar — o erro do banco viraria 500 com nome de constraint na cara do operador.
    const existing = await this.customerRepository.findByDocument(accountId, data.document);
    if (existing) {
      throw new DocumentAlreadyInUseException();
    }

    const customer = Customer.create({ ...data, accountId });

    return this.unitOfWork.execute(async () => {
      const saved = await this.customerRepository.save(customer);
      return CustomerDetailDto.fromDomain(saved);
    });
  }
}
