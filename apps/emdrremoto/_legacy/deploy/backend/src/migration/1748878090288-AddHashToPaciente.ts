import {MigrationInterface, QueryRunner} from "typeorm";

export class AddHashToPaciente1748878090288 implements MigrationInterface {
    name = 'AddHashToPaciente1748878090288'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE paciente ADD hash varchar(255);`);

        await queryRunner.query(`
            UPDATE paciente SET hash = MD5(CONCAT(id, NOW(), RAND()))
            WHERE hash IS NULL;
        `);

        await queryRunner.query(`
            ALTER TABLE paciente MODIFY hash varchar(255) NOT NULL UNIQUE;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE paciente DROP COLUMN hash
        `);
    }

}
