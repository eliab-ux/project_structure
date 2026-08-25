import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ApprovalSettings } from '../../../domain/entities/approval-settings.entity';
import { ApprovalSettingsDto } from '../../dto/approval.dto';
import {
  APPROVAL_SETTINGS_REPOSITORY,
  ApprovalSettingsRepositoryPort,
} from '../../ports/output/approval-repositories.port';
import { GetApprovalSettingsQuery } from './get-approval-settings.query';

/**
 * Reads the policy, substituting the documented defaults when an account never configured it:
 * 1 approval for institutional, 2 for electoral — erring towards the side where being wrong is
 * expensive (§15 risco 6).
 */
@Injectable()
export class GetApprovalSettingsUseCase implements UseCase<
  GetApprovalSettingsQuery,
  ApprovalSettingsDto
> {
  constructor(
    @Inject(APPROVAL_SETTINGS_REPOSITORY)
    private readonly repository: ApprovalSettingsRepositoryPort,
  ) {}

  async execute(query: GetApprovalSettingsQuery): Promise<ApprovalSettingsDto> {
    const settings =
      (await this.repository.find()) ?? ApprovalSettings.createDefault(query.accountId);
    return ApprovalSettingsDto.fromDomain(settings);
  }
}
