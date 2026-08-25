import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { UserNotFoundException } from '../../../domain/exceptions/user-not-found.exception';
import { UserDto } from '../../dto/user.dto';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { ChangeUserRoleCommand } from './change-user-role.command';

@Injectable()
export class ChangeUserRoleUseCase implements UseCase<ChangeUserRoleCommand, UserDto> {
  private readonly logger = new Logger(ChangeUserRoleUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ChangeUserRoleCommand): Promise<UserDto> {
    // Tenant-scoped read: a user of another account is simply not found — never a 403 that
    // confirms the id exists somewhere else.
    const user = await this.users.findById(UserId.from(command.userId));
    if (!user) {
      throw new UserNotFoundException();
    }

    const previous = user.role;
    user.changeRole(command.role);
    const saved = await this.users.save(user);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.USER_ROLE_CHANGED,
      entityType: 'user',
      entityId: saved.id.value,
      ip: command.ip,
      payload: { from: previous, to: saved.role },
    });

    this.logger.log('Papel do usuário alterado', { userId: saved.id.value });
    return UserDto.fromDomain(saved);
  }
}
