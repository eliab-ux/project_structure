import { createE2EApp, E2EContext } from './e2e-app';
import { seedAccount, SeededAccount, TEST_PASSWORD } from './seed';

describe('Pré-pedido e fila de espera (e2e)', () => {
  jest.setTimeout(180_000);

  let ctx: E2EContext;
  let conta: SeededAccount;
  const tokens: Record<string, string> = {};
  let customerId: string;
  let fabricId: string;
  let productTypeId: string;

  const login = (email: string) =>
    ctx.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: TEST_PASSWORD },
    });

  function matriz(overrides: Record<string, unknown> = {}) {
    return {
      fabricId,
      productTypeId,
      estimatedPieces: 160,
      metersPerPiece: 1.35,
      rolls: 3,
      estimatedLayers: 20,
      estimatedLayoutType: 'zigzag',
      ...overrides,
    };
  }

  function preOrderPayload(overrides: Record<string, unknown> = {}) {
    return {
      customerId,
      matrizes: [matriz()],
      estimatedHours: 3,
      notes: 'Cliente quer cortar na quinta.',
      ...overrides,
    };
  }

  beforeAll(async () => {
    ctx = await createE2EApp();
    conta = await seedAccount(ctx, 'fase3');

    for (const role of ['owner', 'admin', 'modelista'] as const) {
      tokens[role] = (await login(conta.users[role].email)).body.accessToken;
    }

    const cliente = await ctx.inject({
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
    });
    customerId = cliente.body.id;

    fabricId = (
      await ctx.inject({
        method: 'POST',
        url: '/api/fabrics',
        token: tokens.modelista,
        payload: { name: 'Malha', maxLayerHeightCm: 2.5 },
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

  describe('o pré-pedido nasce com o Modelista (regra 6.1)', () => {
    let preOrderId: string;

    it('o Modelista cria com as horas que ele definiu', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/pre-orders',
        token: tokens.modelista,
        payload: preOrderPayload(),
      });

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({ status: 'open', estimatedHours: 3 });
      // Os nomes vêm resolvidos: o app do Modelista não faz uma consulta por linha.
      expect(response.body.customer.name).toBe('Malharia São Bento');
      expect(response.body.matrizes).toHaveLength(1);
      expect(response.body.matrizes[0].fabric).toMatchObject({
        name: 'Malha',
        maxLayerHeightCm: 2.5,
      });
      expect(response.body.matrizes[0].sequence).toBe(1);
      expect(response.body.createdBy.name).toBe('Usuário modelista');
      preOrderId = response.body.id;
    });

    /**
     * A regra 6.1 deixou de ser absoluta: ela protege a PRIMEIRA estimativa de um tecido, não
     * todas. Sem corte concluído, o Administrativo continua barrado — e a recusa vem do domínio,
     * com mensagem, não de um guard de papel.
     */
    it('o Administrativo NÃO cria pedido de tecido sem histórico', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/pre-orders',
        token: tokens.admin,
        payload: preOrderPayload(),
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toMatch(/primeira estimativa é do Modelista/i);
      expect(response.body.message).toMatch(/segundo corte/i);
    });

    it('o Administrativo recebe o pré-pedido com as horas prontas', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/pre-orders',
        token: tokens.admin,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body[0]).toMatchObject({ id: preOrderId, estimatedHours: 3 });
    });

    it('o Administrativo NÃO consegue editar estimated_hours (403)', async () => {
      const response = await ctx.inject({
        method: 'PUT',
        url: `/api/pre-orders/${preOrderId}`,
        token: tokens.admin,
        payload: preOrderPayload({ estimatedHours: 6 }),
      });

      expect(response.statusCode).toBe(403);

      // E o número no banco continua o do Modelista.
      const depois = await ctx.inject({
        method: 'GET',
        url: '/api/pre-orders',
        token: tokens.admin,
      });
      expect(depois.body[0].estimatedHours).toBe(3);
    });

    it('nem o DONO altera as horas — a regra é do papel, não da hierarquia', async () => {
      const response = await ctx.inject({
        method: 'PUT',
        url: `/api/pre-orders/${preOrderId}`,
        token: tokens.owner,
        payload: preOrderPayload({ estimatedHours: 6 }),
      });

      expect(response.statusCode).toBe(403);
      expect(response.body.message).toMatch(/Somente o Modelista/);
    });

    it('o dono edita o resto sem tocar nas horas', async () => {
      const response = await ctx.inject({
        method: 'PUT',
        url: `/api/pre-orders/${preOrderId}`,
        token: tokens.owner,
        payload: preOrderPayload({ matrizes: [matriz({ estimatedPieces: 200 })] }),
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.matrizes[0].estimatedPieces).toBe(200);
    });

    it('o Modelista altera as horas', async () => {
      const response = await ctx.inject({
        method: 'PUT',
        url: `/api/pre-orders/${preOrderId}`,
        token: tokens.modelista,
        payload: preOrderPayload({ estimatedHours: 4 }),
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.estimatedHours).toBe(4);
    });

    it('o Modelista vê os pré-pedidos que ele avaliou', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/pre-orders/mine',
        token: tokens.modelista,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.map((p: { id: string }) => p.id)).toContain(preOrderId);
    });

    it('recusa tecido que não é FK — tecido não é texto livre (§4.5)', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/pre-orders',
        token: tokens.modelista,
        payload: preOrderPayload({ matrizes: [matriz({ fabricId: 'Malha' })] }),
      });
      expect(response.statusCode).toBe(400);
    });

    it('recusa horas fracionadas ou zero — a venda é em hora cheia', async () => {
      for (const estimatedHours of [0, 2.5, -1]) {
        const response = await ctx.inject({
          method: 'POST',
          url: '/api/pre-orders',
          token: tokens.modelista,
          payload: preOrderPayload({ estimatedHours }),
        });
        expect([estimatedHours, response.statusCode]).toEqual([estimatedHours, 400]);
      }
    });

    it('descartado sai da lista de abertos', async () => {
      const descarte = await ctx.inject({
        method: 'PATCH',
        url: `/api/pre-orders/${preOrderId}/discard`,
        token: tokens.modelista,
      });
      expect(descarte.statusCode).toBe(200);

      const abertos = await ctx.inject({
        method: 'GET',
        url: '/api/pre-orders',
        token: tokens.admin,
      });
      expect(abertos.body.map((p: { id: string }) => p.id)).not.toContain(preOrderId);

      const todos = await ctx.inject({
        method: 'GET',
        url: '/api/pre-orders/all',
        token: tokens.admin,
      });
      expect(todos.body.map((p: { id: string }) => p.id)).toContain(preOrderId);
    });
  });

  describe('fila de espera — Administrativo escreve, Modelista lê (§4.12)', () => {
    let entryId: string;

    it('o Administrativo cria a entrada', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/waiting-list',
        token: tokens.admin,
        payload: {
          customerId,
          fabricId,
          hoursNeeded: 3,
          technicalNotes: 'Malha, enfesto alto',
          wantsEarlier: true,
          desiredUntil: '2026-09-30',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({
        status: 'waiting',
        wantsEarlier: true,
        desiredUntil: '2026-09-30',
      });
      expect(response.body.customer.name).toBe('Malharia São Bento');
      entryId = response.body.id;
    });

    it('o Modelista LÊ a fila', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/waiting-list',
        token: tokens.modelista,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.map((e: { id: string }) => e.id)).toContain(entryId);
      // `wantsEarlier` chega para a tela poder destacá-lo (DoD da Fase 3).
      expect(response.body[0]).toHaveProperty('wantsEarlier');
    });

    it('quem quer antecipar vem primeiro na lista', async () => {
      await ctx.inject({
        method: 'POST',
        url: '/api/waiting-list',
        token: tokens.admin,
        payload: { customerId, hoursNeeded: 2, wantsEarlier: false },
      });

      const response = await ctx.inject({
        method: 'GET',
        url: '/api/waiting-list',
        token: tokens.modelista,
      });

      expect(response.body[0].wantsEarlier).toBe(true);
    });

    it.each([
      ['POST', '/api/waiting-list', { customerId, hoursNeeded: 2 }],
      ['PUT', '/api/waiting-list/:id', { customerId, hoursNeeded: 2 }],
      ['PATCH', '/api/waiting-list/:id/offer', undefined],
      ['PATCH', '/api/waiting-list/:id/accept', undefined],
      ['PATCH', '/api/waiting-list/:id/drop', undefined],
    ])('o Modelista recebe 403 em %s %s', async (method, url, payload) => {
      const response = await ctx.inject({
        method: method as 'POST',
        url: url.replace(':id', entryId),
        token: tokens.modelista,
        payload,
      });
      expect(response.statusCode).toBe(403);
    });

    it('oferecer a vaga não cria reserva — pagamento é catraca (6.3)', async () => {
      const oferta = await ctx.inject({
        method: 'PATCH',
        url: `/api/waiting-list/${entryId}/offer`,
        token: tokens.admin,
      });

      expect(oferta.statusCode).toBe(200);
      expect(oferta.body.status).toBe('offered');
      expect(oferta.body.offeredAt).not.toBeNull();
    });

    it('"cliente aceitou e está vindo" registra o aceite e para aí', async () => {
      const aceite = await ctx.inject({
        method: 'PATCH',
        url: `/api/waiting-list/${entryId}/accept`,
        token: tokens.admin,
      });

      expect(aceite.statusCode).toBe(200);
      expect(aceite.body.customerAcceptedAt).not.toBeNull();
      // Continua 'offered': a reserva nasce no pagamento, na Fase 4.
      expect(aceite.body.status).toBe('offered');
    });

    it('recusa aceite de entrada que não recebeu oferta', async () => {
      const nova = await ctx.inject({
        method: 'POST',
        url: '/api/waiting-list',
        token: tokens.admin,
        payload: { customerId, hoursNeeded: 2 },
      });

      const response = await ctx.inject({
        method: 'PATCH',
        url: `/api/waiting-list/${nova.body.id}/accept`,
        token: tokens.admin,
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('o aviso de vaga — aviso, não agendamento (regra 6.3)', () => {
    let noticeId: string;

    it('o Modelista avisa o Administrativo', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/slot-notices',
        token: tokens.modelista,
        payload: { note: 'Vagou das 14h às 17h na máquina 01.' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({ status: 'open' });
      expect(response.body.createdBy.name).toBe('Usuário modelista');
      noticeId = response.body.id;
    });

    it('o aviso NÃO carrega máquina, horário nem cliente', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/slot-notices',
        token: tokens.admin,
      });

      const campos = Object.keys(response.body[0]);
      expect(campos).not.toContain('machineId');
      expect(campos).not.toContain('customerId');
      expect(campos).not.toContain('startsAt');
    });

    it('o Modelista NÃO lê a lista de avisos — ela é a pendência do Administrativo', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/slot-notices',
        token: tokens.modelista,
      });
      expect(response.statusCode).toBe(403);
    });

    it('o Administrativo resolve e a trilha guarda quem resolveu', async () => {
      const response = await ctx.inject({
        method: 'PATCH',
        url: `/api/slot-notices/${noticeId}/handled`,
        token: tokens.admin,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe('handled');
      expect(response.body.handledBy.name).toBe('Usuário admin');
      expect(response.body.handledAt).not.toBeNull();
    });

    it('o Administrativo NÃO cria aviso — quem enxerga a vaga é quem está na máquina', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/slot-notices',
        token: tokens.admin,
        payload: { note: 'Vagou alguma coisa' },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('isolamento entre contas', () => {
    it('pré-pedido de uma conta não aparece na outra', async () => {
      const outra = await seedAccount(ctx, 'fase3-isolamento');
      const outroToken = (await login(outra.users.admin.email)).body.accessToken;

      const response = await ctx.inject({
        method: 'GET',
        url: '/api/pre-orders/all',
        token: outroToken,
      });

      expect(response.body).toHaveLength(0);
    });
  });
});
