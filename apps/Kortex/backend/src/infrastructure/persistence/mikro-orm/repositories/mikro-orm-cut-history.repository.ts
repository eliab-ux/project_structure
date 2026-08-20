import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { CutHistoryPort } from '../../../../contexts/pre-order/application/ports/output/cut-history.port';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { FabricId } from '../../../../contexts/catalog/domain/value-objects/fabric-id.vo';
import { CutOrmEntity } from '../entities/cut-orm.entity';

/**
 * Adapter do `CutHistoryPort` — lê a tabela `cut` a partir do contexto de pré-pedido.
 *
 * Atravessa contexto de propósito, e a persistência é o lugar certo para isso: importar o
 * `CutModule` no `PreOrderModule` fecharia um ciclo, porque o corte já importa o pré-pedido para
 * herdar tecido e produto. Aqui é leitura de contagem, sem regra nenhuma junto.
 */
@Injectable()
export class MikroOrmCutHistoryRepository implements CutHistoryPort {
  constructor(
    @InjectRepository(CutOrmEntity)
    private readonly repo: EntityRepository<CutOrmEntity>,
  ) {}

  async countFinished(accountId: AccountId, fabricId: FabricId): Promise<number> {
    // `endedAt` não nulo: matriz em andamento ainda não tem duração, e é a duração que sustenta a
    // estimativa. Contar corte aberto deixaria o Administrativo abrir pedido apoiado em nada.
    return this.repo.count({
      accountId: accountId.value,
      fabricId: fabricId.value,
      endedAt: { $ne: null },
    });
  }
}
