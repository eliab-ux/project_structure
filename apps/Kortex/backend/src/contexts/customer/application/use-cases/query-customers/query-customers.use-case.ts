import { Inject, Injectable } from '@nestjs/common';
import {
  CUSTOMER_REPOSITORY,
  CustomerRepositoryPort,
} from '../../ports/output/customer-repository.port';
import {
  CustomerDetailDto,
  CustomerForModelistaDto,
  CustomerListDto,
} from '../../dto/customer.dto';
import { CustomerNotFoundException } from '../../../domain/exceptions/customer-not-found.exception';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../domain/value-objects/customer-id.vo';

/**
 * As três leituras de cliente, juntas de propósito.
 *
 * Elas se diferenciam apenas pelo DTO, e é exatamente isso que precisa ficar visível num arquivo
 * só: o que o Administrativo vê, o que o Modelista vê, e o detalhe completo. Espalhadas em três
 * arquivos, a próxima pessoa acrescentaria um campo em duas e esqueceria a terceira — e a
 * esquecida seria a do Modelista, que é justamente a restritiva.
 */
@Injectable()
export class QueryCustomersUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepositoryPort,
  ) {}

  /** Listagem do Administrativo — sem número de documento algum (ver `CustomerListDto`). */
  async list(accountId: string): Promise<CustomerListDto[]> {
    const customers = await this.customerRepository.listByAccount(AccountId.from(accountId));
    return customers.map(CustomerListDto.fromDomain);
  }

  /** Detalhe completo — só `admin`/`owner` alcançam a rota. */
  async detail(accountId: string, customerId: string): Promise<CustomerDetailDto> {
    const customer = await this.customerRepository.findById(
      AccountId.from(accountId),
      CustomerId.from(customerId),
    );
    if (!customer) {
      throw new CustomerNotFoundException();
    }
    return CustomerDetailDto.fromDomain(customer);
  }

  /**
   * Lista servida ao Modelista: quatro campos e só os clientes ativos.
   *
   * O recorte acontece no DTO **e** a consulta é a de ativos: ele escolhe cliente para pré-pedido
   * (Fase 3), e oferecer um cliente inativo seria oferecer trabalho que o Administrativo já
   * encerrou.
   */
  async listForModelista(accountId: string): Promise<CustomerForModelistaDto[]> {
    const customers = await this.customerRepository.listActiveByAccount(AccountId.from(accountId));
    return customers.map(CustomerForModelistaDto.fromDomain);
  }
}
