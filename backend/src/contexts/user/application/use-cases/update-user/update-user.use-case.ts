import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  ROLE_REPOSITORY,
  RoleRepositoryPort,
} from '../../../../role/application/ports/output/role-repository.port';
import { RoleId } from '../../../../role/domain/value-objects/role-id.vo';
import { RoleNotFoundException } from '../../../../role/domain/exceptions/role-exceptions';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import {
  LastAdministratorException,
  UserAlreadyExistsException,
  UserNotFoundException,
} from '../../../domain/exceptions/user-exceptions';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { UserDto } from '../../dto/user.dto';

export class UpdateUserCommand {
  constructor(
    public readonly userId: string,
    public readonly name?: string,
    public readonly email?: string,
    public readonly phone?: string,
    public readonly roleId?: string,
  ) {}
}

/**
 * Edits a user's identification and role. Password is NOT here — changing it is its own flow, with
 * its own proof of identity (the current password, or a WhatsApp code).
 */
@Injectable()
export class UpdateUserUseCase implements UseCase<UpdateUserCommand, UserDto> {
  private readonly logger = new Logger(UpdateUserUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateUserCommand): Promise<UserDto> {
    const user = await this.users.findById(UserId.from(command.userId));
    if (!user) {
      throw new UserNotFoundException();
    }

    if (command.name !== undefined) {
      user.changeName(command.name);
    }

    if (command.email !== undefined) {
      const email = Email.create(command.email);
      const existing = await this.users.findByEmail(email);
      if (existing && existing.id.value !== user.id.value) {
        throw new UserAlreadyExistsException();
      }
      user.changeEmail(email);
    }

    if (command.phone !== undefined) {
      user.changePhone(PhoneE164.create(command.phone));
      // Security-relevant: this is where a recovery code will go from now on. Logged with the
      // masked number — never the full one (CLAUDE.md, regra de logs).
      this.logger.warn('WhatsApp do usuário alterado', {
        userId: user.id.value,
        phone: user.phone.masked,
      });
    }

    if (command.roleId !== undefined && command.roleId !== user.roleId) {
      const role = await this.roles.findById(RoleId.from(command.roleId));
      if (!role) {
        throw new RoleNotFoundException();
      }

      const currentRole = await this.roles.findById(RoleId.from(user.roleId));
      // Demoting the last active administrator would leave nobody able to manage users or roles,
      // and no path inside the product to undo it.
      if (currentRole?.isAdministrative && !role.isAdministrative) {
        const administrators = await this.users.countActiveAdministrators();
        if (administrators <= 1) {
          throw new LastAdministratorException();
        }
      }

      user.changeRole(role.id.value);
    }

    return this.uow.execute(async () => {
      const saved = await this.users.save(user);
      return UserDto.fromDomain(saved);
    });
  }
}
