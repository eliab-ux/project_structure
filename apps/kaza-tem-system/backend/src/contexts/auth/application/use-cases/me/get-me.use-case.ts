import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { AuthTokenPayload } from '@infrastructure/security/ports/token-service.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@contexts/user/application/ports/output/user-repository.port';
import {
  RESELLER_REPOSITORY,
  ResellerRepositoryPort,
} from '@contexts/reseller/application/ports/output/reseller-repository.port';
import { GetMeCommand } from './get-me.command';
import { UserId } from '@contexts/user/domain/value-objects/user-id.vo';
import { UserNotFoundException } from '@contexts/user/domain/exceptions/user-not-found.exception';
import { ResellerNotFoundException } from '@contexts/reseller/domain/exceptions/reseller-not-found.exception';
import { UserDto } from '@contexts/user/application/dto/user.dto';
import { ResellerDto } from '@contexts/reseller/application/dto/reseller.dto';
import { InvalidCredentialsException } from '@contexts/user/domain/exceptions/invalid-credentials.exception';

export interface GetMeResult {
  user: UserDto;
  reseller: ResellerDto | null;
}

@Injectable()
export class GetMeUseCase implements UseCase<GetMeCommand, GetMeResult> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
  ) {}

  async execute(command: GetMeCommand): Promise<GetMeResult> {
    const payload: AuthTokenPayload = command.payload;
    if (!payload.sub) {
      throw new InvalidCredentialsException();
    }

    const user = await this.userRepository.findById(UserId.from(payload.sub));
    if (!user) {
      throw new UserNotFoundException(payload.sub);
    }

    let reseller: ResellerDto | null = null;
    if (payload.role === 'reseller') {
      const found = await this.resellerRepository.findByUserId(user.id.value);
      if (!found) {
        throw new ResellerNotFoundException(user.id.value);
      }
      reseller = ResellerDto.fromDomain(found);
    }

    return {
      user: UserDto.fromDomain(user),
      reseller,
    };
  }
}
