import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { AddressPurpose } from '../../../domain/entities/contact.entity';
import { ContactId } from '../../../domain/value-objects/contact-id.vo';
import { ContactDto } from '../../dto/contact.dto';
import {
  ContactNotFoundException,
  DuplicateContactCodeException,
  DuplicateContactDocumentException,
} from '../../../domain/exceptions/contact-exceptions';
import { RequiredFieldsChecker } from '../../../../field-config/application/required-fields.checker';
import { AccountPreferencesReader } from '../../../../account/application/account-preferences.reader';

export class UpdateContactCommand {
  constructor(
    public readonly id: string,
    public readonly input: {
      types?: string[];
      personKind?: string;
      legalName?: string;
      tradeName?: string | null;
      document?: string | null;
      stateRegistration?: string | null;
      code?: string | null;
      creditLimit?: number | null;
      salesRepId?: string | null;
      notes?: string | null;
      municipalRegistration?: string | null;
      suframa?: string | null;
      gln?: string | null;
      pixKey?: string | null;
      website?: string | null;
      active?: boolean;
      emails?: { email: string; label?: string | null }[];
      phones?: { phone: string; label?: string | null; isWhatsapp?: boolean }[];
      addresses?: {
        purpose: AddressPurpose;
        street: string;
        number: string;
        complement?: string | null;
        district: string;
        city: string;
        state: string;
        zipCode: string;
        ibgeCityCode?: string | null;
      }[];
    },
  ) {}
}

/**
 * Altera um contato existente.
 *
 * **`findById` antes de tudo, e é ele quem faz o isolamento aqui.** O id vem da URL, então um id de
 * outra conta chegaria a este use case sem nenhum obstáculo do lado do cliente — quem recusa é o
 * escopo de tenant (filtro global + RLS), que faz o `findById` devolver `null`. O resultado é
 * "não encontrado", e não "sem permissão": as duas respostas precisam ser indistinguíveis, senão a
 * diferença entre elas vira um oráculo que confirma a existência de contatos de outras contas.
 *
 * **Coleções são substituídas, não mescladas.** `emails: []` apaga os e-mails; `emails: undefined`
 * não toca neles. É a semântica que o formulário produz: a tela manda a lista inteira que o usuário
 * vê. Mesclar exigiria id por linha e resolveria um problema que a tela não tem.
 */
@Injectable()
export class UpdateContactUseCase implements UseCase<UpdateContactCommand, ContactDto> {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    private readonly requiredFields: RequiredFieldsChecker,
    private readonly preferences: AccountPreferencesReader,
  ) {}

  async execute(command: UpdateContactCommand): Promise<ContactDto> {
    return this.uow.execute(async () => {
      const contactId = ContactId.from(command.id);
      const contact = await this.contacts.findById(contactId);
      if (!contact) {
        throw new ContactNotFoundException(command.id);
      }

      // Obrigatório dinâmico, modo `update`: só cobra os campos que o payload MENCIONA — um
      // obrigatório ausente aqui significa "não mexa", não "apague".
      await this.requiredFields.assertRequiredPresent('contact', { ...command.input }, 'update');

      const prefs = await this.preferences.forAccount(contact.accountId);

      contact.update({
        ...command.input,
        optional: {
          municipalRegistration: command.input.municipalRegistration,
          suframa: command.input.suframa,
          gln: command.input.gln,
          pixKey: command.input.pixKey,
          website: command.input.website,
        },
        addresses: command.input.addresses?.map((entry) => ({
          purpose: entry.purpose,
          address: {
            street: entry.street,
            number: entry.number,
            complement: entry.complement ?? null,
            district: entry.district,
            city: entry.city,
            state: entry.state,
            zipCode: entry.zipCode,
            ibgeCityCode: entry.ibgeCityCode ?? null,
          },
        })),
      });

      // `exceptId`: sem ele, salvar um contato sem mexer no documento acusaria duplicata contra ele
      // mesmo — o defeito clássico de unicidade em edição. Condicional à preferência da conta (§3.4),
      // como na criação.
      const document = contact.document?.value ?? null;
      if (
        !prefs.allowDuplicateDocument &&
        document &&
        (await this.contacts.findByDocument(document, contactId))
      ) {
        throw new DuplicateContactDocumentException(contact.document!.formatted);
      }
      if (contact.code && (await this.contacts.findByCode(contact.code, contactId))) {
        throw new DuplicateContactCodeException(contact.code);
      }

      return ContactDto.fromDomain(await this.contacts.save(contact));
    });
  }
}
