import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main (même raison que AddTypeRequestRules — `migration:generate`
// remonte du bruit sans rapport sur d'autres tables). Assistant LLM du chat
// (chatbot-llm-spec.md) : escalade d'une conversation vers un humain
// (clergé d'une paroisse ou équipe Amisache) + trace technique des réponses
// du bot sur le message lui-même.
export class AddChatAssistant1790150000000 implements MigrationInterface {
  name = 'AddChatAssistant1790150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `chat_conversations` ADD `escalated_at` datetime NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `chat_conversations` ADD `escalation_reason` text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `chat_conversations` ADD `escalated_church_id` varchar(255) NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `chat_messages` ADD `meta` longtext COLLATE utf8mb4_bin NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `chat_messages` DROP COLUMN `meta`');
    await queryRunner.query('ALTER TABLE `chat_conversations` DROP COLUMN `escalated_church_id`');
    await queryRunner.query('ALTER TABLE `chat_conversations` DROP COLUMN `escalation_reason`');
    await queryRunner.query('ALTER TABLE `chat_conversations` DROP COLUMN `escalated_at`');
  }
}
