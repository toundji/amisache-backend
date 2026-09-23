import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChurchPhotos1789259811392 implements MigrationInterface {
    name = 'AddChurchPhotos1789259811392'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`churches\` ADD \`photos\` json NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`churches\` DROP COLUMN \`photos\``);
    }
}
