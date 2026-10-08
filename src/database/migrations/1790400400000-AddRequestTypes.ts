import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main — sort les types de demande (intention de messe /
// sacrement) de la table mutualisée `types` vers une table dédiée
// `request_types` (2026-09-26, voir liturgy/entities/request-type.entity.ts).
// Les lignes gardent le MÊME id lors de la copie : les FK de `requests` et
// `tariffs` restent valides sans devoir réécrire une seule ligne de données,
// il suffit de les repointer vers la nouvelle table.
export class AddRequestTypes1790400400000 implements MigrationInterface {
  name = 'AddRequestTypes1790400400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`request_types\` (
        \`id\` varchar(36) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`created_by\` varchar(255) NULL,
        \`updated_by\` varchar(255) NULL,
        \`deleted_at\` timestamp(6) NULL,
        \`name\` varchar(255) NOT NULL,
        \`scope\` enum ('INTENTION', 'SACRAMENT') NOT NULL,
        \`active\` tinyint NOT NULL DEFAULT 1,
        \`allow_home_celebration\` tinyint NOT NULL DEFAULT 0,
        \`min_lead_days\` int NOT NULL DEFAULT 2,
        \`requires_schedule_match\` tinyint NOT NULL DEFAULT 0,
        \`code\` varchar(255) NOT NULL,
        UNIQUE INDEX \`IDX_request_types_scope_name\` (\`scope\`, \`name\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    // Copie à l'identique (même id) des types INTENTION/SACRAMENT existants.
    await queryRunner.query(`
      INSERT INTO \`request_types\`
        (id, created_at, updated_at, created_by, updated_by, deleted_at,
         name, scope, active, allow_home_celebration, min_lead_days, requires_schedule_match, code)
      SELECT id, created_at, updated_at, created_by, updated_by, deleted_at,
             name, scope, active, allow_home_celebration, min_lead_days, requires_schedule_match, code
      FROM \`types\`
      WHERE scope IN ('INTENTION', 'SACRAMENT')
    `);

    // Repointe les FK existantes vers la nouvelle table (mêmes id, aucune donnée à réécrire).
    await queryRunner.query('ALTER TABLE `requests` DROP FOREIGN KEY `FK_155cdafb15c49efbe52d7a318c5`');
    await queryRunner.query(
      'ALTER TABLE `requests` ADD CONSTRAINT `FK_155cdafb15c49efbe52d7a318c5` FOREIGN KEY (`type_id`) REFERENCES `request_types`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION',
    );

    await queryRunner.query('ALTER TABLE `tariffs` DROP FOREIGN KEY `FK_tariffs_type_id`');
    await queryRunner.query(
      'ALTER TABLE `tariffs` ADD CONSTRAINT `FK_tariffs_type_id` FOREIGN KEY (`type_id`) REFERENCES `request_types`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );

    // Les lignes ont migré — plus besoin de les garder dans `types`.
    await queryRunner.query("DELETE FROM `types` WHERE scope IN ('INTENTION', 'SACRAMENT')");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rapatrie les lignes dans `types` (même id) avant de supprimer `request_types`.
    await queryRunner.query(`
      INSERT INTO \`types\`
        (id, created_at, updated_at, created_by, updated_by, deleted_at,
         name, scope, active, allow_home_celebration, min_lead_days, requires_schedule_match, code)
      SELECT id, created_at, updated_at, created_by, updated_by, deleted_at,
             name, scope, active, allow_home_celebration, min_lead_days, requires_schedule_match, code
      FROM \`request_types\`
    `);

    await queryRunner.query('ALTER TABLE `tariffs` DROP FOREIGN KEY `FK_tariffs_type_id`');
    await queryRunner.query(
      'ALTER TABLE `tariffs` ADD CONSTRAINT `FK_tariffs_type_id` FOREIGN KEY (`type_id`) REFERENCES `types`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );

    await queryRunner.query('ALTER TABLE `requests` DROP FOREIGN KEY `FK_155cdafb15c49efbe52d7a318c5`');
    await queryRunner.query(
      'ALTER TABLE `requests` ADD CONSTRAINT `FK_155cdafb15c49efbe52d7a318c5` FOREIGN KEY (`type_id`) REFERENCES `types`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION',
    );

    await queryRunner.query('DROP TABLE `request_types`');
  }
}
