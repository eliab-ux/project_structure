import { CreatePaymentConditionUseCase } from '../../src/contexts/payment-condition/application/use-cases/create-payment-condition/create-payment-condition.use-case';
import { ListPaymentConditionsUseCase } from '../../src/contexts/payment-condition/application/use-cases/list-payment-conditions/list-payment-conditions.use-case';
import {
  UpdatePaymentConditionCommand,
  UpdatePaymentConditionUseCase,
} from '../../src/contexts/payment-condition/application/use-cases/update-payment-condition/update-payment-condition.use-case';
import { CreatePaymentConditionCommand } from '../../src/contexts/payment-condition/application/use-cases/create-payment-condition/create-payment-condition.use-case';
import { ListPaymentConditionsQuery } from '../../src/contexts/payment-condition/application/use-cases/list-payment-conditions/list-payment-conditions.use-case';
import { PaymentCondition } from '../../src/contexts/payment-condition/domain/entities/payment-condition.entity';
import { PaymentConditionRepositoryPort } from '../../src/contexts/payment-condition/application/ports/output/payment-condition-repository.port';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';
import { PaymentConditionNotFoundException } from '../../src/contexts/payment-condition/domain/exceptions/payment-condition-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';

function repoFalso() {
  const salvos: PaymentCondition[] = [];
  const repo: PaymentConditionRepositoryPort = {
    findById: async (id) => salvos.find((c) => c.id === id) ?? null,
    list: async (includeInactive) => salvos.filter((c) => (includeInactive ? true : c.active)),
    save: async (c) => {
      const idx = salvos.findIndex((s) => s.id === c.id);
      if (idx >= 0) salvos[idx] = c;
      else salvos.push(c);
      return c;
    },
  };
  return { repo, salvos };
}

const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;

describe('PaymentCondition — cadastro (§4.2 do 02A)', () => {
  it('cria uma condição nomeada ativa', async () => {
    const { repo } = repoFalso();
    const uc = new CreatePaymentConditionUseCase(repo, uowFalso);
    const dto = await uc.execute(new CreatePaymentConditionCommand(CONTA, 'À vista', 'a_vista'));
    expect(dto.name).toBe('À vista');
    expect(dto.kind).toBe('a_vista');
    expect(dto.kindLabel).toBe('À vista');
    expect(dto.active).toBe(true);
  });

  it('lista só as ativas por default; inclui inativas quando pedido', async () => {
    const { repo } = repoFalso();
    const create = new CreatePaymentConditionUseCase(repo, uowFalso);
    const update = new UpdatePaymentConditionUseCase(repo, uowFalso);
    const list = new ListPaymentConditionsUseCase(repo);

    const pix = await create.execute(new CreatePaymentConditionCommand(CONTA, 'Pix', 'pix'));
    await create.execute(new CreatePaymentConditionCommand(CONTA, 'Boleto', 'boleto'));
    await update.execute(new UpdatePaymentConditionCommand(pix.id, { active: false }));

    const ativas = await list.execute(new ListPaymentConditionsQuery(false));
    expect(ativas.map((c) => c.name)).toEqual(['Boleto']);

    const todas = await list.execute(new ListPaymentConditionsQuery(true));
    expect(todas).toHaveLength(2);
  });

  it('edita nome e tipo', async () => {
    const { repo } = repoFalso();
    const create = new CreatePaymentConditionUseCase(repo, uowFalso);
    const update = new UpdatePaymentConditionUseCase(repo, uowFalso);
    const criada = await create.execute(
      new CreatePaymentConditionCommand(CONTA, 'Cartão', 'cartao'),
    );
    const editada = await update.execute(
      new UpdatePaymentConditionCommand(criada.id, { name: 'Cartão 3x', kind: 'cartao' }),
    );
    expect(editada.name).toBe('Cartão 3x');
  });

  it('editar condição inexistente é recusado', async () => {
    const { repo } = repoFalso();
    const update = new UpdatePaymentConditionUseCase(repo, uowFalso);
    await expect(
      update.execute(
        new UpdatePaymentConditionCommand('99999999-9999-4999-8999-999999999999', {
          active: false,
        }),
      ),
    ).rejects.toThrow(PaymentConditionNotFoundException);
  });
});
