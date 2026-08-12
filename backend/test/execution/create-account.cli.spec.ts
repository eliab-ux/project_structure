import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { expectCliSuccess, runCli } from '../helpers/run-cli';
import { connectAsOwner, countAccounts, deleteAccountsByDocument } from '../helpers/db';
import { cnpjWithCheckDigits } from '../helpers/document';

/**
 * `create:account` — o comando de onboarding, executado de verdade.
 *
 * Este arquivo existe por um motivo específico e vale registrá-lo: o onboarding NÃO FUNCIONAVA, e
 * nada acusava. Typecheck passava, lint passava, a suíte passava — porque nada nunca tinha rodado o
 * comando. Ele morria em "Using global EntityManager instance methods for context specific actions
 * is disallowed", um erro que só existe quando o `AppModule` sobe fora de uma requisição HTTP.
 *
 * Cada `it` abaixo é a regressão de um defeito real encontrado na primeira execução. Não são casos
 * hipotéticos.
 */

const DOCUMENT = cnpjWithCheckDigits('900000010001');
const ADMIN_EMAIL = 'exec-create@teste.veertex.local';

/** Argumentos comuns. A senha NÃO está aqui — vai por ambiente, que é o ponto do defeito 2. */
const BASE_ARGS = [
  '--account-name',
  'Conta de Execução',
  '--account-document',
  DOCUMENT,
  '--plan',
  'COMPLETO',
  '--company-legal-name',
  'Conta de Execução Ltda',
  '--company-document',
  DOCUMENT,
  '--tax-regime',
  'SIMPLES',
  '--state-registration-exempt',
  '--street',
  'Rua de Teste',
  '--number',
  '100',
  '--district',
  'Centro',
  '--city',
  'Goiania',
  '--state',
  'GO',
  '--zip',
  '74000000',
  '--admin-name',
  'Admin de Execução',
  '--admin-email',
  ADMIN_EMAIL,
  '--admin-phone',
  '62999990009',
];

describe('create:account — execução real do ponto de entrada', () => {
  let owner: Client;
  // Senha aleatória por rodada: se o comando algum dia voltar a ecoar a senha, a asserção pega o
  // valor DESTA execução, não uma constante que alguém poderia ter posto na allowlist do grep.
  const password = randomBytes(15).toString('base64url');

  beforeAll(async () => {
    owner = await connectAsOwner();
    await deleteAccountsByDocument(owner, [DOCUMENT]);
  });

  afterAll(async () => {
    await deleteAccountsByDocument(owner, [DOCUMENT]);
    await owner.end();
  });

  it('recusa quando a senha não vem nem por ambiente nem por flag', async () => {
    const result = await runCli('create-account.cli.ts', BASE_ARGS, {
      VEERTEX_ADMIN_PASSWORD: undefined,
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('VEERTEX_ADMIN_PASSWORD');
    expect(await countAccounts(owner, [DOCUMENT])).toBe(0);
  });

  it('recusa CNPJ com dígito verificador inválido, sem criar nada', async () => {
    // Defeito 3: o seed morria assim, e a mensagem não dizia qual conta. Aqui se garante ao menos
    // que a recusa acontece ANTES de qualquer escrita.
    const invalid = '44555666000172';
    const args = BASE_ARGS.map((arg) => (arg === DOCUMENT ? invalid : arg));

    const result = await runCli('create-account.cli.ts', args, {
      VEERTEX_ADMIN_PASSWORD: password,
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('CNPJ inválido');
    expect(await countAccounts(owner, [invalid])).toBe(0);
  });

  describe('com a senha no ambiente', () => {
    let created: Awaited<ReturnType<typeof runCli>>;

    beforeAll(async () => {
      created = await runCli('create-account.cli.ts', BASE_ARGS, {
        VEERTEX_ADMIN_PASSWORD: password,
      });
    });

    it('sai com código 0', () => {
      // Defeito 1 (RequestContext): antes da correção, saía 1 com o erro do EntityManager global.
      expect(created.stderr).not.toContain('global EntityManager');
      expectCliSuccess(created, 'create:account');
    });

    it('imprime o resultado para o operador', () => {
      // Defeito 4: a confirmação saía por `Logger.log()` e era descartada pelo nível de log do
      // contexto. O comando terminava bem e não dizia nada.
      expect(created.stdout).toContain('Conta criada com sucesso');
      expect(created.stdout).toContain(ADMIN_EMAIL);
    });

    it('nunca ecoa a senha', () => {
      // Defeito 2. Vale para stdout e stderr: o eco do `npm run` ia para stdout, mas um log de
      // erro que serializasse o comando iria para stderr.
      expect(created.output).not.toContain(password);
    });

    it('cria conta, empresa, os sete papéis padrão e o admin', async () => {
      const { rows } = await owner.query<{
        account_id: string;
        companies: string;
        roles: string;
        users: string;
      }>(
        `select a.id as account_id,
                (select count(*)::text from companies c where c.account_id = a.id) as companies,
                (select count(*)::text from roles r where r.account_id = a.id) as roles,
                (select count(*)::text from users u where u.account_id = a.id) as users
           from accounts a where a.document = $1`,
        [DOCUMENT],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].companies).toBe('1');
      expect(rows[0].roles).toBe('7');
      expect(rows[0].users).toBe('1');
    });

    it('grava a senha como hash bcrypt e o telefone em E.164', async () => {
      const { rows } = await owner.query<{
        password_hash: string;
        phone: string;
        email: string;
      }>(
        `select u.password_hash, u.phone, u.email
           from users u join accounts a on a.id = u.account_id
          where a.document = $1`,
        [DOCUMENT],
      );

      expect(rows).toHaveLength(1);
      // Nunca em texto claro, e nunca comparado com a senha — só a FORMA do hash é assertável.
      expect(rows[0].password_hash).not.toBe(password);
      expect(rows[0].password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(rows[0].phone).toBe('+5562999990009');
      expect(rows[0].email).toBe(ADMIN_EMAIL);
    });

    it('recusa a segunda tentativa com o mesmo documento', async () => {
      const again = await runCli('create-account.cli.ts', BASE_ARGS, {
        VEERTEX_ADMIN_PASSWORD: password,
      });

      expect(again.exitCode).toBe(1);
      expect(await countAccounts(owner, [DOCUMENT])).toBe(1);
    });
  });

  it('avisa quando a senha vem por --admin-password', async () => {
    // O flag continua funcionando para não quebrar uso existente, mas tem de avisar — e o aviso
    // não pode transcrever a senha.
    const flagDocument = cnpjWithCheckDigits('900000020001');
    const args = [
      ...BASE_ARGS.map((arg) => (arg === DOCUMENT ? flagDocument : arg)),
      '--admin-password',
      password,
    ];

    try {
      const result = await runCli('create-account.cli.ts', args, {
        VEERTEX_ADMIN_PASSWORD: undefined,
      });

      expectCliSuccess(result, 'create:account com --admin-password');
      expect(result.output).toContain('--admin-password');
      expect(result.output).toContain('ps');
      // O aviso fala SOBRE a senha; não a repete.
      expect(result.stdout).not.toContain(password);
    } finally {
      await deleteAccountsByDocument(owner, [flagDocument]);
    }
  });
});
