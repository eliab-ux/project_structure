import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../ports/output/product-repository.port';
import {
  PRODUCT_COMPONENT_REPOSITORY,
  ProductComponentRepositoryPort,
} from '../../ports/output/product-component-repository.port';
import { ProductId } from '../../../domain/value-objects/product-id.vo';
import {
  InvalidKitComponentException,
  NotABundleException,
  ProductNotFoundException,
} from '../../../domain/exceptions/product-exceptions';

export interface ComponentInput {
  componentProductId: string;
  quantity: number;
}

export class SetBundleComponentsCommand {
  constructor(
    public readonly accountId: string,
    public readonly productId: string,
    public readonly components: readonly ComponentInput[],
  ) {}
}

/**
 * Define a composição de um kit (§2.5 do 03 — "bundle volta ao Produto"). Guardas de domínio, todas
 * verificadas contra o banco (escopado):
 *
 *  - o produto pai precisa ser `bundle`;
 *  - cada componente existe, está ativo, e **NÃO é um kit** (sem kit-de-kit — a derivação de saldo
 *    seria recursiva e a baixa, ambígua);
 *  - o componente **não é o próprio kit** (composição circular trivial);
 *  - **quantidade > 0**.
 *
 * O kit NÃO tem saldo próprio: o disponível é derivado dos componentes pelo EST. Aqui só se guarda a
 * composição.
 */
@Injectable()
export class SetBundleComponentsUseCase implements UseCase<SetBundleComponentsCommand, void> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    @Inject(PRODUCT_COMPONENT_REPOSITORY)
    private readonly components: ProductComponentRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: SetBundleComponentsCommand): Promise<void> {
    const parent = await this.products.findById(ProductId.from(command.productId));
    if (!parent) {
      throw new ProductNotFoundException(command.productId);
    }
    if (parent.format !== 'bundle') {
      throw new NotABundleException();
    }

    for (const input of command.components) {
      if (input.quantity <= 0) {
        throw new InvalidKitComponentException(
          'A quantidade de cada componente deve ser maior que zero.',
        );
      }
      if (input.componentProductId === command.productId) {
        throw new InvalidKitComponentException('Um kit não pode conter ele mesmo.');
      }
      const component = await this.products.findById(ProductId.from(input.componentProductId));
      if (!component || !component.active) {
        throw new InvalidKitComponentException('Componente não encontrado ou inativo.');
      }
      if (component.format === 'bundle') {
        throw new InvalidKitComponentException(
          `"${component.name}" é um kit — kit de kit não é permitido.`,
        );
      }
    }

    await this.uow.execute(async () => {
      await this.components.replaceForParent(
        command.accountId,
        command.productId,
        command.components.map((c) => ({
          componentProductId: c.componentProductId,
          quantity: c.quantity,
        })),
      );
    });
  }
}
