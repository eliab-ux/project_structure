import { AggregateRoot } from '@gitspread/domain-primitives';
import { ResellerId } from '../value-objects/reseller-id.vo';
import { UniqueLink } from '../value-objects/unique-link.vo';
import { CPF } from '../value-objects/cpf.vo';
import { ResellerStatus } from '../value-objects/reseller-status.vo';
import { ResellerLevel } from '../value-objects/reseller-level.vo';
import { ResellerRegisteredEvent } from '../events/reseller-registered.event';
import { ResellerApprovedEvent } from '../events/reseller-approved.event';
import { ResellerLevelChangedEvent } from '../events/reseller-level-changed.event';
import { ResellerRejectedEvent } from '../events/reseller-rejected.event';
import { ResellerSuspendedEvent } from '../events/reseller-suspended.event';
import { ResellerReactivatedEvent } from '../events/reseller-reactivated.event';
import { ResellerStatusTransitionException } from '../exceptions/reseller-status-transition.exception';

export class Reseller extends AggregateRoot {
  private constructor(
    private readonly _id: ResellerId,
    private readonly _userId: string,
    private readonly _uniqueLink: UniqueLink,
    private readonly _cpf: CPF,
    private readonly _type: 'pf' | 'pj',
    private readonly _birthDate: Date | null,
    private readonly _addressZipCode: string | null,
    private readonly _addressStreet: string | null,
    private readonly _addressNumber: string | null,
    private readonly _addressComplement: string | null,
    private readonly _addressNeighborhood: string | null,
    private readonly _addressCity: string | null,
    private readonly _addressState: string | null,
    private _fullName: string,
    private _status: ResellerStatus,
    private _level: ResellerLevel,
    private _canSetCustomPrice: boolean,
    private _approvedAt: Date | null,
    private _approvedBy: string | null,
    private _rejectedAt: Date | null,
    private _rejectedReason: string | null,
    private _phone: string | null,
    private _bankName: string | null,
    private _bankCode: string | null,
    private _bankAgency: string | null,
    private _bankAccount: string | null,
    private _bankAccountType: string | null,
    private _bankHolderName: string | null,
    private _bankHolderCpf: string | null,
    private _pixKey: string | null,
    private _pixKeyType: string | null,
    private _suspendedAt: Date | null,
    private _suspendedBy: string | null,
    private _suspensionReason: string | null,
    private _totalSoldYear: number,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(
    userId: string,
    uniqueLink: UniqueLink,
    fullName: string,
    cpf: CPF,
    type: 'pf' | 'pj',
    birthDate: Date | null,
    address?: {
      zipCode?: string | null;
      street?: string | null;
      number?: string | null;
      complement?: string | null;
      neighborhood?: string | null;
      city?: string | null;
      state?: string | null;
    },
    phone?: string | null,
    bankName?: string | null,
    bankCode?: string | null,
    bankAgency?: string | null,
    bankAccount?: string | null,
    bankAccountType?: string | null,
    bankHolderName?: string | null,
    bankHolderCpf?: string | null,
    pixKey?: string | null,
    pixKeyType?: string | null,
  ): Reseller {
    const normalizedFullName = fullName?.trim();
    if (!normalizedFullName || normalizedFullName.length < 2 || normalizedFullName.length > 255) {
      throw new Error('Full name must be between 2 and 255 characters');
    }

    const normalize = (value?: string | null) => {
      const trimmed = value?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : null;
    };

    const normalizedAddress = {
      zipCode: normalize(address?.zipCode),
      street: normalize(address?.street),
      number: normalize(address?.number),
      complement: normalize(address?.complement),
      neighborhood: normalize(address?.neighborhood),
      city: normalize(address?.city),
      state: normalize(address?.state),
    };

    const reseller = new Reseller(
      ResellerId.generate(),
      userId,
      uniqueLink,
      cpf,
      type,
      birthDate,
      normalizedAddress.zipCode,
      normalizedAddress.street,
      normalizedAddress.number,
      normalizedAddress.complement,
      normalizedAddress.neighborhood,
      normalizedAddress.city,
      normalizedAddress.state,
      normalizedFullName,
      ResellerStatus.pending(),
      ResellerLevel.bronze(),
      false,
      null,
      null,
      null,
      null,
      phone ?? null,
      bankName ?? null,
      bankCode ?? null,
      bankAgency ?? null,
      bankAccount ?? null,
      bankAccountType ?? null,
      bankHolderName ?? null,
      bankHolderCpf ?? null,
      pixKey ?? null,
      pixKeyType ?? null,
      null,
      null,
      null,
      0,
      new Date(),
      new Date(),
    );

    reseller.addDomainEvent(new ResellerRegisteredEvent(reseller.id.value, userId, cpf.value));

    return reseller;
  }

  updateProfile(fullName?: string | null, phone?: string | null): void {
    let hasChanges = false;

    if (fullName !== undefined && fullName !== null) {
      const normalizedFullName = fullName.trim();
      if (!normalizedFullName || normalizedFullName.length < 2 || normalizedFullName.length > 255) {
        throw new Error('Full name must be between 2 and 255 characters');
      }
      if (normalizedFullName !== this._fullName) {
        this._fullName = normalizedFullName;
        hasChanges = true;
      }
    }

    if (phone !== undefined) {
      const sanitizedPhone = phone?.trim() ?? null;
      if (sanitizedPhone !== this._phone) {
        this._phone = sanitizedPhone;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this._updatedAt = new Date();
    }
  }

  updateBankInfo(bankInfo: {
    bankName?: string | null;
    bankCode?: string | null;
    bankAgency?: string | null;
    bankAccount?: string | null;
    bankAccountType?: string | null;
    bankHolderName?: string | null;
    bankHolderCpf?: string | null;
    pixKey?: string | null;
    pixKeyType?: string | null;
  }): void {
    const normalize = (value?: string | null) => {
      const trimmed = value?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : null;
    };

    const normalized = {
      bankName: normalize(bankInfo.bankName),
      bankCode: normalize(bankInfo.bankCode),
      bankAgency: normalize(bankInfo.bankAgency),
      bankAccount: normalize(bankInfo.bankAccount),
      bankAccountType: normalize(bankInfo.bankAccountType),
      bankHolderName: normalize(bankInfo.bankHolderName),
      bankHolderCpf: normalize(bankInfo.bankHolderCpf),
      pixKey: normalize(bankInfo.pixKey),
      pixKeyType: normalize(bankInfo.pixKeyType),
    };

    const hasChanges =
      this._bankName !== normalized.bankName ||
      this._bankCode !== normalized.bankCode ||
      this._bankAgency !== normalized.bankAgency ||
      this._bankAccount !== normalized.bankAccount ||
      this._bankAccountType !== normalized.bankAccountType ||
      this._bankHolderName !== normalized.bankHolderName ||
      this._bankHolderCpf !== normalized.bankHolderCpf ||
      this._pixKey !== normalized.pixKey ||
      this._pixKeyType !== normalized.pixKeyType;

    if (hasChanges) {
      this._bankName = normalized.bankName;
      this._bankCode = normalized.bankCode;
      this._bankAgency = normalized.bankAgency;
      this._bankAccount = normalized.bankAccount;
      this._bankAccountType = normalized.bankAccountType;
      this._bankHolderName = normalized.bankHolderName;
      this._bankHolderCpf = normalized.bankHolderCpf;
      this._pixKey = normalized.pixKey;
      this._pixKeyType = normalized.pixKeyType;
      this._updatedAt = new Date();
    }
  }

  approve(approvedBy: string): void {
    if (!this._status.isPending()) {
      throw new Error('Only pending resellers can be approved');
    }

    this._status = ResellerStatus.active();
    this._approvedAt = new Date();
    this._approvedBy = approvedBy;
    this._updatedAt = new Date();

    this.addDomainEvent(new ResellerApprovedEvent(this._id.value, this._userId, approvedBy));
  }

  reject(rejectedBy: string, reason: string): void {
    if (!this._status.isPending()) {
      throw new Error('Only pending resellers can be rejected');
    }

    this._status = ResellerStatus.rejected();
    this._rejectedAt = new Date();
    this._rejectedReason = reason;
    this._updatedAt = new Date();

    this.addDomainEvent(new ResellerRejectedEvent(this._id.value, rejectedBy, reason));
  }

  upgradeLevel(newLevel: ResellerLevel): void {
    const previous = this._level;
    this._level = newLevel;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new ResellerLevelChangedEvent(this._id.value, previous.value, newLevel.value),
    );
  }

  enableCustomPricing(): void {
    this._canSetCustomPrice = true;
    this._updatedAt = new Date();
  }

  disableCustomPricing(): void {
    this._canSetCustomPrice = false;
    this._updatedAt = new Date();
  }

  suspend(adminId: string, reason: string): void {
    if (!this._status.isActive()) {
      throw new ResellerStatusTransitionException('Somente revendedores aprovados podem ser suspensos');
    }

    const normalizedReason = reason?.trim() ?? '';
    if (normalizedReason.length < 5) {
      throw new ResellerStatusTransitionException('Informe um motivo válido com pelo menos 5 caracteres');
    }

    this._status = ResellerStatus.suspended();
    this._suspendedAt = new Date();
    this._suspendedBy = adminId;
    this._suspensionReason = normalizedReason;
    this._updatedAt = new Date();

    this.addDomainEvent(new ResellerSuspendedEvent(this._id.value, adminId, normalizedReason));
  }

  reactivate(adminId: string): void {
    if (!this._status.isSuspended()) {
      throw new ResellerStatusTransitionException('Somente revendedores suspensos podem ser reativados');
    }

    this._status = ResellerStatus.active();
    this._suspendedAt = null;
    this._suspendedBy = null;
    this._suspensionReason = null;
    this._updatedAt = new Date();

    this.addDomainEvent(new ResellerReactivatedEvent(this._id.value, adminId));
  }

  get id(): ResellerId {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get fullName(): string {
    return this._fullName;
  }

  get uniqueLink(): UniqueLink {
    return this._uniqueLink;
  }

  get cpf(): CPF {
    return this._cpf;
  }

  get type(): 'pf' | 'pj' {
    return this._type;
  }

  get birthDate(): Date | null {
    return this._birthDate;
  }

  get addressZipCode(): string | null {
    return this._addressZipCode;
  }

  get addressStreet(): string | null {
    return this._addressStreet;
  }

  get addressNumber(): string | null {
    return this._addressNumber;
  }

  get addressComplement(): string | null {
    return this._addressComplement;
  }

  get addressNeighborhood(): string | null {
    return this._addressNeighborhood;
  }

  get addressCity(): string | null {
    return this._addressCity;
  }

  get addressState(): string | null {
    return this._addressState;
  }

  get status(): ResellerStatus {
    return this._status;
  }

  get level(): ResellerLevel {
    return this._level;
  }

  get canSetCustomPrice(): boolean {
    return this._canSetCustomPrice;
  }

  get approvedAt(): Date | null {
    return this._approvedAt;
  }

  get approvedBy(): string | null {
    return this._approvedBy;
  }

  get rejectedAt(): Date | null {
    return this._rejectedAt;
  }

  get rejectedReason(): string | null {
    return this._rejectedReason;
  }

  get phone(): string | null {
    return this._phone;
  }

  get bankName(): string | null {
    return this._bankName;
  }

  get bankCode(): string | null {
    return this._bankCode;
  }

  get bankAgency(): string | null {
    return this._bankAgency;
  }

  get bankAccount(): string | null {
    return this._bankAccount;
  }

  get bankAccountType(): string | null {
    return this._bankAccountType;
  }

  get bankHolderName(): string | null {
    return this._bankHolderName;
  }

  get bankHolderCpf(): string | null {
    return this._bankHolderCpf;
  }

  get pixKey(): string | null {
    return this._pixKey;
  }

  get pixKeyType(): string | null {
    return this._pixKeyType;
  }

  get suspendedAt(): Date | null {
    return this._suspendedAt;
  }

  get suspendedBy(): string | null {
    return this._suspendedBy;
  }

  get suspensionReason(): string | null {
    return this._suspensionReason;
  }

  get totalSoldYear(): number {
    return this._totalSoldYear;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static reconstitute(
    id: ResellerId,
    userId: string,
    uniqueLink: UniqueLink,
    cpf: CPF,
    type: 'pf' | 'pj',
    birthDate: Date | null,
    addressZipCode: string | null,
    addressStreet: string | null,
    addressNumber: string | null,
    addressComplement: string | null,
    addressNeighborhood: string | null,
    addressCity: string | null,
    addressState: string | null,
    fullName: string,
    status: ResellerStatus,
    level: ResellerLevel,
    canSetCustomPrice: boolean,
    approvedAt: Date | null,
    approvedBy: string | null,
    rejectedAt: Date | null,
    rejectedReason: string | null,
    phone: string | null,
    bankName: string | null,
    bankCode: string | null,
    bankAgency: string | null,
    bankAccount: string | null,
    bankAccountType: string | null,
    bankHolderName: string | null,
    bankHolderCpf: string | null,
    pixKey: string | null,
    pixKeyType: string | null,
    suspendedAt: Date | null,
    suspendedBy: string | null,
    suspensionReason: string | null,
    totalSoldYear: number,
    createdAt: Date,
    updatedAt: Date,
  ): Reseller {
    return new Reseller(
      id,
      userId,
      uniqueLink,
      cpf,
      type,
      birthDate,
      addressZipCode,
      addressStreet,
      addressNumber,
      addressComplement,
      addressNeighborhood,
      addressCity,
      addressState,
      fullName,
      status,
      level,
      canSetCustomPrice,
      approvedAt,
      approvedBy,
      rejectedAt,
      rejectedReason,
      phone,
      bankName,
      bankCode,
      bankAgency,
      bankAccount,
      bankAccountType,
      bankHolderName,
      bankHolderCpf,
      pixKey,
      pixKeyType,
      suspendedAt,
      suspendedBy,
      suspensionReason,
      totalSoldYear,
      createdAt,
      updatedAt,
    );
  }
}
