import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  PRICE_LIST_REPOSITORY,
  PriceListRepositoryPort,
} from '../../ports/output/price-list-repository.port';
import { PriceList } from '../../../domain/entities/price-list.entity';
import { PriceListItem } from '../../../domain/entities/price-list-item.entity';
import { PriceListDto } from '../../dto/price-list.dto';

export interface PriceListItemInput {
  productId: string;
  price: number;
  minQuantity?: number | null;
}

export class CreatePriceListCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: {
      name: string;
      contactId?: string | null;
      salesRepId?: string | null;
      items: PriceListItemInput[];
    },
  ) {}
}

/** Cria uma tabela de preço com seus itens (§3.2 do 02A). */
@Injectable()
export class CreatePriceListUseCase implements UseCase<CreatePriceListCommand, PriceListDto> {
  constructor(
    @Inject(PRICE_LIST_REPOSITORY) private readonly priceLists: PriceListRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreatePriceListCommand): Promise<PriceListDto> {
    const priceList = PriceList.create({
      accountId: command.accountId,
      name: command.input.name,
      contactId: command.input.contactId ?? null,
      salesRepId: command.input.salesRepId ?? null,
      items: command.input.items.map((item) =>
        PriceListItem.create({
          productId: item.productId,
          price: item.price,
          minQuantity: item.minQuantity,
        }),
      ),
    });
    return this.uow.execute(async () => {
      const saved = await this.priceLists.save(priceList);
      return PriceListDto.fromDomain(saved);
    });
  }
}
