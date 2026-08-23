import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { LateChargeParamsPort } from '../../../../contexts/finance/application/ports/output/late-charge-params.port';
import { LateChargeParams } from '../../../../contexts/finance/domain/late-charges';
import { AccountOrmEntity } from '../entities/account-orm.entity';
import { TenantContextService } from '../../../security/tenant-context.service';

/**
 * Lê juros/multa da conta atual (§2.1 do 05). O id vem do escopo de tenant do token
 * (`TenantContextService`), nunca de parâmetro. Conta ausente → parâmetros zerados (sem encargo).
 */
@Injectable()
export class LateChargeParamsReader implements LateChargeParamsPort {
  constructor(
    private readonly em: EntityManager,
    private readonly tenant: TenantContextService,
  ) {}

  async forCurrentAccount(): Promise<LateChargeParams> {
    const account = await this.em.findOne(AccountOrmEntity, { id: this.tenant.requireAccountId() });
    return {
      monthlyInterestPercent: account ? Number(account.finMonthlyInterestPercent) : 0,
      finePercent: account ? Number(account.finFinePercent) : 0,
    };
  }
}
