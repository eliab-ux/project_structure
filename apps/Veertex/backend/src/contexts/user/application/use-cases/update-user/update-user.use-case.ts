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
  UserAlreadyExistsException,
  UserNotFoundException,
} from '../../../domain/exceptions/user-exceptions';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { UserDto } from '../../dto/user.dto';
import { CommissionModel } from '../../../domain/commission-model';
import { RoleAdministrationPolicy } from '../../../../role/application/policies/role-administration.policy';

export class UpdateUserCommand {
  constructor(
    public readonly userId: string,
    public readonly name?: string,
    public readonly email?: string,
    public readonly phone?: string,
    public readonly roleId?: string,
    public readonly commissionModel?: CommissionModel,
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
    private readonly roleAdministration: RoleAdministrationPolicy,
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

      // Simulado antes de trocar. A checagem anterior comparava `isAdministrative` (curinga `*`) do
      // papel atual com o do novo, e contava usuários com curinga — cega para o último usuário de um
      // papel com `roles.update` explícito. Ver `RoleAdministrationPolicy`.
      await this.roleAdministration.assertSurvives({
        kind: 'user-role',
        userId: user.id.value,
        roleId: role.id.value,
      });

      user.changeRole(role.id.value);
    }

    if (command.commissionModel !== undefined) {
      user.changeCommissionModel(command.commissionModel);
    }

    return this.uow.execute(async () => {
      const saved = await this.users.save(user);
      return UserDto.fromDomain(saved);
    });
  }
}
