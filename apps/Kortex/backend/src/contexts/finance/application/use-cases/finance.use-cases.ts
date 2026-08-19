import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  BANK_ACCOUNT_REPOSITORY,
  BankAccountRepositoryPort,
  CASH_ENTRY_REPOSITORY,
  CashEntryRepositoryPort,
  FINANCIAL_CATEGORY_REPOSITORY,
  FinancialCategoryRepositoryPort,
} from '../ports/output/finance-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  BalancesDto,
  BankAccountDto,
  CashEntryDto,
  DreDto,
  FinancialCategoryDto,
} from '../dto/finance.dto';
import {
  ReferenceResolver,
  refOrPlaceholder,
} from '../../../pre-order/application/reference-resolver';
import { NamedRef } from '../../../pre-order/application/dto/pre-order.dto';
import { BankAccount } from '../../domain/entities/bank-account.entity';
import {
  DEFAULT_CATEGORIES,
  FinancialCategory,
  MACHINE_HOUR_CATEGORY,
} from '../../domain/entities/financial-category.entity';
import { CashEntry } from '../../domain/entities/cash-entry.entity';
import {
  BankAccountNotFoundException,
  CashEntryNotFoundException,
  CategoryDirectionMismatchException,
  FinancialCategoryNotFoundException,
  NoBankAccountForPaymentException,
} from '../../domain/exceptions/finance.exceptions';
import {
  BankAccountId,
  CashEntryId,
  FinancialCategoryId,
} from '../../domain/value-objects/finance-ids.vo';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../user/domain/value-objects/user-id.vo';
import { ReservationId } from '../../../schedule/domain/value-objects/reservation-id.vo';
import { PaymentMethod } from '../../../schedule/domain/entities/reservation.entity';
import {
  CashRecorderPort,
  ReservationPaymentRecord,
} from '../../../schedule/application/ports/output/cash-recorder.port';
import { Money } from '../../../../shared/domain/value-objects/money.vo';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';

export interface CashEntryInput {
  type: 'in' | 'out';
  occurredOn: string;
  amountCents: number;
  categoryId: string;
  bankAccountId: string;
  description: string;
  payee?: string | null;
  paymentMethod?: string | null;
}

export interface TransferInput {
  occurredOn: string;
  amountCents: number;
  fromAccountId: string;
  toAccountId: string;
  description: string;
}

/**
 * O caixa da operação. Implementa também o `CashRecorderPort` da agenda — é ele que faz o
 * pagamento de uma reserva virar entrada de caixa no mesmo ato.
 */
@Injectable()
export class FinanceUseCases implements CashRecorderPort {
  private readonly logger = new Logger(FinanceUseCases.name);

  constructor(
    @Inject(BANK_ACCOUNT_REPOSITORY)
    private readonly bankAccounts: BankAccountRepositoryPort,
    @Inject(FINANCIAL_CATEGORY_REPOSITORY)
    private readonly categories: FinancialCategoryRepositoryPort,
    @Inject(CASH_ENTRY_REPOSITORY)
    private readonly entries: CashEntryRepositoryPort,
    private readonly references: ReferenceResolver,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  // ==== Contas bancárias ====

  async listBankAccounts(accountId: string): Promise<BankAccountDto[]> {
    const list = await this.bankAccounts.listByAccount(AccountId.from(accountId));
    return list.map(BankAccountDto.fromDomain);
  }

  async createBankAccount(
    accountId: string,
    input: { name: string; bank?: string | null; openingBalanceCents?: number },
  ): Promise<BankAccountDto> {
    const bankAccount = BankAccount.create({ accountId: AccountId.from(accountId), ...input });
    const saved = await this.unitOfWork.execute(async () => this.bankAccounts.save(bankAccount));
    return BankAccountDto.fromDomain(saved);
  }

  async updateBankAccount(
    accountId: string,
    bankAccountId: string,
    input: { name: string; bank?: string | null; openingBalanceCents: number; isActive: boolean },
  ): Promise<BankAccountDto> {
    const account = AccountId.from(accountId);
    const bankAccount = await this.bankAccounts.findById(
      account,
      BankAccountId.from(bankAccountId),
    );
    if (!bankAccount) {
      throw new BankAccountNotFoundException();
    }

    bankAccount.update(input);
    const saved = await this.unitOfWork.execute(async () => this.bankAccounts.save(bankAccount));
    return BankAccountDto.fromDomain(saved);
  }

  // ==== Categorias ====

  async listCategories(accountId: string): Promise<FinancialCategoryDto[]> {
    const list = await this.categories.listByAccount(AccountId.from(accountId));
    return list.map(FinancialCategoryDto.fromDomain);
  }

  async createCategory(
    accountId: string,
    input: { name: string; direction: string },
  ): Promise<FinancialCategoryDto> {
    const account = AccountId.from(accountId);
    const category = FinancialCategory.create({ accountId: account, ...input });

    const existing = await this.categories.findByName(account, category.name, category.direction);
    if (existing) {
      throw new InvalidValueException('Já existe uma categoria com este nome nesta direção.');
    }

    const saved = await this.unitOfWork.execute(async () => this.categories.save(category));
    return FinancialCategoryDto.fromDomain(saved);
  }

  async updateCategory(
    accountId: string,
    categoryId: string,
    input: { name: string; isActive: boolean },
  ): Promise<FinancialCategoryDto> {
    const account = AccountId.from(accountId);
    const category = await this.categories.findById(account, FinancialCategoryId.from(categoryId));
    if (!category) {
      throw new FinancialCategoryNotFoundException();
    }

    category.update(input);
    const saved = await this.unitOfWork.execute(async () => this.categories.save(category));
    return FinancialCategoryDto.fromDomain(saved);
  }

  /**
   * Cria as sementes da §4.14 que ainda não existirem. **Idempotente** — chamar duas vezes não
   * duplica nada, e é isso que a torna segura de rodar no bootstrap e de novo depois.
   */
  async seedDefaultCategories(accountId: string): Promise<FinancialCategoryDto[]> {
    const account = AccountId.from(accountId);

    await this.unitOfWork.execute(async () => {
      for (const seed of DEFAULT_CATEGORIES) {
        const existing = await this.categories.findByName(account, seed.name, seed.direction);
        if (!existing) {
          await this.categories.save(FinancialCategory.create({ accountId: account, ...seed }));
        }
      }
    });

    return this.listCategories(accountId);
  }

  // ==== Lançamentos ====

  async listEntries(
    accountId: string,
    from: string,
    to: string,
    bankAccountId?: string | null,
  ): Promise<CashEntryDto[]> {
    const account = AccountId.from(accountId);
    const list = await this.entries.listByPeriod(
      account,
      parseDate(from),
      parseDate(to),
      bankAccountId ? BankAccountId.from(bankAccountId) : null,
    );
    return this.toDtos(account, list);
  }

  /** Entrada ou saída manual. A categoria precisa bater com o tipo. */
  async recordEntry(
    accountId: string,
    createdBy: string,
    input: CashEntryInput,
  ): Promise<CashEntryDto> {
    const account = AccountId.from(accountId);

    const category = await this.categories.findById(
      account,
      FinancialCategoryId.from(input.categoryId),
    );
    if (!category) {
      throw new FinancialCategoryNotFoundException();
    }
    if (category.direction !== input.type) {
      throw new CategoryDirectionMismatchException(input.type, category.direction);
    }

    await this.requireBankAccount(account, BankAccountId.from(input.bankAccountId));

    const entry = CashEntry.record({
      accountId: account,
      type: input.type,
      occurredOn: parseDate(input.occurredOn),
      amount: Money.fromCents(input.amountCents),
      categoryId: category.id,
      bankAccountId: BankAccountId.from(input.bankAccountId),
      description: input.description,
      payee: input.payee,
      paymentMethod: (input.paymentMethod as PaymentMethod | null) ?? null,
      createdBy: UserId.from(createdBy),
    });

    const saved = await this.unitOfWork.execute(async () => this.entries.save(entry));
    return (await this.toDtos(account, [saved]))[0];
  }

  /** Transferência entre contas próprias — fora do DRE, só move saldo. */
  async recordTransfer(
    accountId: string,
    createdBy: string,
    input: TransferInput,
  ): Promise<CashEntryDto> {
    const account = AccountId.from(accountId);

    const from = BankAccountId.from(input.fromAccountId);
    const to = BankAccountId.from(input.toAccountId);
    await this.requireBankAccount(account, from);
    await this.requireBankAccount(account, to);

    const entry = CashEntry.transfer({
      accountId: account,
      occurredOn: parseDate(input.occurredOn),
      amount: Money.fromCents(input.amountCents),
      fromAccountId: from,
      toAccountId: to,
      description: input.description,
      createdBy: UserId.from(createdBy),
    });

    const saved = await this.unitOfWork.execute(async () => this.entries.save(entry));
    return (await this.toDtos(account, [saved]))[0];
  }

  /** Cancela com motivo e autor. Não apaga — sai do saldo e do DRE, continua consultável. */
  async cancelEntry(
    accountId: string,
    entryId: string,
    reason: string,
    cancelledBy: string,
  ): Promise<CashEntryDto> {
    const account = AccountId.from(accountId);

    const entry = await this.entries.findById(account, CashEntryId.from(entryId));
    if (!entry) {
      throw new CashEntryNotFoundException();
    }

    entry.cancel(reason, UserId.from(cancelledBy));

    const saved = await this.unitOfWork.execute(async () => this.entries.save(entry));
    this.logger.warn('Lançamento cancelado', { entryId: saved.id.value, by: cancelledBy });

    return (await this.toDtos(account, [saved]))[0];
  }

  // ==== DRE e saldos ====

  async dre(accountId: string, from: string, to: string): Promise<DreDto> {
    const start = parseDate(from);
    const end = parseDate(to);
    const lines = await this.entries.dre(AccountId.from(accountId), start, end);
    return DreDto.create(start, end, lines);
  }

  async balances(accountId: string, until?: string | null): Promise<BalancesDto> {
    const limit = until ? parseDate(until) : new Date();
    return BalancesDto.create(await this.entries.balances(AccountId.from(accountId), limit));
  }

  // ==== CashRecorderPort ====

  /**
   * A entrada automática do pagamento de uma reserva (§4.15).
   *
   * **É um único ato**: roda dentro da transação do pagamento, e o índice único parcial
   * `cash_entry_one_per_reservation` garante no banco que uma reserva não gere duas entradas
   * vivas. A checagem aqui existe para dar a mensagem certa; a garantia é do banco.
   *
   * Nunca peça ao Administrativo para lançar a entrada uma segunda vez à mão — o caixa duplicaria.
   */
  async recordReservationPayment(record: ReservationPaymentRecord): Promise<void> {
    const account = AccountId.from(record.accountId);
    const reservationId = ReservationId.from(record.reservationId);

    const existing = await this.entries.findLiveByReservation(account, reservationId);
    if (existing) {
      this.logger.warn('Pagamento já tinha entrada de caixa; nada foi criado', {
        reservationId: record.reservationId,
      });
      return;
    }

    const bankAccountId = await this.resolveBankAccount(account, record.bankAccountId);
    const category = await this.requireMachineHourCategory(account);

    const entry = CashEntry.record({
      accountId: account,
      type: 'in',
      occurredOn: record.occurredOn,
      amount: Money.fromCents(record.amountCents),
      categoryId: category.id,
      bankAccountId,
      description: record.description,
      paymentMethod: record.paymentMethod,
      reservationId,
      createdBy: UserId.from(record.registeredBy),
    });

    await this.entries.save(entry);
    this.logger.log('Entrada de caixa criada pelo pagamento da reserva', {
      reservationId: record.reservationId,
      amountCents: record.amountCents,
    });
  }

  /**
   * Resolve a conta que recebeu o pagamento.
   *
   * Sem conta informada: usa a única ativa. Com várias, exige a escolha — adivinhar em qual conta
   * o dinheiro caiu produziria um extrato que não bate com o banco de verdade.
   */
  private async resolveBankAccount(
    accountId: AccountId,
    informed?: string | null,
  ): Promise<BankAccountId> {
    if (informed) {
      const id = BankAccountId.from(informed);
      await this.requireBankAccount(accountId, id);
      return id;
    }

    const active = (await this.bankAccounts.listByAccount(accountId)).filter(
      (bankAccount) => bankAccount.isActive,
    );

    if (active.length === 0) {
      throw new NoBankAccountForPaymentException(false);
    }
    if (active.length > 1) {
      throw new NoBankAccountForPaymentException(true);
    }
    return active[0].id;
  }

  private async requireMachineHourCategory(accountId: AccountId): Promise<FinancialCategory> {
    const existing = await this.categories.findByName(accountId, MACHINE_HOUR_CATEGORY, 'in');
    if (existing) {
      return existing;
    }
    // A semente pode não ter sido criada ainda; criar aqui evita travar a venda por causa de um
    // cadastro de apoio. É idempotente pelo índice único de (conta, direção, nome).
    return this.categories.save(
      FinancialCategory.create({ accountId, name: MACHINE_HOUR_CATEGORY, direction: 'in' }),
    );
  }

  private async requireBankAccount(accountId: AccountId, id: BankAccountId): Promise<BankAccount> {
    const bankAccount = await this.bankAccounts.findById(accountId, id);
    if (!bankAccount) {
      throw new BankAccountNotFoundException();
    }
    return bankAccount;
  }

  private async toDtos(accountId: AccountId, entries: CashEntry[]): Promise<CashEntryDto[]> {
    if (entries.length === 0) {
      return [];
    }

    // Os ids de reserva dos lançamentos desta página — uma consulta só para todos eles.
    const reservationIds = [
      ...new Set(
        entries
          .map((entry) => entry.reservationId?.value)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [refs, accounts, categories, reservations] = await Promise.all([
      this.references.load(accountId),
      this.bankAccounts.listByAccount(accountId),
      this.categories.listByAccount(accountId),
      this.entries.reservationRefs(accountId, reservationIds),
    ]);

    const reservationById = new Map(reservations.map((item) => [item.reservationId, item]));

    const accountRefs = new Map<string, NamedRef>(
      accounts.map((item) => [item.id.value, { id: item.id.value, name: item.name }]),
    );
    const categoryRefs = new Map<string, NamedRef>(
      categories.map((item) => [item.id.value, { id: item.id.value, name: item.name }]),
    );

    return entries.map((entry) =>
      CashEntryDto.fromDomain(entry, {
        category: entry.categoryId ? refOrPlaceholder(categoryRefs, entry.categoryId.value) : null,
        bankAccount: refOrPlaceholder(accountRefs, entry.bankAccountId.value),
        counterpartAccount: entry.counterpartAccountId
          ? refOrPlaceholder(accountRefs, entry.counterpartAccountId.value)
          : null,
        createdBy: refOrPlaceholder(refs.users, entry.createdBy.value),
        cancelledBy: entry.cancellation
          ? refOrPlaceholder(refs.users, entry.cancellation.by.value)
          : null,
        reservation: entry.reservationId
          ? (reservationById.get(entry.reservationId.value) ?? null)
          : null,
      }),
    );
  }
}

/** 'AAAA-MM-DD' → Date em UTC. Data de calendário: sem fuso no meio. */
function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidValueException('A data deve estar no formato AAAA-MM-DD.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidValueException('Data inválida.');
  }
  return date;
}
