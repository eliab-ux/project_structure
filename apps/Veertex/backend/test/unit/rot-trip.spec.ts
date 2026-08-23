import { Trip } from '../../src/contexts/route/domain/entities/trip.entity';
import {
  InvalidTripTransitionException,
  TripNotOpenForCargoException,
} from '../../src/contexts/route/domain/exceptions/route-exceptions';
import { Order } from '../../src/contexts/order/domain/entities/order.entity';
import { OrderItem } from '../../src/contexts/order/domain/entities/order-item.entity';
import {
  InvalidStatusTransitionException,
  NotAConsignmentOrderException,
} from '../../src/contexts/order/domain/exceptions/order-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const ROTA = '33333333-3333-4333-8333-333333333333';
const VENDEDOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CLIENTE = '55555555-5555-4555-8555-555555555555';
const VIAGEM = '66666666-6666-4666-8666-666666666666';

function trip(): Trip {
  return Trip.create({
    accountId: CONTA,
    companyId: EMPRESA,
    routeId: ROTA,
    salesRepId: VENDEDOR,
    initialCash: 500,
    initialKm: 1000,
  });
}

function item() {
  return OrderItem.create({
    productId: '44444444-4444-4444-8444-444444444444',
    description: 'Produto',
    quantity: 2,
    unitPrice: 10,
  });
}

function pedidoDeRota() {
  return Order.create({
    accountId: CONTA,
    companyId: EMPRESA,
    contactId: CLIENTE,
    number: 1,
    origin: 'rota',
    tripId: VIAGEM,
    items: [item()],
  });
}

describe('Trip — ciclo da viagem (§2 do 04)', () => {
  it('planejada → em_andamento → em_fechamento → fechada', () => {
    const t = trip();
    expect(t.status).toBe('planejada');
    t.depart();
    expect(t.status).toBe('em_andamento');
    expect(t.departureAt).not.toBeNull();
    t.arrive({ returnCash: 1200, finalKm: 2500 });
    expect(t.status).toBe('em_fechamento');
    expect(t.returnCash).toBe(1200);
    expect(t.finalKm).toBe(2500);
    t.close();
    expect(t.status).toBe('fechada');
  });

  it('fechar sem chegar é recusado (em_andamento → fechada não existe)', () => {
    const t = trip();
    t.depart();
    expect(() => t.close()).toThrow(InvalidTripTransitionException);
  });

  it('carga só entra com a viagem PLANEJADA', () => {
    const t = trip();
    t.assertAcceptsCargo(); // planejada: ok
    t.depart();
    expect(() => t.assertAcceptsCargo()).toThrow(TripNotOpenForCargoException);
  });
});

describe('Pedido consignado — ciclo PRÓPRIO (§3.1 do 04)', () => {
  it('rascunho → consignado_aberto → em_acerto → fechado', () => {
    const o = pedidoDeRota();
    o.openConsignment(); // a efetivação da retaguarda (dois estágios, §3.3)
    expect(o.status).toBe('consignado_aberto');
    o.startSettlement();
    expect(o.status).toBe('em_acerto');
    o.closeConsignment();
    expect(o.status).toBe('fechado');
  });

  it('pedido que NÃO é de rota não entra no ciclo consignado', () => {
    const o = Order.create({
      accountId: CONTA,
      companyId: EMPRESA,
      contactId: CLIENTE,
      number: 2,
      origin: 'pdv',
      items: [item()],
    });
    expect(() => o.openConsignment()).toThrow(NotAConsignmentOrderException);
  });

  it('pedido consignado não fecha sem passar pelo acerto (aceite 1 do 04)', () => {
    const o = pedidoDeRota();
    o.openConsignment();
    expect(() => o.closeConsignment()).toThrow(InvalidStatusTransitionException);
  });

  it('pedido consignado não entra no ciclo padrão (confirmar de consignado_aberto é recusado)', () => {
    const o = pedidoDeRota();
    o.openConsignment();
    expect(() => o.confirm()).toThrow(InvalidStatusTransitionException);
  });

  it('cancelamento existe em consignado_aberto e em_acerto', () => {
    const a = pedidoDeRota();
    a.openConsignment();
    a.cancel();
    expect(a.status).toBe('cancelado');

    const b = pedidoDeRota();
    b.openConsignment();
    b.startSettlement();
    b.cancel();
    expect(b.status).toBe('cancelado');
  });
});
