import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main (même raison que AddTariffs/AddLiturgicalPeriod/
// AddRequestHomeAddress — `migration:generate` remonte du bruit sans rapport
// sur d'autres tables) — trois règles de demande configurables par Type
// (type/entities/type.entity.ts), pertinentes pour INTENTION/SACRAMENT :
// éligibilité à la célébration à domicile, délai minimum avant la date
// souhaitée, obligation de correspondre à un horaire publié par la paroisse.
export class AddTypeRequestRules1789899200000 implements MigrationInterface {
  name = 'AddTypeRequestRules1789899200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `types` ADD `allow_home_celebration` tinyint NOT NULL DEFAULT 0",
    );
    await queryRunner.query(
      'ALTER TABLE `types` ADD `min_lead_days` int NOT NULL DEFAULT 2',
    );
    await queryRunner.query(
      "ALTER TABLE `types` ADD `requires_schedule_match` tinyint NOT NULL DEFAULT 0",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `types` DROP COLUMN `requires_schedule_match`');
    await queryRunner.query('ALTER TABLE `types` DROP COLUMN `min_lead_days`');
    await queryRunner.query('ALTER TABLE `types` DROP COLUMN `allow_home_celebration`');
  }
}
