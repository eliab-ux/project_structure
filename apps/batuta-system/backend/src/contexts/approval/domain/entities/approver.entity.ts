import { randomUUID } from 'crypto';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { Email } from '../../../user/domain/value-objects/email.vo';
import { ApproverWithoutContactException } from '../exceptions/approver-without-contact.exception';

/**
 * Someone who may approve content (§8 item 2).
 *
 * "Aprovador **não precisa ter conta de usuário**" — and that is the design, not a convenience: the
 * person approving electoral content for a mandate is often a lawyer or a chief of staff who will
 * never log into a marketing tool. They get a link on their phone and tap it (§8 item 4).
 *
 * So there is no `user_id` here. The link to an account user, when the approver happens to be one, is
 * their e-mail — which is exactly how the "approver ≠ author" check is made.
 */
export class Approver {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _name: string,
    private _email: Email | null,
    private _phone: PhoneE164 | null,
    private _active: boolean,
    private readonly _createdAt: Date,
  ) {}

  static create(params: {
    accountId: string;
    name: string;
    email: Email | null;
    phone: PhoneE164 | null;
  }): Approver {
    // An approver with neither cannot be reached, and an unreachable approver silently blocks every
    // submission for that classification.
    if (!params.email && !params.phone) {
      throw new ApproverWithoutContactException();
    }

    return new Approver(
      randomUUID(),
      params.accountId,
      params.name.trim(),
      params.email,
      params.phone,
      true,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    name: string;
    email: Email | null;
    phone: PhoneE164 | null;
    active: boolean;
    createdAt: Date;
  }): Approver {
    return new Approver(
      params.id,
      params.accountId,
      params.name,
      params.email,
      params.phone,
      params.active,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get name(): string {
    return this._name;
  }

  get email(): Email | null {
    return this._email;
  }

  get phone(): PhoneE164 | null {
    return this._phone;
  }

  get active(): boolean {
    return this._active;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get canReceiveEmail(): boolean {
    return this._email !== null;
  }

  get canReceiveWhatsApp(): boolean {
    return this._phone !== null;
  }

  /**
   * Whether this approver is the same person as the given account user.
   *
   * By e-mail, case-insensitively — the Email value object already normalises. §14 item 11 allows an
   * approver to be an account user; §8.5 forbids them approving their OWN content, and this is how
   * that comparison is made without an FK that the spec deliberately does not have.
   */
  isSamePersonAs(userEmail: string | null): boolean {
    if (!this._email || !userEmail) {
      return false;
    }
    return this._email.value === userEmail.trim().toLowerCase();
  }

  change(params: { name?: string; email?: Email | null; phone?: PhoneE164 | null }): void {
    const nextEmail = params.email !== undefined ? params.email : this._email;
    const nextPhone = params.phone !== undefined ? params.phone : this._phone;

    if (!nextEmail && !nextPhone) {
      throw new ApproverWithoutContactException();
    }

    if (params.name !== undefined) {
      this._name = params.name.trim();
    }
    this._email = nextEmail;
    this._phone = nextPhone;
  }

  /** Deactivated rather than deleted: past `approval_requests` point at this row. */
  deactivate(): void {
    this._active = false;
  }

  activate(): void {
    this._active = true;
  }
}
