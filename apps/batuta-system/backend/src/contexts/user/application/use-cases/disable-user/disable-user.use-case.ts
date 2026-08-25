import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { UserNotFoundException } from '../../../domain/exceptions/user-not-found.exception';
import { CannotDisableSelfException } from '../../../domain/exceptions/cannot-disable-self.exception';
import { UserDto } from '../../dto/user.dto';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { DisableUserCommand } from './disable-user.command';

@Injectable()
export class DisableUserUseCase implements UseCase<DisableUserCommand, UserDto> {
  private readonly logger = new Logger(DisableUserUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: DisableUserCommand): Promise<UserDto> {
    // An admin disabling themselves locks the tenant out of its own account.
    if (command.userId === command.performedBy) {
      throw new CannotDisableSelfException();
    }

    const user = await this.users.findById(UserId.from(command.userId));
    if (!user) {
      throw new UserNotFoundException();
    }

    user.disable();
    const saved = await this.users.save(user);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.USER_DISABLED,
      entityType: 'user',
      entityId: saved.id.value,
      ip: command.ip,
    });

    this.logger.log('Usuário desativado', { userId: saved.id.value });
    return UserDto.fromDomain(saved);
  }
}
