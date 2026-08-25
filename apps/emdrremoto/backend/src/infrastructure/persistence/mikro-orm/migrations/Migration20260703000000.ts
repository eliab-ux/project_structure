import { Migration } from '@mikro-orm/migrations';

/**
 * Schema inicial do EMDR Remoto (MySQL). UUID (varchar(36)) como PK — domínio gera o id.
 * NÃO há colunas *_socket_id: o roteamento em tempo real é por rooms do Socket.IO.
 *
 * Reuso de dados do MySQL legado (int PK / colunas TypeORM) requer um script de
 * transformação à parte — ver README (migração de dados é opcional).
 */
export class Migration20260703000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS \`psicologos\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`email\` VARCHAR(255) NOT NULL,
        \`nome\` VARCHAR(150) NOT NULL,
        \`telefone\` VARCHAR(30) NOT NULL,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`email_verificado\` TINYINT(1) NOT NULL DEFAULT 0,
        \`recovery_code\` VARCHAR(128) NULL,
        \`active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL,
        \`updated_at\` DATETIME NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_psicologos_email\` (\`email\`),
        KEY \`idx_psicologos_recovery_code\` (\`recovery_code\`)
      ) DEFAULT CHARACTER SET utf8mb4 ENGINE = InnoDB;
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS \`pacientes\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`email\` VARCHAR(255) NOT NULL,
        \`nome\` VARCHAR(150) NOT NULL,
        \`telefone\` VARCHAR(30) NOT NULL,
        \`pais\` VARCHAR(80) NULL,
        \`hash\` VARCHAR(64) NOT NULL,
        \`psicologo_id\` VARCHAR(36) NOT NULL,
        \`active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL,
        \`updated_at\` DATETIME NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_pacientes_hash\` (\`hash\`),
        KEY \`idx_pacientes_psicologo_id\` (\`psicologo_id\`)
      ) DEFAULT CHARACTER SET utf8mb4 ENGINE = InnoDB;
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS \`sessions\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`session_code\` VARCHAR(64) NOT NULL,
        \`daily_co_name\` VARCHAR(128) NULL,
        \`psicologo_id\` VARCHAR(36) NOT NULL,
        \`paciente_id\` VARCHAR(36) NOT NULL,
        \`paciente_in\` DATETIME NULL,
        \`psicologo_in\` DATETIME NULL,
        \`session_out\` DATETIME NULL,
        \`active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL,
        \`updated_at\` DATETIME NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_sessions_session_code\` (\`session_code\`),
        KEY \`idx_sessions_psicologo_id\` (\`psicologo_id\`),
        KEY \`idx_sessions_paciente_id\` (\`paciente_id\`)
      ) DEFAULT CHARACTER SET utf8mb4 ENGINE = InnoDB;
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS `sessions`;');
    this.addSql('DROP TABLE IF EXISTS `pacientes`;');
    this.addSql('DROP TABLE IF EXISTS `psicologos`;');
  }
}
