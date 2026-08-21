import { createE2EApp, E2EContext } from './e2e-app';
import { seedAccount, SeededAccount, TEST_PASSWORD } from './seed';

/** 2026-09-07 é segunda-feira. Horário de Brasília = UTC-3. */
const seg = (hhmm: string) => `2026-09-07T${hhmm}:00.000-03:00`;

describe('Agenda, reserva e pagamento (e2e)', () => {
  jest.setTimeout(180_000);

  let ctx: E2EContext;
  let conta: SeededAccount;
  const tokens: Record<string, string> = {};
  let customerId: string;
  let fabricId: string;
  let productTypeId: string;
  let machineId: string;
  let machineBarataId: string;

  const login = (email: string) =>
    ctx.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: TEST_PASSWORD },
    });

  async function novoPreOrder(): Promise<string> {
    const response = await ctx.inject({
      method: 'POST',
      url: '/api/pre-orders',
      token: tokens.modelista,
      payload: {
        customerId,
        matrizes: [{ fabricId, productTypeId, estimatedPieces: 160 }],
        estimatedHours: 3,
      },
    });
    return response.body.id;
  }

  const reservar = (payload: Record<string, unknown>, token = tokens.admin) =>
    ctx.inject({ method: 'POST', url: '/api/reservations', token, payload });

  beforeAll(async () => {
    ctx = await createE2EApp();
    conta = await seedAccount(ctx, 'fase4');

    for (const role of ['owner', 'admin', 'modelista'] as const) {
      tokens[role] = (await login(conta.users[role].email)).body.accessToken;
    }

    // Janelas: manhã 07:00–11:30 e tarde 13:00–17:30 na segunda — o exemplo da spec.
    for (const [startsAt, endsAt] of [
      ['07:00', '11:30'],
      ['13:00', '17:30'],
    ]) {
      await ctx.inject({
        method: 'POST',
        url: '/api/account/business-hours',
        token: tokens.owner,
        payload: { weekday: 1, startsAt, endsAt },
      });
    }

    machineId = conta.machineId; // R$ 85,00/h, do seed
    machineBarataId = (
      await ctx.inject({
        method: 'POST',
        url: '/api/machines',
        token: tokens.owner,
        payload: { name: 'Mesa manual', model: null, hourPriceCents: 4000 },
      })
    ).body.id;

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

  describe('regras da hora de máquina', () => {
    it('cria a reserva e ela nasce pré-reservada', async () => {
      const response = await reservar({
        machineId,
        preOrderId: await novoPreOrder(),
        startsAt: seg('07:00'),
        endsAt: seg('10:00'),
      });

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({ status: 'pre_reserved', hours: 3 });
    });

    it('DUAS horas de máquina sobrepostas na mesma máquina = erro', async () => {
      const response = await reservar({
        machineId,
        preOrderId: await novoPreOrder(),
        startsAt: seg('09:00'),
        endsAt: seg('11:00'),
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toMatch(/já existe hora de máquina/i);
    });

    it('a proibição existe NO BANCO, não só na aplicação', async () => {
      // Insere direto, contornando a validação da aplicação: quem recusa é a constraint.
      const conflito = await ctx.runInContext(async () => {
        const connection = ctx.orm.em.getConnection();
        const [{ id: accountId }] = (await connection.execute(
          `select id from account where id = ?`,
          [conta.accountId],
        )) as { id: string }[];

        try {
          await connection.execute(
            `insert into schedule_entry (account_id, machine_id, type, starts_at, ends_at)
             values (?, ?, 'machine_hour', ?, ?)`,
            [accountId, machineId, seg('08:00'), seg('09:00')],
          );
          return null;
        } catch (error) {
          return (error as Error).message;
        }
      });

      expect(conflito).toMatch(/exclusion constraint|schedule_entry_no_machine_overlap/i);
    });

    it('aceita reserva que EMENDA na anterior (10h começa quando a outra termina)', async () => {
      const response = await reservar({
        machineId,
        preOrderId: await novoPreOrder(),
        startsAt: seg('10:00'),
        endsAt: seg('11:00'),
      });
      expect(response.statusCode).toBe(201);
    });

    it('aceita o mesmo horário em OUTRA máquina', async () => {
      const response = await reservar({
        machineId: machineBarataId,
        preOrderId: await novoPreOrder(),
        startsAt: seg('07:00'),
        endsAt: seg('09:00'),
      });
      expect(response.statusCode).toBe(201);
    });

    it('recusa reserva fora da janela de funcionamento', async () => {
      const response = await reservar({
        machineId,
        preOrderId: await novoPreOrder(),
        startsAt: seg('05:00'),
        endsAt: seg('06:00'),
      });
      expect(response.statusCode).toBe(400);
    });

    it('recusa reserva que ATRAVESSA o intervalo (11h→14h com almoço 11h30–13h)', async () => {
      const response = await reservar({
        machineId,
        preOrderId: await novoPreOrder(),
        startsAt: seg('11:00'),
        endsAt: seg('14:00'),
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toMatch(/partida em duas/);
    });

    it('recusa minuto diferente de zero', async () => {
      const response = await reservar({
        machineId,
        preOrderId: await novoPreOrder(),
        startsAt: seg('13:30'),
        endsAt: seg('15:30'),
      });
      expect(response.statusCode).toBe(400);
    });

    it('recusa duração fracionada', async () => {
      const response = await reservar({
        machineId,
        preOrderId: await novoPreOrder(),
        startsAt: seg('13:00'),
        endsAt: seg('14:30'),
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('preço vem da máquina (decisão 2.9)', () => {
    it('máquinas com preços diferentes geram valores diferentes', async () => {
      const cara = await reservar({
        machineId,
        preOrderId: await novoPreOrder(),
        startsAt: seg('14:00'),
        endsAt: seg('16:00'),
      });
      const barata = await reservar({
        machineId: machineBarataId,
        preOrderId: await novoPreOrder(),
        startsAt: seg('14:00'),
        endsAt: seg('16:00'),
      });

      expect(cara.body).toMatchObject({ hourPriceCents: 8500, totalCents: 17000 });
      expect(barata.body).toMatchObject({ hourPriceCents: 4000, totalCents: 8000 });
    });

    it('alterar o preço da máquina NÃO altera reserva existente', async () => {
      const reserva = await reservar({
        machineId: machineBarataId,
        preOrderId: await novoPreOrder(),
        startsAt: seg('16:00'),
        endsAt: seg('17:00'),
      });
      expect(reserva.body.hourPriceCents).toBe(4000);

      await ctx.inject({
        method: 'PUT',
        url: `/api/machines/${machineBarataId}`,
        token: tokens.owner,
        payload: { name: 'Mesa manual', model: null, hourPriceCents: 9900, isActive: true },
      });

      const depois = await ctx.inject({
        method: 'GET',
        url: '/api/reservations',
        token: tokens.admin,
      });
      const mesma = depois.body.find((r: { id: string }) => r.id === reserva.body.id);

      expect(mesma.hourPriceCents).toBe(4000);
      expect(mesma.totalCents).toBe(4000);
    });

    it('o preço NÃO vem do corpo da requisição', async () => {
      const response = await reservar({
        machineId,
        preOrderId: await novoPreOrder(),
        startsAt: seg('16:00'),
        endsAt: seg('17:00'),
        hourPriceCents: 1,
      });
      // forbidNonWhitelisted: o campo a mais derruba a requisição inteira.
      expect(response.statusCode).toBe(400);
    });
  });

  describe('atendimento sobreposto gera aviso, não erro (regra 6.10)', () => {
    it('cria com warnings quando sobrepõe hora de máquina', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/schedule/consultations',
        token: tokens.admin,
        payload: {
          title: 'Primeira conversa — Duas Marias',
          startsAt: seg('08:00'),
          endsAt: seg('08:30'),
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.body.warnings.length).toBeGreaterThan(0);
      expect(response.body.entry.type).toBe('consultation');
    });

    it('sem sobreposição, warnings vem vazio — nunca nulo', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/schedule/consultations',
        token: tokens.admin,
        payload: {
          title: 'Conversa em horário livre',
          startsAt: `2026-09-08T20:00:00.000-03:00`,
          endsAt: `2026-09-08T20:30:00.000-03:00`,
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.body.warnings).toEqual([]);
    });

    it('atendimento aceita 30 minutos fora de hora cheia', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/schedule/consultations',
        token: tokens.admin,
        payload: {
          title: 'Meia hora quebrada',
          startsAt: seg('09:15'),
          endsAt: seg('09:45'),
        },
      });
      expect(response.statusCode).toBe(201);
    });
  });

  describe('a catraca do pagamento (regra 2.4)', () => {
    let reservaId: string;

    beforeAll(async () => {
      reservaId = (
        await reservar({
          machineId,
          preOrderId: await novoPreOrder(),
          startsAt: `2026-09-14T07:00:00.000-03:00`,
          endsAt: `2026-09-14T09:00:00.000-03:00`,
        })
      ).body.id;
    });

    it('a fila do Modelista NUNCA retorna pre_reserved', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/modelista/reservations',
        token: tokens.modelista,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.map((r: { id: string }) => r.id)).not.toContain(reservaId);
      for (const item of response.body) {
        expect(['confirmed', 'in_progress']).toContain(item.status);
      }
    });

    it('registrar o pagamento confirma e a reserva aparece para o Modelista', async () => {
      const pagamento = await ctx.inject({
        method: 'PATCH',
        url: `/api/reservations/${reservaId}/payment`,
        token: tokens.admin,
        payload: { method: 'pix' },
      });

      expect(pagamento.statusCode).toBe(200);
      expect(pagamento.body).toMatchObject({ status: 'confirmed', paymentMethod: 'pix' });
      expect(pagamento.body.paidRegisteredBy.name).toBe('Usuário admin');

      const fila = await ctx.inject({
        method: 'GET',
        url: '/api/modelista/reservations',
        token: tokens.modelista,
      });
      expect(fila.body.map((r: { id: string }) => r.id)).toContain(reservaId);
    });

    it('o DTO do Modelista não tem NENHUM campo monetário', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/modelista/reservations',
        token: tokens.modelista,
      });

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain('hourPriceCents');
      expect(serialized).not.toContain('totalCents');
      expect(serialized).not.toContain('paidAt');
      expect(serialized).not.toContain('paymentMethod');
      expect(serialized).not.toContain('8500');

      for (const item of response.body) {
        expect(Object.keys(item).sort()).toEqual([
          'customer',
          'endsAt',
          'hours',
          'id',
          'machine',
          'preOrderId',
          'startsAt',
          'status',
        ]);
      }
    });

    it('o Modelista não alcança a rota de reservas do Administrativo', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/reservations',
        token: tokens.modelista,
      });
      expect(response.statusCode).toBe(403);
    });

    it('reserva paga não se "libera" — libera é só de pré-reservada', async () => {
      const response = await ctx.inject({
        method: 'PATCH',
        url: `/api/reservations/${reservaId}/release`,
        token: tokens.admin,
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('no-show não decide nada sozinho (regra 6.9)', () => {
    let reservaId: string;

    beforeAll(async () => {
      reservaId = (
        await reservar({
          machineId,
          preOrderId: await novoPreOrder(),
          startsAt: `2026-09-14T09:00:00.000-03:00`,
          endsAt: `2026-09-14T10:00:00.000-03:00`,
        })
      ).body.id;

      await ctx.inject({
        method: 'PATCH',
        url: `/api/reservations/${reservaId}/payment`,
        token: tokens.admin,
        payload: { method: 'cash' },
      });
    });

    it('o Modelista marca "não compareceu" — é ele quem está lá', async () => {
      const response = await ctx.inject({
        method: 'PATCH',
        url: `/api/modelista/reservations/${reservaId}/no-show`,
        token: tokens.modelista,
      });
      expect(response.statusCode).toBe(200);
    });

    it('cria pendência sem resolver nada', async () => {
      const lista = await ctx.inject({
        method: 'GET',
        url: '/api/reservations',
        token: tokens.admin,
      });
      const reserva = lista.body.find((r: { id: string }) => r.id === reservaId);

      expect(reserva.status).toBe('no_show');
      expect(reserva.noShowAt).not.toBeNull();
      // Sem crédito automático nem baixa automática.
      expect(reserva.noShowResolution).toBeNull();
    });

    it('o Modelista NÃO resolve o no-show', async () => {
      const response = await ctx.inject({
        method: 'PATCH',
        url: `/api/reservations/${reservaId}/no-show/resolution`,
        token: tokens.modelista,
        payload: { resolution: 'written_off' },
      });
      expect(response.statusCode).toBe(403);
    });

    it('o Administrativo resolve, e só uma vez', async () => {
      const primeira = await ctx.inject({
        method: 'PATCH',
        url: `/api/reservations/${reservaId}/no-show/resolution`,
        token: tokens.admin,
        payload: { resolution: 'rescheduled' },
      });
      expect(primeira.statusCode).toBe(200);
      expect(primeira.body.noShowResolution).toBe('rescheduled');

      const segunda = await ctx.inject({
        method: 'PATCH',
        url: `/api/reservations/${reservaId}/no-show/resolution`,
        token: tokens.admin,
        payload: { resolution: 'written_off' },
      });
      expect(segunda.statusCode).toBe(400);
    });
  });

  describe('agenda', () => {
    it('devolve os dois tipos na janela pedida', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: `/api/schedule?from=${encodeURIComponent(seg('00:00'))}&to=${encodeURIComponent('2026-09-08T00:00:00.000-03:00')}`,
        token: tokens.admin,
      });

      expect(response.statusCode).toBe(200);
      const tipos = new Set(response.body.map((e: { type: string }) => e.type));
      expect(tipos).toContain('machine_hour');
      expect(tipos).toContain('consultation');
    });

    it('traz a reserva em curso mesmo buscando um recorte no meio dela', async () => {
      // Reserva das 07h às 10h; janela pedida das 08h às 09h.
      const response = await ctx.inject({
        method: 'GET',
        url: `/api/schedule?from=${encodeURIComponent(seg('08:00'))}&to=${encodeURIComponent(seg('09:00'))}`,
        token: tokens.admin,
      });

      const horas = response.body.filter((e: { type: string }) => e.type === 'machine_hour');
      expect(horas.length).toBeGreaterThan(0);
    });

    it('o Modelista LÊ a agenda, e ela não carrega dinheiro', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: `/api/schedule?from=${encodeURIComponent(seg('00:00'))}&to=${encodeURIComponent('2026-09-08T00:00:00.000-03:00')}`,
        token: tokens.modelista,
      });

      expect(response.statusCode).toBe(200);
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain('hourPriceCents');
      expect(serialized).not.toContain('totalCents');
    });
  });

  describe('máquina inativa', () => {
    it('não aceita reserva nova, mas mantém o histórico', async () => {
      await ctx.inject({
        method: 'PUT',
        url: `/api/machines/${machineBarataId}`,
        token: tokens.owner,
        payload: { name: 'Mesa manual', model: null, hourPriceCents: 9900, isActive: false },
      });

      const response = await reservar({
        machineId: machineBarataId,
        preOrderId: await novoPreOrder(),
        startsAt: `2026-09-21T07:00:00.000-03:00`,
        endsAt: `2026-09-21T08:00:00.000-03:00`,
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toMatch(/inativa/);

      const lista = await ctx.inject({
        method: 'GET',
        url: '/api/reservations',
        token: tokens.admin,
      });
      expect(
        lista.body.some((r: { machine: { id: string } }) => r.machine.id === machineBarataId),
      ).toBe(true);
    });
  });

  describe('mover hora de máquina e editar atendimento (§5)', () => {
    let reservaId: string;
    let entryId: string;

    async function entradaDaReserva(id: string): Promise<string> {
      const agenda = await ctx.inject({
        method: 'GET',
        url: `/api/schedule?from=${encodeURIComponent('2026-09-01T00:00:00.000-03:00')}&to=${encodeURIComponent('2026-10-31T00:00:00.000-03:00')}`,
        token: tokens.admin,
      });
      return agenda.body.find((e: { reservationId: string | null }) => e.reservationId === id).id;
    }

    beforeAll(async () => {
      reservaId = (
        await reservar({
          machineId,
          preOrderId: await novoPreOrder(),
          startsAt: `2026-09-28T07:00:00.000-03:00`,
          endsAt: `2026-09-28T09:00:00.000-03:00`,
        })
      ).body.id;
      entryId = await entradaDaReserva(reservaId);
    });

    const mover = (id: string, payload: Record<string, unknown>, token = tokens.admin) =>
      ctx.inject({ method: 'PATCH', url: `/api/schedule/machine-hours/${id}`, token, payload });

    it('move o horário e a reserva acompanha', async () => {
      const response = await mover(entryId, {
        startsAt: `2026-09-28T14:00:00.000-03:00`,
        endsAt: `2026-09-28T17:00:00.000-03:00`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.entry.startsAt).toContain('T17:00');

      // Não paga: as horas mudam de 2 para 3 e o total é recalculado.
      const lista = await ctx.inject({
        method: 'GET',
        url: '/api/reservations',
        token: tokens.admin,
      });
      const reserva = lista.body.find((r: { id: string }) => r.id === reservaId);
      expect(reserva.hours).toBe(3);
      expect(reserva.totalCents).toBe(25_500);
    });

    it('mover revalida a janela — não é porta dos fundos para horário inválido', async () => {
      const response = await mover(entryId, {
        startsAt: `2026-09-28T05:00:00.000-03:00`,
        endsAt: `2026-09-28T06:00:00.000-03:00`,
      });
      expect(response.statusCode).toBe(400);
    });

    it('mover revalida hora cheia', async () => {
      const response = await mover(entryId, {
        startsAt: `2026-09-28T14:30:00.000-03:00`,
        endsAt: `2026-09-28T16:30:00.000-03:00`,
      });
      expect(response.statusCode).toBe(400);
    });

    it('mover para cima de outra hora de máquina é recusado', async () => {
      const vizinha = (
        await reservar({
          machineId,
          preOrderId: await novoPreOrder(),
          startsAt: `2026-09-28T08:00:00.000-03:00`,
          endsAt: `2026-09-28T10:00:00.000-03:00`,
        })
      ).body.id;
      expect(vizinha).toBeDefined();

      const response = await mover(entryId, {
        startsAt: `2026-09-28T08:00:00.000-03:00`,
        endsAt: `2026-09-28T11:00:00.000-03:00`,
      });
      expect(response.statusCode).toBe(400);
      expect(response.body.message).toMatch(/já existe hora de máquina/i);
    });

    it('mover para o MESMO lugar funciona — a entrada não colide consigo mesma', async () => {
      const response = await mover(entryId, {
        startsAt: `2026-09-28T14:00:00.000-03:00`,
        endsAt: `2026-09-28T17:00:00.000-03:00`,
      });
      expect(response.statusCode).toBe(200);
    });

    it('o Modelista não move nada', async () => {
      const response = await mover(
        entryId,
        { startsAt: `2026-09-28T13:00:00.000-03:00`, endsAt: `2026-09-28T16:00:00.000-03:00` },
        tokens.modelista,
      );
      expect(response.statusCode).toBe(403);
    });

    describe('depois de paga', () => {
      it('o horário ainda se move', async () => {
        await ctx.inject({
          method: 'PATCH',
          url: `/api/reservations/${reservaId}/payment`,
          token: tokens.admin,
          payload: { method: 'pix' },
        });

        const response = await mover(entryId, {
          startsAt: `2026-09-28T13:00:00.000-03:00`,
          endsAt: `2026-09-28T16:00:00.000-03:00`,
        });
        expect(response.statusCode).toBe(200);
      });

      it('mas a DURAÇÃO não — mudaria o total de uma venda já cobrada', async () => {
        const response = await mover(entryId, {
          startsAt: `2026-09-28T13:00:00.000-03:00`,
          endsAt: `2026-09-28T17:00:00.000-03:00`,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toMatch(/já está paga/i);
        expect(response.body.message).toMatch(/reserva separada/i);
      });

      it('nem a MÁQUINA', async () => {
        // Máquina NOVA e ativa: a `machineBarataId` foi inativada por um teste anterior deste
        // arquivo, e aí a recusa viria por inatividade — verdadeira, mas outra regra.
        const outraAtiva = (
          await ctx.inject({
            method: 'POST',
            url: '/api/machines',
            token: tokens.owner,
            payload: { name: 'Mesa auxiliar', model: null, hourPriceCents: 7000 },
          })
        ).body.id;

        const response = await mover(entryId, {
          startsAt: `2026-09-28T13:00:00.000-03:00`,
          endsAt: `2026-09-28T16:00:00.000-03:00`,
          machineId: outraAtiva,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toMatch(/trocar de máquina/i);
      });
    });

    describe('editar atendimento', () => {
      let consultaId: string;

      beforeAll(async () => {
        consultaId = (
          await ctx.inject({
            method: 'POST',
            url: '/api/schedule/consultations',
            token: tokens.admin,
            payload: {
              title: 'Conversa inicial',
              startsAt: `2026-09-28T19:00:00.000-03:00`,
              endsAt: `2026-09-28T19:30:00.000-03:00`,
            },
          })
        ).body.entry.id;
      });

      it('muda título e horário, e continua aceitando meia hora quebrada', async () => {
        const response = await ctx.inject({
          method: 'PUT',
          url: `/api/schedule/consultations/${consultaId}`,
          token: tokens.admin,
          payload: {
            title: 'Conversa remarcada',
            startsAt: `2026-09-28T20:15:00.000-03:00`,
            endsAt: `2026-09-28T20:45:00.000-03:00`,
          },
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.entry.title).toBe('Conversa remarcada');
      });

      /**
       * 404 e não 400: para a rota de atendimento, aquele id simplesmente não é um atendimento.
       * Responder 400 sugeriria corpo malformado e mandaria quem depura conferir o payload.
       */
      it('a rota de atendimento NÃO edita hora de máquina', async () => {
        const response = await ctx.inject({
          method: 'PUT',
          url: `/api/schedule/consultations/${entryId}`,
          token: tokens.admin,
          payload: {
            title: 'Tentando virar atendimento',
            startsAt: `2026-09-28T13:00:00.000-03:00`,
            endsAt: `2026-09-28T16:00:00.000-03:00`,
          },
        });
        expect(response.statusCode).toBe(404);
      });

      it('o Modelista não edita atendimento', async () => {
        const response = await ctx.inject({
          method: 'PUT',
          url: `/api/schedule/consultations/${consultaId}`,
          token: tokens.modelista,
          payload: {
            title: 'Não deveria',
            startsAt: `2026-09-28T20:15:00.000-03:00`,
            endsAt: `2026-09-28T20:45:00.000-03:00`,
          },
        });
        expect(response.statusCode).toBe(403);
      });
    });
  });
});
