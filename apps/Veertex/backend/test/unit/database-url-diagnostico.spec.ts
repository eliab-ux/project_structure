import { ConfigService } from '@nestjs/config';
import { createMikroOrmConfig } from '../../src/infrastructure/persistence/mikro-orm/config/mikro-orm.config';

/**
 * A MENSAGEM de `DATABASE_URL inválida` — e por que ela tem teste próprio.
 *
 * No primeiro deploy (20/08/2026) o container morreu com `Invalid DATABASE_URL.` e nada mais. A
 * verificação estava certa e era inútil: quem lê isso no log do Dokploy não sabe se faltou o esquema,
 * se sobrou um `<placeholder>` do modelo, ou se a senha tem um `@`. São três correções diferentes.
 *
 * O que este arquivo prende são as duas metades disso:
 *
 *  1. cada formato de erro produz a frase que aponta A SUA correção;
 *  2. **a senha nunca aparece na mensagem** — connection string em log é senha de banco em log, e o
 *     log do Dokploy é lido por quem tem acesso ao painel, não por quem tem acesso ao banco.
 */
function configComUrl(url: string): ConfigService {
  return {
    get: (chave: string) => (chave === 'DATABASE_URL' ? url : 'production'),
  } as unknown as ConfigService;
}

function mensagemDeErro(url: string): string {
  try {
    createMikroOrmConfig(configComUrl(url));
    return '(não lançou)';
  } catch (erro) {
    return (erro as Error).message;
  }
}

describe('DATABASE_URL — a mensagem diz o que corrigir', () => {
  it('placeholder do modelo não substituído', () => {
    const mensagem = mensagemDeErro(
      'postgresql://veertex_app:<SENHA>@<INTERNAL_HOST>:5432/veertex',
    );
    expect(mensagem).toMatch(/entre < >/);
    expect(mensagem).toMatch(/placeholder do modelo/);
  });

  it('esquema ausente — o caso de colar só host:porta/banco', () => {
    expect(mensagemDeErro('veertex-veertex-eeilbu:5432/veertex')).toMatch(/Falta o esquema/);
  });

  it('quebra de linha ou espaço no valor', () => {
    // O parser do WHATWG remove tab e newline em silêncio, então este caso pode chegar longe demais
    // sem a checagem explícita. Espaço no meio do host é o que de fato quebra.
    expect(mensagemDeErro('postgresql://u:s@host com espaco:5432/veertex')).toMatch(
      /espaço ou quebra de linha/,
    );
  });

  it('nome da variável colado dentro do valor', () => {
    expect(mensagemDeErro('DATABASE_URL=postgresql://u:s@host:5432/veertex')).toMatch(
      /nome da variável foi colado/,
    );
  });

  it('exige a variável quando ela está ausente', () => {
    expect(mensagemDeErro('')).toMatch(/DATABASE_URL is required/);
  });

  it('A SENHA NUNCA APARECE na mensagem', () => {
    const senha = 'senha-secreta-que-nao-pode-vazar';
    for (const url of [
      `postgresql://veertex_app:${senha}@host com espaco:5432/veertex`,
      `DATABASE_URL=postgresql://veertex_app:${senha}@host:5432/veertex`,
      `veertex_app:${senha}@host:5432/veertex`,
      `postgresql://veertex_app:${senha}@<HOST>:5432/veertex`,
    ]) {
      const mensagem = mensagemDeErro(url);
      expect(mensagem).not.toContain(senha);
      // Nem a string inteira, que carregaria a senha dentro dela.
      expect(mensagem).not.toContain(url);
    }
  });

  it('aceita uma URL válida — a guarda não pode recusar o caso bom', () => {
    expect(() =>
      createMikroOrmConfig(
        configComUrl('postgresql://veertex_app:12345678@veertex-veertex-eeilbu:5432/veertex'),
      ),
    ).not.toThrow();
  });
});
