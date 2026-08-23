import { CommercialRule } from '../../src/contexts/route/domain/entities/commercial-rule.entity';
import { Route } from '../../src/contexts/route/domain/entities/route.entity';

const CONTA = '11111111-1111-4111-8111-111111111111';
const VENDEDOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const EMPRESA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COND_BOLETO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const COND_PIX = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe('Route — cadastro (§2 do 04)', () => {
  it('nasce ativa e normaliza nome/código', () => {
    const r = Route.create({ accountId: CONTA, name: '  Rondonópolis  ', code: ' RO1 ' });
    expect(r.name).toBe('Rondonópolis');
    expect(r.code).toBe('RO1');
    expect(r.active).toBe(true);
  });

  it('desativar não apaga', () => {
    const r = Route.create({ accountId: CONTA, name: 'Campo Grande 1001' });
    r.edit({ active: false });
    expect(r.active).toBe(false);
  });
});

describe('CommercialRule — perfil do representante (§3.7 do 04)', () => {
  it('perfil vazio não restringe nenhuma dimensão (default = pode tudo)', () => {
    const rule = CommercialRule.create({ accountId: CONTA, userId: VENDEDOR });
    expect(rule.allowsCompany(EMPRESA_A)).toBe(true);
    expect(rule.allowsPaymentCondition(COND_BOLETO)).toBe(true);
  });

  it('"tudo, menos boleto": lista de condições permitidas exclui o boleto', () => {
    // Ex. real do 04: "Juliano tudo, menos boleto" — modela-se listando as PERMITIDAS.
    const rule = CommercialRule.create({
      accountId: CONTA,
      userId: VENDEDOR,
      allowedPaymentConditionIds: [COND_PIX],
    });
    expect(rule.allowsPaymentCondition(COND_PIX)).toBe(true);
    expect(rule.allowsPaymentCondition(COND_BOLETO)).toBe(false);
  });

  it('restrição de empresa: só as listadas passam', () => {
    const rule = CommercialRule.create({
      accountId: CONTA,
      userId: VENDEDOR,
      allowedCompanyIds: [EMPRESA_A],
    });
    expect(rule.allowsCompany(EMPRESA_A)).toBe(true);
    expect(rule.allowsCompany(EMPRESA_B)).toBe(false);
  });

  it('replace troca o perfil inteiro por dimensão', () => {
    const rule = CommercialRule.create({ accountId: CONTA, userId: VENDEDOR });
    rule.replace({ allowedCompanyIds: [EMPRESA_A, EMPRESA_B] });
    expect(rule.allowedCompanyIds).toEqual([EMPRESA_A, EMPRESA_B]);
    // dimensões não informadas permanecem vazias
    expect(rule.allowedPriceListIds).toEqual([]);
  });
});
