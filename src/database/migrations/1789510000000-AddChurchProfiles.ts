import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main (même raison que AddTariffs/AddLiturgicalPeriod :
// `migration:generate` remonte du bruit sans rapport sur d'autres tables) —
// crée `church_profiles` (church/entities/church-profile.entity.ts) et y
// rapatrie `leader_message`, jusqu'ici colonne de `churches`.
export class AddChurchProfiles1789510000000 implements MigrationInterface {
  name = 'AddChurchProfiles1789510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `church_profiles` (`id` varchar(36) NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), `created_by` varchar(255) NULL, `updated_by` varchar(255) NULL, `deleted_at` timestamp(6) NULL, `description` text NULL, `leader_message` text NULL, `church_id` varchar(255) NOT NULL, `code` varchar(255) NOT NULL, UNIQUE INDEX `IDX_church_profiles_church_id` (`church_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
    await queryRunner.query(
      'ALTER TABLE `church_profiles` ADD CONSTRAINT `FK_church_profiles_church_id` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      "INSERT INTO `church_profiles` (`id`, `leader_message`, `church_id`, `code`) SELECT UUID(), `leader_message`, `id`, CONCAT('40', UNIX_TIMESTAMP(NOW(3)) * 1000) FROM `churches` WHERE `leader_message` IS NOT NULL",
    );
    await queryRunner.query('ALTER TABLE `churches` DROP COLUMN `leader_message`');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `churches` ADD `leader_message` text NULL');
    await queryRunner.query(
      'UPDATE `churches` c INNER JOIN `church_profiles` p ON p.`church_id` = c.`id` SET c.`leader_message` = p.`leader_message`',
    );
    await queryRunner.query('ALTER TABLE `church_profiles` DROP FOREIGN KEY `FK_church_profiles_church_id`');
    await queryRunner.query('DROP TABLE `church_profiles`');
  }
}
