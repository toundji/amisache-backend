import { MigrationInterface, QueryRunner } from "typeorm";

export class ExtendUserAndAddMembership1788420967627 implements MigrationInterface {
    name = 'ExtendUserAndAddMembership1788420967627'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`memberships\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`since\` date NOT NULL, \`church_id\` varchar(255) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, INDEX \`IDX_83a94afc7629fa3019747c7cf3\` (\`church_id\`), INDEX \`IDX_7c1e2fdfed4f6838e0c05ae505\` (\`user_id\`), UNIQUE INDEX \`IDX_05862d37651c9b6ff7eee13d5c\` (\`user_id\`, \`church_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`phone\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`home_church_id\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`roles\` \`roles\` set ('user', 'manager', 'admin', 'engineer', 'clergy') NOT NULL DEFAULT 'user'`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD CONSTRAINT \`FK_114a230d6a89d48003d43fd9d68\` FOREIGN KEY (\`id_country\`) REFERENCES \`countries\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`memberships\` ADD CONSTRAINT \`FK_83a94afc7629fa3019747c7cf3c\` FOREIGN KEY (\`church_id\`) REFERENCES \`churches\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`memberships\` ADD CONSTRAINT \`FK_7c1e2fdfed4f6838e0c05ae5051\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`memberships\` DROP FOREIGN KEY \`FK_7c1e2fdfed4f6838e0c05ae5051\``);
        await queryRunner.query(`ALTER TABLE \`memberships\` DROP FOREIGN KEY \`FK_83a94afc7629fa3019747c7cf3c\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_114a230d6a89d48003d43fd9d68\``);
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`roles\` \`roles\` set ('user', 'agent', 'investor', 'manager', 'admin', 'engineer') NOT NULL DEFAULT 'user'`);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`home_church_id\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`phone\``);
        await queryRunner.query(`DROP INDEX \`IDX_05862d37651c9b6ff7eee13d5c\` ON \`memberships\``);
        await queryRunner.query(`DROP INDEX \`IDX_7c1e2fdfed4f6838e0c05ae505\` ON \`memberships\``);
        await queryRunner.query(`DROP INDEX \`IDX_83a94afc7629fa3019747c7cf3\` ON \`memberships\``);
        await queryRunner.query(`DROP TABLE \`memberships\``);
    }

}
