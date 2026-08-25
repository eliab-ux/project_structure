import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { UserNotFoundException } from '../../../domain/exceptions/user-not-found.exception';
import { UserDto } from '../../dto/user.dto';

@Injectable()
export class GetMeUseCase implements UseCase<{ userId: string }, UserDto> {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort) {}

  async execute(command: { userId: string }): Promise<UserDto> {
    const user = await this.userRepository.findById(UserId.from(command.userId));
    if (!user) {
      throw new UserNotFoundException(command.userId);
    }
    return UserDto.fromDomain(user);
  }
}
