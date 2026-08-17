import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import {
  PHONE_CHANGE_AUDIT_REPOSITORY,
  PhoneChangeAuditRepositoryPort,
} from '../../ports/output/phone-change-audit-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { UserDto } from '../../dto/user.dto';
import { UserRole, assertUserRole } from '../../../domain/value-objects/user-role.vo';
import { PhoneChangeAudit } from '../../../domain/entities/phone-change-audit.entity';
import { UserNotFoundException } from '../../../domain/exceptions/user-not-found.exception';
import { EmailAlreadyInUseException } from '../../../domain/exceptions/email-already-in-use.exception';
import { ForbiddenRoleAssignmentException } from '../../../domain/exceptions/forbidden-role-assignment.exception';
import { ForbiddenPhoneChangeException } from '../../../domain/exceptions/forbidden-phone-change.exception';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';

export class UpdateUserCommand {
  constructor(
    public readonly accountId: string,
    public readonly actorRole: UserRole,
    public readonly actorUserId: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly email: string,
    public readonly phone: string,
    public readonly role: string,
  ) {}
}

@Injectable()
export class UpdateUserUseCase implements UseCase<UpdateUserCommand, UserDto> {
  private readonly logger = new Logger(UpdateUserUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PHONE_CHANGE_AUDIT_REPOSITORY)
    private readonly auditRepository: PhoneChangeAuditRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateUserCommand): Promise<UserDto> {
    const accountId = AccountId.from(command.accountId);
    const role = assertUserRole(command.role);

    const user = await this.userRepository.findById(accountId, UserId.from(command.userId));
    if (!user) {
      throw new UserNotFoundException();
    }

    // Duas metades da mesma regra (spec §5): o `admin` não promove ninguém a dono, e também não
    // mexe num dono existente — rebaixar o dono é tão eficaz quanto se promover.
    const touchesOwner = role === 'owner' || user.role === 'owner';
    if (touchesOwner && command.actorRole !== 'owner') {
      throw new ForbiddenRoleAssignmentException();
    }

    const email = Email.create(command.email);
    if (email.value !== user.email.value) {
      const existing = await this.userRepository.findByEmailGlobally(email);
      if (existing) {
        throw new EmailAlreadyInUseException();
      }
    }

    /**
     * Trocar o telefone de OUTRA pessoa é exclusivo do `owner` (spec §6.12).
     *
     * Sem esta trava, a regra "ninguém redefine a senha de terceiro" teria uma porta dos fundos de
     * dois passos: o Administrativo mudaria o número, pediria o código de recuperação e entraria
     * como o outro. O `admin` continua editando nome, e-mail e papel de quem não é dono.
     */
    const previousPhone = user.phone;
    const phone = PhoneE164.create(command.phone);
    const isSelf = user.id.value === command.actorUserId;
    const phoneChanged = phone.value !== previousPhone.value;

    if (phoneChanged && !isSelf && command.actorRole !== 'owner') {
      throw new ForbiddenPhoneChangeException();
    }

    user.changeProfile({ name: command.name, email, phone });
    user.changeRole(role);

    return this.unitOfWork.execute(async () => {
      const saved = await this.userRepository.save(user);

      // A auditoria entra na MESMA transação do update: uma trilha que pode faltar quando o
      // update deu certo não é trilha, é sorte.
      if (phoneChanged && !isSelf) {
        await this.auditRepository.save(
          PhoneChangeAudit.record({
            accountId,
            userId: user.id,
            changedByUserId: UserId.from(command.actorUserId),
            previousPhone,
            newPhone: phone,
          }),
        );
        // Os NÚMEROS ficam só na trilha, nunca no log — quem investiga tem acesso à tabela.
        this.logger.warn('Telefone de terceiro alterado', {
          userId: user.id.value,
          changedBy: command.actorUserId,
        });
      }

      return UserDto.fromDomain(saved);
    });
  }
}
