import { createE2EApp, E2EContext } from './e2e-app';
import { seedAccount, SeededAccount, TEST_PASSWORD } from './seed';

/**
 * Configuração da conta: janelas de funcionamento, máquinas com preço e o responsável pelo
 * relatório. É o que a Fase 1 entrega de configurável, e o que a Fase 4 vai consumir para decidir
 * se uma reserva cabe.
 */
describe('Configuração da conta (e2e)', () => {
  jest.setTimeout(120_000);

  let ctx: E2EContext;
  let conta: SeededAccount;
  let ownerToken: string;

  beforeAll(async () => {
    ctx = await createE2EApp();
    conta = await seedAccount(ctx, 'config');

    const session = await ctx.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: conta.users.owner.email, password: TEST_PASSWORD },
    });
    ownerToken = session.body.accessToken;
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  async function addWindow(weekday: number, startsAt: string, endsAt: string) {
    return ctx.inject({
      method: 'POST',
      url: '/api/account/business-hours',
      token: ownerToken,
      payload: { weekday, startsAt, endsAt },
    });
  }

  describe('janelas de funcionamento', () => {
    it('aceita manhã e tarde no mesmo dia — o almoço é a ausência de janela', async () => {
      expect((await addWindow(1, '07:00', '11:30')).statusCode).toBe(201);
      expect((await addWindow(1, '13:00', '17:30')).statusCode).toBe(201);
    });

    it('recusa janela sobreposta com mensagem que nomeia o conflito', async () => {
      const response = await addWindow(1, '10:00', '12:00');

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toMatch(/07:00–11:30/);
    });

    it('aceita janela que encosta na anterior (11:30 fecha uma e abre a outra)', async () => {
      expect((await addWindow(1, '11:30', '13:00')).statusCode).toBe(201);
    });

    it('aceita a mesma faixa em outro dia da semana', async () => {
      expect((await addWindow(2, '07:00', '11:30')).statusCode).toBe(201);
    });

    it('recusa fim antes do início', async () => {
      expect((await addWindow(3, '17:00', '09:00')).statusCode).toBe(400);
    });

    it.each([
      [7, '07:00', '11:30'],
      [-1, '07:00', '11:30'],
      [1, '7:00', '11:30'],
      [1, '07:00', '25:00'],
    ])('recusa entrada inválida (%p %p %p)', async (weekday, startsAt, endsAt) => {
      expect((await addWindow(weekday, startsAt, endsAt)).statusCode).toBe(400);
    });

    it('devolve as janelas ordenadas com as horas úteis calculadas', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/account/business-hours',
        token: ownerToken,
      });

      expect(response.statusCode).toBe(200);
      const segunda = response.body.filter((hour: { weekday: number }) => hour.weekday === 1);
      expect(segunda.map((hour: { startsAt: string }) => hour.startsAt)).toEqual([
        '07:00',
        '11:30',
        '13:00',
      ]);
      // 07:00–11:30 = 270 min
      expect(segunda[0].durationMinutes).toBe(270);
    });

    it('remove uma janela e libera a faixa', async () => {
      const criada = await addWindow(4, '08:00', '12:00');
      const remocao = await ctx.inject({
        method: 'DELETE',
        url: `/api/account/business-hours/${criada.body.id}`,
        token: ownerToken,
      });

      expect(remocao.statusCode).toBe(204);
      expect((await addWindow(4, '08:00', '12:00')).statusCode).toBe(201);
    });

    it('responde 404 ao remover janela inexistente', async () => {
      const response = await ctx.inject({
        method: 'DELETE',
        url: '/api/account/business-hours/8f1a6c2e-0000-4000-8000-000000000000',
        token: ownerToken,
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('máquinas e preço da hora', () => {
    it('cadastra máquina com preço próprio', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/machines',
        token: ownerToken,
        payload: { name: 'Mesa manual', model: null, hourPriceCents: 4000 },
      });

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({ hourPriceCents: 4000, isActive: true });
    });

    it('recusa preço zero ou negativo', async () => {
      for (const hourPriceCents of [0, -100]) {
        const response = await ctx.inject({
          method: 'POST',
          url: '/api/machines',
          token: ownerToken,
          payload: { name: 'Inválida', model: null, hourPriceCents },
        });
        expect(response.statusCode).toBe(400);
      }
    });

    it('recusa preço fracionado — centavos são inteiros', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/machines',
        token: ownerToken,
        payload: { name: 'Fracionada', model: null, hourPriceCents: 8500.5 },
      });
      expect(response.statusCode).toBe(400);
    });

    it('inativa a máquina sem apagar o histórico dela', async () => {
      const response = await ctx.inject({
        method: 'PUT',
        url: `/api/machines/${conta.machineId}`,
        token: ownerToken,
        payload: {
          name: 'Máquina config',
          model: 'Audaces Neocut Bravo',
          hourPriceCents: 9000,
          isActive: false,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({ isActive: false, hourPriceCents: 9000 });

      const lista = await ctx.inject({ method: 'GET', url: '/api/machines', token: ownerToken });
      expect(lista.body.map((m: { id: string }) => m.id)).toContain(conta.machineId);
    });
  });

  describe('responsável pelo relatório', () => {
    it('salva o bloco inteiro e devolve o telefone normalizado', async () => {
      const response = await ctx.inject({
        method: 'PUT',
        url: '/api/account',
        token: ownerToken,
        payload: {
          name: 'Corte Ceres · APL',
          city: 'Ceres',
          timezone: 'America/Sao_Paulo',
          reportOwner: {
            name: 'Cristiano Moreira dos Reis',
            role: 'Operador de Sistema Audaces',
            phone: '(62) 9 9870-8893',
            email: 'corteautomatizadoceres@gmail.com',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.reportOwner).toMatchObject({
        name: 'Cristiano Moreira dos Reis',
        phone: '+5562998708893',
      });
    });

    it('recusa responsável sem nome — responsável sem nome é responsável nenhum', async () => {
      const response = await ctx.inject({
        method: 'PUT',
        url: '/api/account',
        token: ownerToken,
        payload: {
          name: 'Corte Ceres · APL',
          city: 'Ceres',
          timezone: 'America/Sao_Paulo',
          reportOwner: { name: '', role: 'Operador' },
        },
      });
      expect(response.statusCode).toBe(400);
    });

    it('aceita conta sem responsável definido', async () => {
      const response = await ctx.inject({
        method: 'PUT',
        url: '/api/account',
        token: ownerToken,
        payload: {
          name: 'Corte Ceres · APL',
          city: 'Ceres',
          timezone: 'America/Sao_Paulo',
          reportOwner: null,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.reportOwner).toBeNull();
    });
  });

  describe('fuso horário da conta', () => {
    const salvar = (timezone: string) =>
      ctx.inject({
        method: 'PUT',
        url: '/api/account',
        token: ownerToken,
        payload: {
          name: 'Corte Ceres · APL',
          city: 'Ceres',
          timezone,
          reportOwner: null,
        },
      });

    it('a conta nasce em America/Sao_Paulo', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/account',
        token: ownerToken,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.timezone).toBe('America/Sao_Paulo');
    });

    it('aceita outro fuso IANA real', async () => {
      const response = await salvar('America/Manaus');

      expect(response.statusCode).toBe(200);
      expect(response.body.timezone).toBe('America/Manaus');

      // Devolve ao padrão para não contaminar os testes seguintes deste arquivo.
      await salvar('America/Sao_Paulo');
    });

    it('recusa fuso que não existe, mesmo com o formato certo', async () => {
      // Passa no regex do DTO (`Região/Cidade`) e morre no `Intl` do domínio — é essa a divisão:
      // o DTO confere forma, quem sabe se o fuso existe é quem vai converter com ele.
      const response = await salvar('America/Ceres');

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toMatch(/fuso horário desconhecido/i);
    });

    it('recusa string que nem parece fuso', async () => {
      for (const invalido of ['UTC-3', 'Brasilia', '']) {
        const response = await salvar(invalido);
        expect([invalido, response.statusCode]).toEqual([invalido, 400]);
      }
    });

    it('o fuso é obrigatório no PUT — não dá para apagá-lo por omissão', async () => {
      const response = await ctx.inject({
        method: 'PUT',
        url: '/api/account',
        token: ownerToken,
        payload: { name: 'Corte Ceres · APL', city: 'Ceres', reportOwner: null },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
