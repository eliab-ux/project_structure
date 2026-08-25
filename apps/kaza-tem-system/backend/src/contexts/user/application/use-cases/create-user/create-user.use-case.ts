import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { UNIT_OF_WORK, UnitOfWorkPort } from '@infrastructure/persistence/ports/unit-of-work.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '@infrastructure/security/ports/password-hasher.port';
import { SupabaseAuthService } from '@infrastructure/security/supabase-auth.service';
import { CreateUserCommand } from './create-user.command';
import { UserDto } from '../../dto/user.dto';
import { User } from '../../../domain/entities/user.entity';
import { Email } from '../../../domain/value-objects/email.vo';
import { UserAlreadyExistsException } from '../../../domain/exceptions/user-already-exists.exception';
import { AuthError } from '@supabase/auth-js';
import { UserId } from '../../../domain/value-objects/user-id.vo';

@Injectable()
export class CreateUserUseCase implements UseCase<CreateUserCommand, UserDto> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    private readonly supabaseAuthService: SupabaseAuthService,
  ) {}

  async execute(command: CreateUserCommand): Promise<UserDto> {
    const email = Email.create(command.email);

    // Business validation - check if user already exists
    const exists = await this.userRepository.exists(email);
    if (exists) {
      throw new UserAlreadyExistsException(email.value);
    }

    // Create domain entity
    const passwordHash = await this.passwordHasher.hash(command.password);

    let supabaseUser;
    try {
      supabaseUser = await this.supabaseAuthService.createUser(email.value, command.password, {
        name: command.name,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        const message = error.message?.toLowerCase() ?? '';
        const code = (error.code ?? '').toString().toLowerCase();
        if (message.includes('duplicate') || message.includes('already exists')) {
          throw new UserAlreadyExistsException(email.value);
        }

        if (code.includes('duplicate')) {
          throw new UserAlreadyExistsException(email.value);
        }
      }

      throw error;
    }

    const user = User.createWithId(UserId.from(supabaseUser.id), email, command.name, passwordHash);

    // Persist within transaction
    let savedUser;
    try {
      savedUser = await this.unitOfWork.execute(async () => {
        return this.userRepository.save(user);
      });
    } catch (error) {
      await this.supabaseAuthService.deleteUser(supabaseUser.id).catch(() => null);
      throw error;
    }

    return UserDto.fromDomain(savedUser);
  }
}
