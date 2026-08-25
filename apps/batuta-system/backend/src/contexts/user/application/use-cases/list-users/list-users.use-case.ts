import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { UserDto } from '../../dto/user.dto';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { ListUsersQuery } from './list-users.query';

/**
 * Users of the current account. The repository needs no accountId argument: the global tenant
 * filter scopes it from the request's JWT, which is exactly the point of the mechanical isolation
 * (§5, FASE 1 item 4) — there is no parameter here for anyone to forget.
 */
@Injectable()
export class ListUsersUseCase implements UseCase<ListUsersQuery, UserDto[]> {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort) {}

  async execute(_query: ListUsersQuery): Promise<UserDto[]> {
    const users = await this.users.listByAccount();
    return users.map((user) => UserDto.fromDomain(user));
  }
}
