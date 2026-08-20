import { Client } from 'pg';
import { verifyRuntimeIdentity } from '../../src/infrastructure/persistence/isolation-invariants';

/**
 * A CONEXÃO DE RUNTIME É QUEM DIZ SER? — o furo achado em 20/08/2026, no primeiro deploy.
 *
 * Todas as outras verificações de isolamento leem o catálogo pelo NOME dos papéis, e passam intactas
 * com a aplicação conectando como `postgres`. É um erro fácil de cometer: no Dokploy, a "Internal
 * Connection URL" do serviço de banco é o valor mais à mão para colar no `DATABASE_URL` — e é a
 * credencial DELE, normalmente superusuário.
 *
 * O que este teste prende é a única pergunta que responde isso, e ela só pode ser feita À CONEXÃO:
 * `current_user`. Nenhuma leitura de catálogo substitui.
 */
describe('verifyRuntimeIdentity', () => {
  /*
   * `setupFiles` já trocou estas variáveis para as do banco de TESTE (ver `test/test-database.ts`),
   * então ler `process.env` aqui é ler o banco de teste — não o de desenvolvimento.
   */
  const urlApp = () => process.env.DATABASE_URL as string;
  const urlOwner = () => process.env.DATABASE_URL_MIGRATIONS as string;

  it('aprova a conexão do papel de runtime', async () => {
    const client = new Client({ connectionString: urlApp() });
    await client.connect();
    try {
      const violations = await verifyRuntimeIdentity(
        async (sql, params) => (await client.query(sql, params as unknown[])).rows,
      );
      expect(violations).toEqual([]);
    } finally {
      await client.end();
    }
  });

  it('RECUSA a conexão do owner — e é o caso do DATABASE_URL colado errado', async () => {
    /*
     * O owner não é superusuário, mas ignora as policies POR SER DONO das tabelas. A verificação o
     * recusa pelo nome, que é o sinal disponível: se `current_user` não é o papel de runtime, o que
     * a aplicação faz com o banco deixou de ser o que o desenho garante.
     */
    const client = new Client({ connectionString: urlOwner() });
    await client.connect();
    try {
      const violations = await verifyRuntimeIdentity(
        async (sql, params) => (await client.query(sql, params as unknown[])).rows,
      );
      expect(violations).toHaveLength(1);
      expect(violations[0].check).toBe('runtime-identity');
      // A mensagem nomeia a causa provável: é ela que economiza a meia hora de procura.
      expect(violations[0].detail).toMatch(/Internal Connection URL/);
    } finally {
      await client.end();
    }
  });

  it('RECUSA superusuário, com as duas violações separadas', async () => {
    // Simula a conexão de superusuário sem precisar de uma: o executor devolve o que o Postgres
    // devolveria. É o mesmo formato de quatro colunas que a função pede.
    const violations = await verifyRuntimeIdentity(async () => [
      {
        usuario: 'postgres',
        banco: 'postgres',
        superusuario: 'on',
        bypassrls: true,
      },
    ]);

    expect(violations).toHaveLength(3);
    const detalhes = violations.map((v) => v.detail).join(' | ');
    expect(detalhes).toMatch(/conecta como "postgres"/);
    expect(detalhes).toMatch(/SUPERUSUÁRIO/);
    expect(detalhes).toMatch(/BYPASSRLS/);
  });

  it('recusa quando a conexão não responde quem é', async () => {
    const violations = await verifyRuntimeIdentity(async () => []);
    expect(violations).toHaveLength(1);
    expect(violations[0].detail).toMatch(/não respondeu quem ela é/);
  });
});
