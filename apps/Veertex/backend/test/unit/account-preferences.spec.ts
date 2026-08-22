import { AccountPreferences } from '../../src/contexts/account/domain/value-objects/account-preferences.vo';

/**
 * As preferências da conta (§1 do 01A). O ponto é o default DECLARADO, nunca inferido de ausência:
 * `create(undefined)` e `create({})` devolvem exatamente o conjunto conservador escrito no VO.
 */
describe('AccountPreferences', () => {
  it('o default é declarado e conservador', () => {
    const prefs = AccountPreferences.defaults();
    expect(prefs.allowDuplicateDocument).toBe(false);
    expect(prefs.contactCodeMode).toBe('manual');
    expect(prefs.productSkuMode).toBe('manual');
    // Carteirização nasce DESLIGADA (§2.3 / ADR-0007) — ligar muda visibilidade de dado.
    expect(prefs.contactCarteirizacao).toBe(false);
  });

  it('create(undefined) e create({}) caem no default — ausência não vira comportamento inferido', () => {
    expect(AccountPreferences.create().allowDuplicateDocument).toBe(false);
    expect(AccountPreferences.create({}).contactCodeMode).toBe('manual');
  });

  it('parcial sobrepõe só o que veio, o resto é o default', () => {
    const prefs = AccountPreferences.create({ contactCodeMode: 'sequential' });
    expect(prefs.contactCodeMode).toBe('sequential');
    expect(prefs.productSkuMode).toBe('manual'); // não veio → default
    expect(prefs.allowDuplicateDocument).toBe(false);
  });

  it('valor inválido vindo do banco cai no default, não quebra', () => {
    const prefs = AccountPreferences.create({ contactCodeMode: 'lixo' as never });
    expect(prefs.contactCodeMode).toBe('manual');
  });

  it('with() devolve um novo VO imutável com a mudança aplicada', () => {
    const base = AccountPreferences.defaults();
    const mudado = base.with({ productSkuMode: 'sequential' });
    expect(mudado.productSkuMode).toBe('sequential');
    // o original não muda — Value Object é imutável
    expect(base.productSkuMode).toBe('manual');
  });
});
