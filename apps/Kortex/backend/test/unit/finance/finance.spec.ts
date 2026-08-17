import { BankAccount } from '../../../src/contexts/finance/domain/entities/bank-account.entity';
import {
  DEFAULT_CATEGORIES,
  FinancialCategory,
  MACHINE_HOUR_CATEGORY,
} from '../../../src/contexts/finance/domain/entities/financial-category.entity';
import { CashEntry } from '../../../src/contexts/finance/domain/entities/cash-entry.entity';
import {
  BankAccountId,
  FinancialCategoryId,
} from '../../../src/contexts/finance/domain/value-objects/finance-ids.vo';
import { DreDto } from '../../../src/contexts/finance/application/dto/finance.dto';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { UserId } from '../../../src/contexts/user/domain/value-objects/user-id.vo';
import { Money } from '../../../src/shared/domain/value-objects/money.vo';

const accountId = AccountId.create();
const author = UserId.create();
const principal = BankAccountId.create();
const maquina = BankAccountId.create();
const categoria = FinancialCategoryId.create();
const dia = (d: string) => new Date(`${d}T00:00:00.000Z`);

const saida = (cents: number, bankAccountId = principal) =>
  CashEntry.record({
    accountId,
    type: 'out',
    occurredOn: dia('2026-08-10'),
    amount: Money.fromCents(cents),
    categoryId: categoria,
    bankAccountId,
    description: 'Energia de agosto',
    createdBy: author,
  });

describe('BankAccount', () => {
  it('nasce ativa com saldo inicial zero', () => {
    const conta = BankAccount.create({ accountId, name: 'Conta principal' });

    expect(conta.isActive).toBe(true);
    expect(conta.openingBalanceCents).toBe(0);
  });

  it('aceita saldo inicial NEGATIVO — é saldo, não preço', () => {
    // `Money` exigiria valor positivo; saldo de conta no vermelho existe.
    const conta = BankAccount.create({
      accountId,
      name: 'Conta da máquina',
      openingBalanceCents: -35_000,
    });

    expect(conta.openingBalanceCents).toBe(-35_000);
  });

  it('recusa nome vazio', () => {
    expect(() => BankAccount.create({ accountId, name: ' ' })).toThrow();
  });
});

describe('FinancialCategory', () => {
  it('as oito sementes da §4.14 estão completas', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(8);
    expect(DEFAULT_CATEGORIES.filter((c) => c.direction === 'in').map((c) => c.name)).toEqual([
      MACHINE_HOUR_CATEGORY,
      'Outras entradas',
    ]);
    expect(DEFAULT_CATEGORIES.filter((c) => c.direction === 'out')).toHaveLength(6);
  });

  it('"Salários" é apenas uma categoria de saída — não há folha de pagamento', () => {
    const salarios = DEFAULT_CATEGORIES.find((c) => c.name === 'Salários');

    expect(salarios).toEqual({ name: 'Salários', direction: 'out' });
    // Nenhum campo trabalhista existe no modelo: a categoria é só um nome e uma direção.
    expect(Object.keys(salarios!)).toEqual(['name', 'direction']);
  });

  it('a direção não muda no update — inverteria o sinal do histórico', () => {
    const categoria = FinancialCategory.create({ accountId, name: 'Energia', direction: 'out' });

    categoria.update({ name: 'Energia elétrica', isActive: false });

    expect(categoria.name).toBe('Energia elétrica');
    expect(categoria.isActive).toBe(false);
    expect(categoria.direction).toBe('out');
    // A ausência do setter é a garantia: `direction` é só leitura, sem caminho para mudá-la.
    const descriptor = Object.getOwnPropertyDescriptor(FinancialCategory.prototype, 'direction');
    expect(descriptor?.get).toBeDefined();
    expect(descriptor?.set).toBeUndefined();
  });

  it('recusa direção fora de in/out', () => {
    expect(() =>
      FinancialCategory.create({ accountId, name: 'Estranha', direction: 'transfer' }),
    ).toThrow(/entrada \(in\) ou saída \(out\)/);
  });
});

describe('CashEntry', () => {
  it('não existe setter de valor nem de tipo — editar efetivado é proibido', () => {
    const entrada = saida(10_000);

    // A proibição da §4.15 é estrutural: os campos são `readonly` e não há método de edição.
    const mutaveis = Object.getOwnPropertyNames(CashEntry.prototype).filter((name) =>
      ['setAmount', 'changeAmount', 'update', 'edit', 'setType'].includes(name),
    );
    expect(mutaveis).toEqual([]);
    expect(entrada.amount.cents).toBe(10_000);
  });

  it('transferência não tem categoria — não é receita nem despesa', () => {
    const transferencia = CashEntry.transfer({
      accountId,
      occurredOn: dia('2026-08-11'),
      amount: Money.fromCents(50_000),
      fromAccountId: maquina,
      toAccountId: principal,
      description: 'Sobra da conta da máquina',
      createdBy: author,
    });

    expect(transferencia.type).toBe('transfer');
    expect(transferencia.categoryId).toBeNull();
    expect(transferencia.counterpartAccountId?.value).toBe(principal.value);
  });

  it('transferência para a mesma conta é erro', () => {
    expect(() =>
      CashEntry.transfer({
        accountId,
        occurredOn: dia('2026-08-11'),
        amount: Money.fromCents(1),
        fromAccountId: principal,
        toAccountId: principal,
        description: 'Para si mesma',
        createdBy: author,
      }),
    ).toThrow(/diferente da conta de origem/);
  });

  it('a transferência move as DUAS contas, em sinais opostos', () => {
    const transferencia = CashEntry.transfer({
      accountId,
      occurredOn: dia('2026-08-11'),
      amount: Money.fromCents(50_000),
      fromAccountId: maquina,
      toAccountId: principal,
      description: 'Sobra da conta da máquina',
      createdBy: author,
    });

    expect(transferencia.effectOn(maquina)).toBe(-50_000);
    expect(transferencia.effectOn(principal)).toBe(50_000);
    // Soma zero: transferência não cria nem destrói dinheiro.
    expect(transferencia.effectOn(maquina) + transferencia.effectOn(principal)).toBe(0);
  });

  it('cancelar exige motivo e autor, e zera o efeito no saldo', () => {
    const entrada = saida(20_000);
    expect(entrada.effectOn(principal)).toBe(-20_000);

    entrada.cancel('Lançado em duplicidade', author);

    expect(entrada.isCancelled).toBe(true);
    expect(entrada.cancellation?.reason).toBe('Lançado em duplicidade');
    expect(entrada.cancellation?.by.value).toBe(author.value);
    expect(entrada.effectOn(principal)).toBe(0);
    // Continua consultável: o valor e a descrição seguem lá.
    expect(entrada.amount.cents).toBe(20_000);
    expect(entrada.description).toBe('Energia de agosto');
  });

  it('não cancela duas vezes', () => {
    const entrada = saida(20_000);
    entrada.cancel('Primeiro motivo', author);

    expect(() => entrada.cancel('Segundo motivo', author)).toThrow();
  });

  it('motivo curto demais é recusado', () => {
    const entrada = saida(20_000);
    expect(() => entrada.cancel('x', author)).toThrow(/entre 3 e 300/);
  });

  it('lançamento em conta alheia não afeta o saldo consultado', () => {
    const entrada = saida(20_000, maquina);
    expect(entrada.effectOn(principal)).toBe(0);
  });
});

describe('DreDto', () => {
  it('separa entradas e saídas e fecha o resultado', () => {
    const dre = DreDto.create(dia('2026-08-01'), dia('2026-08-31'), [
      {
        categoryId: 'a',
        categoryName: MACHINE_HOUR_CATEGORY,
        direction: 'in',
        totalCents: 340_000,
      },
      { categoryId: 'b', categoryName: 'Outras entradas', direction: 'in', totalCents: 10_000 },
      { categoryId: 'c', categoryName: 'Energia', direction: 'out', totalCents: 90_000 },
    ]);

    expect(dre.totalIncomeCents).toBe(350_000);
    expect(dre.totalExpenseCents).toBe(90_000);
    expect(dre.resultCents).toBe(260_000);
    expect(dre.from).toBe('2026-08-01');
    expect(dre.to).toBe('2026-08-31');
  });

  it('resultado negativo é resultado, não erro', () => {
    const dre = DreDto.create(dia('2026-08-01'), dia('2026-08-31'), [
      { categoryId: 'c', categoryName: 'Energia', direction: 'out', totalCents: 90_000 },
    ]);

    expect(dre.incomes).toEqual([]);
    expect(dre.resultCents).toBe(-90_000);
  });
});
