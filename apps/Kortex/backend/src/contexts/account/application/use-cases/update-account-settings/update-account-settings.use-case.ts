import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../ports/output/account-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { AccountSettingsDto } from '../../dto/account-settings.dto';
import { AccountNotFoundException } from '../../../domain/exceptions/account-not-found.exception';
import { AccountId } from '../../../domain/value-objects/account-id.vo';
import { ReportOwner } from '../../../domain/value-objects/report-owner.vo';

export class UpdateAccountSettingsCommand {
  constructor(
    public readonly accountId: string,
    public readonly name: string,
    public readonly city: string,
    public readonly timezone: string,
    public readonly reportOwner: {
      name: string;
      role?: string | null;
      phone?: string | null;
      email?: string | null;
    } | null,
  ) {}
}

@Injectable()
export class UpdateAccountSettingsUseCase implements UseCase<
  UpdateAccountSettingsCommand,
  AccountSettingsDto
> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateAccountSettingsCommand): Promise<AccountSettingsDto> {
    // A conta vem do token (o controller passa `user.accountId`), nunca do corpo da requisição:
    // aceitar o id do cliente aqui seria entregar a configuração de qualquer conta a quem
    // soubesse um uuid.
    const accountId = AccountId.from(command.accountId);

    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new AccountNotFoundException();
    }

    account.rename(command.name);
    account.changeCity(command.city);
    account.changeTimezone(command.timezone);
    account.changeReportOwner(command.reportOwner ? ReportOwner.create(command.reportOwner) : null);

    return this.unitOfWork.execute(async () => {
      const saved = await this.accountRepository.save(account);
      return AccountSettingsDto.fromDomain(saved);
    });
  }
}
