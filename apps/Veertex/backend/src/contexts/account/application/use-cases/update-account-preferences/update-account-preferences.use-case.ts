import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../ports/output/account-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { AccountDto } from '../../dto/account.dto';
import { AccountId } from '../../../domain/value-objects/account-id.vo';
import { CodeNumberingMode } from '../../../domain/value-objects/account-preferences.vo';
import { AccountNotFoundException } from '../../../domain/exceptions/account-not-found.exception';
import { PreferenceNotAvailableException } from '../../../domain/exceptions/preference-not-available.exception';

export class UpdateAccountPreferencesCommand {
  constructor(
    public readonly accountId: string,
    public readonly changes: {
      allowDuplicateDocument?: boolean;
      contactCodeMode?: CodeNumberingMode;
      productSkuMode?: CodeNumberingMode;
      contactCarteirizacao?: boolean;
      stockAllowNegative?: boolean;
    },
  ) {}
}

/**
 * Edita as preferências da conta (§1 do 01A).
 *
 * A POLÍTICA de quais valores são aceitos HOJE mora aqui, não no VO: o VO conhece o conjunto de
 * valores possíveis (`manual | sequential`, `true | false`); esta camada conhece o que a
 * implementação sustenta. Os dois guardas abaixo recusam LOUD, para não deixar toggle inerte (ver
 * `PreferenceNotAvailableException`). Quando a geração sequencial e o relaxamento do índice
 * existirem, os guardas saem — e a remoção é o lembrete de que o comportamento passou a valer.
 */
@Injectable()
export class UpdateAccountPreferencesUseCase implements UseCase<
  UpdateAccountPreferencesCommand,
  AccountDto
> {
  private readonly logger = new Logger(UpdateAccountPreferencesUseCase.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateAccountPreferencesCommand): Promise<AccountDto> {
    this.assertAvailable(command.changes);

    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    // Carteirização muda VISIBILIDADE de dado (§1 do 01A: "exige registro"). Até a trilha de
    // auditoria existir (item 12 do 01A), o registro mínimo é este log — sem dado sensível.
    if (
      command.changes.contactCarteirizacao !== undefined &&
      command.changes.contactCarteirizacao !== account.preferences.contactCarteirizacao
    ) {
      this.logger.log('Preferência de carteirização alterada', {
        accountId: command.accountId,
        contactCarteirizacao: command.changes.contactCarteirizacao,
      });
    }

    account.changePreferences(command.changes);

    return this.uow.execute(async () => {
      const saved = await this.accounts.save(account);
      return AccountDto.fromDomain(saved);
    });
  }

  private assertAvailable(changes: UpdateAccountPreferencesCommand['changes']): void {
    if (changes.contactCodeMode === 'sequential' || changes.productSkuMode === 'sequential') {
      throw new PreferenceNotAvailableException(
        'Numeração sequencial ainda não está disponível — use "manual".',
      );
    }
    if (changes.allowDuplicateDocument === true) {
      throw new PreferenceNotAvailableException(
        'Permitir documento duplicado não está disponível: o índice único de contatos garante a ' +
          'unicidade e não será relaxado sem necessidade. O padrão é não permitir.',
      );
    }
  }
}
