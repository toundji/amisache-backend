import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main : direct déclaré par le clergé (« Je diffuse en direct ») — fin prévue et lien.
export class ChurchProfileLive1790400900000 implements MigrationInterface {
  name = 'ChurchProfileLive1790400900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `church_profiles` ADD `live_until` datetime NULL, ADD `live_url` varchar(500) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `church_profiles` DROP COLUMN `live_url`, DROP COLUMN `live_until`');
  }
}
