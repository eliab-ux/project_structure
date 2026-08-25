import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../../infrastructure/security/ports/password-hasher.port';
import { User } from '../../../domain/entities/user.entity';
import { UserAlreadyExistsException } from '../../../domain/exceptions/user-already-exists.exception';
import { Email } from '../../../domain/value-objects/email.vo';
import { PhoneNumber } from '../../../domain/value-objects/phone-number.vo';
import { UserDto } from '../../dto/user.dto';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { RegisterUserCommand } from './register-user.command';

@Injectable()
export class RegisterUserUseCase implements UseCase<RegisterUserCommand, UserDto> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(command: RegisterUserCommand): Promise<UserDto> {
    const email = Email.create(command.email);
    // Valida o número ANTES de gastar um hash de bcrypt (~100ms) num cadastro que vai falhar.
    const phone = PhoneNumber.create(command.phone);

    if (await this.userRepository.exists(email)) {
      throw new UserAlreadyExistsException();
    }

    // O hash é gerado antes de construir o agregado: a entidade nunca vê a senha em claro.
    const passwordHash = await this.passwordHasher.hash(command.password);
    const user = User.register(email, command.name, passwordHash, phone);

    const saved = await this.userRepository.save(user);
    return UserDto.fromDomain(saved);
  }
}
