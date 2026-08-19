import { Product } from '../../../domain/entities/product.entity';
import { ProductId } from '../../../domain/value-objects/product-id.vo';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ListProductsFilter {
  /** Texto livre: casa com nome, SKU, marca, GTIN ou categoria. */
  search?: string | null;
  /** Filtro de tipo — produto ou serviço. */
  kind?: string | null;
  /** Filtro por categoria (prefixo do caminho, já que a árvore não existe). */
  categoryPath?: string | null;
  includeInactive?: boolean;
}

/**
 * O repositório de produtos.
 *
 * **Nenhum método recebe `accountId`, e a ausência é a garantia.** O escopo de tenant é estabelecido
 * pelo `JwtAuthGuard` na transação da requisição e aplicado em duas camadas — filtro global do
 * MikroORM e RLS no Postgres. Um parâmetro `accountId` aqui seria uma terceira fonte de verdade sobre
 * "de quem é este dado", e a terceira sempre é a que alguém esquece de passar.
 */
export interface ProductRepositoryPort {
  findById(id: ProductId): Promise<Product | null>;
  /** Para a regra de SKU único por conta. Ignora o próprio produto na edição. */
  findBySku(sku: string, exceptId?: ProductId): Promise<Product | null>;
  findByBarcode(barcode: string, exceptId?: ProductId): Promise<Product | null>;
  list(filter: ListProductsFilter): Promise<Product[]>;
  save(product: Product): Promise<Product>;
}
