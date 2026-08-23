import { Module } from '@nestjs/common';
import { COMMISSION_SALES_LOOKUP } from './application/ports/output/commission-sales-lookup.port';
import { COMMISSION_PAYABLE } from './application/ports/output/commission-payable.port';
import { CommissionSalesLookup } from '../../infrastructure/persistence/mikro-orm/repositories/commission-sales.lookup';
import { AccountModule } from '../account/account.module';
import { CommissionPayableViaFinance } from '../../infrastructure/persistence/mikro-orm/repositories/commission-payable-via-finance.adapter';
import { FinanceModule } from '../finance/finance.module';
import { SetCommissionTiersUseCase } from './application/use-cases/set-commission-tiers/set-commission-tiers.use-case';
import { GetCommissionTiersUseCase } from './application/use-cases/get-commission-tiers/get-commission-tiers.use-case';
import { SetSalesTargetUseCase } from './application/use-cases/set-sales-target/set-sales-target.use-case';
import { ListSalesTargetsUseCase } from './application/use-cases/list-sales-targets/list-sales-targets.use-case';
import { ComputeModelACommissionUseCase } from './application/use-cases/compute-model-a/compute-model-a.use-case';
import { GenerateCommissionPayableUseCase } from './application/use-cases/generate-commission-payable/generate-commission-payable.use-case';

/**
 * Comissão (§2 do 02A). Os repositórios de faixa/meta vêm do @Global RepositoriesModule. O lookup de
 * "vendido" (soma de pedidos) é local; o `COMMISSION_PAYABLE` agora MATERIALIZA a conta a pagar no
 * FIN (saiu do no-op — `CommissionPayableViaFinance`, que usa o `CreateFinancialTitle` do FIN, daí o
 * import do `FinanceModule`). Só o Modelo A nasce agora; o B espera o ROT (viagem/carteira/acerto).
 */
@Module({
  imports: [FinanceModule, AccountModule],
  providers: [
    { provide: COMMISSION_SALES_LOOKUP, useClass: CommissionSalesLookup },
    { provide: COMMISSION_PAYABLE, useClass: CommissionPayableViaFinance },
    SetCommissionTiersUseCase,
    GetCommissionTiersUseCase,
    SetSalesTargetUseCase,
    ListSalesTargetsUseCase,
    ComputeModelACommissionUseCase,
    GenerateCommissionPayableUseCase,
  ],
  exports: [
    SetCommissionTiersUseCase,
    GetCommissionTiersUseCase,
    SetSalesTargetUseCase,
    ListSalesTargetsUseCase,
    ComputeModelACommissionUseCase,
    GenerateCommissionPayableUseCase,
  ],
})
export class CommissionModule {}
