import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { AuthenticatedUserDto } from '../../dto/authenticated-user.dto';
import { InvalidCredentialsException } from '../../../domain/exceptions/invalid-credentials.exception';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';

export class GetMeQuery {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class GetMeUseCase implements UseCase<GetMeQuery, AuthenticatedUserDto> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(query: GetMeQuery): Promise<AuthenticatedUserDto> {
    const user = await this.userRepository.findById(
      AccountId.from(query.accountId),
      UserId.from(query.userId),
    );

    // Token válido de um usuário que não existe mais ou foi desligado: 401, não 404. O recurso
    // existe; o que não vale mais é a credencial.
    if (!user || !user.canAuthenticate()) {
      throw new InvalidCredentialsException();
    }

    return AuthenticatedUserDto.fromDomain(user);
  }
}
