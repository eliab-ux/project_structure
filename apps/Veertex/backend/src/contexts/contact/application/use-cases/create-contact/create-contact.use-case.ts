import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { Contact } from '../../../domain/entities/contact.entity';
import { AddressPurpose } from '../../../domain/entities/contact.entity';
import { ContactDto } from '../../dto/contact.dto';
import {
  DuplicateContactCodeException,
  DuplicateContactDocumentException,
} from '../../../domain/exceptions/contact-exceptions';

export class CreateContactCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: {
      types: string[];
      personKind: string;
      legalName: string;
      tradeName?: string | null;
      document?: string | null;
      stateRegistration?: string | null;
      code?: string | null;
      creditLimit?: number | null;
      notes?: string | null;
      municipalRegistration?: string | null;
      suframa?: string | null;
      gln?: string | null;
      pixKey?: string | null;
      website?: string | null;
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
 * Cria um contato.
 *
 * **Documento único por conta** — decisão de Eliab (14/08/2026) para o default da preferência que o
 * §3.4 prevê ("permitir CPF/CNPJ duplicado" é preferência da conta, e a preferência ainda não
 * existe). O default é o conservador: dois cadastros com o mesmo CNPJ é o começo de duas verdades
 * sobre o mesmo cliente, e desfazer isso depois exige mesclar histórico.
 *
 * A checagem roda **dentro da mesma transação** da escrita. Fora dela, duas requisições simultâneas
 * com o mesmo CNPJ passariam as duas pela verificação antes de qualquer uma gravar — e o índice
 * único no banco é quem de fato fecha a corrida. A verificação aqui existe para a mensagem ser de
 * negócio ("já existe um contato com este documento") em vez de violação de constraint.
 */
@Injectable()
export class CreateContactUseCase implements UseCase<CreateContactCommand, ContactDto> {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateContactCommand): Promise<ContactDto> {
    return this.uow.execute(async () => {
      const contact = Contact.create({
        accountId: command.accountId,
        types: command.input.types,
        personKind: command.input.personKind,
        legalName: command.input.legalName,
        tradeName: command.input.tradeName,
        document: command.input.document,
        stateRegistration: command.input.stateRegistration,
        code: command.input.code,
        creditLimit: command.input.creditLimit,
        notes: command.input.notes,
        optional: {
          municipalRegistration: command.input.municipalRegistration ?? null,
          suframa: command.input.suframa ?? null,
          gln: command.input.gln ?? null,
          pixKey: command.input.pixKey ?? null,
          website: command.input.website ?? null,
        },
        emails: command.input.emails,
        phones: command.input.phones,
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

      // Depois de construir: o VO normaliza o documento (tira máscara), e comparar o valor cru com o
      // que está no banco é a única comparação que não depende de como o operador digitou.
      const document = contact.document?.value ?? null;
      if (document && (await this.contacts.findByDocument(document))) {
        throw new DuplicateContactDocumentException(contact.document!.formatted);
      }
      if (contact.code && (await this.contacts.findByCode(contact.code))) {
        throw new DuplicateContactCodeException(contact.code);
      }

      return ContactDto.fromDomain(await this.contacts.save(contact));
    });
  }
}
