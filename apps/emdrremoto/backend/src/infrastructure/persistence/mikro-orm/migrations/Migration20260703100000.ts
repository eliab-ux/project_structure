import { Migration } from '@mikro-orm/migrations';

/** Config de WhatsApp (Evolution) por psicólogo. */
export class Migration20260703100000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS \`whatsapp_instances\` (
        \`psicologo_id\` VARCHAR(36) NOT NULL,
        \`mode\` VARCHAR(20) NOT NULL,
        \`instance_name\` VARCHAR(128) NOT NULL,
        \`api_key\` VARCHAR(255) NOT NULL,
        \`connected\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` DATETIME NOT NULL,
        \`updated_at\` DATETIME NOT NULL,
        PRIMARY KEY (\`psicologo_id\`)
      ) DEFAULT CHARACTER SET utf8mb4 ENGINE = InnoDB;
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS `whatsapp_instances`;');
  }
}
