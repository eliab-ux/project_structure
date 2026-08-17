import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { UserDto } from '../../dto/user.dto';
import { UserRole } from '../../../domain/value-objects/user-role.vo';
import { UserNotFoundException } from '../../../domain/exceptions/user-not-found.exception';
import { ForbiddenRoleAssignmentException } from '../../../domain/exceptions/forbidden-role-assignment.exception';
import { LastOwnerException } from '../../../domain/exceptions/last-owner.exception';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';

export class SetUserActiveCommand {
  constructor(
    public readonly accountId: string,
    public readonly actorRole: UserRole,
    public readonly actorUserId: string,
    public readonly userId: string,
    public readonly isActive: boolean,
  ) {}
}

@Injectable()
export class SetUserActiveUseCase implements UseCase<SetUserActiveCommand, UserDto> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: SetUserActiveCommand): Promise<UserDto> {
    const accountId = AccountId.from(command.accountId);

    const user = await this.userRepository.findById(accountId, UserId.from(command.userId));
    if (!user) {
      throw new UserNotFoundException();
    }

    if (user.role === 'owner' && command.actorRole !== 'owner') {
      throw new ForbiddenRoleAssignmentException();
    }

    if (!command.isActive) {
      // Duas travas contra a conta que ninguém mais consegue administrar. Não estão na spec, e
      // estão aqui porque a alternativa é uma conta órfã que só o acesso ao banco recupera —
      // exatamente o cenário que a regra 9 do CLAUDE.md descreve para senha, aplicado a papel.
      if (user.id.value === command.actorUserId) {
        throw new LastOwnerException('Você não pode inativar o próprio usuário.');
      }
      if (user.role === 'owner' && (await this.isLastActiveOwner(accountId, user.id))) {
        throw new LastOwnerException(
          'Esta é a única pessoa com papel de dono ativa. Promova outra antes de inativá-la.',
        );
      }
      user.deactivate();
    } else {
      user.activate();
    }

    return this.unitOfWork.execute(async () => {
      const saved = await this.userRepository.save(user);
      return UserDto.fromDomain(saved);
    });
  }

  private async isLastActiveOwner(accountId: AccountId, userId: UserId): Promise<boolean> {
    const users = await this.userRepository.listByAccount(accountId);
    return !users.some(
      (other) => other.role === 'owner' && other.isActive && other.id.value !== userId.value,
    );
  }
}
