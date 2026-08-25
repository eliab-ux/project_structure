import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { Email } from '../../../../user/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import { ApproverNotFoundException } from '../../../domain/exceptions/approver-not-found.exception';
import { ApproverDto } from '../../dto/approval.dto';
import {
  APPROVER_REPOSITORY,
  ApproverRepositoryPort,
} from '../../ports/output/approval-repositories.port';
import { UpdateApproverCommand } from './update-approver.command';

/**
 * Edits an approver, or deactivates one.
 *
 * There is no delete: past `approval_requests` point at this row, and a decision whose approver
 * vanished is unauditable — which defeats the purpose of §8.
 */
@Injectable()
export class UpdateApproverUseCase implements UseCase<UpdateApproverCommand, ApproverDto> {
  private readonly logger = new Logger(UpdateApproverUseCase.name);

  constructor(
    @Inject(APPROVER_REPOSITORY) private readonly approvers: ApproverRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: UpdateApproverCommand): Promise<ApproverDto> {
    const approver = await this.approvers.findById(command.approverId);
    if (!approver) {
      throw new ApproverNotFoundException();
    }

    const previous = { name: approver.name, active: approver.active };

    // `undefined` means "leave as is"; `null` means "clear it" — and clearing both is refused by the
    // entity, since an unreachable approver silently blocks every submission.
    approver.change({
      name: command.name,
      email:
        command.email === undefined
          ? undefined
          : command.email
            ? Email.create(command.email)
            : null,
      phone:
        command.phone === undefined
          ? undefined
          : command.phone
            ? PhoneE164.create(command.phone)
            : null,
    });

    if (command.active === true) {
      approver.activate();
    } else if (command.active === false) {
      approver.deactivate();
    }

    const saved = await this.approvers.save(approver);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.APPROVER_UPDATED,
      entityType: 'approver',
      entityId: saved.id,
      ip: command.ip ?? null,
      payload: { from: previous, to: { name: saved.name, active: saved.active } },
    });

    this.logger.log('Aprovador atualizado', { approverId: saved.id, active: saved.active });
    return ApproverDto.fromDomain(saved);
  }
}
