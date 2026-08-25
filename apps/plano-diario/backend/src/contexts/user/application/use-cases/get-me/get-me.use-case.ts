import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { UserNotFoundException } from '../../../domain/exceptions/user-not-found.exception';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { UserDto } from '../../dto/user.dto';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';

@Injectable()
export class GetMeUseCase implements UseCase<{ userId: string }, UserDto> {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort) {}

  /** `userId` vem SEMPRE do JWT (payload.sub), nunca do body/query. */
  async execute(command: { userId: string }): Promise<UserDto> {
    const user = await this.userRepository.findById(UserId.from(command.userId));
    if (!user) {
      throw new UserNotFoundException();
    }
    return UserDto.fromDomain(user);
  }
}
