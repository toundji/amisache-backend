import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main — choix cliquables (réponses rapides) sous un message du bot.
export class AddChatMessageOptions1790400100000 implements MigrationInterface {
  name = 'AddChatMessageOptions1790400100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `chat_messages` ADD `options` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `chat_messages` DROP COLUMN `options`');
  }
}
