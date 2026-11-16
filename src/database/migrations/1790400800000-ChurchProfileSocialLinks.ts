import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main : liens des réseaux de l'église (YouTube, Facebook, WhatsApp, Telegram),
// facultatifs, affichés sur sa fiche publique.
export class ChurchProfileSocialLinks1790400800000 implements MigrationInterface {
  name = 'ChurchProfileSocialLinks1790400800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `church_profiles` ' +
        'ADD `youtube` varchar(500) NULL, ' +
        'ADD `facebook` varchar(500) NULL, ' +
        'ADD `whatsapp` varchar(500) NULL, ' +
        'ADD `telegram` varchar(500) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `church_profiles` DROP COLUMN `telegram`, DROP COLUMN `whatsapp`, DROP COLUMN `facebook`, DROP COLUMN `youtube`',
    );
  }
}
