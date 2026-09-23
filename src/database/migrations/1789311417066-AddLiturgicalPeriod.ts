import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main : `migration:generate` incluait des dizaines d'ALTER sans
// rapport (drift de schéma préexistant sur d'autres tables) — ne garder que
// la création de `liturgical_periods` (content/liturgical-period.entity.ts).
export class AddLiturgicalPeriod1789311417066 implements MigrationInterface {
  name = 'AddLiturgicalPeriod1789311417066';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `liturgical_periods` (`id` varchar(36) NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), `created_by` varchar(255) NULL, `updated_by` varchar(255) NULL, `deleted_at` timestamp(6) NULL, `name` varchar(255) NOT NULL, `season` enum ('ORDINARY', 'LENT', 'ADVENT', 'PATRON_FEAST') NOT NULL, `start_date` date NOT NULL, `end_date` date NOT NULL, `code` varchar(255) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `liturgical_periods`');
  }
}
