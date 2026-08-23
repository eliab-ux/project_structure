import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../ports/output/product-repository.port';
import { SUPPLIER_LOOKUP, SupplierLookupPort } from '../../ports/output/supplier-lookup.port';
import {
  PRODUCT_COMPONENT_REPOSITORY,
  ProductComponentRepositoryPort,
} from '../../ports/output/product-component-repository.port';
import { ProductId } from '../../../domain/value-objects/product-id.vo';
import { ProductDto } from '../../dto/product.dto';
import { ProductNotFoundException } from '../../../domain/exceptions/product-exceptions';

export class GetProductQuery {
  constructor(
    public readonly productId: string,
    public readonly activeModules: readonly string[],
  ) {}
}

@Injectable()
export class GetProductUseCase implements UseCase<GetProductQuery, ProductDto> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    @Inject(SUPPLIER_LOOKUP) private readonly suppliers: SupplierLookupPort,
    @Inject(PRODUCT_COMPONENT_REPOSITORY)
    private readonly components: ProductComponentRepositoryPort,
  ) {}

  async execute(query: GetProductQuery): Promise<ProductDto> {
    const product = await this.products.findById(ProductId.from(query.productId));
    if (!product) {
      // Id de outra conta cai aqui também: o filtro de tenant o torna invisível, e a resposta é a
      // mesma de um id que não existe — sem oráculo de existência entre contas.
      throw new ProductNotFoundException(query.productId);
    }

    const nomes = product.suppliers.length
      ? new Map(
          [...(await this.suppliers.findByIds(product.suppliers.map((s) => s.contactId)))].map(
            ([id, info]) => [id, info.name],
          ),
        )
      : new Map<string, string>();

    const dto = ProductDto.fromDomain(product, query.activeModules, nomes);
    if (product.format === 'bundle') {
      // A composição sai no GET por id — a tela de kit edita sobre o que EXISTE, nunca às cegas.
      dto.components = await this.components.findByParent(product.id.value);
    }
    return dto;
  }
}
