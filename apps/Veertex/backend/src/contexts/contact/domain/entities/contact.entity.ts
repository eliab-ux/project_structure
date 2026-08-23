import { AggregateRoot } from '@gitspread/domain-primitives';
import { Address } from '../../../../shared/domain/value-objects/address.vo';
import { Document, DocumentType } from '../../../../shared/domain/value-objects/document.vo';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { ContactId } from '../value-objects/contact-id.vo';
import { ContactType, normalizeContactTypes, parsePersonKind, PersonKind } from '../contact-types';
import {
  DocumentKindMismatchException,
  InvalidCreditLimitException,
} from '../exceptions/contact-exceptions';

export type AddressPurpose = 'main' | 'billing' | 'delivery';

export interface ContactAddressEntry {
  purpose: AddressPurpose;
  address: Address;
  /**
   * Preenchidas pela geocodificação, que **não existe nesta fatia** — ela exige BullMQ e Redis
   * (dependências novas) e o §3.4 a define como *best effort*. Nulo aqui é dado ausente, não
   * promessa de recurso: nenhuma tela oferece mapa, nenhum job está registrado.
   */
  latitude: number | null;
  longitude: number | null;
}

export interface ContactEmailEntry {
  email: Email;
  label: string | null;
}

export interface ContactPhoneEntry {
  phone: PhoneE164;
  label: string | null;
  isWhatsapp: boolean;
}

/** Os campos opcionais do §3.4, governados por `field_config` quando ele existir. */
export interface ContactOptionalFields {
  municipalRegistration: string | null;
  suframa: string | null;
  gln: string | null;
  pixKey: string | null;
  website: string | null;
}

/**
 * CONTATO — cadastro único com tipos múltiplos (§3.4 do CORE, decisão fechada).
 *
 * O mesmo registro é cliente, fornecedor, transportadora e/ou revendedor. O critério de aceite §7.6
 * é explícito: *"contato com 2 tipos (cliente+fornecedor) funciona nos dois fluxos sem duplicar"*.
 *
 * ## CARTEIRIZAÇÃO — voltou INTEIRA com o VND (§2.3 do 02), 22/08/2026
 *
 * A decisão de 14/08 foi manter a coluna FORA até existir o filtro que a aplica ("coluna sem filtro é
 * a pior configuração, porque alguém supõe que ela restringe algo"). Com o VND, o filtro chegou —
 * então a coluna `sales_rep_id` entra AGORA, junto com os três pedaços que a tornam real:
 *
 *  - **coluna** `sales_rep_id` (este campo);
 *  - **preferência** da conta `contact_carteirizacao`;
 *  - **filtro em RLS**, resolvido POR REQUEST (nunca no token — ver ADR-0007): com a preferência
 *    ligada, um vendedor sem `contacts.read.all` vê só `sales_rep_id = <seu próprio id>`.
 *
 * A visibilidade mora em RLS + guard, não em `if` de aplicação — o `sales_rep_id` aqui é só o dado; o
 * filtro é a policy da tabela `contacts`, verificada por teste de isolamento POR ATOR (dois vendedores
 * na mesma conta, cada um com o seu contato, mais um sem vendedor). Ver ADR-0007.
 *
 * ## O que ainda NÃO está aqui, e por quê
 *
 *  - **tabela de preço**: `Product` não existe; FK para tabela inexistente é pior que ausência;
 *  - **campos de revendedor** (% comissão, rota, representante): o §3.4 remete ao
 *    `04_Veertex_Rot.md`, não lido. Requisito não se deduz;
 *  - **código sequencial**: o §3.4 o quer como preferência da conta; o default decidido é
 *    **manual**. Sequencial exige contador por tenant, que é design próprio (lock ou sequence), não
 *    um campo.
 */
export class Contact extends AggregateRoot {
  private constructor(
    private readonly _id: ContactId,
    private readonly _accountId: string,
    private _types: ContactType[],
    private _personKind: PersonKind,
    private _legalName: string,
    private _tradeName: string | null,
    private _document: Document | null,
    private _stateRegistration: string | null,
    private _code: string | null,
    private _creditLimit: number | null,
    /** Vendedor vinculado (carteirização, §2.3 do 02). `null` = sem carteira. Ver ADR-0007. */
    private _salesRepId: string | null,
    /** Rota da carteira do revendedor (§2 do 04). `null` = sem rota. Carteirização por rota+rep. */
    private _routeId: string | null,
    private _notes: string | null,
    private _optional: ContactOptionalFields,
    private _emails: ContactEmailEntry[],
    private _phones: ContactPhoneEntry[],
    private _addresses: ContactAddressEntry[],
    private _active: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    types: readonly string[];
    personKind: string;
    legalName: string;
    tradeName?: string | null;
    document?: string | null;
    stateRegistration?: string | null;
    code?: string | null;
    creditLimit?: number | null;
    salesRepId?: string | null;
    routeId?: string | null;
    notes?: string | null;
    optional?: Partial<ContactOptionalFields>;
    emails?: readonly { email: string; label?: string | null }[];
    phones?: readonly { phone: string; label?: string | null; isWhatsapp?: boolean }[];
    addresses?: readonly {
      purpose: AddressPurpose;
      address: Parameters<typeof Address.create>[0];
    }[];
  }): Contact {
    const personKind = parsePersonKind(params.personKind);
    const document = Contact.parseDocument(params.document ?? null, personKind);

    return new Contact(
      ContactId.generate(),
      params.accountId,
      normalizeContactTypes(params.types),
      personKind,
      Contact.requireName(params.legalName),
      trimToNull(params.tradeName),
      document,
      trimToNull(params.stateRegistration),
      trimToNull(params.code),
      Contact.parseCreditLimit(params.creditLimit ?? null),
      trimToNull(params.salesRepId ?? null),
      trimToNull(params.routeId ?? null),
      trimToNull(params.notes),
      normalizeOptional(params.optional),
      (params.emails ?? []).map((entry) => ({
        email: Email.create(entry.email),
        label: trimToNull(entry.label),
      })),
      (params.phones ?? []).map((entry) => ({
        phone: PhoneE164.create(entry.phone),
        label: trimToNull(entry.label),
        isWhatsapp: entry.isWhatsapp ?? false,
      })),
      (params.addresses ?? []).map((entry) => ({
        purpose: entry.purpose,
        address: Address.create(entry.address),
        latitude: null,
        longitude: null,
      })),
      true,
      new Date(),
      new Date(),
    );
  }

  /** Reconstrução a partir da persistência — sem eventos, sem revalidar o que já foi validado. */
  static restore(params: {
    id: string;
    accountId: string;
    types: readonly string[];
    personKind: string;
    legalName: string;
    tradeName: string | null;
    document: string | null;
    stateRegistration: string | null;
    code: string | null;
    creditLimit: number | null;
    salesRepId: string | null;
    routeId: string | null;
    notes: string | null;
    optional: ContactOptionalFields;
    emails: ContactEmailEntry[];
    phones: ContactPhoneEntry[];
    addresses: ContactAddressEntry[];
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Contact {
    return new Contact(
      ContactId.from(params.id),
      params.accountId,
      normalizeContactTypes(params.types),
      parsePersonKind(params.personKind),
      params.legalName,
      params.tradeName,
      params.document ? Document.create(params.document) : null,
      params.stateRegistration,
      params.code,
      params.creditLimit,
      params.salesRepId,
      params.routeId,
      params.notes,
      params.optional,
      params.emails,
      params.phones,
      params.addresses,
      params.active,
      params.createdAt,
      params.updatedAt,
    );
  }

  /**
   * O documento tem de casar com o tipo de pessoa.
   *
   * Pessoa física com CNPJ é erro de digitação em 100% dos casos, e passa despercebido porque o
   * dígito verificador do CNPJ está correto — o `Document` valida o número, não a coerência com o
   * cadastro. É aqui que a coerência entra.
   *
   * Documento é OPCIONAL: o §3.4 não o exige, e o balcão cadastra cliente com nome e telefone antes
   * de ter o CPF. Exigir aqui empurraria o operador a inventar número.
   */
  private static parseDocument(raw: string | null, personKind: PersonKind): Document | null {
    const value = trimToNull(raw);
    if (!value) {
      return null;
    }

    const document = Document.create(value);
    if (personKind === 'individual' && document.type !== DocumentType.CPF) {
      throw new DocumentKindMismatchException('Pessoa física exige CPF, não CNPJ.');
    }
    if (personKind === 'company' && document.type !== DocumentType.CNPJ) {
      throw new DocumentKindMismatchException('Pessoa jurídica exige CNPJ, não CPF.');
    }
    return document;
  }

  private static parseCreditLimit(value: number | null): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Number.isFinite(value) || value < 0) {
      throw new InvalidCreditLimitException('Limite de crédito não pode ser negativo.');
    }
    // Duas casas: dinheiro. Guardar 10.005 e exibir 10,01 faria a soma da tela não bater com a do banco.
    return Math.round(value * 100) / 100;
  }

  private static requireName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new DocumentKindMismatchException('Nome ou razão social é obrigatório.');
    }
    return trimmed;
  }

  update(params: {
    types?: readonly string[];
    personKind?: string;
    legalName?: string;
    tradeName?: string | null;
    document?: string | null;
    stateRegistration?: string | null;
    code?: string | null;
    creditLimit?: number | null;
    salesRepId?: string | null;
    routeId?: string | null;
    notes?: string | null;
    optional?: Partial<ContactOptionalFields>;
    emails?: readonly { email: string; label?: string | null }[];
    phones?: readonly { phone: string; label?: string | null; isWhatsapp?: boolean }[];
    addresses?: readonly {
      purpose: AddressPurpose;
      address: Parameters<typeof Address.create>[0];
    }[];
    active?: boolean;
  }): void {
    if (params.types !== undefined) {
      this._types = normalizeContactTypes(params.types);
    }
    if (params.personKind !== undefined) {
      this._personKind = parsePersonKind(params.personKind);
    }
    if (params.legalName !== undefined) {
      this._legalName = Contact.requireName(params.legalName);
    }
    if (params.tradeName !== undefined) {
      this._tradeName = trimToNull(params.tradeName);
    }
    // O documento é revalidado contra o tipo de pessoa ATUAL — que pode ter acabado de mudar acima.
    // Trocar a pessoa de jurídica para física sem revalidar deixaria um CNPJ num cadastro de PF.
    if (params.document !== undefined || params.personKind !== undefined) {
      const raw = params.document !== undefined ? params.document : (this._document?.value ?? null);
      this._document = Contact.parseDocument(raw, this._personKind);
    }
    if (params.stateRegistration !== undefined) {
      this._stateRegistration = trimToNull(params.stateRegistration);
    }
    if (params.code !== undefined) {
      this._code = trimToNull(params.code);
    }
    if (params.creditLimit !== undefined) {
      this._creditLimit = Contact.parseCreditLimit(params.creditLimit);
    }
    if (params.salesRepId !== undefined) {
      this._salesRepId = trimToNull(params.salesRepId);
    }
    if (params.routeId !== undefined) {
      this._routeId = trimToNull(params.routeId);
    }
    if (params.notes !== undefined) {
      this._notes = trimToNull(params.notes);
    }
    if (params.optional !== undefined) {
      this._optional = normalizeOptional({ ...this._optional, ...params.optional });
    }
    if (params.emails !== undefined) {
      this._emails = params.emails.map((entry) => ({
        email: Email.create(entry.email),
        label: trimToNull(entry.label),
      }));
    }
    if (params.phones !== undefined) {
      this._phones = params.phones.map((entry) => ({
        phone: PhoneE164.create(entry.phone),
        label: trimToNull(entry.label),
        isWhatsapp: entry.isWhatsapp ?? false,
      }));
    }
    if (params.addresses !== undefined) {
      this._addresses = params.addresses.map((entry) => ({
        purpose: entry.purpose,
        address: Address.create(entry.address),
        latitude: null,
        longitude: null,
      }));
    }
    if (params.active !== undefined) {
      this._active = params.active;
    }
    this._updatedAt = new Date();
  }

  get id(): ContactId {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get types(): readonly ContactType[] {
    return this._types;
  }
  get personKind(): PersonKind {
    return this._personKind;
  }
  get legalName(): string {
    return this._legalName;
  }
  get tradeName(): string | null {
    return this._tradeName;
  }
  get displayName(): string {
    return this._tradeName ?? this._legalName;
  }
  get document(): Document | null {
    return this._document;
  }
  get stateRegistration(): string | null {
    return this._stateRegistration;
  }
  get code(): string | null {
    return this._code;
  }
  get creditLimit(): number | null {
    return this._creditLimit;
  }
  get salesRepId(): string | null {
    return this._salesRepId;
  }

  get routeId(): string | null {
    return this._routeId;
  }
  get notes(): string | null {
    return this._notes;
  }
  get optional(): ContactOptionalFields {
    return this._optional;
  }
  get emails(): readonly ContactEmailEntry[] {
    return this._emails;
  }
  get phones(): readonly ContactPhoneEntry[] {
    return this._phones;
  }
  get addresses(): readonly ContactAddressEntry[] {
    return this._addresses;
  }
  get active(): boolean {
    return this._active;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptional(partial?: Partial<ContactOptionalFields>): ContactOptionalFields {
  return {
    municipalRegistration: trimToNull(partial?.municipalRegistration),
    suframa: trimToNull(partial?.suframa),
    gln: trimToNull(partial?.gln),
    pixKey: trimToNull(partial?.pixKey),
    website: trimToNull(partial?.website),
  };
}
