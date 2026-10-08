import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main (même raison que AddTariffs) — délai minimum par église
// sur `tariffs`, montant devenu facultatif (une église peut ne fixer que le délai).
export class AddTariffMinLeadDays1790400000000 implements MigrationInterface {
  name = 'AddTariffMinLeadDays1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `tariffs` MODIFY `amount` decimal(12,2) NULL');
    await queryRunner.query('ALTER TABLE `tariffs` ADD `min_lead_days` int NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `tariffs` DROP COLUMN `min_lead_days`');
    // Les lignes sans montant n'ont pas de sens avant cette migration.
    await queryRunner.query('DELETE FROM `tariffs` WHERE `amount` IS NULL');
    await queryRunner.query('ALTER TABLE `tariffs` MODIFY `amount` decimal(12,2) NOT NULL');
  }
}
