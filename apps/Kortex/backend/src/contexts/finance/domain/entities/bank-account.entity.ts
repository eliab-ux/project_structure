import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { BankAccountId } from '../value-objects/finance-ids.vo';

/** R$ 10.000.000,00 — teto de sanidade contra digitar centavos como reais. */
const MAX_BALANCE_CENTS = 1_000_000_000;

/**
 * Conta bancária da operação (spec §4.13).
 *
 * A operação tem **conta separada para a máquina**, e o saldo de cada conta precisa fechar
 * individualmente — por isso todo lançamento aponta para uma conta.
 *
 * `openingBalanceCents` é um número inteiro em centavos, e **não** um `Money`: `Money` existe para
 * preço e valor de lançamento, que são sempre positivos. Saldo é outra coisa — começa em zero com
 * frequência e pode ficar negativo com a movimentação.
 */
export class BankAccount extends AggregateRoot {
  private constructor(
    private readonly _id: BankAccountId,
    private readonly _accountId: AccountId,
    private _name: string,
    private _bank: string | null,
    private _openingBalanceCents: number,
    private _isActive: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: {
    accountId: AccountId;
    name: string;
    bank?: string | null;
    openingBalanceCents?: number;
  }): BankAccount {
    const now = new Date();
    return new BankAccount(
      BankAccountId.create(),
      input.accountId,
      BankAccount.assertName(input.name),
      BankAccount.normalizeBank(input.bank),
      BankAccount.assertBalance(input.openingBalanceCents ?? 0),
      true,
      now,
      now,
    );
  }

  static restore(input: {
    id: BankAccountId;
    accountId: AccountId;
    name: string;
    bank: string | null;
    openingBalanceCents: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): BankAccount {
    return new BankAccount(
      input.id,
      input.accountId,
      input.name,
      input.bank,
      input.openingBalanceCents,
      input.isActive,
      input.createdAt,
      input.updatedAt,
    );
  }

  update(input: {
    name: string;
    bank?: string | null;
    openingBalanceCents: number;
    isActive: boolean;
  }): void {
    this._name = BankAccount.assertName(input.name);
    this._bank = BankAccount.normalizeBank(input.bank);
    this._openingBalanceCents = BankAccount.assertBalance(input.openingBalanceCents);
    this._isActive = input.isActive;
    this._updatedAt = new Date();
  }

  private static assertName(name: string): string {
    const value = (name ?? '').trim();
    if (value.length < 2 || value.length > 120) {
      throw new InvalidValueException('Nome da conta deve ter entre 2 e 120 caracteres.');
    }
    return value;
  }

  private static normalizeBank(bank: string | null | undefined): string | null {
    const value = (bank ?? '').trim();
    if (!value) {
      return null;
    }
    if (value.length > 120) {
      throw new InvalidValueException('Nome do banco deve ter no máximo 120 caracteres.');
    }
    return value;
  }

  private static assertBalance(cents: number): number {
    if (!Number.isInteger(cents)) {
      throw new InvalidValueException('Saldo inicial deve ser informado em centavos inteiros.');
    }
    if (Math.abs(cents) > MAX_BALANCE_CENTS) {
      throw new InvalidValueException('Saldo inicial acima do limite permitido.');
    }
    return cents;
  }

  get id(): BankAccountId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get name(): string {
    return this._name;
  }

  get bank(): string | null {
    return this._bank;
  }

  get openingBalanceCents(): number {
    return this._openingBalanceCents;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
