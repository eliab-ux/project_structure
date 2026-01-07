import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { UNIT_OF_WORK, UnitOfWorkPort } from '../../../../infrastructure/persistence/ports/unit-of-work.port';
import { CreateUserCommand } from './create-user.command';
import { UserDto } from '../../dto/user.dto';
import { User } from '../../../domain/entities/user.entity';
import { Email } from '../../../domain/value-objects/email.vo';
import { UserAlreadyExistsException } from '../../../domain/exceptions/user-already-exists.exception';

@Injectable()
export class CreateUserUseCase implements UseCase<CreateUserCommand, UserDto> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: CreateUserCommand): Promise<UserDto> {
    const email = Email.create(command.email);

    // Business validation - check if user already exists
    const exists = await this.userRepository.exists(email);
    if (exists) {
      throw new UserAlreadyExistsException(email.value);
    }

    // Create domain entity
    const user = User.create(email, command.name);

    // Persist within transaction
    const savedUser = await this.unitOfWork.execute(async () => {
      return this.userRepository.save(user);
    });

    return UserDto.fromDomain(savedUser);
  }
}
