import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { MikroORM, defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import {
  DEFAULT_ISOLATION_ROLES,
  IsolationRoles,
  verifyIsolationInvariants,
} from '../isolation-invariants';
import { seedPlanCatalog } from './plan-catalog.seed';

/**
 * Key of the advisory lock that serialises the whole bootstrap. Arbitrary but FIXED — every replica
 * must pick the same number or the lock protects nothing.
 */
const BOOTSTRAP_LOCK_KEY = 726_452_026;

/** How long a replica waits for another one to finish migrating before giving up and failing loudly. */
const LOCK_WAIT_MS = 120_000;

/**
 * Brings the database to a usable, VERIFIED state before the application accepts a single request:
 * migrate → verify → seed. Any failure aborts the boot.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Why an advisory lock, and why this replaces the old "migrations never run at boot" rule
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Running migrations at startup is exactly what the Dockerfile used to forbid, and for a good
 * reason: with two replicas, two processes apply the same batch at the same time — duplicate DDL,
 * deadlocks, or a half-applied schema. Auto-migration is now a product requirement (minimise manual
 * operation), so the hazard has to be closed rather than avoided.
 *
 * `pg_advisory_lock` is the mutex. The first replica takes it and migrates; the others BLOCK at the
 * lock and, when they wake, find nothing pending and continue. It is a session-level lock held on a
 * dedicated connection, so it does not interfere with the migrations' own transactions. The whole
 * sequence — migrate, verify, seed — is inside it, so two replicas never race on the seed either.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * The credential trade-off, stated plainly
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Auto-migration means the API process must hold `DATABASE_URL_MIGRATIONS` — a DDL-capable
 * credential. That is a real reduction of what the two-role design buys: a compromised API process
 * can now DROP TABLE, which it could not before. It is Eliab's explicit call, and the mitigations
 * applied here are: the owner connection is opened only for the bootstrap and closed immediately
 * after, and the variable is removed from `process.env` once used, so anything running later in the
 * process cannot read it. Neither is airtight (the value still passed through memory) — they narrow
 * the window, they do not close it.
 *
 * `AUTO_MIGRATE=false` restores the previous posture for controlled deploys: migrations are applied
 * out of band and the process never needs the owner credential to migrate. **Verification still
 * runs** — see `onApplicationBootstrap`.
 */
@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(private readonly config: ConfigService) {}

  async onApplicationBootstrap(): Promise<void> {
    const ownerUrl = process.env.DATABASE_URL_MIGRATIONS;
    const autoMigrate = this.config.get<string>('AUTO_MIGRATE') !== 'false';

    if (!ownerUrl) {
      // Fail closed. Continuing would mean serving traffic without ever having checked that the
      // isolation between accounts actually holds — which is the one thing that must never be
      // assumed. Turning AUTO_MIGRATE off does not remove this requirement, it only removes the DDL.
      throw new Error(
        'DATABASE_URL_MIGRATIONS ausente. Ela é necessária no boot para aplicar migrations e, ' +
          'sobretudo, para VERIFICAR os invariantes de isolamento antes de aceitar requisições. ' +
          'Ver deploy/README.md.',
      );
    }

    const roles: IsolationRoles = {
      owner: this.config.get<string>('DATABASE_OWNER_ROLE') ?? DEFAULT_ISOLATION_ROLES.owner,
      app: this.config.get<string>('DATABASE_APP_ROLE') ?? DEFAULT_ISOLATION_ROLES.app,
    };

    const client = new Client({ connectionString: ownerUrl });
    await client.connect();

    try {
      await this.acquireLock(client);

      if (autoMigrate) {
        await this.migrate(ownerUrl);
      } else {
        this.logger.warn(
          'AUTO_MIGRATE=false — migrations NÃO foram aplicadas neste boot. A verificação de ' +
            'isolamento roda mesmo assim e aborta se o schema estiver atrás.',
        );
      }

      await this.verify(client, roles);
      await this.seed(client);
    } finally {
      // Released before the connection closes so a failed boot does not leave the next replica
      // blocked — though closing the session would release it anyway, this makes the intent explicit.
      await client
        .query('select pg_advisory_unlock($1)', [BOOTSTRAP_LOCK_KEY])
        .catch(() => undefined);
      await client.end().catch(() => undefined);
    }

    // Narrows the window in which a DDL-capable credential is readable from this process. Deleted
    // AFTER the bootstrap because nothing else in the running application ever needs it — the CLIs
    // are separate processes and read the container's environment fresh.
    delete process.env.DATABASE_URL_MIGRATIONS;
  }

  private async acquireLock(client: Client): Promise<void> {
    // A bounded wait, not an indefinite one: if a previous replica died holding the lock, or a
    // migration is genuinely stuck, an unbounded wait would look like a silent hang at boot.
    await client.query(`set statement_timeout = ${LOCK_WAIT_MS}`);
    try {
      await client.query('select pg_advisory_lock($1)', [BOOTSTRAP_LOCK_KEY]);
    } catch (error) {
      throw new Error(
        `Não foi possível obter o lock de bootstrap em ${LOCK_WAIT_MS / 1000}s. ` +
          'Outra réplica pode estar migrando, ou um processo anterior travou segurando o lock. ' +
          `Detalhe: ${(error as Error)?.message}`,
      );
    } finally {
      await client.query('set statement_timeout = 0');
    }
  }

  private async migrate(ownerUrl: string): Promise<void> {
    // A SEPARATE MikroORM instance, on the owner connection. The application's own ORM runs as the
    // runtime role, which has no DDL — using it here would fail on the first `create table`, and
    // succeeding would be worse: tables owned by the runtime role are tables RLS stops protecting.
    const orm = await MikroORM.init(
      defineConfig({
        clientUrl: ownerUrl,
        extensions: [Migrator],
        pool: { min: 0, max: 2 },
        entities: ['./dist/**/*.entity.js'],
        entitiesTs: ['./src/**/*.entity.ts'],
        discovery: { warnWhenNoEntities: false },
        migrations: {
          path: './dist/infrastructure/persistence/mikro-orm/migrations',
          pathTs: './src/infrastructure/persistence/mikro-orm/migrations',
          transactional: true,
        },
        forceUtcTimezone: true,
      }),
    );

    try {
      const applied = await orm.getMigrator().up();
      this.logger.log(
        applied.length === 0
          ? 'Nenhuma migration pendente.'
          : `${applied.length} migration(s) aplicada(s): ${applied.map((m) => m.name).join(', ')}`,
      );
    } finally {
      await orm.close(true);
    }
  }

  private async verify(client: Client, roles: IsolationRoles): Promise<void> {
    const violations = await verifyIsolationInvariants(
      async (sql, params) => (await client.query(sql, params as unknown[])).rows,
      roles,
    );

    if (violations.length > 0) {
      const detail = violations.map((v) => `  [${v.check}] ${v.detail}`).join('\n');
      // Aborting the boot is the point. A process that starts here would serve requests while the
      // isolation between accounts is not guaranteed — and that failure is invisible until one
      // customer sees another's data.
      throw new Error(
        `Isolamento comprometido — a aplicação NÃO vai subir.\n\n${detail}\n\n` +
          'Corrija o provisionamento (deploy/sql/001_create_roles.sql) e reimplante. ' +
          'Ver "Verificação do isolamento" em deploy/README.md.',
      );
    }

    this.logger.log('Invariantes de isolamento verificados.');
  }

  private async seed(client: Client): Promise<void> {
    const result = await seedPlanCatalog(
      async (sql, params) => (await client.query(sql, params as unknown[])).rows,
    );
    this.logger.log(
      `Catálogo de planos reconciliado: ${result.inserted} inserido(s), ${result.unchanged} já existente(s).`,
    );
  }
}
