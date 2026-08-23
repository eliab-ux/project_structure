import { PriceList } from '../../domain/entities/price-list.entity';
import { PriceListItem } from '../../domain/entities/price-list-item.entity';
import { PriceSource } from '../../domain/price-source';

export class PriceListItemDto {
  id!: string;
  productId!: string;
  price!: number;
  minQuantity!: number;

  static fromDomain(item: PriceListItem): PriceListItemDto {
    const dto = new PriceListItemDto();
    dto.id = item.id;
    dto.productId = item.productId;
    dto.price = item.price;
    dto.minQuantity = item.minQuantity;
    return dto;
  }
}

export class PriceListDto {
  id!: string;
  name!: string;
  active!: boolean;
  contactId!: string | null;
  salesRepId!: string | null;
  items!: PriceListItemDto[];
  createdAt!: Date;

  static fromDomain(priceList: PriceList): PriceListDto {
    const dto = new PriceListDto();
    dto.id = priceList.id;
    dto.name = priceList.name;
    dto.active = priceList.active;
    dto.contactId = priceList.contactId;
    dto.salesRepId = priceList.salesRepId;
    dto.items = priceList.items.map(PriceListItemDto.fromDomain);
    dto.createdAt = priceList.createdAt;
    return dto;
  }
}

export class ResolvedPriceDto {
  productId!: string;
  productName!: string;
  quantity!: number;
  unitPrice!: number;
  source!: PriceSource;
  /** Id da tabela que resolveu o preço, quando veio de uma (não da base). */
  priceListId!: string | null;

  static build(params: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    source: PriceSource;
    priceListId?: string | null;
  }): ResolvedPriceDto {
    const dto = new ResolvedPriceDto();
    dto.productId = params.productId;
    dto.productName = params.productName;
    dto.quantity = params.quantity;
    dto.unitPrice = params.unitPrice;
    dto.source = params.source;
    dto.priceListId = params.priceListId ?? null;
    return dto;
  }
}
