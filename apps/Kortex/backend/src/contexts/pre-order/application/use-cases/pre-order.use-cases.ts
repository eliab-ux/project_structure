import { Inject, Injectable } from '@nestjs/common';
import {
  PRE_ORDER_REPOSITORY,
  PreOrderRepositoryPort,
} from '../ports/output/pre-order-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../infrastructure/persistence/ports/unit-of-work.port';
import { PreOrderDto } from '../dto/pre-order.dto';
import { ReferenceResolver, fabricRefOrPlaceholder, refOrPlaceholder } from '../reference-resolver';
import { PreOrder, PreOrderStatus } from '../../domain/entities/pre-order.entity';
import {
  NoCutHistoryForAdminException,
  PreOrderNotFoundException,
} from '../../domain/exceptions/pre-order.exceptions';
import { PreOrderId } from '../../domain/value-objects/pre-order-id.vo';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../customer/domain/value-objects/customer-id.vo';
import { FabricId } from '../../../catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../catalog/domain/value-objects/product-type-id.vo';
import { UserId } from '../../../user/domain/value-objects/user-id.vo';
import { UserRole } from '../../../user/domain/value-objects/user-role.vo';
import { CUT_HISTORY, CutHistoryPort } from '../ports/output/cut-history.port';
import {
  FABRIC_REPOSITORY,
  FabricRepositoryPort,
} from '../../../catalog/application/ports/output/catalog-repository.port';
import { FabricNotFoundException } from '../../../catalog/domain/exceptions/catalog.exceptions';
import { LayoutType } from '../../../../shared/domain/value-objects/layout-type';

/** Uma matriz declarada, como chega da tela. */
export interface MatrizInputDto {
  fabricId: string;
  productTypeId: string;
  estimatedPieces: number;
  metersPerPiece?: number | null;
  rolls?: number | null;
  estimatedLayers?: number | null;
  estimatedLayoutType?: string | null;
}

export interface PreOrderInput {
  customerId: string;
  /** Ao menos uma. O domínio recusa pedido sem matriz — não descreve trabalho nenhum. */
  matrizes: MatrizInputDto[];
  estimatedHours: number;
  notes?: string | null;
}

@Injectable()
export class PreOrderUseCases {
  constructor(
    @Inject(PRE_ORDER_REPOSITORY)
    private readonly preOrderRepository: PreOrderRepositoryPort,
    private readonly references: ReferenceResolver,
    @Inject(FABRIC_REPOSITORY)
    private readonly fabricRepository: FabricRepositoryPort,
    // Histórico de cortes do tecido — o que autoriza o Administrativo a estimar (regra 6.1).
    @Inject(CUT_HISTORY)
    private readonly cutHistory: CutHistoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  /** Painel do Administrativo. Sem filtro = abertos, que é o que ele precisa resolver. */
  async list(accountId: string, statuses?: PreOrderStatus[]): Promise<PreOrderDto[]> {
    const account = AccountId.from(accountId);
    const preOrders = await this.preOrderRepository.listByAccount(account, statuses);
    return this.toDtos(account, preOrders);
  }

  /** Quantos pedidos esperam reserva — alimenta o balão do menu. */
  async countOpen(accountId: string): Promise<number> {
    return this.preOrderRepository.countOpen(AccountId.from(accountId));
  }

  /** App do Modelista: o que ELE avaliou. */
  async listMine(accountId: string, userId: string): Promise<PreOrderDto[]> {
    const account = AccountId.from(accountId);
    const preOrders = await this.preOrderRepository.listByCreator(account, UserId.from(userId));
    return this.toDtos(account, preOrders);
  }

  /**
   * Criar pedido.
   *
   * Modelista e dono criam sempre. O **Administrativo só cria para tecido com histórico** — a
   * regra 6.1 protege a PRIMEIRA estimativa, que é conhecimento de quem está na máquina; a
   * segunda em diante está no sistema (mediana de camadas, peças e minutos por 100 peças).
   */
  async create(
    accountId: string,
    createdByUserId: string,
    actorRole: UserRole,
    input: PreOrderInput,
  ): Promise<PreOrderDto> {
    const account = AccountId.from(accountId);

    // A regra 6.1 vale POR MATRIZ: basta um tecido estreante para o Administrativo ser barrado.
    // Verificar só a primeira deixaria o segundo material entrar sem estimativa que o sustente.
    if (actorRole === 'admin') {
      for (const matriz of input.matrizes) {
        await this.assertHistoryForAdmin(account, FabricId.from(matriz.fabricId));
      }
    }

    const preOrder = PreOrder.create({
      accountId: account,
      customerId: CustomerId.from(input.customerId),
      matrizes: toMatrizes(input),
      createdByUserId: UserId.from(createdByUserId),
      estimate: toEstimate(input),
    });

    const saved = await this.unitOfWork.execute(async () => this.preOrderRepository.save(preOrder));
    return (await this.toDtos(account, [saved]))[0];
  }

  /**
   * O `actorRole` desce até a entidade: mudar `estimated_hours` é exclusivo do Modelista (§4.7),
   * e essa é a regra que o Administrativo não pode contornar nem sendo dono.
   */
  async update(
    accountId: string,
    actorRole: UserRole,
    preOrderId: string,
    input: PreOrderInput,
  ): Promise<PreOrderDto> {
    const account = AccountId.from(accountId);

    const preOrder = await this.preOrderRepository.findById(account, PreOrderId.from(preOrderId));
    if (!preOrder) {
      throw new PreOrderNotFoundException();
    }

    preOrder.update({
      actorRole,
      customerId: CustomerId.from(input.customerId),
      matrizes: toMatrizes(input),
      estimate: toEstimate(input),
    });

    const saved = await this.unitOfWork.execute(async () => this.preOrderRepository.save(preOrder));
    return (await this.toDtos(account, [saved]))[0];
  }

  async discard(accountId: string, preOrderId: string): Promise<PreOrderDto> {
    const account = AccountId.from(accountId);

    const preOrder = await this.preOrderRepository.findById(account, PreOrderId.from(preOrderId));
    if (!preOrder) {
      throw new PreOrderNotFoundException();
    }

    preOrder.discard();

    const saved = await this.unitOfWork.execute(async () => this.preOrderRepository.save(preOrder));
    return (await this.toDtos(account, [saved]))[0];
  }

  /**
   * O Administrativo só abre pedido para tecido com corte concluído (regra 6.1).
   *
   * A primeira estimativa de um tecido é conhecimento de quem está na máquina; da segunda em
   * diante ela está no sistema.
   */
  private async assertHistoryForAdmin(accountId: AccountId, fabricId: FabricId): Promise<void> {
    const fabric = await this.fabricRepository.findById(accountId, fabricId);
    if (!fabric) {
      throw new FabricNotFoundException();
    }
    if ((await this.cutHistory.countFinished(accountId, fabricId)) === 0) {
      throw new NoCutHistoryForAdminException(fabric.name);
    }
  }

  private async toDtos(accountId: AccountId, preOrders: PreOrder[]): Promise<PreOrderDto[]> {
    if (preOrders.length === 0) {
      return [];
    }

    const refs = await this.references.load(accountId);

    return preOrders.map((preOrder) =>
      PreOrderDto.fromDomain(preOrder, {
        customer: refOrPlaceholder(refs.customers, preOrder.customerId.value),
        createdBy: refOrPlaceholder(refs.users, preOrder.createdByUserId.value),
        // Funções e não valores: as matrizes de um pedido podem ter tecidos diferentes, e o mapa
        // já veio carregado de uma vez pelo `ReferenceResolver`.
        fabricOf: (fabricId) => fabricRefOrPlaceholder(refs.fabrics, fabricId),
        productTypeOf: (productTypeId) => refOrPlaceholder(refs.productTypes, productTypeId),
      }),
    );
  }
}

function toEstimate(input: PreOrderInput) {
  return {
    estimatedHours: input.estimatedHours,
    notes: input.notes ?? null,
  };
}

function toMatrizes(input: PreOrderInput) {
  return input.matrizes.map((matriz) => ({
    fabricId: FabricId.from(matriz.fabricId),
    productTypeId: ProductTypeId.from(matriz.productTypeId),
    estimate: {
      estimatedPieces: matriz.estimatedPieces,
      metersPerPiece: matriz.metersPerPiece ?? null,
      rolls: matriz.rolls ?? null,
      estimatedLayers: matriz.estimatedLayers ?? null,
      estimatedLayoutType: (matriz.estimatedLayoutType as LayoutType | null | undefined) ?? null,
    },
  }));
}
