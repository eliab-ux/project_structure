import { Inject, Injectable } from '@nestjs/common';
import {
  CUSTOMER_REPOSITORY,
  CustomerRepositoryPort,
} from '../../customer/application/ports/output/customer-repository.port';
import {
  FABRIC_REPOSITORY,
  FabricRepositoryPort,
  PRODUCT_TYPE_REPOSITORY,
  ProductTypeRepositoryPort,
} from '../../catalog/application/ports/output/catalog-repository.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../user/application/ports/output/user-repository.port';
import { AccountId } from '../../account/domain/value-objects/account-id.vo';
import { FabricRef, NamedRef } from './dto/pre-order.dto';

export interface ReferenceMaps {
  customers: Map<string, NamedRef>;
  fabrics: Map<string, FabricRef>;
  productTypes: Map<string, NamedRef>;
  users: Map<string, NamedRef>;
}

/**
 * Resolve os nomes que o pré-pedido e a fila de espera exibem (cliente, tecido, produto, autor).
 *
 * Carrega as quatro listas da conta INTEIRAS, uma vez, e monta um mapa. É o oposto de elegante
 * e é o certo aqui: são quatro consultas fixas em vez de quatro por linha (N+1), e o volume é o
 * de uma oficina — dezenas de clientes, um punhado de tecidos, uma equipe de quatro pessoas.
 *
 * A alternativa seria um join em SQL cru num read model. Vale a pena quando o volume justificar;
 * hoje custaria uma camada nova para resolver um problema que não existe.
 *
 * O nome do cliente exposto é o **fantasia** — é o que aparece na agenda e no relatório (§4.4),
 * e é o único campo de cliente que o Modelista pode ver junto de cidade, WhatsApp e observações.
 */
@Injectable()
export class ReferenceResolver {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepositoryPort,
    @Inject(FABRIC_REPOSITORY)
    private readonly fabricRepository: FabricRepositoryPort,
    @Inject(PRODUCT_TYPE_REPOSITORY)
    private readonly productTypeRepository: ProductTypeRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async load(accountId: AccountId): Promise<ReferenceMaps> {
    const [customers, fabrics, productTypes, users] = await Promise.all([
      this.customerRepository.listByAccount(accountId),
      this.fabricRepository.listByAccount(accountId),
      this.productTypeRepository.listByAccount(accountId),
      this.userRepository.listByAccount(accountId),
    ]);

    return {
      customers: new Map(
        customers.map((customer) => [
          customer.id.value,
          { id: customer.id.value, name: customer.tradeName },
        ]),
      ),
      fabrics: new Map(
        fabrics.map((fabric) => [
          fabric.id.value,
          {
            id: fabric.id.value,
            name: fabric.name,
            maxLayerHeightCm: fabric.maxLayerHeightCm,
            layerThicknessCm: fabric.layerThicknessCm,
          },
        ]),
      ),
      productTypes: new Map(
        productTypes.map((type) => [type.id.value, { id: type.id.value, name: type.name }]),
      ),
      users: new Map(users.map((user) => [user.id.value, { id: user.id.value, name: user.name }])),
    };
  }
}

/**
 * Referência para um id que não está no mapa.
 *
 * Não deveria acontecer — todas as FKs são `restrict` e nada é apagado — mas devolver um objeto
 * com o nome vazio é melhor do que estourar a listagem inteira por causa de uma linha. A tela
 * mostra "—" e a operação continua.
 */
export function refOrPlaceholder(map: Map<string, NamedRef>, id: string): NamedRef {
  return map.get(id) ?? { id, name: '—' };
}

export function fabricRefOrPlaceholder(map: Map<string, FabricRef>, id: string): FabricRef {
  return map.get(id) ?? { id, name: '—', maxLayerHeightCm: 0, layerThicknessCm: null };
}
