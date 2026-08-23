import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PRICE_LIST_REPOSITORY,
  PriceListRepositoryPort,
} from '../../ports/output/price-list-repository.port';
import {
  PRICE_PRODUCT_LOOKUP,
  PriceProductLookupPort,
} from '../../ports/output/price-product-lookup.port';
import { PriceList } from '../../../domain/entities/price-list.entity';
import { PriceSource } from '../../../domain/price-source';
import { ResolvedPriceDto } from '../../dto/price-list.dto';
import {
  PriceNotResolvableException,
  PriceListNotFoundException,
} from '../../../domain/exceptions/price-list-exceptions';

export class ResolvePriceQuery {
  constructor(
    public readonly productId: string,
    public readonly quantity: number,
    public readonly contactId?: string | null,
    public readonly salesRepId?: string | null,
  ) {}
}

/**
 * Resolve o preço unitário de um `(produto, quantidade)` pela PRIORIDADE do §3.2 do 02A:
 *
 *   1. tabela do CONTATO → 2. tabela do VENDEDOR → 3. preço BASE do produto.
 *
 * O rung "preço negociado no item" fica ANTES de tudo, mas é resolvido no build do item do pedido
 * (preço digitado na linha), não aqui — este use case é a fonte para quando NÃO há preço na linha.
 * Canal/PDV são rungs futuros (CAN/PDV), reservados no enum de origem.
 *
 * Dentro de uma tabela, o degrau vale: escolhe-se o item de MAIOR `minQuantity` que cabe na
 * quantidade. Entre várias tabelas do mesmo vínculo, vence a de menor preço (melhor para o cliente)
 * — desempate determinístico, não "a primeira que veio".
 */
@Injectable()
export class ResolvePriceUseCase implements UseCase<ResolvePriceQuery, ResolvedPriceDto> {
  constructor(
    @Inject(PRICE_LIST_REPOSITORY) private readonly priceLists: PriceListRepositoryPort,
    @Inject(PRICE_PRODUCT_LOOKUP) private readonly products: PriceProductLookupPort,
  ) {}

  async execute(query: ResolvePriceQuery): Promise<ResolvedPriceDto> {
    const product = await this.products.findById(query.productId);
    if (!product) {
      throw new PriceListNotFoundException();
    }
    const quantity = Math.max(1, query.quantity);

    // 1. Tabela do contato.
    if (query.contactId) {
      const byContact = this.bestPrice(
        await this.priceLists.findActiveByContact(query.contactId),
        query.productId,
        quantity,
      );
      if (byContact) {
        return ResolvedPriceDto.build({
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice: byContact.price,
          source: 'contact_list',
          priceListId: byContact.priceListId,
        });
      }
    }

    // 2. Tabela do vendedor.
    if (query.salesRepId) {
      const bySalesRep = this.bestPrice(
        await this.priceLists.findActiveBySalesRep(query.salesRepId),
        query.productId,
        quantity,
      );
      if (bySalesRep) {
        return ResolvedPriceDto.build({
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice: bySalesRep.price,
          source: 'sales_rep_list',
          priceListId: bySalesRep.priceListId,
        });
      }
    }

    // 3. Preço base do produto.
    if (product.basePrice !== null) {
      return ResolvedPriceDto.build({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: product.basePrice,
        source: 'base' as PriceSource,
        priceListId: null,
      });
    }

    throw new PriceNotResolvableException(product.name);
  }

  /** Melhor preço (menor) entre as tabelas candidatas, respeitando o degrau de cada uma. */
  private bestPrice(
    lists: PriceList[],
    productId: string,
    quantity: number,
  ): { price: number; priceListId: string } | null {
    let best: { price: number; priceListId: string } | null = null;
    for (const list of lists) {
      const price = list.priceFor(productId, quantity);
      if (price !== null && (best === null || price < best.price)) {
        best = { price, priceListId: list.id };
      }
    }
    return best;
  }
}
