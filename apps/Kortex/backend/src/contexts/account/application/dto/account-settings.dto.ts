import { Account } from '../../domain/entities/account.entity';

export interface ReportOwnerDto {
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
}

/**
 * Configuração da conta como a tela de Configuração a consome. Mapeamento explícito: nada sai
 * daqui por acidente de acrescentarem um campo na entidade.
 */
export class AccountSettingsDto {
  id!: string;
  name!: string;
  city!: string;
  /** Fuso IANA. A agenda inteira é lida através dele. */
  timezone!: string;
  reportOwner!: ReportOwnerDto | null;

  static fromDomain(account: Account): AccountSettingsDto {
    const dto = new AccountSettingsDto();
    dto.id = account.id.value;
    dto.name = account.name;
    dto.city = account.city;
    dto.timezone = account.timezone;

    const owner = account.reportOwner;
    dto.reportOwner = owner
      ? {
          name: owner.name,
          role: owner.role,
          phone: owner.phone?.value ?? null,
          email: owner.email?.value ?? null,
        }
      : null;

    return dto;
  }
}
