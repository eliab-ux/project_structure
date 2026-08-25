import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../../infrastructure/security/ports/password-hasher.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { User } from '../../../domain/entities/user.entity';
import { Email } from '../../../domain/value-objects/email.vo';
import { UserAlreadyExistsException } from '../../../domain/exceptions/user-already-exists.exception';
import { UserDto } from '../../dto/user.dto';
import { RegisterUserCommand } from './register-user.command';

@Injectable()
export class RegisterUserUseCase implements UseCase<RegisterUserCommand, UserDto> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RegisterUserCommand): Promise<UserDto> {
    const email = Email.create(command.email);

    if (await this.userRepository.exists(email)) {
      throw new UserAlreadyExistsException(email.value);
    }

    const passwordHash = await this.passwordHasher.hash(command.password);
    const user = User.register(email, command.name, passwordHash);

    return this.uow.execute(async () => {
      const saved = await this.userRepository.save(user);
      return UserDto.fromDomain(saved);
    });
  }
}
