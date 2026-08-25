import { EntityManager } from '@mikro-orm/postgresql';
import { MikroOrmContactRepository } from '../../../src/infrastructure/persistence/mikro-orm/repositories/contact.repository';
import { ContactMapper } from '../../../src/infrastructure/persistence/mikro-orm/mappers/contact.mapper';
import { ScopedRawQueryService } from '../../../src/infrastructure/persistence/mikro-orm/scoped-raw-query.service';
import { ContactOrmEntity } from '../../../src/infrastructure/persistence/mikro-orm/entities/contact-orm.entity';
import { ContactId } from '../../../src/contexts/audience/domain/value-objects/contact-id.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const CONTACT_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const CHANNEL_ID = 'bbbbbbbb-1111-4111-8111-111111111111';

function ormRow(): ContactOrmEntity {
  const row = new ContactOrmEntity();
  row.id = CONTACT_ID;
  row.accountId = ACCOUNT_A;
  row.phoneE164 = '+5511999998888';
  row.name = 'Maria Silva';
  row.firstName = 'Maria';
  row.tags = ['vip'];
  row.currentChannelId = CHANNEL_ID;
  row.active = true;
  row.optedOutAt = null;
  row.contactImportId = null;
  row.createdAt = new Date();
  return row;
}

/** Cross-tenant isolation for the contact repository — §13 asks for one per repository. */
describe('MikroOrmContactRepository — tenant scoping', () => {
  let em: jest.Mocked<
    Pick<
      EntityManager,
      'findOne' | 'find' | 'findAndCount' | 'upsert' | 'insertMany' | 'flush' | 'count'
    >
  >;
  let repository: MikroOrmContactRepository;
  /** Só `scoped` é usado por este repositório, e o teste checa o SQL que passa por ele. */
  let raw: { scoped: jest.Mock };

  beforeEach(() => {
    raw = { scoped: jest.fn(async () => []) };
    em = {
      findOne: jest.fn(async () => ormRow()),
      find: jest.fn(async () => [ormRow()]),
      findAndCount: jest.fn(async () => [[ormRow()], 1]),
      upsert: jest.fn(async () => ormRow()),
      insertMany: jest.fn(async () => []),
      flush: jest.fn(),
      count: jest.fn(async () => 1),
    } as unknown as jest.Mocked<
      Pick<
        EntityManager,
        'findOne' | 'find' | 'findAndCount' | 'upsert' | 'insertMany' | 'flush' | 'count'
      >
    >;
    repository = new MikroOrmContactRepository(
      em as unknown as EntityManager,
      new ContactMapper(),
      raw as unknown as ScopedRawQueryService,
    );
  });

  it('findById passes NO accountId and NO filter override', async () => {
    await repository.findById(ContactId.from(CONTACT_ID));

    const [, where, options] = em.findOne.mock.calls[0];
    expect(where).toEqual({ id: CONTACT_ID });
    expect(JSON.stringify(where)).not.toContain('accountId');
    expect(options?.filters).toBeUndefined();
  });

  it('the dedup lookup is tenant-scoped: the same number in another account is invisible', async () => {
    // This is what makes §6.1 item 4 deduplicate WITHIN a tenant and not across tenants.
    await repository.findByPhone(PhoneE164.create('11999998888'));

    const [, where, options] = em.findOne.mock.calls[0];
    expect(where).toEqual({ phoneE164: '+5511999998888' });
    expect(options?.filters).toBeUndefined();
  });

  it('NO method anywhere disables the tenant filter', async () => {
    await repository.findById(ContactId.from(CONTACT_ID));
    await repository.findByPhone(PhoneE164.create('11999998888'));
    await repository.findManyByPhones(['+5511999998888']);
    await repository.list({ page: 1, limit: 10 });
    await repository.listByChannel(CHANNEL_ID);
    await repository.countByChannelId(CHANNEL_ID);

    const overrides = [
      ...em.findOne.mock.calls,
      ...em.find.mock.calls,
      ...em.findAndCount.mock.calls,
    ]
      .map(([, , options]) => options?.filters)
      .filter(Boolean);
    expect(overrides).toEqual([]);
  });

  it('writes always carry the accountId, so a row cannot land in another tenant', async () => {
    const mapper = new ContactMapper();
    const contact = mapper.toDomain(ormRow());

    await repository.save(contact);
    await repository.saveMany([contact]);

    const [, single] = em.upsert.mock.calls[0] as [unknown, Record<string, unknown>];
    const [, batch] = em.insertMany.mock.calls[0] as [unknown, Record<string, unknown>[]];
    expect(single.accountId).toBe(ACCOUNT_A);
    expect(batch[0].accountId).toBe(ACCOUNT_A);
  });

  it('the search filter never touches the phone column', async () => {
    await repository.list({ page: 1, limit: 10, search: '9999' });

    const [, where] = em.findAndCount.mock.calls[0] as [unknown, Record<string, unknown>];
    // A phone searchable by fragment turns the contact list into a number-lookup tool.
    expect(where.name).toEqual({ $ilike: '%9999%' });
    expect(where).not.toHaveProperty('phoneE164');
  });

  /**
   * O bug que isto trava: o contato guarda a tag como foi escrita (`Brasilia`) e todo filtro
   * minúsculo o que o operador digita (`TargetFilter` e o atribuidor de variantes fazem isso). O
   * `$contains` do jsonb é exato, então os dois nunca se encontravam — a campanha dizia "nenhum
   * contato enviável" com os contatos ali, usando a tag.
   */
  describe('filtro por tag ignora maiúsculas', () => {
    it('resolve a tag digitada para a que está gravada, e filtra por ela', async () => {
      raw.scoped.mockResolvedValue([{ tag: 'Brasilia' }]);

      await repository.list({ tags: ['brasilia'], page: 1, limit: 20 });

      const [sql, bindings] = raw.scoped.mock.calls[0] as [string, Record<string, unknown>];
      expect(sql).toContain(':accountId');
      expect(sql).toContain('lower(t.value)');
      // Os dois lados em minúscula: o digitado aqui, o gravado no SQL.
      expect(bindings.wanted).toEqual(['brasilia']);

      const [, where] = em.findAndCount.mock.calls[0] as [unknown, Record<string, unknown>];
      // Filtra pelo valor GRAVADO, para o índice GIN continuar servindo a consulta cara.
      expect(where.$or).toEqual([{ tags: { $contains: ['Brasilia'] } }]);
    });

    it('devolve vazio — nunca a base inteira — quando nenhuma tag gravada casa', async () => {
      raw.scoped.mockResolvedValue([]);

      const result = await repository.list({ tags: ['inexistente'], page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      // Um `$or` vazio o MikroORM descarta, e o filtro viraria "todo mundo" — o pior desfecho
      // possível para algo que decide quem recebe uma mensagem.
      expect(em.findAndCount).not.toHaveBeenCalled();
    });

    it('não vai ao banco quando a lista de tags só tem espaço em branco', async () => {
      await repository.list({ tags: ['   '], page: 1, limit: 20 });

      expect(raw.scoped).not.toHaveBeenCalled();
      expect(em.findAndCount).not.toHaveBeenCalled();
    });
  });

  it('load per channel counts only routable contacts, via scoped raw SQL', async () => {
    raw.scoped.mockResolvedValue([{ channel_id: CHANNEL_ID, contacts: '7' }]);

    const counts = await repository.countByChannel();

    const [sql] = raw.scoped.mock.calls[0] as [string];
    // Passa pelo serviço de raw scoped, e NÃO pelo query builder: o MikroORM prefixa o alias em toda
    // expressão selecionada, então `count(*)` virava `c.count(*)` e o Postgres recusava — 500 na tela.
    expect(sql).toContain(':accountId');
    // Contar quem saiu faria o alocador evitar um canal que na verdade está livre.
    expect(sql).toContain('"active" = true');
    expect(sql).toContain('"opted_out_at" is null');
    // count(*) do Postgres volta como string; sem a coerção a soma na tela concatenaria.
    expect(counts).toEqual([{ channelId: CHANNEL_ID, contacts: 7 }]);
  });

  it('lists the distinct tags of the base with the audience each one reaches', async () => {
    raw.scoped.mockResolvedValue([
      { tag: 'Brasilia', contacts: '2' },
      { tag: 'Goiânia', contacts: '1' },
    ]);

    const tags = await repository.listTags();

    const [sql] = raw.scoped.mock.calls[0] as [string];
    expect(sql).toContain(':accountId');
    // Só quem é alcançável: uma tag cujos contatos saíram todos não alcança ninguém, e mostrá-la com
    // o número deles prometeria um público que não existe.
    expect(sql).toContain('"active" = true');
    expect(sql).toContain('"opted_out_at" is null');
    // Agrupado pela tag em minúscula: `Brasilia` e `brasilia` são uma entrada só, não duas idênticas
    // na tela.
    expect(sql).toContain('group by lower(t.value)');
    // count() do Postgres volta string; sem a coerção a tela somaria concatenando.
    expect(tags).toEqual([
      { tag: 'Brasilia', contacts: 2 },
      { tag: 'Goiânia', contacts: 1 },
    ]);
  });

  it('round-trips a contact through the mapper without losing state', async () => {
    const mapper = new ContactMapper();
    const row = ormRow();
    row.optedOutAt = new Date('2026-08-01T10:00:00Z');
    row.active = false;
    row.tags = ['vip', 'centro'];

    const back = mapper.toOrmData(mapper.toDomain(row));

    expect(back).toMatchObject({
      id: row.id,
      accountId: row.accountId,
      phoneE164: row.phoneE164,
      firstName: 'Maria',
      currentChannelId: CHANNEL_ID,
      active: false,
      tags: ['vip', 'centro'],
      optedOutAt: row.optedOutAt,
    });
  });
});
