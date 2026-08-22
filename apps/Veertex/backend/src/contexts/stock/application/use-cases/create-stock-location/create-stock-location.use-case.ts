import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { DomainException } from '@gitspread/domain-primitives';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  STOCK_LOCATION_REPOSITORY,
  StockLocationRepositoryPort,
} from '../../ports/output/stock-location-repository.port';
import {
  CREATABLE_LOCATION_KINDS,
  StockLocation,
  StockLocationKind,
} from '../../../domain/entities/stock-location.entity';
import { StockLocationDto } from '../../dto/stock.dto';

export class CreateStockLocationCommand {
  constructor(
    public readonly accountId: string,
    public readonly companyId: string,
    public readonly kind: StockLocationKind,
    public readonly name: string,
  ) {}
}

/** Tipo de localização que o cadastro manual não cria (rep_load nasce no ROT; pdv reservado). */
export class LocationKindNotCreatableException extends DomainException {
  constructor(kind: string) {
    super(`Localização do tipo "${kind}" não é criada manualmente.`);
  }
}

/**
 * Cadastro manual de localização (§2 do 03A). Hoje só `warehouse` — `rep_load` chega pelo ROT e `pdv`
 * está reservado. O tipo é validado aqui, não só no DTO, porque a regra é de negócio (quem é dono do
 * tipo), não de forma.
 */
@Injectable()
export class CreateStockLocationUseCase implements UseCase<
  CreateStockLocationCommand,
  StockLocationDto
> {
  constructor(
    @Inject(STOCK_LOCATION_REPOSITORY) private readonly locations: StockLocationRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateStockLocationCommand): Promise<StockLocationDto> {
    if (!CREATABLE_LOCATION_KINDS.includes(command.kind)) {
      throw new LocationKindNotCreatableException(command.kind);
    }

    const location = StockLocation.create({
      accountId: command.accountId,
      companyId: command.companyId,
      kind: command.kind,
      name: command.name,
    });

    return this.uow.execute(async () => {
      const saved = await this.locations.save(location);
      return StockLocationDto.fromDomain(saved);
    });
  }
}
