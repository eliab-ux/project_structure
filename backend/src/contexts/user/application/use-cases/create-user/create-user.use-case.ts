import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../auth/application/ports/output/password-hasher.port';
import { assertPasswordStrength } from '../../../../auth/domain/password-policy';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../../account/domain/exceptions/account-not-found.exception';
import {
  PLAN_REPOSITORY,
  PlanRepositoryPort,
} from '../../../../plan/application/ports/output/plan-repository.port';
import { PlanLimitExceededException } from '../../../../plan/domain/exceptions/plan-limit-exceeded.exception';
import {
  ROLE_REPOSITORY,
  RoleRepositoryPort,
} from '../../../../role/application/ports/output/role-repository.port';
import { RoleId } from '../../../../role/domain/value-objects/role-id.vo';
import { RoleNotFoundException } from '../../../../role/domain/exceptions/role-exceptions';
import { User } from '../../../domain/entities/user.entity';
import { UserAlreadyExistsException } from '../../../domain/exceptions/user-exceptions';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { UserDto } from '../../dto/user.dto';

/** Name, e-mail and WhatsApp are all required — CLAUDE.md regra 9, enforced in all three layers. */
export class CreateUserCommand {
  constructor(
    public readonly accountId: string,
    public readonly name: string,
    public readonly email: string,
    public readonly phone: string,
    public readonly password: string,
    public readonly roleId: string,
  ) {}
}

@Injectable()
export class CreateUserUseCase implements UseCase<CreateUserCommand, UserDto> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateUserCommand): Promise<UserDto> {
    assertPasswordStrength(command.password);

    const email = Email.create(command.email);
    // The VO is the second of the three layers guarding regra 9: it refuses anything that is not a
    // usable E.164 number, so a user who cannot receive a recovery code cannot be created.
    const phone = PhoneE164.create(command.phone);

    if (await this.users.findByEmail(email)) {
      throw new UserAlreadyExistsException();
    }

    // Scoped read: a roleId belonging to another account does not resolve, so this doubles as the
    // authorization check that the role is the caller's to assign.
    const role = await this.roles.findById(RoleId.from(command.roleId));
    if (!role) {
      throw new RoleNotFoundException();
    }

    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    const plan = await this.plans.findById(account.planId);
    if (plan) {
      const current = await this.users.countAll();
      if (plan.limits.wouldExceedUsers(current)) {
        throw new PlanLimitExceededException('usuários', plan.limits.maxUsers as number);
      }
    }

    const user = User.create({
      accountId: command.accountId,
      name: command.name,
      email,
      phone,
      passwordHash: await this.hasher.hash(command.password),
      roleId: role.id.value,
    });

    return this.uow.execute(async () => {
      const saved = await this.users.save(user);
      return UserDto.fromDomain(saved);
    });
  }
}
