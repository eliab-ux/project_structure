import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { GetUserQuery } from './get-user.query';
import { UserDto } from '../../dto/user.dto';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { UserNotFoundException } from '../../../domain/exceptions/user-not-found.exception';

@Injectable()
export class GetUserUseCase implements UseCase<GetUserQuery, UserDto> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(query: GetUserQuery): Promise<UserDto> {
    const userId = UserId.from(query.userId);

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UserNotFoundException(userId.value);
    }

    return UserDto.fromDomain(user);
  }
}
