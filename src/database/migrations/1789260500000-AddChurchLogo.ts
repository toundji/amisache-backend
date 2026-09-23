import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChurchLogo1789260500000 implements MigrationInterface {
    name = 'AddChurchLogo1789260500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`churches\` ADD \`logo\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`churches\` DROP COLUMN \`logo\``);
    }
}
