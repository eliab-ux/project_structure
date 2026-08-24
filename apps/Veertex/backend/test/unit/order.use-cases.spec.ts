import {
  CreateOrderUseCase,
  CreateOrderCommand,
} from '../../src/contexts/order/application/use-cases/create-order/create-order.use-case';
import {
  ChangeOrderStatusUseCase,
  ChangeOrderStatusCommand,
} from '../../src/contexts/order/application/use-cases/change-order-status/change-order-status.use-case';
import {
  UpdateOrderUseCase,
  UpdateOrderCommand,
} from '../../src/contexts/order/application/use-cases/update-order/update-order.use-case';
import { Order } from '../../src/contexts/order/domain/entities/order.entity';
import { OrderItem } from '../../src/contexts/order/domain/entities/order-item.entity';
import { OrderRepositoryPort } from '../../src/contexts/order/application/ports/output/order-repository.port';
import { CustomerLookupPort } from '../../src/contexts/order/application/ports/output/customer-lookup.port';
import { OrderProductLookupPort } from '../../src/contexts/order/application/ports/output/order-product-lookup.port';
import { CompanyRepositoryPort } from '../../src/contexts/company/application/ports/output/company-repository.port';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';
import {
  CreditLimitExceededException,
  DiscountNotAllowedException,
  OrderCustomerInvalidException,
} from '../../src/contexts/order/domain/exceptions/order-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';
const ATOR = '99999999-9999-4999-8999-999999999999';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const CLIENTE = '33333333-3333-4333-8333-333333333333';
const PRODUTO = '44444444-4444-4444-8444-444444444444';

function repoFalso(inicial: Order[] = []) {
  const salvos = [...inicial];
  let contador = 0;
  const repo: OrderRepositoryPort = {
    findById: async (id) => salvos.find((o) => o.id.value === id.value) ?? null,
    list: async () => salvos,
    save: async (order) => {
      const i = salvos.findIndex((o) => o.id.value === order.id.value);
      if (i >= 0) salvos[i] = order;
      else salvos.push(order);
      return order;
    },
    nextOrderNumber: async () => {
      contador += 1;
      return contador;
    },
  };
  return { repo, salvos };
}

const companyFalsa = (existe = true): CompanyRepositoryPort =>
  ({ findById: async () => (existe ? ({ id: { value: EMPRESA } } as never) : null) }) as never;

function customerFalso(overrides: Record<string, unknown> = {}): CustomerLookupPort {
  return {
    findById: async () => ({
      id: CLIENTE,
      displayName: 'Cliente Bom',
      creditLimit: null,
      salesRepId: null,
      defaultPaymentConditionId: null,
      isCustomer: true,
      active: true,
      ...overrides,
    }),
  };
}

const produtoFalso: OrderProductLookupPort = {
  findByIds: async (ids) =>
    new Map(ids.map((id) => [id, { id, name: 'Chapa', basePrice: 10, active: true }])),
};

const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;

/** Sem inadimplência e com o bloqueio DESLIGADO — o comportamento pré-COB dos testes de crédito. */
const semInadimplencia = { overdueAmount: async () => 0 } as never;
const prefsSemBloqueio = {
  forAccount: async () => ({ overdueBlockEnabled: false, overdueBlockDays: 30 }),
} as never;

/** Reserva de estoque que não faz nada — o teste de reserva de verdade vive no EST. */
const reservaFalsa = {
  reserve: async () => undefined,
  release: async () => undefined,
};

function itemInput(overrides: Record<string, unknown> = {}) {
  return { productId: PRODUTO, quantity: 2, ...overrides };
}

function criar(over: Record<string, unknown> = {}, canDiscount = true) {
  return new CreateOrderCommand(CONTA, ATOR, canDiscount, {
    companyId: EMPRESA,
    contactId: CLIENTE,
    origin: 'pdv',
    items: [itemInput()],
    ...over,
  });
}

describe('CreateOrderUseCase', () => {
  it('cria pedido em rascunho, numerado, com o vendedor = ator quando não informado', async () => {
    const { repo, salvos } = repoFalso();
    const uc = new CreateOrderUseCase(
      repo,
      companyFalsa(),
      customerFalso(),
      produtoFalso,
      uowFalso,
    );

    const dto = await uc.execute(criar());

    expect(salvos).toHaveLength(1);
    expect(dto.status).toBe('rascunho');
    expect(dto.number).toBe(1);
    expect(dto.salesRepId).toBe(ATOR);
    expect(dto.total).toBe(20);
    // snapshot do nome do produto
    expect(dto.items[0].description).toBe('Chapa');
  });

  it('usa o preço base quando o item não traz preço', async () => {
    const { repo } = repoFalso();
    const uc = new CreateOrderUseCase(
      repo,
      companyFalsa(),
      customerFalso(),
      produtoFalso,
      uowFalso,
    );
    const dto = await uc.execute(criar({ items: [{ productId: PRODUTO, quantity: 3 }] }));
    expect(dto.items[0].unitPrice).toBe(10);
    expect(dto.total).toBe(30);
  });

  it('recusa contato que não é cliente, nomeando a ação', async () => {
    const { repo } = repoFalso();
    const uc = new CreateOrderUseCase(
      repo,
      companyFalsa(),
      customerFalso({ isCustomer: false }),
      produtoFalso,
      uowFalso,
    );
    await expect(uc.execute(criar())).rejects.toThrow(OrderCustomerInvalidException);
  });

  it('recusa desconto sem a permissão orders.discount.grant (§3.5)', async () => {
    const { repo } = repoFalso();
    const uc = new CreateOrderUseCase(
      repo,
      companyFalsa(),
      customerFalso(),
      produtoFalso,
      uowFalso,
    );
    await expect(
      uc.execute(criar({ items: [itemInput({ discountPercent: 10 })] }, false)),
    ).rejects.toThrow(DiscountNotAllowedException);
  });

  it('aceita desconto com a permissão', async () => {
    const { repo } = repoFalso();
    const uc = new CreateOrderUseCase(
      repo,
      companyFalsa(),
      customerFalso(),
      produtoFalso,
      uowFalso,
    );
    const dto = await uc.execute(criar({ items: [itemInput({ discountPercent: 10 })] }, true));
    expect(dto.total).toBe(18);
  });
});

describe('ChangeOrderStatusUseCase — crédito na confirmação (§2.2)', () => {
  function pedidoRascunho(total = 100) {
    return Order.create({
      accountId: CONTA,
      companyId: EMPRESA,
      contactId: CLIENTE,
      number: 1,
      origin: 'pdv',
      items: [
        OrderItem.create({ productId: PRODUTO, description: 'X', quantity: 1, unitPrice: total }),
      ],
    });
  }

  it('bloqueia confirmação acima do limite de crédito, nomeando limite e total', async () => {
    const { repo } = repoFalso([pedidoRascunho(6000)]);
    const alvo = (await repo.list({}))[0];
    const uc = new ChangeOrderStatusUseCase(
      repo,
      customerFalso({ creditLimit: 5000 }),
      reservaFalsa,
      semInadimplencia,
      prefsSemBloqueio,
      uowFalso,
    );

    const p = uc.execute(new ChangeOrderStatusCommand(alvo.id.value, 'confirm'));
    await expect(p).rejects.toThrow(CreditLimitExceededException);
    await expect(p).rejects.toThrow(/5000/);
  });

  it('confirma dentro do limite', async () => {
    const { repo } = repoFalso([pedidoRascunho(4000)]);
    const alvo = (await repo.list({}))[0];
    const uc = new ChangeOrderStatusUseCase(
      repo,
      customerFalso({ creditLimit: 5000 }),
      reservaFalsa,
      semInadimplencia,
      prefsSemBloqueio,
      uowFalso,
    );
    const dto = await uc.execute(new ChangeOrderStatusCommand(alvo.id.value, 'confirm'));
    expect(dto.status).toBe('confirmado');
  });

  it('sem limite definido, não bloqueia', async () => {
    const { repo } = repoFalso([pedidoRascunho(999999)]);
    const alvo = (await repo.list({}))[0];
    const uc = new ChangeOrderStatusUseCase(
      repo,
      customerFalso({ creditLimit: null }),
      reservaFalsa,
      semInadimplencia,
      prefsSemBloqueio,
      uowFalso,
    );
    const dto = await uc.execute(new ChangeOrderStatusCommand(alvo.id.value, 'confirm'));
    expect(dto.status).toBe('confirmado');
  });
});

describe('CreateOrder/UpdateOrder — condição de pagamento (§3.6 do 02)', () => {
  const CONDICAO_CONTATO = 'c0nd1c40-0000-4000-8000-000000000001';
  const CONDICAO_EXPLICITA = 'c0nd1c40-0000-4000-8000-000000000002';

  it('herda o default do contato quando nenhuma condição é informada', async () => {
    const { repo } = repoFalso();
    const uc = new CreateOrderUseCase(
      repo,
      companyFalsa(),
      customerFalso({ defaultPaymentConditionId: CONDICAO_CONTATO }),
      produtoFalso,
      uowFalso,
    );
    const dto = await uc.execute(criar());
    expect(dto.paymentConditionId).toBe(CONDICAO_CONTATO);
  });

  it('condição informada VENCE o default do contato', async () => {
    const { repo } = repoFalso();
    const uc = new CreateOrderUseCase(
      repo,
      companyFalsa(),
      customerFalso({ defaultPaymentConditionId: CONDICAO_CONTATO }),
      produtoFalso,
      uowFalso,
    );
    const dto = await uc.execute(criar({ paymentConditionId: CONDICAO_EXPLICITA }));
    expect(dto.paymentConditionId).toBe(CONDICAO_EXPLICITA);
  });

  it('sem condição no pedido nem default no contato → null (venda sem condição é válida)', async () => {
    const { repo } = repoFalso();
    const uc = new CreateOrderUseCase(repo, companyFalsa(), customerFalso(), produtoFalso, uowFalso);
    const dto = await uc.execute(criar());
    expect(dto.paymentConditionId).toBeNull();
  });

  it('a condição do pedido é editável enquanto rascunho', async () => {
    const { repo } = repoFalso();
    const create = new CreateOrderUseCase(
      repo,
      companyFalsa(),
      customerFalso({ defaultPaymentConditionId: CONDICAO_CONTATO }),
      produtoFalso,
      uowFalso,
    );
    const criado = await create.execute(criar());

    const update = new UpdateOrderUseCase(repo, produtoFalso, uowFalso);
    const dto = await update.execute(
      new UpdateOrderCommand(criado.id, true, { paymentConditionId: CONDICAO_EXPLICITA }),
    );
    expect(dto.paymentConditionId).toBe(CONDICAO_EXPLICITA);
  });
});

describe('Bloqueio por inadimplência na confirmação (06 §2.5)', () => {
  function pedidoRascunho(total = 100) {
    return Order.create({
      accountId: CONTA,
      companyId: EMPRESA,
      contactId: CLIENTE,
      number: 1,
      origin: 'pdv',
      items: [
        OrderItem.create({ productId: PRODUTO, description: 'X', quantity: 1, unitPrice: total }),
      ],
    });
  }

  const prefsComBloqueio = {
    forAccount: async () => ({ overdueBlockEnabled: true, overdueBlockDays: 30 }),
  } as never;

  function ucCom(overdueAmount: number, canOverride = false) {
    return (async () => {
      const { repo } = repoFalso([pedidoRascunho(100)]);
      const alvo = (await repo.list({}))[0];
      const uc = new ChangeOrderStatusUseCase(
        repo,
        customerFalso({ creditLimit: null }),
        reservaFalsa,
        { overdueAmount: async () => overdueAmount } as never,
        prefsComBloqueio,
        uowFalso,
      );
      return uc.execute(
        new ChangeOrderStatusCommand(alvo.id.value, 'confirm', [], canOverride),
      );
    })();
  }

  it('cliente com vencido além de N dias é BLOQUEADO, nomeando valor e permissão de exceção', async () => {
    const p = ucCom(543.21);
    await expect(p).rejects.toThrow('543.21');
    await expect(p).rejects.toThrow('orders.overdue.override');
  });

  it('a permissão de override LIBERA (exceção granular, decidida no token)', async () => {
    const dto = await ucCom(543.21, true);
    expect(dto.status).toBe('confirmado');
  });

  it('sem vencidos, confirma normal', async () => {
    const dto = await ucCom(0);
    expect(dto.status).toBe('confirmado');
  });
});
