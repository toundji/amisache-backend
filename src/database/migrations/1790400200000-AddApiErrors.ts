import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main — trace des erreurs 5xx (ApiErrorFilter/ApiErrorLogService),
// consultable sans accès serveur, purgée automatiquement au-delà de 30 jours.
export class AddApiErrors1790400200000 implements MigrationInterface {
  name = 'AddApiErrors1790400200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`api_errors\` (
        \`id\` varchar(36) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`created_by\` varchar(255) NULL,
        \`updated_by\` varchar(255) NULL,
        \`deleted_at\` timestamp NULL DEFAULT NULL,
        \`error_id\` varchar(16) NOT NULL,
        \`status_code\` int NOT NULL,
        \`method\` varchar(255) NOT NULL,
        \`path\` varchar(255) NOT NULL,
        \`user_email\` varchar(255) NULL,
        \`ip\` varchar(255) NULL,
        \`message\` text NOT NULL,
        \`stack\` text NULL,
        UNIQUE INDEX \`IDX_api_errors_error_id\` (\`error_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `api_errors`');
  }
}
