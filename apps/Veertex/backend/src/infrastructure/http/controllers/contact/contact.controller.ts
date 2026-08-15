import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateContactCommand,
  CreateContactUseCase,
} from '../../../../contexts/contact/application/use-cases/create-contact/create-contact.use-case';
import {
  UpdateContactCommand,
  UpdateContactUseCase,
} from '../../../../contexts/contact/application/use-cases/update-contact/update-contact.use-case';
import {
  ListContactsQuery,
  ListContactsUseCase,
} from '../../../../contexts/contact/application/use-cases/list-contacts/list-contacts.use-case';
import {
  GetContactQuery,
  GetContactUseCase,
} from '../../../../contexts/contact/application/use-cases/get-contact/get-contact.use-case';
import { ContactDto } from '../../../../contexts/contact/application/dto/contact.dto';
import { ContactType } from '../../../../contexts/contact/domain/contact-types';
import {
  CONTACT_FIELD_CATALOG,
  ContactFieldDefinition,
} from '../../../../contexts/contact/domain/contact-field.catalog';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  CreateContactRequestDto,
  ListContactsQueryDto,
  UpdateContactRequestDto,
} from './dto/contact-request.dto';

/**
 * Contatos — §3.4 do CORE.
 *
 * **Sem `@RequireModule`**: contato é CORE. Ele existe em toda conta, independentemente de plano ou
 * de módulo contratado — exatamente como empresas, usuários e papéis. Módulos futuros (VND, ROT)
 * acrescentam o que FAZER com o contato, não o direito de tê-lo.
 */
@Controller('contacts')
@UseGuards(PermissionGuard)
export class ContactController {
  constructor(
    private readonly createContactUseCase: CreateContactUseCase,
    private readonly updateContactUseCase: UpdateContactUseCase,
    private readonly listContactsUseCase: ListContactsUseCase,
    private readonly getContactUseCase: GetContactUseCase,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.contacts.read)
  async list(@Query() query: ListContactsQueryDto): Promise<ContactDto[]> {
    return this.listContactsUseCase.execute(
      new ListContactsQuery(
        query.search ?? null,
        (query.type as ContactType | undefined) ?? null,
        query.includeInactive ?? false,
      ),
    );
  }

  /**
   * O catálogo de campos, para a tela montar o formulário sem manter uma cópia dele.
   *
   * Fixo em código (§3.6: *"o catálogo de campos por entidade é FIXO em código"*), e por isso é
   * igual para todas as contas HOJE. Quando `field_config` existir, esta mesma rota devolverá o
   * catálogo **mesclado** com a configuração da conta — mesmo formato, e a tela não muda. É o motivo
   * de a resposta já trazer `visible` e `required` em vez de só a lista de nomes.
   *
   * Antes de `:id`, senão o roteador do Fastify trataria "field-catalog" como um id e o
   * `ParseUUIDPipe` responderia 400 para uma rota que existe.
   */
  @Get('field-catalog')
  @RequirePermission(PERMISSIONS.contacts.read)
  fieldCatalog(): { fields: ContactFieldDefinition[] } {
    return { fields: [...CONTACT_FIELD_CATALOG] };
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.contacts.read)
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ContactDto> {
    return this.getContactUseCase.execute(new GetContactQuery(id));
  }

  @Post()
  @RequirePermission(PERMISSIONS.contacts.create)
  async create(
    @Body() dto: CreateContactRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<ContactDto> {
    // `accountId` do TOKEN, nunca do corpo — é por isso que nenhum DTO deste sistema o tem.
    return this.createContactUseCase.execute(new CreateContactCommand(actor.accountId, dto));
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.contacts.update)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactRequestDto,
  ): Promise<ContactDto> {
    return this.updateContactUseCase.execute(new UpdateContactCommand(id, dto));
  }
}
