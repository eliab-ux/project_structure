import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AudienceModule } from '../audience/audience.module';
import {
  CONTACT_SAMPLE_PROVIDER,
  CONTENT_REPOSITORY,
} from './application/ports/output/content-repository.port';
import { CreateContentUseCase } from './application/use-cases/create-content/create-content.use-case';
import { DuplicateContentUseCase } from './application/use-cases/duplicate-content/duplicate-content.use-case';
import { GetMediaContentUseCase } from './application/use-cases/get-media-content/get-media-content.use-case';
import { ReopenContentUseCase } from './application/use-cases/reopen-content/reopen-content.use-case';
import { UpdateContentUseCase } from './application/use-cases/update-content/update-content.use-case';
import { ListContentsUseCase } from './application/use-cases/list-contents/list-contents.use-case';
import { GetContentUseCase } from './application/use-cases/get-content/get-content.use-case';
import { AddVariantUseCase } from './application/use-cases/add-variant/add-variant.use-case';
import { UpdateVariantUseCase } from './application/use-cases/update-variant/update-variant.use-case';
import { RemoveVariantUseCase } from './application/use-cases/remove-variant/remove-variant.use-case';
import { AttachMediaUseCase } from './application/use-cases/attach-media/attach-media.use-case';
import { RemoveMediaUseCase } from './application/use-cases/remove-media/remove-media.use-case';
import { ArchiveContentUseCase } from './application/use-cases/archive-content/archive-content.use-case';
import { PreviewContentUseCase } from './application/use-cases/preview-content/preview-content.use-case';
import { ContentOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/content-orm.entity';
import { ContentVariantOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/content-variant-orm.entity';
import { MediaAssetOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/media-asset-orm.entity';
import { ContentMapper } from '../../infrastructure/persistence/mikro-orm/mappers/content.mapper';
import { MikroOrmContentRepository } from '../../infrastructure/persistence/mikro-orm/repositories/content.repository';
import { ContactSampleAdapter } from '../../infrastructure/persistence/contact-sample.adapter';

/**
 * Content authoring (FASE 4).
 *
 * AudienceModule is imported for one reason: the §7.4 preview renders against REAL contacts, and the
 * adapter that supplies them needs the contact repository. The content use case itself only knows the
 * `ContactSampleProviderPort`.
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([ContentOrmEntity, ContentVariantOrmEntity, MediaAssetOrmEntity]),
    AudienceModule,
  ],
  providers: [
    ContentMapper,
    { provide: CONTENT_REPOSITORY, useClass: MikroOrmContentRepository },
    { provide: CONTACT_SAMPLE_PROVIDER, useClass: ContactSampleAdapter },
    CreateContentUseCase,
    DuplicateContentUseCase,
    GetMediaContentUseCase,
    ReopenContentUseCase,
    UpdateContentUseCase,
    ListContentsUseCase,
    GetContentUseCase,
    AddVariantUseCase,
    UpdateVariantUseCase,
    RemoveVariantUseCase,
    AttachMediaUseCase,
    RemoveMediaUseCase,
    ArchiveContentUseCase,
    PreviewContentUseCase,
  ],
  exports: [
    CONTENT_REPOSITORY,
    // Exported for FASE 5: the public approval page renders a sample against a real contact, exactly
    // as the authoring preview does — same adapter, so the approver sees what the operator saw.
    CONTACT_SAMPLE_PROVIDER,
    CreateContentUseCase,
    DuplicateContentUseCase,
    GetMediaContentUseCase,
    ReopenContentUseCase,
    UpdateContentUseCase,
    ListContentsUseCase,
    GetContentUseCase,
    AddVariantUseCase,
    UpdateVariantUseCase,
    RemoveVariantUseCase,
    AttachMediaUseCase,
    RemoveMediaUseCase,
    ArchiveContentUseCase,
    PreviewContentUseCase,
  ],
})
export class ContentModule {}
