import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CONTACT_SAMPLE_PROVIDER,
  CONTENT_REPOSITORY,
  ContactSampleProviderPort,
  ContentRepositoryPort,
} from '../../../../content/application/ports/output/content-repository.port';
import { ContentId } from '../../../../content/domain/value-objects/content-id.vo';
import { ContentNotFoundException } from '../../../../content/domain/exceptions/content-not-found.exception';
import { renderMergeFields } from '../../../../content/domain/services/merge-fields';
import { TenantScopedJobRunner } from '../../../../../infrastructure/messaging/tenant-scoped-job.runner';
import { ApprovalRequest } from '../../../domain/entities/approval-request.entity';
import { ApprovalSettings } from '../../../domain/entities/approval-settings.entity';
import { ApprovalRequestStatus } from '../../../domain/value-objects/approval-status.vo';
import { hashApprovalToken } from '../../../domain/value-objects/approval-token.vo';
import { InvalidApprovalTokenException } from '../../../domain/exceptions/invalid-approval-token.exception';
import { ApprovalPageDto } from '../../dto/approval.dto';
import {
  APPROVAL_REQUEST_REPOSITORY,
  APPROVAL_SETTINGS_REPOSITORY,
  APPROVER_REPOSITORY,
  ApprovalRequestRepositoryPort,
  ApprovalSettingsRepositoryPort,
  ApproverRepositoryPort,
} from '../../ports/output/approval-repositories.port';
import { GetApprovalPageQuery } from './get-approval-page.query';

/**
 * What the magic-link page shows (§8 item 4): "o conteúdo exato submetido (texto, variantes, mídias,
 * amostra renderizada) e o `content_hash`".
 *
 * The hash is on the page for a reason: it is what makes the record unambiguous later. "Ana aprovou às
 * 14h32" is weak; "Ana aprovou a versão a1b2c3… às 14h32, deste IP" is defensible, and she can see the
 * same identifier that the trail will carry.
 *
 * Read-only and idempotent: opening the link twice is normal (people forward it to a bigger screen),
 * so this must not consume the token. Only deciding does.
 */
@Injectable()
export class GetApprovalPageUseCase implements UseCase<GetApprovalPageQuery, ApprovalPageDto> {
  constructor(
    @Inject(APPROVAL_REQUEST_REPOSITORY)
    private readonly requests: ApprovalRequestRepositoryPort,
    @Inject(APPROVER_REPOSITORY) private readonly approvers: ApproverRepositoryPort,
    @Inject(APPROVAL_SETTINGS_REPOSITORY)
    private readonly settingsRepository: ApprovalSettingsRepositoryPort,
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(CONTACT_SAMPLE_PROVIDER) private readonly samples: ContactSampleProviderPort,
    private readonly runner: TenantScopedJobRunner,
  ) {}

  async execute(query: GetApprovalPageQuery): Promise<ApprovalPageDto> {
    const request = await this.requests.findByTokenHashUnscoped(hashApprovalToken(query.token));
    if (!request) {
      throw new InvalidApprovalTokenException();
    }

    // Same shape as deciding: one unscoped read for the token, then the tenant scope comes from the
    // token itself — never from the caller.
    return this.runner.run(request.accountId, () => this.render(request, query.token));
  }

  private async render(request: ApprovalRequest, token: string): Promise<ApprovalPageDto> {
    const content = await this.contents.findById(ContentId.from(request.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    // Same three checks as deciding, so the page never renders a link that cannot be used — the
    // approver learns why before reading and forming an opinion.
    request.assertUsable(content.contentHash);

    const [approver, settings, siblings, contacts] = await Promise.all([
      this.approvers.findById(request.approverId),
      this.settingsRepository.find(),
      this.requests.listForContent(request.contentId),
      // One real contact is enough here; the operator already saw the full three-contact preview.
      this.samples.sampleForPreview({ limit: 1 }),
    ]);

    const effectiveSettings = settings ?? ApprovalSettings.createDefault(request.accountId);
    const firstName = contacts[0]?.firstName ?? null;

    const dto = new ApprovalPageDto();
    dto.approverName = approver?.name ?? 'Aprovador';
    dto.contentTitle = content.title;
    dto.classification = content.classification;
    dto.contentHash = content.contentHash;
    dto.bodyBase = content.bodyBase;
    // Procedência na página do aprovador: para conteúdo eleitoral, saber de onde o texto veio faz parte
    // de julgá-lo. Sem isto, quem decide vê a mensagem e não tem como conferir a fonte.
    dto.sourceUrl = content.sourceUrl;
    dto.includeSourceUrl = content.includeSourceUrl;
    dto.variants = content.variants.map((variant) => ({
      label: variant.label,
      body: variant.body,
    }));
    // A URL é RELATIVA e passa por este backend, não uma URL assinada do MinIO.
    //
    // Duas razões. A primeira é que a assinada não funciona: ela é gerada com o endpoint INTERNO do
    // storage (o nome do container), que o navegador do aprovador não resolve — dá
    // ERR_NAME_NOT_RESOLVED, e a mídia da aprovação simplesmente não abre. A alternativa seria expor
    // a API do MinIO na internet só para isso.
    //
    // A segunda é que servir por aqui herda exatamente a autorização da página: quem tem o token vê,
    // e quando o token morre a mídia morre com ele. Uma URL assinada, uma vez repassada, funciona
    // para qualquer pessoa até expirar — e o link de aprovação circula por WhatsApp.
    dto.media = content.media.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      originalName: asset.originalName,
      downloadUrl: `/api/public/approvals/${token}/media/${asset.id}`,
    }));
    dto.renderedSamples = content.sendableBodies.map((body) => {
      const rendered = renderMergeFields(body.body, { firstName });
      return {
        label: body.label,
        renderedBody: rendered.body,
        usedFallback: rendered.usedFallback,
      };
    });
    dto.expiresAt = request.expiresAt;
    dto.requiredApprovals = effectiveSettings.requiredFor(content.classification);
    dto.approvalsSoFar = siblings.filter(
      (sibling) =>
        sibling.status === ApprovalRequestStatus.APPROVED &&
        sibling.contentHash === content.contentHash,
    ).length;

    return dto;
  }
}
