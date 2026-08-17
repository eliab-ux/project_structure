import { Inject, Injectable } from '@nestjs/common';
import { FABRIC_REPOSITORY, FabricRepositoryPort } from '../ports/output/catalog-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../infrastructure/persistence/ports/unit-of-work.port';
import { FabricDto } from '../dto/catalog.dto';
import { Fabric } from '../../domain/entities/fabric.entity';
import {
  CatalogNameAlreadyInUseException,
  FabricNotFoundException,
} from '../../domain/exceptions/catalog.exceptions';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { FabricId } from '../../domain/value-objects/fabric-id.vo';

export interface FabricInput {
  name: string;
  maxLayerHeightCm: number;
  /** Ausente = ainda não medida. Ver `Fabric`: nesse estado o sistema não avisa sobre altura. */
  layerThicknessCm?: number | null;
  notes?: string | null;
}

/**
 * Tecido: listar, criar e editar. Os três casos num arquivo porque são três linhas de lógica cada
 * um e a única regra real — nome único por conta — é compartilhada.
 */
@Injectable()
export class FabricUseCases {
  constructor(
    @Inject(FABRIC_REPOSITORY)
    private readonly fabricRepository: FabricRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async list(accountId: string): Promise<FabricDto[]> {
    const fabrics = await this.fabricRepository.listByAccount(AccountId.from(accountId));
    return fabrics.map(FabricDto.fromDomain);
  }

  async create(accountId: string, input: FabricInput): Promise<FabricDto> {
    const account = AccountId.from(accountId);

    const fabric = Fabric.create({ accountId: account, ...input });
    await this.assertNameIsFree(account, fabric.name, null);

    return this.unitOfWork.execute(async () => {
      const saved = await this.fabricRepository.save(fabric);
      return FabricDto.fromDomain(saved);
    });
  }

  async update(accountId: string, fabricId: string, input: FabricInput): Promise<FabricDto> {
    const account = AccountId.from(accountId);

    const fabric = await this.fabricRepository.findById(account, FabricId.from(fabricId));
    if (!fabric) {
      throw new FabricNotFoundException();
    }

    fabric.update(input);
    await this.assertNameIsFree(account, fabric.name, fabric.id.value);

    return this.unitOfWork.execute(async () => {
      const saved = await this.fabricRepository.save(fabric);
      return FabricDto.fromDomain(saved);
    });
  }

  /**
   * A checagem roda DEPOIS da entidade normalizar o nome (trim), não sobre a string crua: senão
   * `' Malha '` passaria pela verificação e esbarraria no índice único já dentro da transação.
   */
  private async assertNameIsFree(
    accountId: AccountId,
    name: string,
    ownId: string | null,
  ): Promise<void> {
    const existing = await this.fabricRepository.findByName(accountId, name);
    if (existing && existing.id.value !== ownId) {
      throw new CatalogNameAlreadyInUseException('tecido');
    }
  }
}
