import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { ContactType } from '../../../domain/contact-types';
import { ContactDto } from '../../dto/contact.dto';

export class ListContactsQuery {
  constructor(
    public readonly search: string | null = null,
    public readonly type: ContactType | null = null,
    public readonly includeInactive = false,
  ) {}
}

/**
 * Lista os contatos da conta — §5 do CORE: *"lista com filtros por tipo"*.
 *
 * Sem paginação nesta fatia, e é uma decisão com prazo: uma conta nova tem dezenas de contatos, e
 * paginar agora exigiria decidir ordenação estável, cursor e contagem total antes de existir tela
 * que os use. Quando a primeira conta passar de algumas centenas, isto vira fatia própria — e o
 * sinal é observável (a lista demorando), não uma adivinhação de hoje.
 */
@Injectable()
export class ListContactsUseCase implements UseCase<ListContactsQuery, ContactDto[]> {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort) {}

  async execute(query: ListContactsQuery): Promise<ContactDto[]> {
    const contacts = await this.contacts.list({
      search: query.search,
      type: query.type,
      includeInactive: query.includeInactive,
    });
    return contacts.map((contact) => ContactDto.fromDomain(contact));
  }
}
