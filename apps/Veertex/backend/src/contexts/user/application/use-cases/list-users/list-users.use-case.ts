import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { UserDto } from '../../dto/user.dto';

export class ListUsersQuery {}

@Injectable()
export class ListUsersUseCase implements UseCase<ListUsersQuery, UserDto[]> {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort) {}

  async execute(): Promise<UserDto[]> {
    const users = await this.users.listAll();
    return users.map((user) => UserDto.fromDomain(user));
  }
}
