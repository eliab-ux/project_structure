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

export interface PreOrderInput {
  customerId: string;
  fabricId: string;
  productTypeId: string;
  estimatedPieces: number;
  metersPerPiece?: number | null;
  rolls?: number | null;
  estimatedLayers?: number | null;
  estimatedLayoutType?: string | null;
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
    const fabricId = FabricId.from(input.fabricId);

    if (actorRole === 'admin') {
      const fabric = await this.fabricRepository.findById(account, fabricId);
      if (!fabric) {
        throw new FabricNotFoundException();
      }
      if ((await this.cutHistory.countFinished(account, fabricId)) === 0) {
        throw new NoCutHistoryForAdminException(fabric.name);
      }
    }

    const preOrder = PreOrder.create({
      accountId: account,
      customerId: CustomerId.from(input.customerId),
      fabricId,
      productTypeId: ProductTypeId.from(input.productTypeId),
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
      fabricId: FabricId.from(input.fabricId),
      productTypeId: ProductTypeId.from(input.productTypeId),
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

  private async toDtos(accountId: AccountId, preOrders: PreOrder[]): Promise<PreOrderDto[]> {
    if (preOrders.length === 0) {
      return [];
    }

    const refs = await this.references.load(accountId);

    return preOrders.map((preOrder) =>
      PreOrderDto.fromDomain(preOrder, {
        customer: refOrPlaceholder(refs.customers, preOrder.customerId.value),
        fabric: fabricRefOrPlaceholder(refs.fabrics, preOrder.fabricId.value),
        productType: refOrPlaceholder(refs.productTypes, preOrder.productTypeId.value),
        createdBy: refOrPlaceholder(refs.users, preOrder.createdByUserId.value),
      }),
    );
  }
}

function toEstimate(input: PreOrderInput) {
  return {
    estimatedPieces: input.estimatedPieces,
    metersPerPiece: input.metersPerPiece ?? null,
    rolls: input.rolls ?? null,
    estimatedLayers: input.estimatedLayers ?? null,
    estimatedLayoutType: (input.estimatedLayoutType as LayoutType | null | undefined) ?? null,
    estimatedHours: input.estimatedHours,
    notes: input.notes ?? null,
  };
}
