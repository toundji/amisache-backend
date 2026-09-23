import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main (même raison que AddLiturgicalPeriod : `migration:generate`
// remonte du bruit sans rapport sur d'autres tables) — ne crée que
// `tariffs` (liturgy/entities/tariff.entity.ts).
export class AddTariffs1789484530515 implements MigrationInterface {
  name = 'AddTariffs1789484530515';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `tariffs` (`id` varchar(36) NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), `created_by` varchar(255) NULL, `updated_by` varchar(255) NULL, `deleted_at` timestamp(6) NULL, `amount` decimal(12,2) NOT NULL, `active` tinyint NOT NULL DEFAULT 1, `church_id` varchar(255) NOT NULL, `type_id` varchar(255) NOT NULL, `code` varchar(255) NOT NULL, INDEX `IDX_tariffs_church_id` (`church_id`), INDEX `IDX_tariffs_type_id` (`type_id`), UNIQUE INDEX `IDX_tariffs_church_type` (`church_id`, `type_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
    await queryRunner.query(
      'ALTER TABLE `tariffs` ADD CONSTRAINT `FK_tariffs_church_id` FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `tariffs` ADD CONSTRAINT `FK_tariffs_type_id` FOREIGN KEY (`type_id`) REFERENCES `types`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `tariffs` DROP FOREIGN KEY `FK_tariffs_type_id`');
    await queryRunner.query('ALTER TABLE `tariffs` DROP FOREIGN KEY `FK_tariffs_church_id`');
    await queryRunner.query('DROP TABLE `tariffs`');
  }
}
