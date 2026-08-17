import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BankAccountOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/bank-account-orm.entity';
import { FinancialCategoryOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/financial-category-orm.entity';
import { CashEntryOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/cash-entry-orm.entity';
import {
  BankAccountMapper,
  CashEntryMapper,
  FinancialCategoryMapper,
} from '../../infrastructure/persistence/mikro-orm/mappers/finance.mapper';
import {
  MikroOrmBankAccountRepository,
  MikroOrmCashEntryRepository,
  MikroOrmFinancialCategoryRepository,
} from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-finance.repository';
import { PreOrderModule } from '../pre-order/pre-order.module';
import { CASH_RECORDER } from '../schedule/application/ports/output/cash-recorder.port';
import {
  BANK_ACCOUNT_REPOSITORY,
  CASH_ENTRY_REPOSITORY,
  FINANCIAL_CATEGORY_REPOSITORY,
} from './application/ports/output/finance-repository.port';
import { FinanceUseCases } from './application/use-cases/finance.use-cases';

/**
 * O caixa.
 *
 * Este módulo **não importa** `ScheduleModule`: a dependência anda no sentido contrário. A agenda
 * declara o que precisa (`CASH_RECORDER`, no próprio contexto dela) e o financeiro implementa —
 * por isso o token vem de `schedule/` e é aqui que ele ganha uma classe. Importar a agenda de volta
 * fecharia um ciclo entre os dois módulos.
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([
      BankAccountOrmEntity,
      FinancialCategoryOrmEntity,
      CashEntryOrmEntity,
    ]),
    // ReferenceResolver — nomes de quem lançou e de quem cancelou.
    PreOrderModule,
  ],
  providers: [
    BankAccountMapper,
    FinancialCategoryMapper,
    CashEntryMapper,
    { provide: BANK_ACCOUNT_REPOSITORY, useClass: MikroOrmBankAccountRepository },
    { provide: FINANCIAL_CATEGORY_REPOSITORY, useClass: MikroOrmFinancialCategoryRepository },
    { provide: CASH_ENTRY_REPOSITORY, useClass: MikroOrmCashEntryRepository },
    FinanceUseCases,
    // `useExisting`, não `useClass`: é a MESMA instância. Duas instâncias fariam a checagem de
    // não-duplicação e a criação da entrada olharem estados diferentes dentro da transação.
    { provide: CASH_RECORDER, useExisting: FinanceUseCases },
  ],
  exports: [FinanceUseCases, CASH_RECORDER, CASH_ENTRY_REPOSITORY, BANK_ACCOUNT_REPOSITORY],
})
export class FinanceModule {}
