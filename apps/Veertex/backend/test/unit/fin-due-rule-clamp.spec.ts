import { commissionDueDate } from '../../src/contexts/commission/domain/commission-due';
import {
  CreateRecurringPayableCommand,
  CreateRecurringPayableUseCase,
} from '../../src/contexts/finance/application/use-cases/create-recurring-payable/create-recurring-payable.use-case';
import { FinancialTitleRepositoryPort } from '../../src/contexts/finance/application/ports/output/financial-title-repository.port';
import { FinancialTitle } from '../../src/contexts/finance/domain/entities/financial-title.entity';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';

const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;

describe('commissionDueDate — a regra de vencimento da comissão (registro de 23/08/2026)', () => {
  it('last_day_of_period (default): último dia do mês apurado', () => {
    const due = commissionDueDate('2026-02', {
      commissionDueRule: 'last_day_of_period',
      commissionDueDay: 5,
    });
    expect(due.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('day_n_next_month: dia N do mês SEGUINTE ao apurado', () => {
    const due = commissionDueDate('2026-02', {
      commissionDueRule: 'day_n_next_month',
      commissionDueDay: 5,
    });
    expect(due.toISOString().slice(0, 10)).toBe('2026-03-05');
  });

  it('aceita Date (Modelo B — mês do fechamento) e clampa o dia a 28', () => {
    const due = commissionDueDate(new Date('2026-12-15T12:00:00Z'), {
      commissionDueRule: 'day_n_next_month',
      commissionDueDay: 99,
    });
    expect(due.toISOString().slice(0, 10)).toBe('2027-01-28');
  });
});

describe('Recorrência — clamp de meses curtos (31/jan + 1 mês → fim de fevereiro)', () => {
  function fakes() {
    const saved: FinancialTitle[] = [];
    const titles = {
      save: async (title: FinancialTitle) => {
        saved.push(title);
        return title;
      },
    } as unknown as FinancialTitleRepositoryPort;
    return { titles, saved };
  }

  it('dia 31 clampa para 28/29 em fevereiro e VOLTA a 31 em março', async () => {
    const { titles, saved } = fakes();
    const uc = new CreateRecurringPayableUseCase(titles, uowFalso);
    await uc.execute(
      new CreateRecurringPayableCommand(CONTA, {
        companyId: EMPRESA,
        description: 'Aluguel',
        amount: 1000,
        firstDueDate: new Date('2026-01-31T00:00:00Z'),
        occurrences: 3,
      }),
    );
    const dias = saved.map((title) => title.dueDate.toISOString().slice(0, 10));
    expect(dias).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('ano bissexto: fevereiro clampa para 29', async () => {
    const { titles, saved } = fakes();
    const uc = new CreateRecurringPayableUseCase(titles, uowFalso);
    await uc.execute(
      new CreateRecurringPayableCommand(CONTA, {
        companyId: EMPRESA,
        description: 'Energia',
        amount: 500,
        firstDueDate: new Date('2028-01-30T00:00:00Z'),
        occurrences: 2,
      }),
    );
    const dias = saved.map((title) => title.dueDate.toISOString().slice(0, 10));
    expect(dias).toEqual(['2028-01-30', '2028-02-29']);
  });
});
