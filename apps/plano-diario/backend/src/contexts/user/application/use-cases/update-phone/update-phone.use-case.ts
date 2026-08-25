import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { UserNotFoundException } from '../../../domain/exceptions/user-not-found.exception';
import { PhoneNumber } from '../../../domain/value-objects/phone-number.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { UserDto } from '../../dto/user.dto';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';

export interface UpdatePhoneCommand {
  /** Vem SEMPRE do token, nunca do corpo da requisição. */
  userId: string;
  phone: string;
}

/**
 * Cadastra ou corrige o WhatsApp de contato da própria conta.
 *
 * Existe porque o número passou a ser obrigatório no cadastro depois que já havia conta criada:
 * sem esta rota, quem se cadastrou antes ficaria permanentemente sem como recuperar a senha.
 */
@Injectable()
export class UpdatePhoneUseCase implements UseCase<UpdatePhoneCommand, UserDto> {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort) {}

  async execute(command: UpdatePhoneCommand): Promise<UserDto> {
    const user = await this.users.findById(UserId.from(command.userId));
    if (!user) {
      throw new UserNotFoundException();
    }

    user.changePhone(PhoneNumber.create(command.phone));
    return UserDto.fromDomain(await this.users.save(user));
  }
}
