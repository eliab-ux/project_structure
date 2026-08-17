import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { CustomerId } from '../value-objects/customer-id.vo';
import { CustomerDocument } from '../value-objects/customer-document.vo';
import { Address } from '../value-objects/address.vo';
import { LegalRepresentative } from '../value-objects/legal-representative.vo';

export const COMPANY_SIZES = ['mei', 'me', 'epp', 'other'] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  mei: 'MEI',
  me: 'ME',
  epp: 'EPP',
  other: 'Outro',
};

interface Contact {
  whatsapp: PhoneE164;
  email: Email | null;
  phone: PhoneE164 | null;
}

interface Membership {
  isMember: boolean;
  memberSince: Date | null;
}

/**
 * A confecção cliente (spec §4.4).
 *
 * O cadastro é mais pesado do que um "cliente" comum porque a operação é conduzida por uma
 * **associação (APL)** e precisa sustentar prestação de contas: pessoa jurídica identificada,
 * endereço e representante legal com CPF.
 *
 * O que NÃO existe aqui, e por decisão registrada:
 * - **`first_cut_at`** — data do primeiro corte concluído sai por query sobre `cut`, não por
 *   coluna mantida à mão. Coluna denormalizada que ninguém recalcula é coluna que mente.
 * - **produtos cortados historicamente** — derivam de `cut → product_type`. Não existe campo de
 *   produtos no cliente.
 */
export class Customer extends AggregateRoot {
  private constructor(
    private readonly _id: CustomerId,
    private readonly _accountId: AccountId,
    private _legalName: string,
    private _tradeName: string,
    private _document: CustomerDocument,
    private _stateRegistration: string | null,
    private _companySize: CompanySize | null,
    private _employeesCount: number | null,
    private _status: CustomerStatus,
    private _address: Address,
    private _representative: LegalRepresentative,
    private _contact: Contact,
    private _membership: Membership,
    private _notes: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: CustomerData & { accountId: AccountId }): Customer {
    const now = new Date();
    return new Customer(
      CustomerId.create(),
      input.accountId,
      Customer.assertName(input.legalName, 'Razão social'),
      Customer.assertName(input.tradeName, 'Nome fantasia'),
      input.document,
      Customer.normalizeStateRegistration(input.stateRegistration),
      Customer.assertCompanySize(input.companySize),
      Customer.assertEmployeesCount(input.employeesCount),
      'active',
      input.address,
      input.representative,
      input.contact,
      Customer.assertMembership(input.membership),
      input.notes?.trim() || null,
      now,
      now,
    );
  }

  static restore(input: {
    id: CustomerId;
    accountId: AccountId;
    legalName: string;
    tradeName: string;
    document: CustomerDocument;
    stateRegistration: string | null;
    companySize: CompanySize | null;
    employeesCount: number | null;
    status: CustomerStatus;
    address: Address;
    representative: LegalRepresentative;
    contact: Contact;
    membership: Membership;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Customer {
    return new Customer(
      input.id,
      input.accountId,
      input.legalName,
      input.tradeName,
      input.document,
      input.stateRegistration,
      input.companySize,
      input.employeesCount,
      input.status,
      input.address,
      input.representative,
      input.contact,
      input.membership,
      input.notes,
      input.createdAt,
      input.updatedAt,
    );
  }

  update(input: CustomerData): void {
    this._legalName = Customer.assertName(input.legalName, 'Razão social');
    this._tradeName = Customer.assertName(input.tradeName, 'Nome fantasia');
    this._document = input.document;
    this._stateRegistration = Customer.normalizeStateRegistration(input.stateRegistration);
    this._companySize = Customer.assertCompanySize(input.companySize);
    this._employeesCount = Customer.assertEmployeesCount(input.employeesCount);
    this._address = input.address;
    this._representative = input.representative;
    this._contact = input.contact;
    this._membership = Customer.assertMembership(input.membership);
    this._notes = input.notes?.trim() || null;
    this.touch();
  }

  activate(): void {
    this._status = 'active';
    this.touch();
  }

  /**
   * Cliente inativo some da lista de trabalho mas continua existindo — os cortes dele são o
   * histórico do mês em que ele ainda cortava. Nunca há exclusão.
   */
  deactivate(): void {
    this._status = 'inactive';
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static assertName(value: string, label: string): string {
    const name = (value ?? '').trim();
    if (name.length < 2 || name.length > 200) {
      throw new InvalidValueException(`${label} deve ter entre 2 e 200 caracteres.`);
    }
    return name;
  }

  private static normalizeStateRegistration(value: string | null | undefined): string | null {
    const registration = (value ?? '').trim();
    if (!registration) {
      return null;
    }
    if (registration.length > 30) {
      throw new InvalidValueException('Inscrição estadual deve ter no máximo 30 caracteres.');
    }
    return registration;
  }

  private static assertCompanySize(value: CompanySize | null | undefined): CompanySize | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!(COMPANY_SIZES as readonly string[]).includes(value)) {
      throw new InvalidValueException('Porte da empresa inválido.');
    }
    return value;
  }

  private static assertEmployeesCount(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidValueException('Número de funcionários deve ser inteiro e não negativo.');
    }
    return value;
  }

  private static assertMembership(membership: Membership): Membership {
    // Data de associação sem ser associado é dado órfão: quando o filtro "só associados" existir,
    // essa linha ficaria de fora carregando uma data que ninguém explica.
    if (!membership.isMember && membership.memberSince) {
      throw new InvalidValueException(
        'Data de associação só se aplica a cliente associado. Marque como associado ou remova a data.',
      );
    }
    return membership;
  }

  get id(): CustomerId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get legalName(): string {
    return this._legalName;
  }

  /** É o que aparece na agenda e no relatório (spec §4.4). */
  get tradeName(): string {
    return this._tradeName;
  }

  get document(): CustomerDocument {
    return this._document;
  }

  get stateRegistration(): string | null {
    return this._stateRegistration;
  }

  get companySize(): CompanySize | null {
    return this._companySize;
  }

  get employeesCount(): number | null {
    return this._employeesCount;
  }

  get status(): CustomerStatus {
    return this._status;
  }

  get address(): Address {
    return this._address;
  }

  get representative(): LegalRepresentative {
    return this._representative;
  }

  get contact(): Contact {
    return this._contact;
  }

  get membership(): Membership {
    return this._membership;
  }

  get notes(): string | null {
    return this._notes;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}

/** Campos que criar e editar têm em comum — `status` não está aqui: ele tem métodos próprios. */
export interface CustomerData {
  legalName: string;
  tradeName: string;
  document: CustomerDocument;
  stateRegistration?: string | null;
  companySize?: CompanySize | null;
  employeesCount?: number | null;
  address: Address;
  representative: LegalRepresentative;
  contact: Contact;
  membership: Membership;
  notes?: string | null;
}
