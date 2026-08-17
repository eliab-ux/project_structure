import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { UserDto } from '../../dto/user.dto';
import { UserNotFoundException } from '../../../domain/exceptions/user-not-found.exception';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';

export class ChangeOwnPhoneCommand {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
    public readonly phone: string,
  ) {}
}

/**
 * O usuário troca o PRÓPRIO telefone (spec §6.12).
 *
 * Livre para qualquer papel, inclusive `modelista` — que troca de chip como qualquer pessoa e não
 * alcança `/users` por causa do `AdminGuard`. Sem este caminho, ele dependeria de outra pessoa
 * para manter o próprio canal de recuperação de senha em dia.
 *
 * Não gera auditoria: não há terceiro envolvido, não há sequestro a reconstruir. O alvo vem
 * sempre do token — não existe parâmetro de "de quem" aqui.
 */
@Injectable()
export class ChangeOwnPhoneUseCase implements UseCase<ChangeOwnPhoneCommand, UserDto> {
  private readonly logger = new Logger(ChangeOwnPhoneUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: ChangeOwnPhoneCommand): Promise<UserDto> {
    const accountId = AccountId.from(command.accountId);
    const userId = UserId.from(command.userId);

    const user = await this.userRepository.findById(accountId, userId);
    if (!user) {
      throw new UserNotFoundException();
    }

    user.changeProfile({
      name: user.name,
      email: user.email,
      phone: PhoneE164.create(command.phone),
    });

    const saved = await this.unitOfWork.execute(async () => this.userRepository.save(user));

    // Sem o número no log: o canal de recuperação não precisa ser publicado no arquivo de log.
    this.logger.log('Telefone alterado pelo próprio usuário', { userId: user.id.value });

    return UserDto.fromDomain(saved);
  }
}
