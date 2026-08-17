import { createE2EApp, E2EContext } from './e2e-app';
import { seedAccount, SeededAccount, TEST_PASSWORD } from './seed';

/** 2026-10-05 é segunda-feira. Horário de Brasília = UTC-3. */
const seg = (hhmm: string, dia = '2026-10-05') => `${dia}T${hhmm}:00.000-03:00`;

interface Categoria {
  id: string;
  name: string;
  direction: 'in' | 'out';
}

interface LinhaDre {
  categoryName: string;
  totalCents: number;
}

interface SaldoConta {
  bankAccountId: string;
  name: string;
  openingBalanceCents: number;
  balanceCents: number;
}

describe('Caixa e mini DRE (e2e)', () => {
  jest.setTimeout(180_000);

  let ctx: E2EContext;
  let conta: SeededAccount;
  const tokens: Record<string, string> = {};
  let customerId: string;
  let fabricId: string;
  let productTypeId: string;
  let categorias: Categoria[];
  let contaPrincipal: string;
  let contaMaquina: string;
  let horaInicial = 7;

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
      payload: { customerId, fabricId, productTypeId, estimatedPieces: 160, estimatedHours: 2 },
    });
    return response.body.id;
  }

  /** Reserva de 2h num horário livre — cada chamada avança na grade da segunda. */
  async function novaReserva(dia = '2026-10-05'): Promise<string> {
    const inicio = horaInicial;
    horaInicial += 2;
    const response = await ctx.inject({
      method: 'POST',
      url: '/api/reservations',
      token: tokens.admin,
      payload: {
        machineId: conta.machineId,
        preOrderId: await novoPreOrder(),
        startsAt: seg(`${String(inicio).padStart(2, '0')}:00`, dia),
        endsAt: seg(`${String(inicio + 2).padStart(2, '0')}:00`, dia),
      },
    });
    return response.body.id;
  }

  const pagar = (reservaId: string, payload: Record<string, unknown> = { method: 'pix' }) =>
    ctx.inject({
      method: 'PATCH',
      url: `/api/reservations/${reservaId}/payment`,
      token: tokens.admin,
      payload,
    });

  /**
   * Janela larga de propósito.
   *
   * A entrada gerada pelo pagamento é datada de **hoje** — regime de caixa (§4.15): vale a data em
   * que o dinheiro entrou, não a da reserva. Filtrar só o mês da reserva não a encontraria.
   */
  const lancamentos = (from = '2026-01-01', to = '2026-12-31') =>
    ctx.inject({
      method: 'GET',
      url: `/api/finance/entries?from=${from}&to=${to}`,
      token: tokens.admin,
    });

  const categoriaDe = (name: string): string => categorias.find((c) => c.name === name)!.id;

  beforeAll(async () => {
    ctx = await createE2EApp();
    conta = await seedAccount(ctx, 'fase6');
    contaPrincipal = conta.bankAccountId;

    for (const role of ['owner', 'admin', 'modelista'] as const) {
      tokens[role] = (await login(conta.users[role].email)).body.accessToken;
    }

    // Janelas largas: aqui o assunto é dinheiro, não grade — 07h às 21h na segunda.
    await ctx.inject({
      method: 'POST',
      url: '/api/account/business-hours',
      token: tokens.owner,
      payload: { weekday: 1, startsAt: '07:00', endsAt: '21:00' },
    });

    categorias = (
      await ctx.inject({
        method: 'POST',
        url: '/api/finance/categories/defaults',
        token: tokens.admin,
      })
    ).body;

    customerId = (
      await ctx.inject({
        method: 'POST',
        url: '/api/customers',
        token: tokens.admin,
        payload: {
          legalName: 'Confecções Rio Verde LTDA',
          tradeName: 'Rio Verde',
          documentType: 'cnpj',
          document: '11222333000181',
          city: 'Ceres',
          state: 'GO',
          repName: 'João Batista Nunes',
          repCpf: '52998224725',
          repPhone: '62998887766',
          repEmail: 'joao@rioverde.com.br',
          whatsapp: '62998887766',
        },
      })
    ).body.id;

    fabricId = (
      await ctx.inject({
        method: 'POST',
        url: '/api/fabrics',
        token: tokens.modelista,
        payload: { name: 'Tricoline', maxLayerHeightCm: 3 },
      })
    ).body.id;

    productTypeId = (
      await ctx.inject({
        method: 'POST',
        url: '/api/product-types',
        token: tokens.modelista,
        payload: { name: 'Camisa' },
      })
    ).body.id;
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  describe('cadastros de apoio', () => {
    it('as sementes da §4.14 nascem completas e a chamada é idempotente', async () => {
      expect(categorias).toHaveLength(8);
      expect(categorias.map((c) => c.name)).toContain('Hora de máquina');
      expect(categorias.filter((c) => c.direction === 'out')).toHaveLength(6);

      const denovo = await ctx.inject({
        method: 'POST',
        url: '/api/finance/categories/defaults',
        token: tokens.admin,
      });
      expect(denovo.body).toHaveLength(8);
    });

    it('não existe campo de encargo em lugar nenhum do schema', async () => {
      // "Isto não é folha de pagamento" (§4.15): salário é saída com categoria e favorecido.
      const colunas = await ctx.runInContext(async () =>
        ctx.orm.em.getConnection().execute(
          `select table_name, column_name from information_schema.columns
             where table_schema = 'public'
               and (column_name ~* 'inss|fgts|holerite|payroll|encargo|rescis|competenc'
                    or table_name ~* 'payroll|folha')`,
        ),
      );
      expect(colunas).toEqual([]);
    });

    it('a segunda conta bancária entra pelo cadastro', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/finance/bank-accounts',
        token: tokens.admin,
        payload: { name: 'Conta da máquina', bank: 'Cooperativa', openingBalanceCents: 100_000 },
      });

      expect(response.statusCode).toBe(201);
      contaMaquina = response.body.id;
    });
  });

  describe('DoD — o pagamento cria exatamente UMA entrada', () => {
    let reservaId: string;

    it('registrar o pagamento gera a entrada de caixa no mesmo ato', async () => {
      reservaId = await novaReserva();
      const pagamento = await pagar(reservaId, { method: 'pix', bankAccountId: contaPrincipal });
      expect(pagamento.statusCode).toBe(200);

      const doCaixa = (await lancamentos()).body.filter(
        (e: { reservationId: string | null }) => e.reservationId === reservaId,
      );

      expect(doCaixa).toHaveLength(1);
      expect(doCaixa[0]).toMatchObject({
        type: 'in',
        amountCents: 17_000, // 2h × R$ 85,00 — o total da reserva, não um valor digitado
        paymentMethod: 'pix',
        occurredOn: new Date().toISOString().slice(0, 10),
      });
      expect(doCaixa[0].category.name).toBe('Hora de máquina');
      expect(doCaixa[0].bankAccount.id).toBe(contaPrincipal);
    });

    it('pagar de novo não cria uma segunda entrada', async () => {
      const segunda = await pagar(reservaId);
      // A reserva já está `confirmed`: a catraca recusa antes mesmo de chegar ao caixa.
      expect(segunda.statusCode).toBe(400);

      const doCaixa = (await lancamentos()).body.filter(
        (e: { reservationId: string | null }) => e.reservationId === reservaId,
      );
      expect(doCaixa).toHaveLength(1);
    });

    it('a NÃO-duplicação existe no banco, não só na aplicação', async () => {
      const conflito = await ctx.runInContext(async () => {
        const connection = ctx.orm.em.getConnection();
        try {
          await connection.execute(
            `insert into cash_entry
               (account_id, type, occurred_on, amount_cents, category_id, bank_account_id,
                description, reservation_id, created_by)
             values (?, 'in', current_date, 17000, ?, ?, 'Entrada duplicada à mão', ?, ?)`,
            [
              conta.accountId,
              categoriaDe('Hora de máquina'),
              contaPrincipal,
              reservaId,
              conta.users.admin.id,
            ],
          );
          return null;
        } catch (error) {
          return (error as Error).message;
        }
      });

      expect(conflito).toMatch(/cash_entry_one_per_reservation|duplicate key/i);
    });

    it('sem conta informada, resolve para a única conta ativa', async () => {
      // A segunda conta existe desde o teste anterior — desative-a e sobra uma só.
      await ctx.inject({
        method: 'PUT',
        url: `/api/finance/bank-accounts/${contaMaquina}`,
        token: tokens.admin,
        payload: {
          name: 'Conta da máquina',
          bank: 'Cooperativa',
          openingBalanceCents: 100_000,
          isActive: false,
        },
      });

      const outra = await novaReserva();
      const pagamento = await pagar(outra, { method: 'cash' });
      expect(pagamento.statusCode).toBe(200);

      const doCaixa = (await lancamentos()).body.find(
        (e: { reservationId: string | null }) => e.reservationId === outra,
      );
      expect(doCaixa.bankAccount.id).toBe(contaPrincipal);

      // Reativa para os testes de transferência e saldo.
      await ctx.inject({
        method: 'PUT',
        url: `/api/finance/bank-accounts/${contaMaquina}`,
        token: tokens.admin,
        payload: {
          name: 'Conta da máquina',
          bank: 'Cooperativa',
          openingBalanceCents: 100_000,
          isActive: true,
        },
      });
    });

    it('com DUAS contas ativas, exige a escolha em vez de adivinhar', async () => {
      const outra = await novaReserva();
      const pagamento = await pagar(outra, { method: 'pix' });

      expect(pagamento.statusCode).toBe(400);
      expect(pagamento.body.message).toMatch(/conta/i);

      // E a reserva NÃO ficou paga: o pagamento e a entrada são um ato só.
      const lista = await ctx.inject({
        method: 'GET',
        url: '/api/reservations',
        token: tokens.admin,
      });
      const reserva = lista.body.find((r: { id: string }) => r.id === outra);
      expect(reserva.status).toBe('pre_reserved');
      expect(reserva.paidAt).toBeNull();
    });
  });

  describe('DoD — remarcação de no-show não cria segunda entrada', () => {
    let originalId: string;
    let novaId: string;

    beforeAll(async () => {
      originalId = await novaReserva();
      await pagar(originalId, { method: 'pix', bankAccountId: contaPrincipal });
      await ctx.inject({
        method: 'PATCH',
        url: `/api/modelista/reservations/${originalId}/no-show`,
        token: tokens.modelista,
      });
    });

    it('a reserva remarcada nasce paga', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: `/api/reservations/${originalId}/no-show/reschedule`,
        token: tokens.admin,
        payload: { startsAt: seg('08:00', '2026-10-12'), endsAt: seg('10:00', '2026-10-12') },
      });

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({ status: 'confirmed', totalCents: 17_000 });
      expect(response.body.paidAt).not.toBeNull();
      novaId = response.body.id;
    });

    it('NÃO existe lançamento de caixa para a reserva remarcada', async () => {
      const todos = (await lancamentos()).body;

      expect(
        todos.filter((e: { reservationId: string | null }) => e.reservationId === novaId),
      ).toHaveLength(0);
      // A entrada original continua uma só e continua válida.
      expect(
        todos.filter((e: { reservationId: string | null }) => e.reservationId === originalId),
      ).toHaveLength(1);
    });

    it('a original fica resolvida como rescheduled', async () => {
      const lista = await ctx.inject({
        method: 'GET',
        url: '/api/reservations',
        token: tokens.admin,
      });
      const original = lista.body.find((r: { id: string }) => r.id === originalId);

      expect(original.status).toBe('no_show');
      expect(original.noShowResolution).toBe('rescheduled');
    });

    it('remarcar com duração diferente é recusado', async () => {
      const outra = await novaReserva();
      await pagar(outra, { method: 'pix', bankAccountId: contaPrincipal });
      await ctx.inject({
        method: 'PATCH',
        url: `/api/modelista/reservations/${outra}/no-show`,
        token: tokens.modelista,
      });

      const response = await ctx.inject({
        method: 'POST',
        url: `/api/reservations/${outra}/no-show/reschedule`,
        token: tokens.admin,
        payload: { startsAt: seg('14:00', '2026-10-12'), endsAt: seg('17:00', '2026-10-12') },
      });

      expect(response.statusCode).toBe(400);
      // A mensagem precisa dizer o que FAZER: sem isso, o Administrativo cancela a reserva paga e
      // fica com o dinheiro sem destino.
      expect(response.body.message).toMatch(/mantém as 2h já pagas/);
      expect(response.body.message).toMatch(/reserva separada para o restante/);
    });
  });

  describe('DoD — transferência move saldo e fica fora do DRE', () => {
    let transferenciaId: string;

    beforeAll(async () => {
      transferenciaId = (
        await ctx.inject({
          method: 'POST',
          url: '/api/finance/entries/transfers',
          token: tokens.admin,
          payload: {
            occurredOn: '2026-10-20',
            amountCents: 40_000,
            fromAccountId: contaPrincipal,
            toAccountId: contaMaquina,
            description: 'Reserva para manutenção da máquina',
          },
        })
      ).body.id;
    });

    it('não aparece nem em entradas nem em saídas do DRE', async () => {
      const dre = await ctx.inject({
        method: 'GET',
        url: '/api/finance/dre?from=2026-10-01&to=2026-10-31',
        token: tokens.admin,
      });

      const nomes = [...dre.body.incomes, ...dre.body.expenses].map(
        (l: LinhaDre) => l.categoryName,
      );
      expect(nomes).not.toContain('Transferência');
      expect(JSON.stringify(dre.body)).not.toContain(transferenciaId);
      expect(JSON.stringify(dre.body)).not.toContain('40000');
    });

    it('move as duas contas, em sinais opostos', async () => {
      const saldos = await ctx.inject({
        method: 'GET',
        url: '/api/finance/balances?until=2026-10-31',
        token: tokens.admin,
      });

      const maquina = saldos.body.accounts.find(
        (a: SaldoConta) => a.bankAccountId === contaMaquina,
      );
      // Saldo inicial 100.000 + 40.000 recebidos.
      expect(maquina.balanceCents).toBe(140_000);
      expect(maquina.openingBalanceCents).toBe(100_000);
    });

    it('a soma dos saldos não muda com a transferência', async () => {
      const antes = (
        await ctx.inject({
          method: 'GET',
          url: '/api/finance/balances?until=2026-10-31',
          token: tokens.admin,
        })
      ).body.totalBalanceCents;

      await ctx.inject({
        method: 'POST',
        url: '/api/finance/entries/transfers',
        token: tokens.admin,
        payload: {
          occurredOn: '2026-10-21',
          amountCents: 25_000,
          fromAccountId: contaMaquina,
          toAccountId: contaPrincipal,
          description: 'Devolução do que sobrou',
        },
      });

      const depois = (
        await ctx.inject({
          method: 'GET',
          url: '/api/finance/balances?until=2026-10-31',
          token: tokens.admin,
        })
      ).body.totalBalanceCents;

      // Dinheiro trocou de bolso: o total é o mesmo.
      expect(depois).toBe(antes);
    });
  });

  describe('DoD — cancelamento sai do saldo e do DRE, mas continua consultável', () => {
    let entradaId: string;

    beforeAll(async () => {
      entradaId = (
        await ctx.inject({
          method: 'POST',
          url: '/api/finance/entries',
          token: tokens.admin,
          payload: {
            type: 'out',
            occurredOn: '2026-10-22',
            amountCents: 30_000,
            categoryId: categoriaDe('Energia'),
            bankAccountId: contaPrincipal,
            description: 'Conta de luz de outubro',
            payee: 'Equatorial Goiás',
            paymentMethod: 'pix',
          },
        })
      ).body.id;
    });

    it('cancelar exige motivo', async () => {
      const semMotivo = await ctx.inject({
        method: 'PATCH',
        url: `/api/finance/entries/${entradaId}/cancel`,
        token: tokens.admin,
        payload: {},
      });
      expect(semMotivo.statusCode).toBe(400);
    });

    it('depois de cancelado, sai do DRE e do saldo', async () => {
      const antes = (
        await ctx.inject({
          method: 'GET',
          url: '/api/finance/dre?from=2026-10-01&to=2026-10-31',
          token: tokens.admin,
        })
      ).body.totalExpenseCents;

      const cancelamento = await ctx.inject({
        method: 'PATCH',
        url: `/api/finance/entries/${entradaId}/cancel`,
        token: tokens.admin,
        payload: { reason: 'Lançado na conta errada' },
      });
      expect(cancelamento.statusCode).toBe(200);

      const depois = (
        await ctx.inject({
          method: 'GET',
          url: '/api/finance/dre?from=2026-10-01&to=2026-10-31',
          token: tokens.admin,
        })
      ).body.totalExpenseCents;

      expect(antes - depois).toBe(30_000);
    });

    it('continua consultável, com motivo e autor', async () => {
      const cancelado = (await lancamentos()).body.find((e: { id: string }) => e.id === entradaId);

      expect(cancelado).toBeDefined();
      expect(cancelado.amountCents).toBe(30_000);
      expect(cancelado.cancelledReason).toBe('Lançado na conta errada');
      expect(cancelado.cancelledBy.name).toBe('Usuário admin');
      expect(cancelado.cancelledAt).not.toBeNull();
    });

    it('não cancela duas vezes', async () => {
      const response = await ctx.inject({
        method: 'PATCH',
        url: `/api/finance/entries/${entradaId}/cancel`,
        token: tokens.admin,
        payload: { reason: 'Tentando de novo' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('DoD — editar valor de lançamento efetivado é impossível', () => {
    it('não existe rota de edição de lançamento', async () => {
      const entrada = (
        await ctx.inject({
          method: 'POST',
          url: '/api/finance/entries',
          token: tokens.admin,
          payload: {
            type: 'out',
            occurredOn: '2026-10-23',
            amountCents: 12_000,
            categoryId: categoriaDe('Insumos'),
            bankAccountId: contaPrincipal,
            description: 'Lâminas',
          },
        })
      ).body;

      for (const method of ['PUT', 'PATCH'] as const) {
        const response = await ctx.inject({
          method,
          url: `/api/finance/entries/${entrada.id}`,
          token: tokens.admin,
          payload: { amountCents: 1 },
        });
        expect(response.statusCode).toBe(404);
      }
    });

    it('a categoria precisa bater com o tipo do lançamento', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/finance/entries',
        token: tokens.admin,
        payload: {
          type: 'in',
          occurredOn: '2026-10-23',
          amountCents: 12_000,
          categoryId: categoriaDe('Insumos'), // categoria de SAÍDA
          bankAccountId: contaPrincipal,
          description: 'Entrada com categoria de saída',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('valor zero ou negativo é recusado', async () => {
      for (const amountCents of [0, -100]) {
        const response = await ctx.inject({
          method: 'POST',
          url: '/api/finance/entries',
          token: tokens.admin,
          payload: {
            type: 'out',
            occurredOn: '2026-10-23',
            amountCents,
            categoryId: categoriaDe('Insumos'),
            bankAccountId: contaPrincipal,
            description: 'Valor inválido',
          },
        });
        expect(response.statusCode).toBe(400);
      }
    });
  });

  describe('DoD — o mês fecha', () => {
    it('entradas − saídas = resultado, e os saldos batem com inicial + movimento', async () => {
      // O período do DRE cobre TODO o movimento até 31/10 — inclusive as entradas de hoje, que o
      // regime de caixa data pela entrada do dinheiro. Só assim as duas contas fecham entre si.
      const dre = (
        await ctx.inject({
          method: 'GET',
          url: '/api/finance/dre?from=2026-01-01&to=2026-10-31',
          token: tokens.admin,
        })
      ).body;

      const somaEntradas = dre.incomes.reduce((s: number, l: LinhaDre) => s + l.totalCents, 0);
      const somaSaidas = dre.expenses.reduce((s: number, l: LinhaDre) => s + l.totalCents, 0);

      expect(dre.totalIncomeCents).toBe(somaEntradas);
      expect(dre.totalExpenseCents).toBe(somaSaidas);
      expect(dre.resultCents).toBe(somaEntradas - somaSaidas);

      const saldos = (
        await ctx.inject({
          method: 'GET',
          url: '/api/finance/balances?until=2026-10-31',
          token: tokens.admin,
        })
      ).body;

      for (const item of saldos.accounts as (SaldoConta & {
        inCents: number;
        outCents: number;
        transferInCents: number;
        transferOutCents: number;
      })[]) {
        expect(item.balanceCents).toBe(
          item.openingBalanceCents +
            item.inCents +
            item.transferInCents -
            item.outCents -
            item.transferOutCents,
        );
      }

      // O total das contas = saldos iniciais + resultado do período. As transferências se anulam.
      const iniciais = saldos.accounts.reduce(
        (s: number, a: SaldoConta) => s + a.openingBalanceCents,
        0,
      );
      expect(saldos.totalBalanceCents).toBe(iniciais + dre.resultCents);
    });

    it('regime de caixa: lançamento de novembro não entra no DRE de outubro', async () => {
      await ctx.inject({
        method: 'POST',
        url: '/api/finance/entries',
        token: tokens.admin,
        payload: {
          type: 'out',
          occurredOn: '2026-11-03',
          amountCents: 99_900,
          categoryId: categoriaDe('Manutenção'),
          bankAccountId: contaPrincipal,
          description: 'Manutenção preventiva de novembro',
        },
      });

      const outubro = (
        await ctx.inject({
          method: 'GET',
          url: '/api/finance/dre?from=2026-10-01&to=2026-10-31',
          token: tokens.admin,
        })
      ).body;
      const novembro = (
        await ctx.inject({
          method: 'GET',
          url: '/api/finance/dre?from=2026-11-01&to=2026-11-30',
          token: tokens.admin,
        })
      ).body;

      expect(JSON.stringify(outubro)).not.toContain('99900');
      expect(novembro.totalExpenseCents).toBe(99_900);
    });
  });

  describe('DoD — o Modelista leva 403 em TODA rota do financeiro', () => {
    const rotas: [string, string, Record<string, unknown> | undefined][] = [
      ['GET', '/api/finance/bank-accounts', undefined],
      ['POST', '/api/finance/bank-accounts', { name: 'Conta pirata' }],
      ['GET', '/api/finance/categories', undefined],
      ['POST', '/api/finance/categories', { name: 'Categoria pirata', direction: 'in' }],
      ['POST', '/api/finance/categories/defaults', undefined],
      ['GET', '/api/finance/entries?from=2026-10-01&to=2026-10-31', undefined],
      ['POST', '/api/finance/entries', { type: 'out', amountCents: 1 }],
      ['POST', '/api/finance/entries/transfers', { amountCents: 1 }],
      ['GET', '/api/finance/dre?from=2026-10-01&to=2026-10-31', undefined],
      ['GET', '/api/finance/balances', undefined],
    ];

    it.each(rotas)('%s %s → 403', async (method, url, payload) => {
      const response = await ctx.inject({
        method: method as 'GET' | 'POST',
        url,
        token: tokens.modelista,
        payload,
      });

      // 403 e não 400: o guard barra ANTES da validação do corpo — nem chega ao use case.
      expect(response.statusCode).toBe(403);
    });

    it('nenhum valor em dinheiro vaza pelas rotas que ele alcança', async () => {
      const fila = await ctx.inject({
        method: 'GET',
        url: '/api/modelista/reservations',
        token: tokens.modelista,
      });

      const serialized = JSON.stringify(fila.body);
      expect(serialized).not.toContain('amountCents');
      expect(serialized).not.toContain('totalCents');
      expect(serialized).not.toContain('17000');
    });
  });
});
