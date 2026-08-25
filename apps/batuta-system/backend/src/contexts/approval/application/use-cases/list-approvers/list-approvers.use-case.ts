import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ApproverDto } from '../../dto/approval.dto';
import {
  APPROVER_REPOSITORY,
  ApproverRepositoryPort,
} from '../../ports/output/approval-repositories.port';
import { ListApproversQuery } from './list-approvers.query';

@Injectable()
export class ListApproversUseCase implements UseCase<ListApproversQuery, ApproverDto[]> {
  constructor(@Inject(APPROVER_REPOSITORY) private readonly approvers: ApproverRepositoryPort) {}

  async execute(_query: ListApproversQuery): Promise<ApproverDto[]> {
    // Includes inactive ones: they are deactivated rather than deleted, and the screen has to show why
    // a name that used to approve no longer receives links.
    const approvers = await this.approvers.listAll();
    return approvers.map((approver) => ApproverDto.fromDomain(approver));
  }
}
