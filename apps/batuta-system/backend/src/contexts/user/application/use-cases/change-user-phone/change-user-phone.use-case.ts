import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { UserNotFoundException } from '../../../domain/exceptions/user-not-found.exception';
import { UserDto } from '../../dto/user.dto';
import { USER_REPOSITORY, UserRepositoryPort } from '../../ports/output/user-repository.port';
import { ChangeUserPhoneCommand } from './change-user-phone.command';

/**
 * Changes where a user's password-recovery code is sent.
 *
 * This is a **security-relevant** edit, not a profile detail: whoever controls the number can take
 * over the account through the recovery flow. Hence the audit entry, and hence the masked-only
 * payload — the trail records THAT the number changed and enough to recognise it, never the number.
 */
@Injectable()
export class ChangeUserPhoneUseCase implements UseCase<ChangeUserPhoneCommand, UserDto> {
  private readonly logger = new Logger(ChangeUserPhoneUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ChangeUserPhoneCommand): Promise<UserDto> {
    // Tenant-scoped read: a user of another account is simply not found.
    const user = await this.users.findById(UserId.from(command.userId));
    if (!user) {
      throw new UserNotFoundException();
    }

    const previous = user.phone?.masked ?? null;
    user.changePhone(PhoneE164.create(command.phone));
    const saved = await this.users.save(user);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.USER_PHONE_CHANGED,
      entityType: 'user',
      entityId: saved.id.value,
      ip: command.ip,
      // Masked on both sides — a full number is personal data and never goes in the trail.
      payload: { from: previous, to: saved.phone?.masked ?? null },
    });

    this.logger.log('WhatsApp do usuário alterado', { userId: saved.id.value });
    return UserDto.fromDomain(saved);
  }
}
