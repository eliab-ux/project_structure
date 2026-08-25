import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { ApprovalSettings } from '../../../domain/entities/approval-settings.entity';
import { ApprovalSettingsDto } from '../../dto/approval.dto';
import {
  APPROVAL_SETTINGS_REPOSITORY,
  ApprovalSettingsRepositoryPort,
} from '../../ports/output/approval-repositories.port';
import { UpdateApprovalSettingsCommand } from './update-approval-settings.command';

/**
 * Sets how many approvals each classification needs (§8 item 1).
 *
 * Audited with both the old and the new values, because lowering electoral from 2 to 1 is exactly the
 * kind of change someone will later need to explain — and the trail should not require guessing when
 * it happened.
 */
@Injectable()
export class UpdateApprovalSettingsUseCase implements UseCase<
  UpdateApprovalSettingsCommand,
  ApprovalSettingsDto
> {
  private readonly logger = new Logger(UpdateApprovalSettingsUseCase.name);

  constructor(
    @Inject(APPROVAL_SETTINGS_REPOSITORY)
    private readonly repository: ApprovalSettingsRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: UpdateApprovalSettingsCommand): Promise<ApprovalSettingsDto> {
    const settings =
      (await this.repository.find()) ?? ApprovalSettings.createDefault(command.accountId);

    const previous = {
      requiredForInstitutional: settings.requiredForInstitutional,
      requiredForElectoral: settings.requiredForElectoral,
      notifyChannel: settings.notifyChannel,
    };

    // Throws InvalidApprovalSettingsException for anything other than 1 or 2.
    settings.change({
      requiredForInstitutional: command.requiredForInstitutional,
      requiredForElectoral: command.requiredForElectoral,
      notifyChannel: command.notifyChannel,
    });

    const saved = await this.repository.save(settings);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.APPROVAL_SETTINGS_CHANGED,
      entityType: 'approval_settings',
      entityId: saved.id,
      ip: command.ip,
      payload: {
        from: previous,
        to: {
          requiredForInstitutional: saved.requiredForInstitutional,
          requiredForElectoral: saved.requiredForElectoral,
          notifyChannel: saved.notifyChannel,
        },
      },
    });

    this.logger.log('Configuração de aprovação alterada', {
      institutional: saved.requiredForInstitutional,
      electoral: saved.requiredForElectoral,
    });
    return ApprovalSettingsDto.fromDomain(saved);
  }
}
