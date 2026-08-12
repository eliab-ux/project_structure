import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { AccountDto } from '../../../../account/application/dto/account.dto';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../../account/domain/exceptions/account-not-found.exception';
import { RoleDto } from '../../../../role/application/dto/role.dto';
import {
  ROLE_REPOSITORY,
  RoleRepositoryPort,
} from '../../../../role/application/ports/output/role-repository.port';
import { RoleId } from '../../../../role/domain/value-objects/role-id.vo';
import { UserDto } from '../../../../user/application/dto/user.dto';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';
import { UserNotFoundException } from '../../../../user/domain/exceptions/user-exceptions';
import {
  GetEffectiveModulesQuery,
  GetEffectiveModulesUseCase,
} from '../../../../module/application/use-cases/get-effective-modules/get-effective-modules.use-case';

export class GetMeQuery {
  constructor(
    public readonly userId: string,
    public readonly accountId: string,
  ) {}
}

export interface MeDto {
  user: UserDto;
  account: AccountDto;
  role: RoleDto | null;
  /**
   * Os módulos efetivos da conta (`plano ∩ conta`).
   *
   * Precisa vir por aqui, e não só no login, porque o access token vive 15 minutos: depois de um
   * toggle de módulo, é o `/auth/me` que o frontend consulta para redesenhar o menu sem exigir novo
   * login. O claim `modules` do JWT serve ao `ModuleGuard` no backend; o frontend não decodifica
   * token, e não deveria.
   */
  modules: string[];
}

/**
 * Everything the frontend needs to render the shell after a page reload: who I am, which account
 * I am in, and what I may do.
 *
 * Both ids come from the token, so a client cannot ask about another user or tenant.
 */
@Injectable()
export class GetMeUseCase implements UseCase<GetMeQuery, MeDto> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepositoryPort,
    private readonly getEffectiveModules: GetEffectiveModulesUseCase,
  ) {}

  async execute(query: GetMeQuery): Promise<MeDto> {
    const user = await this.users.findById(UserId.from(query.userId));
    if (!user) {
      throw new UserNotFoundException();
    }

    const account = await this.accounts.findById(AccountId.from(query.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    const role = await this.roles.findById(RoleId.from(user.roleId));
    // Mesmo use case que o login usa — uma fonte só para "quais módulos valem nesta conta".
    const modules = await this.getEffectiveModules.execute(
      new GetEffectiveModulesQuery(query.accountId),
    );

    return {
      user: UserDto.fromDomain(user),
      account: AccountDto.fromDomain(account),
      role: role ? RoleDto.fromDomain(role) : null,
      modules,
    };
  }
}
