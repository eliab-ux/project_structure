import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { Email } from '../../../../user/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import { Approver } from '../../../domain/entities/approver.entity';
import { ApproverAlreadyExistsException } from '../../../domain/exceptions/approver-already-exists.exception';
import { ApproverDto } from '../../dto/approval.dto';
import {
  APPROVER_REPOSITORY,
  ApproverRepositoryPort,
} from '../../ports/output/approval-repositories.port';
import { CreateApproverCommand } from './create-approver.command';

/**
 * Registers someone who may approve content (§8 item 2).
 *
 * No user account is created and none is required: this person may be a lawyer or a chief of staff who
 * will never log in. They get a link on their phone and tap it.
 */
@Injectable()
export class CreateApproverUseCase implements UseCase<CreateApproverCommand, ApproverDto> {
  private readonly logger = new Logger(CreateApproverUseCase.name);

  constructor(
    @Inject(APPROVER_REPOSITORY) private readonly approvers: ApproverRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: CreateApproverCommand): Promise<ApproverDto> {
    const email = command.email ? Email.create(command.email) : null;
    const phone = command.phone ? PhoneE164.create(command.phone) : null;

    if (email) {
      // Tenant-scoped: the same person may legitimately approve for another account.
      const existing = await this.approvers.findByEmail(email.value);
      if (existing) {
        throw new ApproverAlreadyExistsException();
      }
    }

    // Throws ApproverWithoutContactException when neither e-mail nor phone is given.
    const approver = Approver.create({
      accountId: command.accountId,
      name: command.name,
      email,
      phone,
    });

    const saved = await this.approvers.save(approver);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.APPROVER_CREATED,
      entityType: 'approver',
      entityId: saved.id,
      ip: command.ip,
      // Masked phone; the e-mail is the identity that matters for the approver-is-not-author check.
      payload: {
        name: saved.name,
        email: saved.email?.value ?? null,
        phone: saved.phone?.masked ?? null,
      },
    });

    this.logger.log('Aprovador cadastrado', { approverId: saved.id });
    return ApproverDto.fromDomain(saved);
  }
}
