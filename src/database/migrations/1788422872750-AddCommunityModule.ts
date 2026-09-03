import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCommunityModule1788422872750 implements MigrationInterface {
    name = 'AddCommunityModule1788422872750'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`groups\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`name\` varchar(255) NOT NULL, \`type\` enum ('CHOIR', 'MOVEMENT', 'ASSOCIATION', 'OTHER') NOT NULL, \`church_id\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, INDEX \`IDX_45b11fb16e1de8a734953d2c36\` (\`church_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`group_members\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`group_id\` varchar(255) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, INDEX \`IDX_2c840df5db52dc6b4a1b0b69c6\` (\`group_id\`), INDEX \`IDX_20a555b299f75843aa53ff8b0e\` (\`user_id\`), UNIQUE INDEX \`IDX_f5939ee0ad233ad35e03f5c65c\` (\`user_id\`, \`group_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`publications\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`title\` varchar(255) NOT NULL, \`content\` text NOT NULL, \`published_at\` datetime NULL, \`status\` enum ('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT', \`start_date\` date NULL, \`end_date\` date NULL, \`church_id\` varchar(255) NOT NULL, \`group_id\` varchar(255) NULL, \`type_id\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, INDEX \`IDX_48bcdf029a1d2c92659b1eb6c7\` (\`church_id\`), INDEX \`IDX_7c318bbdf047cfb4941e112004\` (\`type_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`media\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`kind\` enum ('VIDEO', 'IMAGE', 'AUDIO') NOT NULL, \`provider\` enum ('YOUTUBE', 'UPLOAD', 'FACEBOOK', 'OTHER') NOT NULL, \`url\` varchar(255) NOT NULL, \`publication_id\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, INDEX \`IDX_c9de402f13413c92ab4f450f84\` (\`publication_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`groups\` ADD CONSTRAINT \`FK_45b11fb16e1de8a734953d2c363\` FOREIGN KEY (\`church_id\`) REFERENCES \`churches\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`group_members\` ADD CONSTRAINT \`FK_2c840df5db52dc6b4a1b0b69c6e\` FOREIGN KEY (\`group_id\`) REFERENCES \`groups\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`group_members\` ADD CONSTRAINT \`FK_20a555b299f75843aa53ff8b0ee\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`publications\` ADD CONSTRAINT \`FK_48bcdf029a1d2c92659b1eb6c7b\` FOREIGN KEY (\`church_id\`) REFERENCES \`churches\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`publications\` ADD CONSTRAINT \`FK_4cae2b1d4a3f2fdec40ac2c810a\` FOREIGN KEY (\`group_id\`) REFERENCES \`groups\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`publications\` ADD CONSTRAINT \`FK_7c318bbdf047cfb4941e112004c\` FOREIGN KEY (\`type_id\`) REFERENCES \`types\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`media\` ADD CONSTRAINT \`FK_c9de402f13413c92ab4f450f844\` FOREIGN KEY (\`publication_id\`) REFERENCES \`publications\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`media\` DROP FOREIGN KEY \`FK_c9de402f13413c92ab4f450f844\``);
        await queryRunner.query(`ALTER TABLE \`publications\` DROP FOREIGN KEY \`FK_7c318bbdf047cfb4941e112004c\``);
        await queryRunner.query(`ALTER TABLE \`publications\` DROP FOREIGN KEY \`FK_4cae2b1d4a3f2fdec40ac2c810a\``);
        await queryRunner.query(`ALTER TABLE \`publications\` DROP FOREIGN KEY \`FK_48bcdf029a1d2c92659b1eb6c7b\``);
        await queryRunner.query(`ALTER TABLE \`group_members\` DROP FOREIGN KEY \`FK_20a555b299f75843aa53ff8b0ee\``);
        await queryRunner.query(`ALTER TABLE \`group_members\` DROP FOREIGN KEY \`FK_2c840df5db52dc6b4a1b0b69c6e\``);
        await queryRunner.query(`ALTER TABLE \`groups\` DROP FOREIGN KEY \`FK_45b11fb16e1de8a734953d2c363\``);
        await queryRunner.query(`DROP INDEX \`IDX_c9de402f13413c92ab4f450f84\` ON \`media\``);
        await queryRunner.query(`DROP TABLE \`media\``);
        await queryRunner.query(`DROP INDEX \`IDX_7c318bbdf047cfb4941e112004\` ON \`publications\``);
        await queryRunner.query(`DROP INDEX \`IDX_48bcdf029a1d2c92659b1eb6c7\` ON \`publications\``);
        await queryRunner.query(`DROP TABLE \`publications\``);
        await queryRunner.query(`DROP INDEX \`IDX_f5939ee0ad233ad35e03f5c65c\` ON \`group_members\``);
        await queryRunner.query(`DROP INDEX \`IDX_20a555b299f75843aa53ff8b0e\` ON \`group_members\``);
        await queryRunner.query(`DROP INDEX \`IDX_2c840df5db52dc6b4a1b0b69c6\` ON \`group_members\``);
        await queryRunner.query(`DROP TABLE \`group_members\``);
        await queryRunner.query(`DROP INDEX \`IDX_45b11fb16e1de8a734953d2c36\` ON \`groups\``);
        await queryRunner.query(`DROP TABLE \`groups\``);
    }

}
