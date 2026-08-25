import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { GetApprovalSettingsUseCase } from '../../../../contexts/approval/application/use-cases/get-approval-settings/get-approval-settings.use-case';
import { GetApprovalSettingsQuery } from '../../../../contexts/approval/application/use-cases/get-approval-settings/get-approval-settings.query';
import { UpdateApprovalSettingsUseCase } from '../../../../contexts/approval/application/use-cases/update-approval-settings/update-approval-settings.use-case';
import { UpdateApprovalSettingsCommand } from '../../../../contexts/approval/application/use-cases/update-approval-settings/update-approval-settings.command';
import { CreateApproverUseCase } from '../../../../contexts/approval/application/use-cases/create-approver/create-approver.use-case';
import { CreateApproverCommand } from '../../../../contexts/approval/application/use-cases/create-approver/create-approver.command';
import { UpdateApproverUseCase } from '../../../../contexts/approval/application/use-cases/update-approver/update-approver.use-case';
import { UpdateApproverCommand } from '../../../../contexts/approval/application/use-cases/update-approver/update-approver.command';
import { ListApproversUseCase } from '../../../../contexts/approval/application/use-cases/list-approvers/list-approvers.use-case';
import { ListApproversQuery } from '../../../../contexts/approval/application/use-cases/list-approvers/list-approvers.query';
import { SubmitForApprovalUseCase } from '../../../../contexts/approval/application/use-cases/submit-for-approval/submit-for-approval.use-case';
import { SubmitForApprovalCommand } from '../../../../contexts/approval/application/use-cases/submit-for-approval/submit-for-approval.command';
import { ListApprovalRequestsUseCase } from '../../../../contexts/approval/application/use-cases/list-approval-requests/list-approval-requests.use-case';
import { ListApprovalRequestsQuery } from '../../../../contexts/approval/application/use-cases/list-approval-requests/list-approval-requests.query';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { AccountAdminGuard } from '../../../security/guards/account-admin.guard';
import { ClientIp, CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  CreateApproverRequestDto,
  SubmitForApprovalRequestDto,
  UpdateApprovalSettingsRequestDto,
  UpdateApproverRequestDto,
} from './dto/approval-request.dto';
import {
  ApprovalProgressResponseDto,
  ApprovalSettingsResponseDto,
  ApproverResponseDto,
  SubmissionResponseDto,
} from './dto/approval-response.dto';

/**
 * The tenant side of approval (FASE 5): who approves, how many are needed, and submitting for review.
 *
 * The guard split follows who bears the consequence:
 *  - **AccountAdminGuard** for settings and the approver roster — deciding that electoral content needs
 *    only one approval, or adding oneself as an approver, is a control change, not day-to-day work;
 *  - **JwtAuthGuard** for submitting and for tracking progress, which is the operator's job.
 *
 * Deciding is NOT here. It lives on the public magic-link route, because the approver may have no
 * account at all (§8 item 2) — and keeping it out of the authenticated surface is what stops an operator
 * from approving on someone else's behalf just by holding a session.
 */
@Controller('approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalController {
  constructor(
    private readonly getSettings: GetApprovalSettingsUseCase,
    private readonly updateSettings: UpdateApprovalSettingsUseCase,
    private readonly createApprover: CreateApproverUseCase,
    private readonly updateApprover: UpdateApproverUseCase,
    private readonly listApprovers: ListApproversUseCase,
    private readonly submitForApproval: SubmitForApprovalUseCase,
    private readonly listRequests: ListApprovalRequestsUseCase,
  ) {}

  @Get('settings')
  async settings(@CurrentUser() user: AuthTokenPayload): Promise<ApprovalSettingsResponseDto> {
    const dto = await this.getSettings.execute(new GetApprovalSettingsQuery(user.accountId));
    return ApprovalSettingsResponseDto.from(dto);
  }

  /** Control change: how many approvals electoral content needs is exactly the kind of knob that
   * should not be turned by whoever happens to be logged in. */
  @Put('settings')
  @UseGuards(AccountAdminGuard)
  async changeSettings(
    @Body() dto: UpdateApprovalSettingsRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ApprovalSettingsResponseDto> {
    const result = await this.updateSettings.execute(
      new UpdateApprovalSettingsCommand(
        user.accountId,
        user.sub,
        dto.requiredForInstitutional,
        dto.requiredForElectoral,
        dto.notifyChannel,
        ip,
      ),
    );
    return ApprovalSettingsResponseDto.from(result);
  }

  @Get('approvers')
  async approvers(@CurrentUser() user: AuthTokenPayload): Promise<ApproverResponseDto[]> {
    const dtos = await this.listApprovers.execute(new ListApproversQuery(user.accountId));
    return dtos.map((dto) => ApproverResponseDto.from(dto));
  }

  @Post('approvers')
  @HttpCode(201)
  @UseGuards(AccountAdminGuard)
  async addApprover(
    @Body() dto: CreateApproverRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ApproverResponseDto> {
    const result = await this.createApprover.execute(
      new CreateApproverCommand(
        user.accountId,
        user.sub,
        dto.name,
        dto.email ?? null,
        dto.phone ?? null,
        ip,
      ),
    );
    return ApproverResponseDto.from(result);
  }

  /**
   * No DELETE: `approval_requests` reference this row, and a decision whose approver vanished is
   * unauditable. Removing someone is `{ "active": false }`.
   */
  @Patch('approvers/:id')
  @UseGuards(AccountAdminGuard)
  async editApprover(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApproverRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ApproverResponseDto> {
    const result = await this.updateApprover.execute(
      new UpdateApproverCommand(
        user.accountId,
        user.sub,
        id,
        dto.name,
        dto.email,
        dto.phone,
        dto.active,
        ip,
      ),
    );
    return ApproverResponseDto.from(result);
  }

  /**
   * Submits a content for approval: freezes nothing, but binds every request created to the content's
   * CURRENT hash. Editing the content afterwards invalidates them all (§8.5).
   */
  @Post('contents/:contentId/submit')
  @HttpCode(200)
  async submit(
    @Param('contentId', ParseUUIDPipe) contentId: string,
    @Body() _dto: SubmitForApprovalRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<SubmissionResponseDto> {
    const result = await this.submitForApproval.execute(
      new SubmitForApprovalCommand(user.accountId, user.sub, contentId, ip),
    );
    return SubmissionResponseDto.from(result);
  }

  /** The author's tracking view: how many approvals so far, on the current version, and any comment. */
  @Get('contents/:contentId')
  async progress(
    @Param('contentId', ParseUUIDPipe) contentId: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<ApprovalProgressResponseDto> {
    const dto = await this.listRequests.execute(
      new ListApprovalRequestsQuery(user.accountId, contentId),
    );
    return ApprovalProgressResponseDto.from(dto);
  }
}
