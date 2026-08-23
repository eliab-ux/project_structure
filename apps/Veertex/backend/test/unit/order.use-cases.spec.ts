import {
  CreateOrderUseCase,
  CreateOrderCommand,
} from '../../src/contexts/order/application/use-cases/create-order/create-order.use-case';
import {
  ChangeOrderStatusUseCase,
  ChangeOrderStatusCommand,
} from '../../src/contexts/order/application/use-cases/change-order-status/change-order-status.use-case';
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
      uowFalso,
    );
    const dto = await uc.execute(new ChangeOrderStatusCommand(alvo.id.value, 'confirm'));
    expect(dto.status).toBe('confirmado');
  });
});
