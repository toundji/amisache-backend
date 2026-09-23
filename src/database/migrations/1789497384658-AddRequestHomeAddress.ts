import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main (même raison que AddLiturgicalPeriod/AddTariffs :
// `migration:generate` remonte du bruit sans rapport sur d'autres tables) —
// ajoute seulement `home_address`/`home_location` sur `requests`
// (liturgy/entities/request.entity.ts — célébration à domicile, optionnelle,
// valable pour n'importe quel motif de demande).
export class AddRequestHomeAddress1789497384658 implements MigrationInterface {
  name = 'AddRequestHomeAddress1789497384658';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `requests` ADD `home_address` text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `requests` ADD `home_location` point NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `requests` DROP COLUMN `home_location`');
    await queryRunner.query('ALTER TABLE `requests` DROP COLUMN `home_address`');
  }
}
