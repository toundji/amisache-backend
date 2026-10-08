import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main — site web propre à l'église (certaines en ont déjà un).
export class AddChurchProfileWebsite1790400300000 implements MigrationInterface {
  name = 'AddChurchProfileWebsite1790400300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `church_profiles` ADD `website` varchar(500) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `church_profiles` DROP COLUMN `website`');
  }
}
