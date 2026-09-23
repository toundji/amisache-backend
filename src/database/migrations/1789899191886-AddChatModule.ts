import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main (même raison que AddTariffs/AddChurchProfiles —
// `migration:generate` remonte du bruit sans rapport sur d'autres tables).
// Le module chat/ (conversations/participants/messages/attachments) existait
// en code depuis le socle UNIFIED AUTH mais n'avait jamais été migré — cette
// migration crée les 4 tables avec les enums déjà adaptés à Amisache
// (ParticipantRole FAITHFUL/CLERGY, ActorType +GUEST pour le widget public),
// cf. EVOLUTION.md et chat/chat.enum.ts.
export class AddChatModule1789899191886 implements MigrationInterface {
  name = 'AddChatModule1789899191886';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `chat_conversations` (" +
        '`id` varchar(36) NOT NULL, ' +
        '`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
        '`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), ' +
        '`created_by` varchar(255) NULL, ' +
        '`updated_by` varchar(255) NULL, ' +
        '`deleted_at` timestamp(6) NULL, ' +
        '`subject_type` varchar(255) NULL, ' +
        '`subject_id` varchar(255) NULL, ' +
        "`status` enum('OPEN','PENDING','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN', " +
        "`mode` enum('BOT','AGENT') NOT NULL DEFAULT 'AGENT', " +
        '`last_message_at` datetime NULL, ' +
        '`last_message_preview` varchar(255) NULL, ' +
        '`last_message_sender_id` varchar(255) NULL, ' +
        '`closed_at` datetime NULL, ' +
        'INDEX `IDX_chat_conversations_subject` (`subject_type`, `subject_id`), ' +
        'INDEX `IDX_chat_conversations_last_message_at` (`last_message_at`), ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    );

    await queryRunner.query(
      'CREATE TABLE `chat_participants` (' +
        '`id` varchar(36) NOT NULL, ' +
        '`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
        '`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), ' +
        '`created_by` varchar(255) NULL, ' +
        '`updated_by` varchar(255) NULL, ' +
        '`deleted_at` timestamp(6) NULL, ' +
        '`conversation_id` varchar(255) NOT NULL, ' +
        '`actor_id` varchar(255) NOT NULL, ' +
        "`actor_type` enum('HUMAN','GUEST','AI','SYSTEM') NOT NULL, " +
        "`role` enum('OWNER','MEMBER','FAITHFUL','CLERGY') NOT NULL, " +
        '`joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        '`left_at` datetime NULL, ' +
        '`last_read_at` datetime NULL, ' +
        'INDEX `IDX_chat_participants_actor_left` (`actor_id`, `left_at`), ' +
        'INDEX `IDX_chat_participants_conversation_id` (`conversation_id`), ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'ALTER TABLE `chat_participants` ADD CONSTRAINT `FK_chat_participants_conversation_id` ' +
        'FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );

    await queryRunner.query(
      'CREATE TABLE `chat_messages` (' +
        '`id` varchar(36) NOT NULL, ' +
        '`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
        '`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), ' +
        '`created_by` varchar(255) NULL, ' +
        '`updated_by` varchar(255) NULL, ' +
        '`deleted_at` timestamp(6) NULL, ' +
        '`conversation_id` varchar(255) NOT NULL, ' +
        '`sender_id` varchar(255) NULL, ' +
        "`sender_type` enum('HUMAN','GUEST','AI','SYSTEM') NOT NULL, " +
        "`kind` enum('TEXT','MEDIA','CALL','SYSTEM') NOT NULL DEFAULT 'TEXT', " +
        '`body` longtext NULL, ' +
        '`reply_to` varchar(255) NULL, ' +
        '`delivered_at` datetime NULL, ' +
        '`read_at` datetime NULL, ' +
        '`failed_at` datetime NULL, ' +
        '`content_deleted_at` datetime NULL, ' +
        'INDEX `IDX_chat_messages_conversation_created` (`conversation_id`, `created_at`), ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'ALTER TABLE `chat_messages` ADD CONSTRAINT `FK_chat_messages_conversation_id` ' +
        'FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `chat_messages` ADD CONSTRAINT `FK_chat_messages_reply_to` ' +
        'FOREIGN KEY (`reply_to`) REFERENCES `chat_messages`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
    );

    await queryRunner.query(
      'CREATE TABLE `chat_attachments` (' +
        '`id` varchar(36) NOT NULL, ' +
        '`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
        '`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), ' +
        '`created_by` varchar(255) NULL, ' +
        '`updated_by` varchar(255) NULL, ' +
        '`deleted_at` timestamp(6) NULL, ' +
        '`message_id` varchar(255) NOT NULL, ' +
        "`kind` enum('IMAGE','AUDIO','VIDEO','FILE') NOT NULL, " +
        '`url` varchar(255) NOT NULL, ' +
        '`meta` longtext COLLATE utf8mb4_bin NULL, ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'ALTER TABLE `chat_attachments` ADD CONSTRAINT `FK_chat_attachments_message_id` ' +
        'FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `chat_attachments` DROP FOREIGN KEY `FK_chat_attachments_message_id`');
    await queryRunner.query('DROP TABLE `chat_attachments`');

    await queryRunner.query('ALTER TABLE `chat_messages` DROP FOREIGN KEY `FK_chat_messages_reply_to`');
    await queryRunner.query('ALTER TABLE `chat_messages` DROP FOREIGN KEY `FK_chat_messages_conversation_id`');
    await queryRunner.query('DROP TABLE `chat_messages`');

    await queryRunner.query('ALTER TABLE `chat_participants` DROP FOREIGN KEY `FK_chat_participants_conversation_id`');
    await queryRunner.query('DROP TABLE `chat_participants`');

    await queryRunner.query('DROP TABLE `chat_conversations`');
  }
}
