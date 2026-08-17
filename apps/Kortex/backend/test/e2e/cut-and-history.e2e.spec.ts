import { createE2EApp, E2EContext } from './e2e-app';
import { seedAccount, SeededAccount, TEST_PASSWORD } from './seed';

const seg = (hhmm: string) => `2026-09-07T${hhmm}:00.000-03:00`;

describe('Apontamento e histórico por tecido (e2e)', () => {
  jest.setTimeout(240_000);

  let ctx: E2EContext;
  let conta: SeededAccount;
  const tokens: Record<string, string> = {};
  let customerId: string;
  let fabricId: string;
  let productTypeId: string;
  let machineId: string;
  let hora = 7;

  const login = (email: string) =>
    ctx.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: TEST_PASSWORD },
    });

  /** Cria pré-pedido + reserva num horário livre. `pagar: false` deixa em pré-reserva. */
  async function novaReserva(pagar = true): Promise<string> {
    const preOrderId = (
      await ctx.inject({
        method: 'POST',
        url: '/api/pre-orders',
        token: tokens.modelista,
        payload: { customerId, fabricId, productTypeId, estimatedPieces: 160, estimatedHours: 1 },
      })
    ).body.id;

    const inicio = String(hora).padStart(2, '0');
    const fim = String(hora + 1).padStart(2, '0');
    hora += 1;

    const reserva = await ctx.inject({
      method: 'POST',
      url: '/api/reservations',
      token: tokens.admin,
      // `seg` espera HH:MM — sem os minutos o ISO sai malformado e o DTO recusa com 400.
      payload: { machineId, preOrderId, startsAt: seg(`${inicio}:00`), endsAt: seg(`${fim}:00`) },
    });

    if (pagar) {
      await ctx.inject({
        method: 'PATCH',
        url: `/api/reservations/${reserva.body.id}/payment`,
        token: tokens.admin,
        payload: { method: 'pix' },
      });
    }

    return reserva.body.id;
  }

  beforeAll(async () => {
    ctx = await createE2EApp();
    conta = await seedAccount(ctx, 'fase5');

    for (const role of ['owner', 'admin', 'modelista'] as const) {
      tokens[role] = (await login(conta.users[role].email)).body.accessToken;
    }

    // Janela larga na segunda, para caber várias reservas de uma hora.
    await ctx.inject({
      method: 'POST',
      url: '/api/account/business-hours',
      token: tokens.owner,
      payload: { weekday: 1, startsAt: '07:00', endsAt: '22:00' },
    });

    machineId = conta.machineId;

    customerId = (
      await ctx.inject({
        method: 'POST',
        url: '/api/customers',
        token: tokens.admin,
        payload: {
          legalName: 'Malharia São Bento LTDA',
          tradeName: 'Malharia São Bento',
          documentType: 'cnpj',
          document: '11222333000181',
          city: 'Ceres',
          state: 'GO',
          repName: 'Maria Aparecida Souza',
          repCpf: '52998224725',
          repPhone: '62998887766',
          repEmail: 'maria@saobento.com.br',
          whatsapp: '62998887766',
        },
      })
    ).body.id;

    fabricId = (
      await ctx.inject({
        method: 'POST',
        url: '/api/fabrics',
        token: tokens.modelista,
        // Malha: enfesto de até 2,5 cm com camadas de 0,05 cm — cabem 50.
        payload: { name: 'Malha', maxLayerHeightCm: 2.5, layerThicknessCm: 0.05 },
      })
    ).body.id;

    productTypeId = (
      await ctx.inject({
        method: 'POST',
        url: '/api/product-types',
        token: tokens.modelista,
        payload: { name: 'Camiseta' },
      })
    ).body.id;
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  describe('a catraca vale para o corte (regra 2.4)', () => {
    it('reserva PRÉ-RESERVADA não aceita start', async () => {
      const reservaId = await novaReserva(false);

      const response = await ctx.inject({
        method: 'POST',
        url: `/api/reservations/${reservaId}/cuts`,
        token: tokens.modelista,
        payload: {},
      });

      expect(response.statusCode).toBe(403);
      expect(response.body.message).toMatch(/não está paga/);
    });

    it('reserva paga aceita, e o primeiro start move para "em execução"', async () => {
      const reservaId = await novaReserva();

      const response = await ctx.inject({
        method: 'POST',
        url: `/api/reservations/${reservaId}/cuts`,
        token: tokens.modelista,
        payload: { markerName: 'Matriz A' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({ sequence: 1, isRunning: true, totalPieces: null });

      const fila = await ctx.inject({
        method: 'GET',
        url: '/api/modelista/reservations',
        token: tokens.modelista,
      });
      const reserva = fila.body.find((r: { id: string }) => r.id === reservaId);
      expect(reserva.status).toBe('in_progress');
    });

    it('o Administrativo NÃO aponta corte — segregação de função (§5)', async () => {
      const reservaId = await novaReserva();

      const response = await ctx.inject({
        method: 'POST',
        url: `/api/reservations/${reservaId}/cuts`,
        token: tokens.admin,
        payload: {},
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('dois toques e o derivado', () => {
    let reservaId: string;
    let cutId: string;

    beforeAll(async () => {
      reservaId = await novaReserva();
      cutId = (
        await ctx.inject({
          method: 'POST',
          url: `/api/reservations/${reservaId}/cuts`,
          token: tokens.modelista,
          payload: { markerName: 'Matriz 1' },
        })
      ).body.id;
    });

    it('o stop calcula total_pieces — 12 encaixadas × 14 camadas = 168', async () => {
      const response = await ctx.inject({
        method: 'PATCH',
        url: `/api/cuts/${cutId}/stop`,
        token: tokens.modelista,
        payload: { layers: 14, nestedPieces: 12, layoutType: 'zigzag' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.cut).toMatchObject({ layers: 14, nestedPieces: 12, totalPieces: 168 });
      // Start e stop acontecem com milissegundos de diferença no teste, então a duração
      // arredonda para 0 — o que importa aqui é que ela foi MEDIDA. A aritmética do intervalo
      // tem teste unitário com datas fixas (13:00 → 14:14 = 74 min).
      expect(response.body.cut.durationSeconds).not.toBeNull();
      expect(typeof response.body.cut.durationSeconds).toBe('number');

      /**
       * 14 camadas de malha **não** avisam — e este é o ponto da correção.
       *
       * 14 × 0,05 cm = 0,70 cm, bem dentro dos 2,50 cm de enfesto do tecido. A comparação antiga
       * confrontava a contagem de camadas com a altura em cm e avisava aqui, num corte
       * absolutamente normal; aviso que dispara no caso comum deixa de ser lido no caso raro.
       */
      expect(response.body.warnings).toEqual([]);
    });

    it('total_pieces NÃO é aceito do cliente HTTP', async () => {
      const outra = await novaReserva();
      const nova = await ctx.inject({
        method: 'POST',
        url: `/api/reservations/${outra}/cuts`,
        token: tokens.modelista,
        payload: {},
      });

      const response = await ctx.inject({
        method: 'PATCH',
        url: `/api/cuts/${nova.body.id}/stop`,
        token: tokens.modelista,
        payload: { layers: 10, nestedPieces: 10, layoutType: 'zigzag', totalPieces: 99999 },
      });

      // forbidNonWhitelisted: o campo a mais derruba a requisição inteira.
      expect(response.statusCode).toBe(400);
    });

    it('uma reserva tem N matrizes, mas uma de cada vez', async () => {
      const segunda = await ctx.inject({
        method: 'POST',
        url: `/api/reservations/${reservaId}/cuts`,
        token: tokens.modelista,
        payload: { markerName: 'Matriz 2' },
      });
      expect(segunda.body.sequence).toBe(2);

      const terceira = await ctx.inject({
        method: 'POST',
        url: `/api/reservations/${reservaId}/cuts`,
        token: tokens.modelista,
        payload: {},
      });
      expect(terceira.statusCode).toBe(400);
      expect(terceira.body.message).toMatch(/ainda está em andamento/);
    });

    it('enfesto acima da altura máxima = AVISO, e a matriz é gravada', async () => {
      const emAndamento = (
        await ctx.inject({
          method: 'GET',
          url: `/api/reservations/${reservaId}/cuts`,
          token: tokens.modelista,
        })
      ).body.find((cut: { isRunning: boolean }) => cut.isRunning);

      const response = await ctx.inject({
        method: 'PATCH',
        url: `/api/cuts/${emAndamento.id}/stop`,
        token: tokens.modelista,
        // 60 × 0,05 cm = 3,00 cm contra os 2,50 cm da malha. Passa de verdade, e aí sim avisa.
        payload: { layers: 60, nestedPieces: 5, layoutType: 'sheet_by_sheet' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.warnings).toHaveLength(1);
      expect(response.body.warnings[0]).toMatch(/60 camadas/);
      expect(response.body.warnings[0]).toMatch(/3,00 cm/);
      // Gravada assim mesmo: 60 × 5 = 300.
      expect(response.body.cut.totalPieces).toBe(300);
    });

    it('tecido SEM espessura cadastrada não gera aviso nenhum', async () => {
      const semMedida = (
        await ctx.inject({
          method: 'POST',
          url: '/api/fabrics',
          token: tokens.modelista,
          // Sem `layerThicknessCm`: o cadastro ainda não foi medido.
          payload: { name: 'Feltro sem medida', maxLayerHeightCm: 1 },
        })
      ).body;

      const outra = await novaReserva();
      const nova = await ctx.inject({
        method: 'POST',
        url: `/api/reservations/${outra}/cuts`,
        token: tokens.modelista,
        payload: {},
      });

      const response = await ctx.inject({
        method: 'PATCH',
        url: `/api/cuts/${nova.body.id}/stop`,
        token: tokens.modelista,
        payload: {
          layers: 500,
          nestedPieces: 2,
          layoutType: 'zigzag',
          fabricId: semMedida.id,
        },
      });

      // 500 camadas num tecido de 1 cm de enfesto máximo — e mesmo assim, silêncio: sem espessura
      // não há altura a calcular, e um palpite aqui viraria aviso falso em todo corte.
      expect(response.statusCode).toBe(200);
      expect(response.body.warnings).toEqual([]);
      expect(response.body.cut.totalPieces).toBe(1000);
    });

    it('após encerrar a reserva, a matriz não é mais editável', async () => {
      const encerrar = await ctx.inject({
        method: 'PATCH',
        url: `/api/reservations/${reservaId}/cuts/complete`,
        token: tokens.modelista,
      });
      expect(encerrar.statusCode).toBe(204);

      const novoStart = await ctx.inject({
        method: 'POST',
        url: `/api/reservations/${reservaId}/cuts`,
        token: tokens.modelista,
        payload: {},
      });
      expect(novoStart.statusCode).toBe(403);
      expect(novoStart.body.message).toMatch(/já foi concluída/);
    });

    it('não encerra reserva com matriz em andamento', async () => {
      const outra = await novaReserva();
      await ctx.inject({
        method: 'POST',
        url: `/api/reservations/${outra}/cuts`,
        token: tokens.modelista,
        payload: {},
      });

      const response = await ctx.inject({
        method: 'PATCH',
        url: `/api/reservations/${outra}/cuts/complete`,
        token: tokens.modelista,
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('histórico por tecido', () => {
    it('agrega camadas, peças e duração dos cortes anteriores', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: `/api/fabric-history?fabricId=${fabricId}`,
        token: tokens.modelista,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.samples).toBeGreaterThan(0);
      expect(response.body.medianTotalPieces).toBeGreaterThan(0);
      expect(response.body.fabric.name).toBe('Malha');
    });

    it('sugere horas para o volume pedido, arredondando para cima', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: `/api/fabric-history?fabricId=${fabricId}&pieces=168`,
        token: tokens.modelista,
      });

      // Mínimo de 1: a venda é em hora cheia, e nenhum corte custa zero hora.
      expect(response.body.suggestedHours).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(response.body.suggestedHours)).toBe(true);
    });

    it('tecido sem histórico responde vazio, não quebra', async () => {
      const novo = await ctx.inject({
        method: 'POST',
        url: '/api/fabrics',
        token: tokens.modelista,
        payload: { name: 'Tecido Sem Uso', maxLayerHeightCm: 3 },
      });

      const response = await ctx.inject({
        method: 'GET',
        url: `/api/fabric-history?fabricId=${novo.body.id}`,
        token: tokens.modelista,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.samples).toBe(0);
      expect(response.body.medianTotalPieces).toBeNull();
      expect(response.body.suggestedHours).toBeNull();
    });

    /**
     * O DoD: resposta em menos de 300 ms com 5.000 cortes semeados.
     *
     * A semeadura é por SQL direto — passar por 5.000 chamadas HTTP mediria a suíte de testes, não
     * a consulta.
     */
    it('responde em menos de 300 ms com 5.000 cortes semeados', async () => {
      await ctx.runInContext(async () => {
        const connection = ctx.orm.em.getConnection();
        const reservaId = await novaReserva();

        await connection.execute(
          `insert into "cut"
             (account_id, reservation_id, sequence, started_at, ended_at,
              layers, nested_pieces, total_pieces, layout_type, fabric_id, product_type_id,
              created_at, updated_at)
           select ?, ?, g, now() - (g || ' minutes')::interval,
                  now() - (g || ' minutes')::interval + ((40 + (g % 40)) || ' minutes')::interval,
                  10 + (g % 20), 8 + (g % 10),
                  (10 + (g % 20)) * (8 + (g % 10)),
                  case when g % 2 = 0 then 'zigzag' else 'sheet_by_sheet' end,
                  ?, ?, now(), now()
             from generate_series(1000, 6000) as g`,
          [conta.accountId, reservaId, fabricId, productTypeId],
        );
      });

      const total = await ctx.runInContext(async () => {
        const connection = ctx.orm.em.getConnection();
        const rows = (await connection.execute(
          `select count(*)::int as total from "cut" where account_id = ?`,
          [conta.accountId],
        )) as { total: number }[];
        return rows[0].total;
      });
      expect(total).toBeGreaterThanOrEqual(5000);

      // Uma chamada de aquecimento (plano de consulta em cache), depois a medição.
      await ctx.inject({
        method: 'GET',
        url: `/api/fabric-history?fabricId=${fabricId}&pieces=200`,
        token: tokens.modelista,
      });

      const inicio = process.hrtime.bigint();
      const response = await ctx.inject({
        method: 'GET',
        url: `/api/fabric-history?fabricId=${fabricId}&pieces=200`,
        token: tokens.modelista,
      });
      const ms = Number(process.hrtime.bigint() - inicio) / 1_000_000;

      expect(response.statusCode).toBe(200);
      /**
       * Menos de 5.000 porque a consulta recorta o volume comparável (metade a dobro de 200
       * peças) — parte dos cortes semeados fica de fora do recorte de propósito. O que o teste
       * mede é a LATÊNCIA sobre a tabela cheia, e a amostra confirma que a consulta varreu o
       * volume todo.
       */
      expect(response.body.samples).toBeGreaterThan(3000);
      // eslint-disable-next-line no-console
      console.log(`histórico por tecido: ${ms.toFixed(1)} ms com ${total} cortes`);
      expect(ms).toBeLessThan(300);
    });
  });

  describe('isolamento entre contas', () => {
    it('o histórico de uma conta não enxerga os cortes da outra', async () => {
      const outra = await seedAccount(ctx, 'fase5-isolamento');
      const outroToken = (await login(outra.users.modelista.email)).body.accessToken;

      const response = await ctx.inject({
        method: 'GET',
        url: `/api/fabric-history?fabricId=${fabricId}`,
        token: outroToken,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.samples).toBe(0);
    });
  });
});
