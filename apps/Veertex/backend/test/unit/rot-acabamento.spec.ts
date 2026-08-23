import {
  OpenConsignedOrderCommand,
  OpenConsignedOrderUseCase,
} from '../../src/contexts/route/application/use-cases/open-consigned-order/open-consigned-order.use-case';
import {
  CloseConsignedOrderCommand,
  CloseConsignedOrderUseCase,
} from '../../src/contexts/route/application/use-cases/close-consigned-order/close-consigned-order.use-case';
import { Order } from '../../src/contexts/order/domain/entities/order.entity';
import { OrderItem } from '../../src/contexts/order/domain/entities/order-item.entity';
import { OrderRepositoryPort } from '../../src/contexts/order/application/ports/output/order-repository.port';
import { Trip } from '../../src/contexts/route/domain/entities/trip.entity';
import { Route } from '../../src/contexts/route/domain/entities/route.entity';
import { TripRepositoryPort } from '../../src/contexts/route/application/ports/output/trip-repository.port';
import { RouteRepositoryPort } from '../../src/contexts/route/application/ports/output/route-repository.port';
import { ConsignmentFiscalPort } from '../../src/contexts/route/application/ports/output/consignment-fiscal.port';
import { StockMovement } from '../../src/contexts/stock/domain/entities/stock-movement.entity';
import { StockMovementRepositoryPort } from '../../src/contexts/stock/application/ports/output/stock-movement-repository.port';
import {
  CreateFinancialTitleCommand,
  CreateFinancialTitleUseCase,
} from '../../src/contexts/finance/application/use-cases/create-financial-title/create-financial-title.use-case';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const ROTA = '33333333-3333-4333-8333-333333333333';
const VENDEDOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CLIENTE = '55555555-5555-4555-8555-555555555555';
const PROD_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROD_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;

function item(productId: string, quantity: number, unitPrice: number) {
  return OrderItem.create({ productId, description: 'Item', quantity, unitPrice });
}

function pedidoDeRota(trip: Trip): Order {
  return Order.create({
    accountId: CONTA,
    companyId: EMPRESA,
    contactId: CLIENTE,
    number: 7,
    origin: 'rota',
    tripId: trip.id,
    items: [item(PROD_A, 10, 20), item(PROD_B, 5, 40)],
  });
}

function fakesBase() {
  const trip = Trip.create({
    accountId: CONTA,
    companyId: EMPRESA,
    routeId: ROTA,
    salesRepId: VENDEDOR,
  });
  const route = Route.create({ accountId: CONTA, name: 'Rondonópolis', cycleDays: 45 });
  const order = pedidoDeRota(trip);

  const orders: OrderRepositoryPort = {
    findById: async () => order,
    list: async () => [order],
    save: async (o) => o,
    nextOrderNumber: async () => 1,
  };
  const trips: TripRepositoryPort = {
    findById: async () => trip,
    list: async () => [trip],
    save: async (t) => t,
  };
  const routes: RouteRepositoryPort = {
    findById: async () => route,
    list: async () => [route],
    save: async (r) => r,
  };
  return { trip, route, order, orders, trips, routes };
}

describe('OpenConsignedOrder — efetivação faz nascer o TÍTULO (dúvida 2 confirmada)', () => {
  it('título a receber origin=consignment, valor=total, vencimento = saída + cycle_days', async () => {
    const { trip, order, orders, trips, routes } = fakesBase();
    trip.depart(); // saída registrada — a base do vencimento

    const created: CreateFinancialTitleCommand[] = [];
    const createTitle = {
      execute: async (cmd: CreateFinancialTitleCommand) => {
        created.push(cmd);
        return { id: 'title-1', status: 'open' };
      },
    } as unknown as CreateFinancialTitleUseCase;

    const uc = new OpenConsignedOrderUseCase(orders, trips, routes, createTitle, uowFalso);
    const dto = await uc.execute(new OpenConsignedOrderCommand(CONTA, order.id.value));

    expect(dto.status).toBe('consignado_aberto');
    expect(created).toHaveLength(1);
    expect(created[0].input.origin).toBe('consignment');
    expect(created[0].input.amount).toBe(order.total); // 10×20 + 5×40 = 400
    expect(created[0].input.contactId).toBe(CLIENTE);
    // vencimento = departureAt + 45 dias (cycleDays da rota)
    const dias =
      (created[0].input.dueDate.getTime() - (trip.departureAt as Date).getTime()) / 86_400_000;
    expect(Math.round(dias)).toBe(45);
  });
});

describe('CloseConsignedOrder — venda = saída física, no MESMO evento (dúvida 1 confirmada)', () => {
  function fakesClose() {
    const base = fakesBase();
    base.trip.attachLoadLocation('99999999-9999-4999-8999-999999999999');
    base.order.openConsignment();
    base.order.startSettlement();

    const saved: StockMovement[] = [];
    const movements: StockMovementRepositoryPort = {
      listByCompanyProduct: async () => [],
      listByCompanyProductLocation: async () => [],
      findById: async () => null,
      save: async (m) => {
        saved.push(m);
        return m;
      },
      list: async () => saved,
    };
    const fiscalCalls: { orderId: string; lines: { productId: string; quantity: number }[] }[] = [];
    const fiscal: ConsignmentFiscalPort = {
      emitConsignmentShipment: async () => null,
      emitConsignedSale: async (req) => {
        fiscalCalls.push({ orderId: req.orderId, lines: req.lines });
        return null;
      },
      emitConsignmentReturn: async () => null,
    };
    return { ...base, saved, movements, fiscal, fiscalCalls };
  }

  it('sem soldLines: baixa os itens do pedido inteiros (sale_out @rep_load) + emitConsignedSale', async () => {
    const f = fakesClose();
    const uc = new CloseConsignedOrderUseCase(f.orders, f.trips, f.movements, f.fiscal, uowFalso);
    const dto = await uc.execute(new CloseConsignedOrderCommand(CONTA, f.order.id.value, null));

    expect(dto.status).toBe('fechado');
    expect(f.saved).toHaveLength(2); // um sale_out por item
    expect(f.saved.every((m) => m.type === 'sale_out')).toBe(true);
    expect(f.saved.every((m) => m.locationId === f.trip.loadLocationId)).toBe(true);
    expect(f.fiscalCalls).toHaveLength(1);
    expect(f.fiscalCalls[0].lines).toHaveLength(2);
  });

  it('com soldLines (houve devolução): baixa SÓ o vendido real — sem baixa dupla', async () => {
    const f = fakesClose();
    const uc = new CloseConsignedOrderUseCase(f.orders, f.trips, f.movements, f.fiscal, uowFalso);
    await uc.execute(
      new CloseConsignedOrderCommand(CONTA, f.order.id.value, [
        { productId: PROD_A, quantity: 7 }, // 3 dos 10 foram devolvidos
      ]),
    );
    expect(f.saved).toHaveLength(1);
    expect(f.saved[0].productId).toBe(PROD_A);
    expect(f.saved[0].signedQuantity).toBe(7);
    expect(f.fiscalCalls[0].lines).toEqual([{ productId: PROD_A, quantity: 7 }]);
  });
});
