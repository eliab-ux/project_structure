import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  ROLE_REPOSITORY,
  RoleRepositoryPort,
} from '../../../../role/application/ports/output/role-repository.port';
import { RoleId } from '../../../../role/domain/value-objects/role-id.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import {
  CannotDisableSelfException,
  LastAdministratorException,
  UserNotFoundException,
} from '../../../domain/exceptions/user-exceptions';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { UserDto } from '../../dto/user.dto';

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
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
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

      const role = await this.roles.findById(RoleId.from(user.roleId));
      if (role?.isAdministrative && user.isActive) {
        const administrators = await this.users.countActiveAdministrators();
        if (administrators <= 1) {
          throw new LastAdministratorException();
        }
      }
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
