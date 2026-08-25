import {
  Body,
  Controller,
  Get,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PaginatedResult } from '@gitspread/shared-kernel';
import { StartContactImportUseCase } from '../../../../contexts/audience/application/use-cases/start-contact-import/start-contact-import.use-case';
import { StartContactImportCommand } from '../../../../contexts/audience/application/use-cases/start-contact-import/start-contact-import.command';
import { GetContactImportUseCase } from '../../../../contexts/audience/application/use-cases/get-contact-import/get-contact-import.use-case';
import { GetContactImportQuery } from '../../../../contexts/audience/application/use-cases/get-contact-import/get-contact-import.query';
import {
  ListContactImportsQuery,
  ListContactImportsUseCase,
} from '../../../../contexts/audience/application/use-cases/list-contact-imports/list-contact-imports.use-case';
import {
  ListSenderMigrationsQuery,
  ListSenderMigrationsUseCase,
} from '../../../../contexts/audience/application/use-cases/list-sender-migrations/list-sender-migrations.use-case';
import { ListContactsUseCase } from '../../../../contexts/audience/application/use-cases/list-contacts/list-contacts.use-case';
import { ListContactsQuery } from '../../../../contexts/audience/application/use-cases/list-contacts/list-contacts.query';
import { GetContactUseCase } from '../../../../contexts/audience/application/use-cases/get-contact/get-contact.use-case';
import { GetContactQuery } from '../../../../contexts/audience/application/use-cases/get-contact/get-contact.query';
import { GetChannelLoadsUseCase } from '../../../../contexts/audience/application/use-cases/get-channel-loads/get-channel-loads.use-case';
import { GetChannelLoadsQuery } from '../../../../contexts/audience/application/use-cases/get-channel-loads/get-channel-loads.query';
import { ListContactTagsUseCase } from '../../../../contexts/audience/application/use-cases/list-contact-tags/list-contact-tags.use-case';
import { ListContactTagsQuery } from '../../../../contexts/audience/application/use-cases/list-contact-tags/list-contact-tags.query';
import { DeleteContactUseCase } from '../../../../contexts/audience/application/use-cases/delete-contact/delete-contact.use-case';
import { DeleteContactCommand } from '../../../../contexts/audience/application/use-cases/delete-contact/delete-contact.command';
import { PreviewSenderMigrationUseCase } from '../../../../contexts/audience/application/use-cases/preview-sender-migration/preview-sender-migration.use-case';
import { PreviewSenderMigrationQuery } from '../../../../contexts/audience/application/use-cases/preview-sender-migration/preview-sender-migration.query';
import { ExecuteSenderMigrationUseCase } from '../../../../contexts/audience/application/use-cases/execute-sender-migration/execute-sender-migration.use-case';
import { ExecuteSenderMigrationCommand } from '../../../../contexts/audience/application/use-cases/execute-sender-migration/execute-sender-migration.command';
import { OptOutContactUseCase } from '../../../../contexts/audience/application/use-cases/opt-out-contact/opt-out-contact.use-case';
import { OptOutContactCommand } from '../../../../contexts/audience/application/use-cases/opt-out-contact/opt-out-contact.command';
import { DeactivateContactUseCase } from '../../../../contexts/audience/application/use-cases/set-contact-routing/deactivate-contact.use-case';
import { ReactivateContactUseCase } from '../../../../contexts/audience/application/use-cases/set-contact-routing/reactivate-contact.use-case';
import {
  DeactivateContactCommand,
  ReactivateContactCommand,
} from '../../../../contexts/audience/application/use-cases/set-contact-routing/set-contact-routing.command';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { AccountAdminGuard } from '../../../security/guards/account-admin.guard';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { ClientIp, CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  ContactImportJobData,
  QUEUE_CONTACT_IMPORT,
} from '../../../messaging/queues/queues.constants';
import {
  ExecuteMigrationRequestDto,
  ListContactsQueryDto,
  MigrationPreviewQueryDto,
  OptOutRequestDto,
  StartContactImportRequestDto,
} from './dto/contact-request.dto';
import {
  ChannelLoadResponseDto,
  ContactTagResponseDto,
  ContactDetailResponseDto,
  ContactImportReportResponseDto,
  ContactImportResponseDto,
  ContactResponseDto,
  MigrationPreviewResponseDto,
  SenderMigrationResponseDto,
} from './dto/contact-response.dto';

/**
 * Contacts, imports and sender migration (FASE 3).
 *
 * Guards follow Least Privilege: reading contacts and channel loads is fine for any authenticated
 * user of the account; importing, migrating and opting out are ACCOUNT_ADMIN only, because each of
 * them changes the base irreversibly.
 *
 * Note what is NOT here: no endpoint sets `current_channel_id` (allocation is the allocator's, change
 * is the migration's, §6.2/§6.4), and no endpoint clears `opted_out_at` (§6.5 is irreversible).
 */
@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactController {
  constructor(
    private readonly startImport: StartContactImportUseCase,
    private readonly getImport: GetContactImportUseCase,
    private readonly listContactImports: ListContactImportsUseCase,
    private readonly listSenderMigrations: ListSenderMigrationsUseCase,
    private readonly listContacts: ListContactsUseCase,
    private readonly getContact: GetContactUseCase,
    private readonly getChannelLoads: GetChannelLoadsUseCase,
    private readonly listContactTags: ListContactTagsUseCase,
    private readonly deleteContact: DeleteContactUseCase,
    private readonly previewMigration: PreviewSenderMigrationUseCase,
    private readonly executeMigration: ExecuteSenderMigrationUseCase,
    private readonly optOutContact: OptOutContactUseCase,
    private readonly deactivateContact: DeactivateContactUseCase,
    private readonly reactivateContact: ReactivateContactUseCase,
    @InjectQueue(QUEUE_CONTACT_IMPORT) private readonly importQueue: Queue,
  ) {}

  @Get()
  async list(
    @Query() query: ListContactsQueryDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<PaginatedResult<ContactResponseDto>> {
    const page = await this.listContacts.execute(
      new ListContactsQuery(
        user.accountId,
        query.page,
        query.limit,
        query.tags,
        query.channelId,
        query.active,
        query.optedOut,
        query.search,
      ),
    );
    return { data: page.data.map((contact) => ContactResponseDto.from(contact)), meta: page.meta };
  }

  /**
   * The tags that exist in the base, for picking an audience instead of typing one from memory.
   *
   * Declared before `@Get(':id')`, like every other literal path in this controller: Nest matches in
   * declaration order, so `tags` would otherwise be parsed as a contact id and rejected by the UUID
   * pipe — a 400 that says nothing about the real cause.
   */
  @Get('tags')
  async listTags(): Promise<ContactTagResponseDto[]> {
    const tags = await this.listContactTags.execute(new ListContactTagsQuery());
    return tags.map((tag) => ContactTagResponseDto.from(tag));
  }

  /** Contacts per channel — the "carga por canal" panel, and what makes greedy allocation legible. */
  @Get('channel-loads')
  async channelLoads(@CurrentUser() user: AuthTokenPayload): Promise<ChannelLoadResponseDto[]> {
    const loads = await this.getChannelLoads.execute(new GetChannelLoadsQuery(user.accountId));
    return loads.map((load) => ChannelLoadResponseDto.from(load));
  }

  /** History of migrations — a migration is undone only by another one, so the record is the trail. */
  @Get('sender-migrations')
  @UseGuards(AccountAdminGuard)
  async listMigrations(): Promise<SenderMigrationResponseDto[]> {
    const migrations = await this.listSenderMigrations.execute(new ListSenderMigrationsQuery());
    return migrations.map((migration) => SenderMigrationResponseDto.from(migration));
  }

  /** Preview of a sender migration. Mandatory before executing (§6.4 item 3). */
  @Get('sender-migrations/preview')
  @UseGuards(AccountAdminGuard)
  async migrationPreview(
    @Query() query: MigrationPreviewQueryDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<MigrationPreviewResponseDto> {
    const preview = await this.previewMigration.execute(
      new PreviewSenderMigrationQuery(
        user.accountId,
        query.fromChannelId,
        query.strategy,
        query.toChannelId ?? null,
      ),
    );
    return MigrationPreviewResponseDto.from(preview);
  }

  @Post('sender-migrations')
  @HttpCode(200)
  @UseGuards(AccountAdminGuard)
  async migrate(
    @Body() dto: ExecuteMigrationRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<SenderMigrationResponseDto> {
    const migration = await this.executeMigration.execute(
      new ExecuteSenderMigrationCommand(
        user.accountId,
        user.sub,
        dto.fromChannelId,
        dto.strategy,
        dto.toChannelId ?? null,
        ip,
      ),
    );
    return SenderMigrationResponseDto.from(migration);
  }

  /**
   * Accepts the file and enqueues the work (§6.1 item 7). 202: the import is running, and the client
   * polls `GET /contacts/imports/:id` for progress and the report.
   */
  @Post('imports')
  @HttpCode(202)
  @UseGuards(AccountAdminGuard)
  async importContacts(
    @Body() dto: StartContactImportRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContactImportResponseDto> {
    const mapping = {
      phone: dto.mapping.phone,
      name: dto.mapping.name ?? null,
      tags: dto.mapping.tags ?? null,
    };

    const started = await this.startImport.execute(
      new StartContactImportCommand(
        user.accountId,
        user.sub,
        dto.fileName,
        dto.fileMimeType,
        dto.fileBase64,
        dto.consentBasis,
        dto.originNote,
        mapping,
        dto.hasHeader,
        ip,
      ),
    );

    const jobData: ContactImportJobData = {
      accountId: user.accountId,
      importId: started.id,
      mapping,
      hasHeader: dto.hasHeader,
    };
    await this.importQueue.add('process', jobData, {
      // Deterministic id: a double-submitted upload cannot process the same import twice.
      jobId: started.id,
      // No retry: the use case records its own failure with a message the operator reads, and a retry
      // of a half-finished parse would double-count progress.
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100,
    });

    return ContactImportResponseDto.from(started);
  }

  /**
   * Recent imports of the account.
   *
   * Declared BEFORE `@Get(':id')`, and that ordering is load-bearing: Nest matches in declaration
   * order, so with `:id` first the path `/contacts/imports` would be read as a contact whose id is
   * "imports" and `ParseUUIDPipe` would answer 400 — which is exactly what the screen was getting.
   */
  @Get('imports')
  async listImports(): Promise<ContactImportResponseDto[]> {
    const imports = await this.listContactImports.execute(new ListContactImportsQuery());
    return imports.map((contactImport) => ContactImportResponseDto.from(contactImport));
  }

  @Get('imports/:id')
  async importReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<ContactImportReportResponseDto> {
    const report = await this.getImport.execute(new GetContactImportQuery(user.accountId, id));
    return ContactImportReportResponseDto.from(report);
  }

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<ContactDetailResponseDto> {
    const detail = await this.getContact.execute(new GetContactQuery(user.accountId, id));
    return ContactDetailResponseDto.from(detail);
  }

  /**
   * Permanent removal from routing (§6.5). Irreversible: there is no endpoint that undoes this, and
   * bringing the contact back requires a new import with its own provenance.
   */
  @Post(':id/opt-out')
  @HttpCode(200)
  @UseGuards(AccountAdminGuard)
  async optOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: OptOutRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContactResponseDto> {
    const contact = await this.optOutContact.execute(
      new OptOutContactCommand(user.accountId, user.sub, id, ip),
    );
    return ContactResponseDto.from(contact);
  }

  /**
   * Remove o contato dos envios sem apagá-lo — a saída para quem o `DELETE` recusa.
   *
   * É `active = false`, e isso basta: o planejamento já exclui contato não roteável (§9.1) e a execução
   * recheca e bloqueia com `CONTACT_INACTIVE`. Duas camadas independentes, nenhuma coluna nova.
   *
   * **Não é opt-out**, e a distinção é deliberada: `opt_out_rate` alimenta o throttle, então registrar
   * decisão do operador como "o contato pediu para sair" cortaria a cota de um chip saudável.
   *
   * 200 com o contato: a tela precisa do novo `active` para atualizar a linha sem recarregar.
   */
  @Post(':id/deactivate')
  @HttpCode(200)
  @UseGuards(AccountAdminGuard)
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContactResponseDto> {
    const contact = await this.deactivateContact.execute(
      new DeactivateContactCommand(user.accountId, user.sub, id, ip),
    );
    return ContactResponseDto.from(contact);
  }

  /**
   * Devolve o contato aos envios.
   *
   * Existe porque estado sem volta transforma um clique errado em perda permanente. Recusa com 400 quem
   * pediu para sair — essa supressão é definitiva (§6.5) e a checagem está na entidade, não aqui, para
   * valer em qualquer caminho que chegue nela.
   */
  @Post(':id/reactivate')
  @HttpCode(200)
  @UseGuards(AccountAdminGuard)
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContactResponseDto> {
    const contact = await this.reactivateContact.execute(
      new ReactivateContactCommand(user.accountId, user.sub, id, ip),
    );
    return ContactResponseDto.from(contact);
  }

  /**
   * Apaga o contato da base.
   *
   * Recusa quem já recebeu algum envio e quem pediu para sair — as duas razões estão em
   * `ContactNotDeletableException`, e chegam ao operador como 400 com o texto explicando o que fazer
   * no lugar, não como um erro genérico.
   *
   * 204 sem corpo: não há o que devolver de uma linha que deixou de existir.
   */
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AccountAdminGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.deleteContact.execute(new DeleteContactCommand(user.accountId, id, user.sub, ip));
  }
}
