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
import { PriceListItem } from '../../../domain/entities/price-list-item.entity';
import { PriceListDto } from '../../dto/price-list.dto';
import { PriceListItemInput } from '../create-price-list/create-price-list.use-case';
import { PriceListNotFoundException } from '../../../domain/exceptions/price-list-exceptions';

export class UpdatePriceListCommand {
  constructor(
    public readonly id: string,
    public readonly input: {
      name?: string;
      active?: boolean;
      contactId?: string | null;
      salesRepId?: string | null;
      items?: PriceListItemInput[];
    },
  ) {}
}

/**
 * Edita cabeçalho e/ou itens de uma tabela de preço (§3.2 do 02A). Quando `items` vem, SUBSTITUI o
 * conjunto (mesmo padrão do pedido). `findById` primeiro, e é ele que isola por tenant.
 */
@Injectable()
export class UpdatePriceListUseCase implements UseCase<UpdatePriceListCommand, PriceListDto> {
  constructor(
    @Inject(PRICE_LIST_REPOSITORY) private readonly priceLists: PriceListRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: UpdatePriceListCommand): Promise<PriceListDto> {
    return this.uow.execute(async () => {
      const priceList = await this.priceLists.findById(command.id);
      if (!priceList) {
        throw new PriceListNotFoundException();
      }
      priceList.editHeader({
        name: command.input.name,
        active: command.input.active,
        contactId: command.input.contactId,
        salesRepId: command.input.salesRepId,
      });
      if (command.input.items !== undefined) {
        priceList.replaceItems(
          command.input.items.map((item) =>
            PriceListItem.create({
              productId: item.productId,
              price: item.price,
              minQuantity: item.minQuantity,
            }),
          ),
        );
      }
      const saved = await this.priceLists.save(priceList);
      return PriceListDto.fromDomain(saved);
    });
  }
}
