import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main : réglage « l'église reçoit des demandes en ligne », activé
// par défaut pour garder le comportement des églises existantes.
export class ChurchAcceptsRequests1790400700000 implements MigrationInterface {
  name = 'ChurchAcceptsRequests1790400700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `churches` ADD `accepts_requests` tinyint NOT NULL DEFAULT 1',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `churches` DROP COLUMN `accepts_requests`');
  }
}
