import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ListProductsFilter,
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../ports/output/product-repository.port';
import { ProductDto } from '../../dto/product.dto';

export class ListProductsQuery {
  constructor(
    public readonly activeModules: readonly string[],
    public readonly filter: ListProductsFilter = {},
  ) {}
}

/**
 * Lista produtos da conta.
 *
 * **Não busca nome de fornecedor**, e é decisão de custo: a lista mostra nome, SKU, preço e situação;
 * ninguém lê fornecedor numa grade. Resolver os nomes aqui seria uma consulta a mais por página para
 * um dado que a tela não exibe.
 */
@Injectable()
export class ListProductsUseCase implements UseCase<ListProductsQuery, ProductDto[]> {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort) {}

  async execute(query: ListProductsQuery): Promise<ProductDto[]> {
    const produtos = await this.products.list(query.filter);
    return produtos.map((product) => ProductDto.fromDomain(product, query.activeModules));
  }
}
