import { BusinessHour } from '../../../domain/entities/business-hour.entity';
import { AccountId } from '../../../domain/value-objects/account-id.vo';
import { BusinessHourId } from '../../../domain/value-objects/business-hour-id.vo';

export const BUSINESS_HOUR_REPOSITORY = Symbol('BUSINESS_HOUR_REPOSITORY');

/**
 * Toda operação recebe `accountId` explicitamente — inclusive as que já têm o id da janela.
 *
 * É deliberado. Sem RLS, o escopo é responsabilidade da aplicação (spec §0.6), e um
 * `findById(id)` sem conta é a assinatura que permite ler a janela de outro tenant se um id
 * vazar. Exigir a conta em toda assinatura faz o compilador cobrar o que a revisão esqueceria.
 */
export interface BusinessHourRepositoryPort {
  listByAccount(accountId: AccountId): Promise<BusinessHour[]>;
  listByAccountAndWeekday(accountId: AccountId, weekday: number): Promise<BusinessHour[]>;
  findById(accountId: AccountId, id: BusinessHourId): Promise<BusinessHour | null>;
  save(businessHour: BusinessHour): Promise<BusinessHour>;
  delete(accountId: AccountId, id: BusinessHourId): Promise<void>;
}
