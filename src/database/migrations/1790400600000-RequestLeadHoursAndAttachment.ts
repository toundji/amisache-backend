import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main :
// - délai minimum d'une demande en HEURES (plus en jours) — permet « 12 heures »,
//   « 3 jours » ou « 2 semaines » ; les valeurs existantes sont converties (× 24) ;
// - pièce jointe activable par type de demande (désactivée par défaut).
export class RequestLeadHoursAndAttachment1790400600000 implements MigrationInterface {
  name = 'RequestLeadHoursAndAttachment1790400600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `request_types` CHANGE `min_lead_days` `min_lead_hours` int NOT NULL DEFAULT 48',
    );
    await queryRunner.query('UPDATE `request_types` SET `min_lead_hours` = `min_lead_hours` * 24');
    await queryRunner.query(
      'ALTER TABLE `request_types` ADD `allow_attachment` tinyint NOT NULL DEFAULT 0',
    );
    await queryRunner.query('ALTER TABLE `tariffs` CHANGE `min_lead_days` `min_lead_hours` int NULL');
    await queryRunner.query(
      'UPDATE `tariffs` SET `min_lead_hours` = `min_lead_hours` * 24 WHERE `min_lead_hours` IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'UPDATE `tariffs` SET `min_lead_hours` = CEIL(`min_lead_hours` / 24) WHERE `min_lead_hours` IS NOT NULL',
    );
    await queryRunner.query('ALTER TABLE `tariffs` CHANGE `min_lead_hours` `min_lead_days` int NULL');
    await queryRunner.query('ALTER TABLE `request_types` DROP COLUMN `allow_attachment`');
    await queryRunner.query('UPDATE `request_types` SET `min_lead_hours` = CEIL(`min_lead_hours` / 24)');
    await queryRunner.query(
      'ALTER TABLE `request_types` CHANGE `min_lead_hours` `min_lead_days` int NOT NULL DEFAULT 2',
    );
  }
}
