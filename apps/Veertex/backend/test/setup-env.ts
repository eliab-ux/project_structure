import { loadEnvFiles } from '../src/config/load-env';
import { applyTestDatabaseEnv } from './test-database';

/**
 * Carrega o `.env` antes de qualquer teste **e aponta a suíte para o banco de TESTE**.
 *
 * Sem o carregamento, os testes de integração falham dizendo que `DATABASE_URL` não existe — quando
 * na verdade ela existe e só não foi lida. O Jest não herda o carregamento que os scripts `npm`
 * fazem via `dotenv` no próprio processo; cada worker é um processo novo.
 *
 * Registrado em `setupFiles` (e não `setupFilesAfterEach`) porque precisa rodar ANTES do framework
 * de teste, para que qualquer `process.env` lido no topo de um arquivo de spec já enxergue o valor.
 *
 * `override: false` mantém uma variável exportada no shell — ou injetada pelo CI — ganhando do
 * arquivo, que é o comportamento que um pipeline espera.
 *
 * A troca de banco roda aqui **e** no `globalSetup` (que migra antes da suíte): os dois são processos
 * distintos, e cada um precisa da própria troca. A regra vive num módulo só — ver `test-database.ts`.
 */
loadEnvFiles();
applyTestDatabaseEnv();
