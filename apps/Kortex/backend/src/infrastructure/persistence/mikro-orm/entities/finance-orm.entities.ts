/**
 * Este arquivo NÃO é descoberto pelo MikroORM: o glob de discovery é `*.entity.ts`, no singular.
 * As três entidades do financeiro vivem em arquivos próprios ao lado deste. Mantido apenas como
 * ponto de reexportação para os imports ficarem curtos.
 */
export { BankAccountOrmEntity } from './bank-account-orm.entity';
export { FinancialCategoryOrmEntity } from './financial-category-orm.entity';
export { CashEntryOrmEntity } from './cash-entry-orm.entity';
