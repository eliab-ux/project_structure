import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../ports/output/product-repository.port';
import { SUPPLIER_LOOKUP, SupplierLookupPort } from '../../ports/output/supplier-lookup.port';
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

    return ProductDto.fromDomain(product, query.activeModules, nomes);
  }
}
