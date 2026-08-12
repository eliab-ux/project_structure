import { Client } from 'pg';
import { runCli } from '../helpers/run-cli';
import { connectAsOwner } from '../helpers/db';

/**
 * `verify:isolation` e `verify:rls` — os dois gates, executados de verdade.
 *
 * O caminho feliz é metade do valor. A outra metade, e a que este arquivo existe para cobrir, é
 * **provar que o verificador reprova quando deve**. Um gate que nunca foi visto falhando é
 * indistinguível de um gate que não verifica nada: os dois saem 0 sempre, e a diferença só aparece
 * no dia em que já era para ter aparecido.
 *
 * O mesmo raciocínio já cobrou um preço neste projeto na direção oposta — o `smoke:auth` exigia um
 * claim que só existe na F2, e por isso nunca poderia passar verde na F1. Gate que não pode passar
 * ensina a ignorar gate; gate que não pode falhar ensina a confiar em nada.
 */

/**
 * Tabela-isca: tem `account_id` e NÃO tem RLS. É exatamente a forma do erro que se quer pegar —
 * alguém acrescenta uma tabela de negócio numa migration e esquece a policy, e todo o isolamento
 * daquela tabela deixa de existir em silêncio.
 *
 * ⚠️ Ela precisa sumir ao fim do teste. Enquanto existir, TODO boot da aplicação aborta, porque a
 * verificação de invariantes roda no start e é fail-fast. Por isso o `drop` aparece três vezes:
 * antes (caso uma execução anterior tenha morrido no meio), no `afterAll` e no `finally` do próprio
 * teste.
 */
const BAIT_TABLE = 'zz_test_tabela_sem_rls';

async function dropBait(owner: Client): Promise<void> {
  await owner.query(`drop table if exists public.${BAIT_TABLE} cascade`);
}

describe('verificadores de isolamento — execução real', () => {
  let owner: Client;

  beforeAll(async () => {
    owner = await connectAsOwner();
    await dropBait(owner);
  });

  afterAll(async () => {
    await dropBait(owner);
    await owner.end();
  });

  it('verify:isolation aprova o schema íntegro', async () => {
    const result = await runCli('verify-isolation.ts');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Isolamento íntegro');
  });

  it('verify:rls aprova o comportamento do RLS', async () => {
    const result = await runCli('verify-rls.ts');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('§7.2 satisfeito');
  });

  it('verify:isolation REPROVA uma tabela com account_id e sem policy', async () => {
    try {
      await owner.query(
        `create table public.${BAIT_TABLE} (
           id uuid primary key default gen_random_uuid(),
           account_id uuid not null
         )`,
      );

      const result = await runCli('verify-isolation.ts');

      expect(result.exitCode).not.toBe(0);
      // A mensagem tem de NOMEAR a tabela. "Isolamento comprometido" sozinho manda o operador
      // procurar em nove tabelas qual delas está errada.
      expect(result.output).toContain(BAIT_TABLE);
    } finally {
      await dropBait(owner);
    }
  });

  it('volta a aprovar depois que a tabela some', async () => {
    // Fecha o ciclo: garante que o teste anterior não deixou o banco num estado que faria os
    // próximos specs — e todo boot da aplicação — abortarem.
    const result = await runCli('verify-isolation.ts');

    expect(result.exitCode).toBe(0);
  });
});
