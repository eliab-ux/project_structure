import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import {
  CannotDisableSelfException,
  UserNotFoundException,
} from '../../../domain/exceptions/user-exceptions';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { UserDto } from '../../dto/user.dto';
import { RoleAdministrationPolicy } from '../../../../role/application/policies/role-administration.policy';

export class SetUserStatusCommand {
  constructor(
    public readonly userId: string,
    public readonly active: boolean,
    /** From the token — used to refuse self-disabling. */
    public readonly actingUserId: string,
  ) {}
}

/**
 * Enables or disables a user. There is no delete: their name is on orders, stock movements and
 * audit rows, and removing the row would orphan all of it.
 */
@Injectable()
export class SetUserStatusUseCase implements UseCase<SetUserStatusCommand, UserDto> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    private readonly roleAdministration: RoleAdministrationPolicy,
  ) {}

  async execute(command: SetUserStatusCommand): Promise<UserDto> {
    const user = await this.users.findById(UserId.from(command.userId));
    if (!user) {
      throw new UserNotFoundException();
    }

    if (!command.active) {
      if (user.id.value === command.actingUserId) {
        throw new CannotDisableSelfException();
      }

      // Simulado antes de desabilitar. A checagem anterior olhava `isAdministrative` (curinga `*`)
      // e não via o último usuário de um papel com `roles.update` explícito — ver
      // `RoleAdministrationPolicy`.
      await this.roleAdministration.assertSurvives({
        kind: 'user-status',
        userId: user.id.value,
        active: false,
      });

      user.disable();
    } else {
      user.enable();
    }

    return this.uow.execute(async () => {
      const saved = await this.users.save(user);
      return UserDto.fromDomain(saved);
    });
  }
}
