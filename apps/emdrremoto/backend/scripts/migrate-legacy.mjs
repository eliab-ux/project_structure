/**
 * Migração de dados: banco LEGADO (Express/TypeORM, PK int) → banco NOVO (MikroORM, PK uuid).
 *
 * Uso (as senhas ficam nas env vars — não no código):
 *   LEGACY_DATABASE_URL="mysql://user:pass@host:porta/db_legado" \
 *   DATABASE_URL="mysql://emdr:pass@host:porta/emdr" \
 *   MIGRATE_SESSIONS=1 \        # opcional: também migra o histórico de sessões
 *   node scripts/migrate-legacy.mjs
 *
 * Idempotente: reexecutar não duplica (dedupe por e-mail do psicólogo, hash do paciente,
 * session_code da sessão). Senhas vêm prontas (o legado já usa bcrypt = compatível).
 *
 * ⚠️ Rode PRIMEIRO com DRY_RUN=1 para ver os totais sem gravar nada.
 */
import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';

const LEGACY_URL = process.env.LEGACY_DATABASE_URL;
const NEW_URL = process.env.DATABASE_URL;
const MIGRATE_SESSIONS = !!process.env.MIGRATE_SESSIONS;
const DRY_RUN = !!process.env.DRY_RUN;

if (!LEGACY_URL || !NEW_URL) {
  console.error('Defina LEGACY_DATABASE_URL e DATABASE_URL nas variáveis de ambiente.');
  process.exit(1);
}

const bool = (v) => (v ? 1 : 0);

/** Cria o schema novo (idempotente) — mesmo DDL das migrations, para o script ser auto-suficiente. */
async function ensureSchema(target) {
  await target.query(`CREATE TABLE IF NOT EXISTS \`psicologos\` (
    \`id\` VARCHAR(36) NOT NULL, \`email\` VARCHAR(255) NOT NULL, \`nome\` VARCHAR(150) NOT NULL,
    \`telefone\` VARCHAR(30) NOT NULL, \`password_hash\` VARCHAR(255) NOT NULL,
    \`email_verificado\` TINYINT(1) NOT NULL DEFAULT 0, \`recovery_code\` VARCHAR(128) NULL,
    \`active\` TINYINT(1) NOT NULL DEFAULT 1, \`created_at\` DATETIME NOT NULL, \`updated_at\` DATETIME NOT NULL,
    PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_psicologos_email\` (\`email\`), KEY \`idx_psicologos_recovery_code\` (\`recovery_code\`)
  ) DEFAULT CHARACTER SET utf8mb4 ENGINE = InnoDB;`);
  await target.query(`CREATE TABLE IF NOT EXISTS \`pacientes\` (
    \`id\` VARCHAR(36) NOT NULL, \`email\` VARCHAR(255) NOT NULL, \`nome\` VARCHAR(150) NOT NULL,
    \`telefone\` VARCHAR(30) NOT NULL, \`pais\` VARCHAR(80) NULL, \`hash\` VARCHAR(64) NOT NULL,
    \`psicologo_id\` VARCHAR(36) NOT NULL, \`active\` TINYINT(1) NOT NULL DEFAULT 1,
    \`created_at\` DATETIME NOT NULL, \`updated_at\` DATETIME NOT NULL,
    PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_pacientes_hash\` (\`hash\`), KEY \`idx_pacientes_psicologo_id\` (\`psicologo_id\`)
  ) DEFAULT CHARACTER SET utf8mb4 ENGINE = InnoDB;`);
  await target.query(`CREATE TABLE IF NOT EXISTS \`sessions\` (
    \`id\` VARCHAR(36) NOT NULL, \`session_code\` VARCHAR(64) NOT NULL, \`daily_co_name\` VARCHAR(128) NULL,
    \`psicologo_id\` VARCHAR(36) NOT NULL, \`paciente_id\` VARCHAR(36) NOT NULL,
    \`paciente_in\` DATETIME NULL, \`psicologo_in\` DATETIME NULL, \`session_out\` DATETIME NULL,
    \`active\` TINYINT(1) NOT NULL DEFAULT 1, \`created_at\` DATETIME NOT NULL, \`updated_at\` DATETIME NOT NULL,
    PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_sessions_session_code\` (\`session_code\`),
    KEY \`idx_sessions_psicologo_id\` (\`psicologo_id\`), KEY \`idx_sessions_paciente_id\` (\`paciente_id\`)
  ) DEFAULT CHARACTER SET utf8mb4 ENGINE = InnoDB;`);
  await target.query(`CREATE TABLE IF NOT EXISTS \`whatsapp_instances\` (
    \`psicologo_id\` VARCHAR(36) NOT NULL, \`mode\` VARCHAR(20) NOT NULL, \`instance_name\` VARCHAR(128) NOT NULL,
    \`api_key\` VARCHAR(255) NOT NULL, \`connected\` TINYINT(1) NOT NULL DEFAULT 0,
    \`created_at\` DATETIME NOT NULL, \`updated_at\` DATETIME NOT NULL, PRIMARY KEY (\`psicologo_id\`)
  ) DEFAULT CHARACTER SET utf8mb4 ENGINE = InnoDB;`);
}

async function main() {
  const legacy = await mysql.createConnection(LEGACY_URL);
  const target = await mysql.createConnection(NEW_URL);
  const log = (...a) => console.log(...a);
  log(`\n=== Migração legado → novo ${DRY_RUN ? '(DRY-RUN, nada será gravado)' : ''} ===`);
  // Cria as tabelas (idempotente) mesmo em DRY-RUN — as checagens de duplicado precisam delas.
  await ensureSchema(target);
  log('Schema garantido (tabelas criadas se não existiam).');

  // ---------------- PSICÓLOGOS ----------------
  const [psis] = await legacy.query('SELECT * FROM psicologo');
  const psiMap = new Map(); // legacyId(int) -> uuid(novo)
  let psiNovos = 0;
  for (const p of psis) {
    const [ex] = await target.query('SELECT id FROM psicologos WHERE email = ? LIMIT 1', [p.email]);
    if (ex.length) {
      psiMap.set(p.id, ex[0].id);
      continue;
    }
    const id = randomUUID();
    psiMap.set(p.id, id);
    psiNovos++;
    if (!DRY_RUN) {
      await target.query(
        `INSERT INTO psicologos
         (id, email, nome, telefone, password_hash, email_verificado, recovery_code, active, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          p.email,
          p.nome,
          String(p.telefone ?? ''),
          p.senha,
          bool(p.email_verificado),
          p.codigo_recuperacao || null,
          bool(p.status ?? 1),
          p.created_at ?? new Date(),
          p.updated_at ?? new Date(),
        ],
      );
    }
  }
  log(`Psicólogos: ${psis.length} no legado, ${psiNovos} novos migrados.`);

  // ---------------- PACIENTES ----------------
  const [pacs] = await legacy.query('SELECT * FROM paciente');
  const pacMap = new Map();
  let pacNovos = 0;
  let pacSemPsi = 0;
  for (const p of pacs) {
    const psicologoId = psiMap.get(p.psicologoId);
    if (!psicologoId) {
      pacSemPsi++;
      continue; // paciente órfão (psicólogo não migrou) — pulado
    }
    const [ex] = await target.query('SELECT id FROM pacientes WHERE hash = ? LIMIT 1', [p.hash]);
    if (ex.length) {
      pacMap.set(p.id, ex[0].id);
      continue;
    }
    const id = randomUUID();
    pacMap.set(p.id, id);
    pacNovos++;
    if (!DRY_RUN) {
      await target.query(
        `INSERT INTO pacientes
         (id, email, nome, telefone, pais, hash, psicologo_id, active, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          p.email,
          p.nome,
          String(p.telefone ?? ''),
          p.pais || null,
          p.hash,
          psicologoId,
          bool(p.status ?? 1),
          p.created_at ?? new Date(),
          p.updated_at ?? new Date(),
        ],
      );
    }
  }
  log(`Pacientes: ${pacs.length} no legado, ${pacNovos} novos migrados` + (pacSemPsi ? `, ${pacSemPsi} órfãos pulados.` : '.'));

  // ---------------- SESSÕES (opcional) ----------------
  if (MIGRATE_SESSIONS) {
    const [sess] = await legacy.query('SELECT * FROM sessions');
    let sessNovas = 0;
    let sessSemFk = 0;
    for (const s of sess) {
      const psicologoId = psiMap.get(s.psicologoId);
      const pacienteId = pacMap.get(s.pacienteId);
      if (!psicologoId || !pacienteId) {
        sessSemFk++;
        continue;
      }
      const [ex] = await target.query('SELECT id FROM sessions WHERE session_code = ? LIMIT 1', [
        s.session_code,
      ]);
      if (ex.length) continue;
      sessNovas++;
      if (!DRY_RUN) {
        await target.query(
          `INSERT INTO sessions
           (id, session_code, daily_co_name, psicologo_id, paciente_id, paciente_in, psicologo_in, session_out, active, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            randomUUID(),
            s.session_code,
            s.daily_co_name || null,
            psicologoId,
            pacienteId,
            s.paciente_in || null,
            s.psicologo_in || null,
            s.session_out || null,
            bool(s.status ?? 1),
            s.created_at ?? new Date(),
            s.updated_at ?? new Date(),
          ],
        );
      }
    }
    log(`Sessões: ${sess.length} no legado, ${sessNovas} novas migradas` + (sessSemFk ? `, ${sessSemFk} sem FK válida puladas.` : '.'));
  } else {
    log('Sessões: NÃO migradas (defina MIGRATE_SESSIONS=1 para incluir).');
  }

  await legacy.end();
  await target.end();
  log(`\n=== Concluído ${DRY_RUN ? '(DRY-RUN)' : ''} ===\n`);
}

main().catch((e) => {
  console.error('ERRO na migração:', e);
  process.exit(1);
});
