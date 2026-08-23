import {
  ResolvePriceQuery,
  ResolvePriceUseCase,
} from '../../src/contexts/price-list/application/use-cases/resolve-price/resolve-price.use-case';
import { PriceList } from '../../src/contexts/price-list/domain/entities/price-list.entity';
import { PriceListItem } from '../../src/contexts/price-list/domain/entities/price-list-item.entity';
import { PriceListRepositoryPort } from '../../src/contexts/price-list/application/ports/output/price-list-repository.port';
import {
  PriceProductInfo,
  PriceProductLookupPort,
} from '../../src/contexts/price-list/application/ports/output/price-product-lookup.port';
import { PriceNotResolvableException } from '../../src/contexts/price-list/domain/exceptions/price-list-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';
const PRODUTO = '44444444-4444-4444-8444-444444444444';
const CONTATO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const VENDEDOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function lista(params: {
  name: string;
  contactId?: string | null;
  salesRepId?: string | null;
  itens: { price: number; minQuantity?: number }[];
}): PriceList {
  return PriceList.create({
    accountId: CONTA,
    name: params.name,
    contactId: params.contactId ?? null,
    salesRepId: params.salesRepId ?? null,
    items: params.itens.map((i) =>
      PriceListItem.create({ productId: PRODUTO, price: i.price, minQuantity: i.minQuantity }),
    ),
  });
}

function repoFalso(listas: PriceList[]): PriceListRepositoryPort {
  return {
    findById: async () => null,
    list: async () => listas,
    findActiveByContact: async (contactId) =>
      listas.filter((l) => l.active && l.contactId === contactId),
    findActiveBySalesRep: async (salesRepId) =>
      listas.filter((l) => l.active && l.salesRepId === salesRepId),
    save: async (l) => l,
  };
}

function produtoFalso(basePrice: number | null): PriceProductLookupPort {
  return {
    findById: async (id): Promise<PriceProductInfo | null> => ({
      id,
      name: 'Chapa',
      basePrice,
      active: true,
    }),
  };
}

describe('ResolvePrice — prioridade e degrau (§3.2 do 02A)', () => {
  it('tabela do CONTATO vence a do vendedor e a base', async () => {
    const uc = new ResolvePriceUseCase(
      repoFalso([
        lista({ name: 'Contato', contactId: CONTATO, itens: [{ price: 8 }] }),
        lista({ name: 'Vendedor', salesRepId: VENDEDOR, itens: [{ price: 9 }] }),
      ]),
      produtoFalso(10),
    );
    const r = await uc.execute(new ResolvePriceQuery(PRODUTO, 1, CONTATO, VENDEDOR));
    expect(r.source).toBe('contact_list');
    expect(r.unitPrice).toBe(8);
  });

  it('sem tabela de contato, cai para a do VENDEDOR', async () => {
    const uc = new ResolvePriceUseCase(
      repoFalso([lista({ name: 'Vendedor', salesRepId: VENDEDOR, itens: [{ price: 9 }] })]),
      produtoFalso(10),
    );
    const r = await uc.execute(new ResolvePriceQuery(PRODUTO, 1, CONTATO, VENDEDOR));
    expect(r.source).toBe('sales_rep_list');
    expect(r.unitPrice).toBe(9);
  });

  it('sem tabela aplicável, usa o preço BASE', async () => {
    const uc = new ResolvePriceUseCase(repoFalso([]), produtoFalso(10));
    const r = await uc.execute(new ResolvePriceQuery(PRODUTO, 1, CONTATO, VENDEDOR));
    expect(r.source).toBe('base');
    expect(r.unitPrice).toBe(10);
  });

  it('degrau: escolhe o maior minQuantity que cabe na quantidade', async () => {
    const uc = new ResolvePriceUseCase(
      repoFalso([
        lista({
          name: 'Atacado',
          contactId: CONTATO,
          itens: [
            { price: 10, minQuantity: 1 },
            { price: 8.5, minQuantity: 12 },
          ],
        }),
      ]),
      produtoFalso(20),
    );
    const varejo = await uc.execute(new ResolvePriceQuery(PRODUTO, 5, CONTATO));
    expect(varejo.unitPrice).toBe(10);
    const atacado = await uc.execute(new ResolvePriceQuery(PRODUTO, 12, CONTATO));
    expect(atacado.unitPrice).toBe(8.5);
  });

  it('entre tabelas do mesmo vínculo, vence o MENOR preço (melhor p/ o cliente)', async () => {
    const uc = new ResolvePriceUseCase(
      repoFalso([
        lista({ name: 'A', contactId: CONTATO, itens: [{ price: 9 }] }),
        lista({ name: 'B', contactId: CONTATO, itens: [{ price: 7.5 }] }),
      ]),
      produtoFalso(20),
    );
    const r = await uc.execute(new ResolvePriceQuery(PRODUTO, 1, CONTATO));
    expect(r.unitPrice).toBe(7.5);
  });

  it('sem tabela e sem preço base é recusado', async () => {
    const uc = new ResolvePriceUseCase(repoFalso([]), produtoFalso(null));
    await expect(uc.execute(new ResolvePriceQuery(PRODUTO, 1, CONTATO))).rejects.toThrow(
      PriceNotResolvableException,
    );
  });
});
