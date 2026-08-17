import { Logger } from '@nestjs/common';
import { createE2EApp, E2EContext } from './e2e-app';
import { seedAccount, SeededAccount, TEST_PASSWORD } from './seed';

const CNPJ = '11222333000181';
const CNPJ_MASCARADO = '11.222.333/0001-81';
const CPF_REP = '52998224725';
const CPF_REP_MASCARADO = '529.982.247-25';
const RUA = 'Rua das Malhas';

function customerPayload(overrides: Record<string, unknown> = {}) {
  return {
    legalName: 'Malharia São Bento LTDA',
    tradeName: 'Malharia São Bento',
    documentType: 'cnpj',
    document: CNPJ_MASCARADO,
    stateRegistration: '10.123.456-7',
    companySize: 'me',
    employeesCount: 12,
    zipCode: '76300-000',
    street: RUA,
    number: '145',
    district: 'Centro',
    city: 'Ceres',
    state: 'GO',
    repName: 'Maria Aparecida Souza',
    repRole: 'owner',
    repCpf: CPF_REP_MASCARADO,
    repPhone: '62998887766',
    repEmail: 'maria@saobento.com.br',
    whatsapp: '(62) 9 9888-7766',
    email: 'contato@saobento.com.br',
    isMember: true,
    memberSince: '2024-03-01',
    notes: 'Costuma cortar malha em enfesto alto.',
    ...overrides,
  };
}

describe('Cadastros — cliente, tecido e tipo de produto (e2e)', () => {
  jest.setTimeout(180_000);

  let ctx: E2EContext;
  let conta: SeededAccount;
  const tokens: Record<string, string> = {};

  const login = (email: string) =>
    ctx.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: TEST_PASSWORD },
    });

  beforeAll(async () => {
    ctx = await createE2EApp();
    conta = await seedAccount(ctx, 'cadastros');

    for (const role of ['owner', 'admin', 'modelista'] as const) {
      tokens[role] = (await login(conta.users[role].email)).body.accessToken;
    }
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  describe('permissões (regra 6.2 — o Modelista nunca cadastra cliente)', () => {
    it('modelista recebe 403 ao criar cliente', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/customers',
        token: tokens.modelista,
        payload: customerPayload({ document: CNPJ_MASCARADO }),
      });
      expect(response.statusCode).toBe(403);
    });

    it('modelista recebe 403 ao listar clientes pela rota do Administrativo', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/customers',
        token: tokens.modelista,
      });
      expect(response.statusCode).toBe(403);
    });

    it('modelista CADASTRA tecido e tipo de produto — os três papéis podem (§5)', async () => {
      const tecido = await ctx.inject({
        method: 'POST',
        url: '/api/fabrics',
        token: tokens.modelista,
        payload: { name: 'Malha', maxLayerHeightCm: 2.5, notes: 'Cola se passar de 2,5 cm' },
      });
      expect(tecido.statusCode).toBe(201);
      expect(tecido.body).toMatchObject({ name: 'Malha', maxLayerHeightCm: 2.5 });

      const produto = await ctx.inject({
        method: 'POST',
        url: '/api/product-types',
        token: tokens.modelista,
        payload: { name: 'Camiseta' },
      });
      expect(produto.statusCode).toBe(201);
    });
  });

  describe('cadastro de cliente', () => {
    let criadoId: string;

    it('exige os campos obrigatórios do DoD', async () => {
      const obrigatorios = [
        'legalName',
        'tradeName',
        'document',
        'city',
        'state',
        'repName',
        'repCpf',
        'repPhone',
        'repEmail',
        'whatsapp',
      ];

      for (const campo of obrigatorios) {
        const payload = customerPayload();
        delete (payload as Record<string, unknown>)[campo];

        const response = await ctx.inject({
          method: 'POST',
          url: '/api/customers',
          token: tokens.admin,
          payload,
        });
        expect([campo, response.statusCode]).toEqual([campo, 400]);
      }
    });

    it('cria com documento mascarado e guarda só dígitos', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/customers',
        token: tokens.admin,
        payload: customerPayload(),
      });

      expect(response.statusCode).toBe(201);
      expect(response.body.document).toBe(CNPJ);
      expect(response.body.documentFormatted).toBe(CNPJ_MASCARADO);
      expect(response.body.representative.cpf).toBe(CPF_REP);
      expect(response.body.contact.whatsapp).toBe('+5562998887766');
      criadoId = response.body.id;
    });

    it('recusa CNPJ com dígito verificador errado', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/customers',
        token: tokens.admin,
        payload: customerPayload({ document: '11222333000182' }),
      });
      expect(response.statusCode).toBe(400);
    });

    it('recusa CPF de representante inválido', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/customers',
        token: tokens.admin,
        payload: customerPayload({ document: '11444777000161', repCpf: '111.111.111-11' }),
      });
      expect(response.statusCode).toBe(400);
    });

    it('recusa documento repetido na MESMA conta, com erro tratado', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/customers',
        token: tokens.admin,
        // Mesmo CNPJ, agora sem máscara: se a coluna guardasse a máscara, este passaria.
        payload: customerPayload({ document: CNPJ, tradeName: 'Outra Malharia' }),
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Já existe um cliente com este documento nesta conta.');
      // A mensagem não repete o documento.
      expect(response.body.message).not.toContain(CNPJ);
    });

    it('aceita o MESMO documento em OUTRA conta — unicidade é por conta', async () => {
      const outra = await seedAccount(ctx, 'outra-conta');
      const outroToken = (await login(outra.users.admin.email)).body.accessToken;

      const response = await ctx.inject({
        method: 'POST',
        url: '/api/customers',
        token: outroToken,
        payload: customerPayload(),
      });

      expect(response.statusCode).toBe(201);
    });

    it('aceita cliente pessoa física — a costureira autônoma sem CNPJ', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/customers',
        token: tokens.admin,
        payload: customerPayload({
          documentType: 'cpf',
          document: CPF_REP_MASCARADO,
          tradeName: 'Costura da Ana',
          legalName: 'Ana Paula Ribeiro',
        }),
      });

      expect(response.statusCode).toBe(201);
      expect(response.body.documentType).toBe('cpf');
    });

    it('recusa UF inexistente', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/customers',
        token: tokens.admin,
        payload: customerPayload({ document: '11444777000161', state: 'XX' }),
      });
      expect(response.statusCode).toBe(400);
    });

    it('edita e inativa sem apagar', async () => {
      const edicao = await ctx.inject({
        method: 'PUT',
        url: `/api/customers/${criadoId}`,
        token: tokens.admin,
        payload: customerPayload({ tradeName: 'Malharia São Bento Matriz' }),
      });
      expect(edicao.statusCode).toBe(200);
      expect(edicao.body.tradeName).toBe('Malharia São Bento Matriz');

      const inativacao = await ctx.inject({
        method: 'PATCH',
        url: `/api/customers/${criadoId}/status`,
        token: tokens.admin,
        payload: { active: false },
      });
      expect(inativacao.statusCode).toBe(200);
      expect(inativacao.body.status).toBe('inactive');
    });
  });

  describe('o que cada papel enxerga', () => {
    it('a LISTAGEM do Administrativo não traz documento nem CPF nem endereço', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/customers',
        token: tokens.admin,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(CPF_REP);
      expect(serialized).not.toContain(CNPJ);
      expect(serialized).not.toContain(RUA);

      for (const item of response.body) {
        expect(Object.keys(item)).not.toContain('document');
        expect(Object.keys(item)).not.toContain('representative');
        expect(Object.keys(item)).not.toContain('address');
      }
    });

    it('o DETALHE traz o CPF do representante — e é o único lugar', async () => {
      const lista = await ctx.inject({ method: 'GET', url: '/api/customers', token: tokens.admin });
      const detalhe = await ctx.inject({
        method: 'GET',
        url: `/api/customers/${lista.body[0].id}`,
        token: tokens.admin,
      });

      expect(detalhe.statusCode).toBe(200);
      expect(detalhe.body.representative.cpf).toMatch(/^\d{11}$/);
    });

    it('a lista do MODELISTA tem exatamente quatro campos e o id', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/modelista/customers',
        token: tokens.modelista,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);

      for (const item of response.body) {
        expect(Object.keys(item).sort()).toEqual(['city', 'id', 'notes', 'tradeName', 'whatsapp']);
      }

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(CPF_REP);
      expect(serialized).not.toContain(CNPJ);
      expect(serialized).not.toContain(RUA);
      expect(serialized).not.toContain('Maria Aparecida Souza');
    });

    it('a lista do Modelista só traz clientes ativos', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/modelista/customers',
        token: tokens.modelista,
      });

      const nomes = response.body.map((c: { tradeName: string }) => c.tradeName);
      expect(nomes).not.toContain('Malharia São Bento Matriz');
    });

    it('admin recebe 403 na rota do Modelista — ela é dele, não uma segunda listagem', async () => {
      const response = await ctx.inject({
        method: 'GET',
        url: '/api/modelista/customers',
        token: tokens.admin,
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('nenhum log contém CPF, CNPJ ou endereço — inclusive em erro', () => {
    it('espiona o Logger durante um ciclo completo de sucesso e de falha', async () => {
      const capturado: string[] = [];
      const capture = (...args: unknown[]) => {
        capturado.push(args.map((arg) => JSON.stringify(arg) ?? String(arg)).join(' '));
        return undefined;
      };

      const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
        jest.spyOn(Logger.prototype, level).mockImplementation(capture),
      );

      try {
        // Sucesso.
        await ctx.inject({
          method: 'POST',
          url: '/api/customers',
          token: tokens.admin,
          payload: customerPayload({ document: '11444777000161', tradeName: 'Log Teste' }),
        });
        // Documento duplicado (400 de negócio).
        await ctx.inject({
          method: 'POST',
          url: '/api/customers',
          token: tokens.admin,
          payload: customerPayload({ document: '11444777000161' }),
        });
        // Documento inválido (400 de domínio).
        await ctx.inject({
          method: 'POST',
          url: '/api/customers',
          token: tokens.admin,
          payload: customerPayload({ document: '11222333000199' }),
        });
        // Leituras.
        await ctx.inject({ method: 'GET', url: '/api/customers', token: tokens.admin });
      } finally {
        spies.forEach((spy) => spy.mockRestore());
      }

      const tudo = capturado.join('\n');
      expect(tudo).not.toContain(CPF_REP);
      expect(tudo).not.toContain(CPF_REP_MASCARADO);
      expect(tudo).not.toContain(CNPJ);
      expect(tudo).not.toContain('11444777000161');
      expect(tudo).not.toContain(RUA);
      expect(tudo).not.toContain('76300000');
    });
  });

  describe('tecido', () => {
    it('exige a altura máxima de enfesto', async () => {
      const semAltura = await ctx.inject({
        method: 'POST',
        url: '/api/fabrics',
        token: tokens.admin,
        payload: { name: 'TNT' },
      });
      expect(semAltura.statusCode).toBe(400);

      const zero = await ctx.inject({
        method: 'POST',
        url: '/api/fabrics',
        token: tokens.admin,
        payload: { name: 'TNT', maxLayerHeightCm: 0 },
      });
      expect(zero.statusCode).toBe(400);
    });

    it('guarda as duas casas decimais exatas', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/fabrics',
        token: tokens.admin,
        payload: { name: 'Tricoline', maxLayerHeightCm: 4.75 },
      });

      expect(response.statusCode).toBe(201);
      expect(response.body.maxLayerHeightCm).toBe(4.75);

      const lista = await ctx.inject({ method: 'GET', url: '/api/fabrics', token: tokens.admin });
      const tricoline = lista.body.find((f: { name: string }) => f.name === 'Tricoline');
      expect(tricoline.maxLayerHeightCm).toBe(4.75);
    });

    it('recusa nome repetido na mesma conta', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/fabrics',
        token: tokens.admin,
        payload: { name: 'Malha', maxLayerHeightCm: 3 },
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Já existe um tecido com este nome.');
    });

    it('edita mantendo o próprio nome, sem colidir consigo mesmo', async () => {
      const lista = await ctx.inject({ method: 'GET', url: '/api/fabrics', token: tokens.admin });
      const malha = lista.body.find((f: { name: string }) => f.name === 'Malha');

      const response = await ctx.inject({
        method: 'PUT',
        url: `/api/fabrics/${malha.id}`,
        token: tokens.admin,
        payload: { name: 'Malha', maxLayerHeightCm: 3.2, notes: 'Ajustado na prática' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.maxLayerHeightCm).toBe(3.2);
    });

    describe('espessura da camada — a medida que faltava', () => {
      it('o tecido nasce SEM espessura, e é assim que deve ser', async () => {
        const response = await ctx.inject({
          method: 'POST',
          url: '/api/fabrics',
          token: tokens.admin,
          payload: { name: 'Moletom', maxLayerHeightCm: 6 },
        });

        expect(response.statusCode).toBe(201);
        expect(response.body.layerThicknessCm).toBeNull();
        // Sem espessura não há teto de camadas calculável — e a API diz isso com `null`, em vez
        // de devolver um número que ninguém poderia justificar.
        expect(response.body.maxLayers).toBeNull();
      });

      it('com espessura, o teto de camadas sai da divisão das duas medidas', async () => {
        const response = await ctx.inject({
          method: 'POST',
          url: '/api/fabrics',
          token: tokens.admin,
          payload: { name: 'Viscose', maxLayerHeightCm: 2.5, layerThicknessCm: 0.05 },
        });

        expect(response.statusCode).toBe(201);
        expect(response.body.layerThicknessCm).toBe(0.05);
        expect(response.body.maxLayers).toBe(50); // 2,50 ÷ 0,05
      });

      it('guarda as três casas — tecido fino se mede em milímetros', async () => {
        const response = await ctx.inject({
          method: 'POST',
          url: '/api/fabrics',
          token: tokens.admin,
          payload: { name: 'Seda', maxLayerHeightCm: 1.5, layerThicknessCm: 0.015 },
        });

        expect(response.statusCode).toBe(201);
        expect(response.body.layerThicknessCm).toBe(0.015);
        expect(response.body.maxLayers).toBe(100);
      });

      it('espessura zero ou negativa é recusada — nulo é o jeito de dizer "não medi"', async () => {
        for (const layerThicknessCm of [0, -0.05]) {
          const response = await ctx.inject({
            method: 'POST',
            url: '/api/fabrics',
            token: tokens.admin,
            payload: {
              name: `Inválido ${layerThicknessCm}`,
              maxLayerHeightCm: 3,
              layerThicknessCm,
            },
          });
          expect(response.statusCode).toBe(400);
        }
      });

      it('editar preenche a espessura de um tecido que não tinha', async () => {
        const lista = await ctx.inject({ method: 'GET', url: '/api/fabrics', token: tokens.admin });
        const moletom = lista.body.find((f: { name: string }) => f.name === 'Moletom');
        expect(moletom.layerThicknessCm).toBeNull();

        const response = await ctx.inject({
          method: 'PUT',
          url: `/api/fabrics/${moletom.id}`,
          token: tokens.admin,
          payload: { name: 'Moletom', maxLayerHeightCm: 6, layerThicknessCm: 0.3 },
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.layerThicknessCm).toBe(0.3);
        expect(response.body.maxLayers).toBe(20);
      });

      it('a restrição de positividade existe NO BANCO, não só na aplicação', async () => {
        const conflito = await ctx.runInContext(async () => {
          try {
            await ctx.orm.em
              .getConnection()
              .execute(`update "fabric" set layer_thickness_cm = 0 where account_id = ?`, [
                conta.accountId,
              ]);
            return null;
          } catch (error) {
            return (error as Error).message;
          }
        });

        expect(conflito).toMatch(/fabric_layer_thickness_positive_check|check constraint/i);
      });
    });
  });

  describe('tipo de produto', () => {
    it('recusa nome repetido', async () => {
      const response = await ctx.inject({
        method: 'POST',
        url: '/api/product-types',
        token: tokens.admin,
        payload: { name: 'Camiseta' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Já existe um tipo de produto com este nome.');
    });

    it('lista em ordem alfabética', async () => {
      await ctx.inject({
        method: 'POST',
        url: '/api/product-types',
        token: tokens.admin,
        payload: { name: 'Avental cirúrgico' },
      });

      const response = await ctx.inject({
        method: 'GET',
        url: '/api/product-types',
        token: tokens.admin,
      });

      const nomes = response.body.map((p: { name: string }) => p.name);
      expect(nomes[0]).toBe('Avental cirúrgico');
    });
  });

  describe('isolamento entre contas', () => {
    it('tecido de uma conta não aparece na outra', async () => {
      const outra = await seedAccount(ctx, 'isolamento-catalogo');
      const outroToken = (await login(outra.users.admin.email)).body.accessToken;

      const response = await ctx.inject({
        method: 'GET',
        url: '/api/fabrics',
        token: outroToken,
      });

      expect(response.body).toHaveLength(0);
    });
  });
});
