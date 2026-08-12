import { Client } from 'pg';
import { expectCliSuccess, runCli } from '../helpers/run-cli';
import {
  connectAsOwner,
  countAccounts,
  deleteAccountsByDocument,
  deleteAccountsExcept,
} from '../helpers/db';
import { cnpjWithCheckDigits } from '../helpers/document';

/**
 * `seed:dev` — as duas contas de desenvolvimento, executado de verdade.
 *
 * Dois defeitos reais nasceram aqui e cada um tem seu `it`: o CNPJ da segunda conta com dígito
 * verificador inválido (o seed morria antes de criá-la) e o retorno ao operador saindo por
 * `Logger.log()`, que o nível de log do contexto descartava — o comando terminava com sucesso e
 * não dizia uma palavra sobre o que havia feito.
 *
 * O terceiro grupo de asserções cobre a BARREIRA DE DADO, que é a parte com consequência séria: o
 * seed recusa rodar se o banco tiver conta que não seja de demonstração. A barreira anterior era
 * `NODE_ENV !== 'production'`, trocada porque env é derrubável por quem invoca o comando. Um teste
 * que só verificasse o caminho feliz deixaria a barreira apodrecer sem aviso.
 *
 * ⚠️ Este spec APAGA as contas de demonstração no fim. Elas são recriáveis com um `npm run
 * seed:dev`, e deixar estado para trás faria a suíte depender da ordem dos arquivos — o tipo de
 * acoplamento que produz falha diferente conforme o jest resolve rodar.
 */

const DEMO_DOCUMENTS = ['11222333000181', '44555666000181'];
const INTRUDER_DOCUMENT = cnpjWithCheckDigits('900000030001');
const INTRUDER_NAME = 'Cliente Que Não É Demo';

describe('seed:dev — execução real do ponto de entrada', () => {
  let owner: Client;

  beforeAll(async () => {
    owner = await connectAsOwner();
    await deleteAccountsByDocument(owner, [...DEMO_DOCUMENTS, INTRUDER_DOCUMENT]);

    // A barreira de dado do seed é GLOBAL: ele recusa rodar se existir qualquer conta que não seja de
    // demonstração. Este spec, portanto, precisa do banco inteiro sob controle — e não pode depender
    // de toda rodada anterior ter terminado limpa. Ver o docblock de `deleteAccountsExcept`.
    const leftovers = await deleteAccountsExcept(owner, DEMO_DOCUMENTS);
    if (leftovers.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️  Sobras de execução anterior removidas antes do seed: ${leftovers.join(', ')}. ` +
          'Se isto aparecer numa rodada que NÃO foi interrompida, algum spec não está limpando o ' +
          'que cria.',
      );
    }
  });

  afterAll(async () => {
    await deleteAccountsByDocument(owner, [...DEMO_DOCUMENTS, INTRUDER_DOCUMENT]);
    await owner.end();
  });

  describe('num banco sem contas', () => {
    let first: Awaited<ReturnType<typeof runCli>>;

    beforeAll(async () => {
      first = await runCli('seed-dev.cli.ts');
    });

    it('sai com código 0', () => {
      expect(first.stderr).not.toContain('global EntityManager');
      expectCliSuccess(first, 'seed:dev (primeira execução)');
    });

    it('anuncia cada conta que criou', () => {
      // A regressão do defeito 4. Antes, esta saída era vazia e o teste do banco (abaixo) passaria
      // do mesmo jeito — é por isso que a asserção sobre a SAÍDA precisa existir separada da
      // asserção sobre o EFEITO.
      expect(first.stdout).toContain('"Tudodicasa (dev)" criada');
      expect(first.stdout).toContain('"Kaza Tem (dev)" criada');
    });

    it('cria as duas contas, cada uma com seus próprios papéis', async () => {
      // DUAS contas, e não uma, é o ponto do seed: bug de multi-tenancy só é visível quando existe
      // um segundo tenant para vazar.
      const { rows } = await owner.query<{ document: string; roles: string; users: string }>(
        `select a.document,
                (select count(*)::text from roles r where r.account_id = a.id) as roles,
                (select count(*)::text from users u where u.account_id = a.id) as users
           from accounts a where a.document = any($1::text[]) order by a.document`,
        [DEMO_DOCUMENTS],
      );

      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.roles).toBe('7');
        expect(row.users).toBe('1');
      }
    });
  });

  describe('rodando de novo', () => {
    let second: Awaited<ReturnType<typeof runCli>>;

    beforeAll(async () => {
      second = await runCli('seed-dev.cli.ts');
    });

    it('é idempotente e diz que nada havia a fazer', () => {
      expectCliSuccess(second, 'seed:dev (segunda execução)');
      expect(second.stdout).toContain('"Tudodicasa (dev)" já existe');
      expect(second.stdout).toContain('"Kaza Tem (dev)" já existe');
    });

    it('não duplica nada', async () => {
      expect(await countAccounts(owner, DEMO_DOCUMENTS)).toBe(2);
    });
  });

  describe('barreira de dado', () => {
    beforeAll(async () => {
      // Precondição criada por SQL direto, de propósito: o que se testa aqui é a REAÇÃO do seed à
      // presença de uma conta de cliente, não o caminho que a criou. Gastar 12 segundos subindo o
      // `create:account` para produzir uma linha não acrescentaria nada à asserção.
      await owner.query(
        `insert into accounts (id, name, document, plan_id, status, timezone, created_at, updated_at)
         select gen_random_uuid(), $1, $2, p.id, 'ACTIVE', 'America/Sao_Paulo', now(), now()
           from plans p order by p.code limit 1`,
        [INTRUDER_NAME, INTRUDER_DOCUMENT],
      );
    });

    afterAll(async () => {
      await deleteAccountsByDocument(owner, [INTRUDER_DOCUMENT]);
    });

    it('recusa rodar e NOMEIA a conta encontrada', async () => {
      const blocked = await runCli('seed-dev.cli.ts');

      expect(blocked.exitCode).toBe(1);
      // Nomear importa: "há contas reais" sozinho deixa o operador sem saber se esbarrou num resto
      // de teste ou num cliente de verdade.
      expect(blocked.output).toContain(INTRUDER_NAME);
    });
  });

  it('recusa com NODE_ENV=production mesmo num banco só com contas demo', async () => {
    // A segunda camada. Env é derrubável por quem controla o env — o que a torna insuficiente como
    // única barreira, não inútil como segunda: cobre o caso que a barreira de dado não cobre, que é
    // um banco de produção ainda vazio.
    const blocked = await runCli('seed-dev.cli.ts', [], { NODE_ENV: 'production' });

    expect(blocked.exitCode).toBe(1);
    expect(blocked.output).toContain('NODE_ENV=production');
  });
});
