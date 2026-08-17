import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { UserDto } from '../../dto/user.dto';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';

export class ListUsersQuery {
  constructor(public readonly accountId: string) {}
}

@Injectable()
export class ListUsersUseCase implements UseCase<ListUsersQuery, UserDto[]> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(query: ListUsersQuery): Promise<UserDto[]> {
    const users = await this.userRepository.listByAccount(AccountId.from(query.accountId));
    // Inativos vêm juntos e de propósito: a tela de Equipe mostra quem foi desligado, com o botão
    // de reativar. Desligamento inativa, nunca apaga (spec §4.3).
    return users.map(UserDto.fromDomain);
  }
}
