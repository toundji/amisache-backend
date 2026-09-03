import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChurchModule1788420143461 implements MigrationInterface {
    name = 'AddChurchModule1788420143461'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`churches\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`type\` enum ('CONFERENCE', 'ARCHDIOCESE', 'DIOCESE', 'DOYENNE', 'PAROISSE', 'COMMUNAUTE', 'CHURCH', 'CHAPEL') NOT NULL, \`name\` varchar(255) NOT NULL, \`slug\` varchar(255) NOT NULL, \`leader_message\` text NULL, \`banner_photo\` varchar(255) NULL, \`accent_color\` varchar(7) NULL, \`default_language\` varchar(10) NULL DEFAULT 'fr', \`status\` enum ('PENDING', 'APPROVED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING', \`perimeter\` polygon NULL, \`parent_id\` varchar(255) NULL, \`country_id\` varchar(255) NULL, \`code\` varchar(255) NOT NULL, \`locality\` varchar(255) NULL, \`landmark\` varchar(255) NULL, \`location\` point NULL, \`zone_id\` varchar(255) NOT NULL, \`village_id\` varchar(255) NULL, UNIQUE INDEX \`IDX_7cf9653e300cedb022d70a7c1a\` (\`slug\`), INDEX \`IDX_6fda1840f9e521a6812dc30331\` (\`parent_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`clergy_members\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`role\` enum ('ARCHBISHOP', 'BISHOP', 'PRIEST', 'VICAR', 'DEACON', 'CATECHIST', 'SECRETARY', 'ADMIN') NOT NULL, \`start_date\` date NOT NULL, \`end_date\` date NULL, \`church_id\` varchar(255) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, INDEX \`IDX_96901e01afa7819a862bc7bfb6\` (\`church_id\`), INDEX \`IDX_9313c22d6492e3785bfa655e54\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`entrances\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`type\` enum ('VEHICLE', 'PEDESTRIAN', 'MIXED', 'SERVICE') NOT NULL, \`name\` varchar(255) NOT NULL, \`location\` point NOT NULL, \`church_id\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, INDEX \`IDX_cbca269bf6926383eec435e4f7\` (\`church_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`churches\` ADD CONSTRAINT \`FK_6fda1840f9e521a6812dc303310\` FOREIGN KEY (\`parent_id\`) REFERENCES \`churches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`churches\` ADD CONSTRAINT \`FK_5beba378bc0e7d9b4ad2a208365\` FOREIGN KEY (\`country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`clergy_members\` ADD CONSTRAINT \`FK_96901e01afa7819a862bc7bfb68\` FOREIGN KEY (\`church_id\`) REFERENCES \`churches\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`clergy_members\` ADD CONSTRAINT \`FK_9313c22d6492e3785bfa655e548\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`entrances\` ADD CONSTRAINT \`FK_cbca269bf6926383eec435e4f73\` FOREIGN KEY (\`church_id\`) REFERENCES \`churches\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`entrances\` DROP FOREIGN KEY \`FK_cbca269bf6926383eec435e4f73\``);
        await queryRunner.query(`ALTER TABLE \`clergy_members\` DROP FOREIGN KEY \`FK_9313c22d6492e3785bfa655e548\``);
        await queryRunner.query(`ALTER TABLE \`clergy_members\` DROP FOREIGN KEY \`FK_96901e01afa7819a862bc7bfb68\``);
        await queryRunner.query(`ALTER TABLE \`churches\` DROP FOREIGN KEY \`FK_5beba378bc0e7d9b4ad2a208365\``);
        await queryRunner.query(`ALTER TABLE \`churches\` DROP FOREIGN KEY \`FK_6fda1840f9e521a6812dc303310\``);
        await queryRunner.query(`DROP INDEX \`IDX_cbca269bf6926383eec435e4f7\` ON \`entrances\``);
        await queryRunner.query(`DROP TABLE \`entrances\``);
        await queryRunner.query(`DROP INDEX \`IDX_9313c22d6492e3785bfa655e54\` ON \`clergy_members\``);
        await queryRunner.query(`DROP INDEX \`IDX_96901e01afa7819a862bc7bfb6\` ON \`clergy_members\``);
        await queryRunner.query(`DROP TABLE \`clergy_members\``);
        await queryRunner.query(`DROP INDEX \`IDX_6fda1840f9e521a6812dc30331\` ON \`churches\``);
        await queryRunner.query(`DROP INDEX \`IDX_7cf9653e300cedb022d70a7c1a\` ON \`churches\``);
        await queryRunner.query(`DROP TABLE \`churches\``);
    }

}
