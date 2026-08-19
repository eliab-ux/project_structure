import { AggregateRoot } from '@gitspread/domain-primitives';
import { Address } from '../../../../shared/domain/value-objects/address.vo';
import { Document } from '../../../../shared/domain/value-objects/document.vo';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { CompanyId } from '../value-objects/company-id.vo';
import { StateRegistration } from '../value-objects/state-registration.vo';
import { TaxRegime } from '../value-objects/tax-regime.vo';
import { InconsistentStateRegistrationException } from '../exceptions/company-exceptions';

export interface CompanyFiscalData {
  /** Inscrição Estadual. Null when `stateRegistrationExempt` is true. */
  stateRegistration: string | null;
  stateRegistrationExempt: boolean;
  /** Inscrição Municipal — required for service invoices (NFS-e), optional here. */
  municipalRegistration: string | null;
  suframa: string | null;
  cnae: string | null;
  taxRegime: TaxRegime;
}

/**
 * A CNPJ of the account — an "empresa".
 *
 * Companies are PARALLEL, never hierarchical (Visão Geral §3): there is no matriz/filial link, and
 * that absence is a decision, not an omission. Stock, fiscal numbering and invoicing are segregated
 * per company; moving goods between two of them is a fiscal operation with its own invoice, not an
 * internal transfer.
 *
 * The A1 digital certificate is deliberately NOT modelled here: it lands with the FIS module, which
 * is the only consumer, and modelling it before there is anything to consume it would be guessing
 * at the encryption and storage shape.
 */
export class Company extends AggregateRoot {
  private constructor(
    private readonly _id: CompanyId,
    private readonly _accountId: string,
    private _legalName: string,
    private _tradeName: string | null,
    private readonly _document: Document,
    private _fiscal: CompanyFiscalData,
    private _address: Address,
    private _contactEmail: Email | null,
    private _billingEmail: Email | null,
    private _phone: PhoneE164 | null,
    private _stateRegistrations: StateRegistration[],
    private _logoObjectKey: string | null,
    private _active: boolean,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    legalName: string;
    tradeName?: string | null;
    document: Document;
    fiscal: CompanyFiscalData;
    address: Address;
    contactEmail?: Email | null;
    billingEmail?: Email | null;
    phone?: PhoneE164 | null;
    stateRegistrations?: StateRegistration[];
  }): Company {
    Company.assertFiscalConsistency(params.fiscal);

    return new Company(
      CompanyId.generate(),
      params.accountId,
      params.legalName.trim(),
      params.tradeName?.trim() || null,
      params.document,
      params.fiscal,
      params.address,
      params.contactEmail ?? null,
      params.billingEmail ?? null,
      params.phone ?? null,
      params.stateRegistrations ?? [],
      null,
      true,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: CompanyId;
    accountId: string;
    legalName: string;
    tradeName: string | null;
    document: Document;
    fiscal: CompanyFiscalData;
    address: Address;
    contactEmail: Email | null;
    billingEmail: Email | null;
    phone: PhoneE164 | null;
    stateRegistrations: StateRegistration[];
    logoObjectKey: string | null;
    active: boolean;
    createdAt: Date;
  }): Company {
    return new Company(
      params.id,
      params.accountId,
      params.legalName,
      params.tradeName,
      params.document,
      params.fiscal,
      params.address,
      params.contactEmail,
      params.billingEmail,
      params.phone,
      params.stateRegistrations,
      params.logoObjectKey,
      params.active,
      params.createdAt,
    );
  }

  /**
   * "Isento" and a registration number are mutually exclusive. Checked in the domain and not only
   * in the DTO because the CLI and future importers create companies without passing through HTTP,
   * and an inconsistent pair here only fails much later — at the SEFAZ, on a real invoice.
   */
  private static assertFiscalConsistency(fiscal: CompanyFiscalData): void {
    const hasRegistration = !!fiscal.stateRegistration?.trim();

    if (fiscal.stateRegistrationExempt && hasRegistration) {
      throw new InconsistentStateRegistrationException(
        'Empresa isenta de Inscrição Estadual não pode ter número de IE.',
      );
    }
    // MEI is frequently exempt and frequently has no IE at all, so it is the one regime where an
    // absent, non-exempt registration is a normal state rather than a mistake.
    if (!fiscal.stateRegistrationExempt && !hasRegistration && fiscal.taxRegime !== TaxRegime.MEI) {
      throw new InconsistentStateRegistrationException(
        'Informe a Inscrição Estadual ou marque a empresa como isenta.',
      );
    }
  }

  get id(): CompanyId {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get legalName(): string {
    return this._legalName;
  }

  get tradeName(): string | null {
    return this._tradeName;
  }

  /** Display name: the trade name when there is one, the legal name otherwise. */
  get displayName(): string {
    return this._tradeName ?? this._legalName;
  }

  get document(): Document {
    return this._document;
  }

  get fiscal(): CompanyFiscalData {
    return this._fiscal;
  }

  get address(): Address {
    return this._address;
  }

  get contactEmail(): Email | null {
    return this._contactEmail;
  }

  get billingEmail(): Email | null {
    return this._billingEmail;
  }

  get phone(): PhoneE164 | null {
    return this._phone;
  }

  get stateRegistrations(): readonly StateRegistration[] {
    return this._stateRegistrations;
  }

  get logoObjectKey(): string | null {
    return this._logoObjectKey;
  }

  get active(): boolean {
    return this._active;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  updateIdentification(params: { legalName?: string; tradeName?: string | null }): void {
    if (params.legalName !== undefined) {
      this._legalName = params.legalName.trim();
    }
    if (params.tradeName !== undefined) {
      this._tradeName = params.tradeName?.trim() || null;
    }
  }

  changeFiscalData(fiscal: CompanyFiscalData): void {
    Company.assertFiscalConsistency(fiscal);
    this._fiscal = fiscal;
  }

  changeAddress(address: Address): void {
    this._address = address;
  }

  changeContacts(params: {
    contactEmail?: Email | null;
    billingEmail?: Email | null;
    phone?: PhoneE164 | null;
  }): void {
    if (params.contactEmail !== undefined) {
      this._contactEmail = params.contactEmail;
    }
    if (params.billingEmail !== undefined) {
      this._billingEmail = params.billingEmail;
    }
    if (params.phone !== undefined) {
      this._phone = params.phone;
    }
  }

  /** Replaces the whole list — the UI edits it as a set, and a partial update has no meaning. */
  replaceStateRegistrations(registrations: StateRegistration[]): void {
    const seen = new Set<string>();
    for (const registration of registrations) {
      if (seen.has(registration.state)) {
        throw new InconsistentStateRegistrationException(
          `Há duas inscrições de substituto tributário para ${registration.state}.`,
        );
      }
      seen.add(registration.state);
    }
    this._stateRegistrations = registrations;
  }

  setLogo(objectKey: string | null): void {
    this._logoObjectKey = objectKey;
  }

  /**
   * Deactivation, not deletion: invoices, orders and stock movements already reference this
   * company, and removing it would orphan fiscal history that must be kept for years.
   */
  deactivate(): void {
    this._active = false;
  }

  activate(): void {
    this._active = true;
  }
}
