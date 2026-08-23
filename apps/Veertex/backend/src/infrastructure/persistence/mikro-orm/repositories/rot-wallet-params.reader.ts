import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { RotWalletParamsPort } from '../../../../contexts/route/application/ports/output/rot-wallet-params.port';
import { AccountOrmEntity } from '../entities/account-orm.entity';
import { TenantContextService } from '../../../security/tenant-context.service';

/**
 * Limiar de recobranças da conta atual (§3.4 do 04 — "1 cobrança + 3 recobranças", o 3 é
 * configurável). Lido pelo escopo de tenant do token, nunca por parâmetro. Conta ausente → 3.
 */
@Injectable()
export class RotWalletParamsReader implements RotWalletParamsPort {
  constructor(
    private readonly em: EntityManager,
    private readonly tenant: TenantContextService,
  ) {}

  async recollectionLimit(): Promise<number> {
    const account = await this.em.findOne(AccountOrmEntity, { id: this.tenant.requireAccountId() });
    return account ? account.rotRecollectionLimit : 3;
  }
}
