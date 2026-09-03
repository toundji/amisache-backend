import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentAndLiturgyModules1788422079117 implements MigrationInterface {
    name = 'AddPaymentAndLiturgyModules1788422079117'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`payment_methods\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`operator\` enum ('MTN_MOMO', 'MOOV_MONEY', 'BANK_CARD') NOT NULL, \`phone\` varchar(255) NOT NULL, \`account_name\` varchar(255) NOT NULL, \`active\` tinyint NOT NULL DEFAULT 1, \`church_id\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, INDEX \`IDX_9137ed00d5cc6f1c1039de8847\` (\`church_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`payments\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`amount\` decimal(12,2) NOT NULL, \`operator\` enum ('MTN_MOMO', 'MOOV_MONEY', 'BANK_CARD') NOT NULL, \`reference\` varchar(255) NOT NULL, \`receipt_image\` varchar(255) NOT NULL, \`paid_at\` date NOT NULL, \`status\` enum ('SUBMITTED', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'SUBMITTED', \`confirmed_at\` datetime NULL, \`payment_method_id\` varchar(255) NOT NULL, \`confirmed_by_id\` varchar(255) NULL, \`code\` varchar(255) NOT NULL, INDEX \`IDX_12fd861c33c885f01b9a7da7d9\` (\`payment_method_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`donations\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`amount\` decimal(12,2) NOT NULL, \`date\` datetime NOT NULL, \`church_id\` varchar(255) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`type_id\` varchar(255) NOT NULL, \`payment_id\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, INDEX \`IDX_86bfa353a3c46d5bb70655df41\` (\`church_id\`), INDEX \`IDX_e0a522570e35074125c86d817e\` (\`user_id\`), INDEX \`IDX_fd5c923b2321e53bf4e0d6ac83\` (\`type_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`schedules\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`frequency\` enum ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ONCE') NOT NULL, \`day_of_week\` tinyint NULL, \`week_of_month\` tinyint NULL, \`time\` time NOT NULL, \`duration\` int NOT NULL, \`language\` varchar(10) NULL, \`season\` enum ('ORDINARY', 'LENT', 'ADVENT', 'PATRON_FEAST') NOT NULL DEFAULT 'ORDINARY', \`start_date\` date NULL, \`end_date\` date NULL, \`church_id\` varchar(255) NOT NULL, \`type_id\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, INDEX \`IDX_e0e27a9bee939c5aded099d9ad\` (\`church_id\`), INDEX \`IDX_eff15b897c3104e92d16db4a8e\` (\`type_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`requests\` (\`id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` varchar(255) NULL, \`updated_by\` varchar(255) NULL, \`deleted_at\` timestamp(6) NULL, \`date\` date NOT NULL, \`text\` text NULL, \`offering\` decimal(12,2) NULL, \`attachments\` text NULL, \`status\` enum ('SUBMITTED', 'IN_PROGRESS', 'CONFIRMED', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'SUBMITTED', \`church_id\` varchar(255) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`schedule_id\` varchar(255) NULL, \`type_id\` varchar(255) NOT NULL, \`payment_id\` varchar(255) NULL, \`code\` varchar(255) NOT NULL, INDEX \`IDX_5d16e2d5f41521d13184e125c6\` (\`church_id\`), INDEX \`IDX_9e5e2eb56e3837b43e5a547be2\` (\`user_id\`), INDEX \`IDX_155cdafb15c49efbe52d7a318c\` (\`type_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`payment_methods\` ADD CONSTRAINT \`FK_9137ed00d5cc6f1c1039de8847a\` FOREIGN KEY (\`church_id\`) REFERENCES \`churches\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`payments\` ADD CONSTRAINT \`FK_12fd861c33c885f01b9a7da7d93\` FOREIGN KEY (\`payment_method_id\`) REFERENCES \`payment_methods\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`payments\` ADD CONSTRAINT \`FK_e8fe12cc25d0796abbccc1380cf\` FOREIGN KEY (\`confirmed_by_id\`) REFERENCES \`clergy_members\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`donations\` ADD CONSTRAINT \`FK_86bfa353a3c46d5bb70655df413\` FOREIGN KEY (\`church_id\`) REFERENCES \`churches\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`donations\` ADD CONSTRAINT \`FK_e0a522570e35074125c86d817ea\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`donations\` ADD CONSTRAINT \`FK_fd5c923b2321e53bf4e0d6ac83c\` FOREIGN KEY (\`type_id\`) REFERENCES \`types\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`donations\` ADD CONSTRAINT \`FK_a58be6122a78437405b1d89524f\` FOREIGN KEY (\`payment_id\`) REFERENCES \`payments\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`schedules\` ADD CONSTRAINT \`FK_e0e27a9bee939c5aded099d9ade\` FOREIGN KEY (\`church_id\`) REFERENCES \`churches\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`schedules\` ADD CONSTRAINT \`FK_eff15b897c3104e92d16db4a8e2\` FOREIGN KEY (\`type_id\`) REFERENCES \`types\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`requests\` ADD CONSTRAINT \`FK_5d16e2d5f41521d13184e125c67\` FOREIGN KEY (\`church_id\`) REFERENCES \`churches\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`requests\` ADD CONSTRAINT \`FK_9e5e2eb56e3837b43e5a547be23\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`requests\` ADD CONSTRAINT \`FK_5a3179501cf5c2d89328a4817b8\` FOREIGN KEY (\`schedule_id\`) REFERENCES \`schedules\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`requests\` ADD CONSTRAINT \`FK_155cdafb15c49efbe52d7a318c5\` FOREIGN KEY (\`type_id\`) REFERENCES \`types\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`requests\` ADD CONSTRAINT \`FK_b4ef6b6abc3c9ca5c2f9a3382e9\` FOREIGN KEY (\`payment_id\`) REFERENCES \`payments\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`requests\` DROP FOREIGN KEY \`FK_b4ef6b6abc3c9ca5c2f9a3382e9\``);
        await queryRunner.query(`ALTER TABLE \`requests\` DROP FOREIGN KEY \`FK_155cdafb15c49efbe52d7a318c5\``);
        await queryRunner.query(`ALTER TABLE \`requests\` DROP FOREIGN KEY \`FK_5a3179501cf5c2d89328a4817b8\``);
        await queryRunner.query(`ALTER TABLE \`requests\` DROP FOREIGN KEY \`FK_9e5e2eb56e3837b43e5a547be23\``);
        await queryRunner.query(`ALTER TABLE \`requests\` DROP FOREIGN KEY \`FK_5d16e2d5f41521d13184e125c67\``);
        await queryRunner.query(`ALTER TABLE \`schedules\` DROP FOREIGN KEY \`FK_eff15b897c3104e92d16db4a8e2\``);
        await queryRunner.query(`ALTER TABLE \`schedules\` DROP FOREIGN KEY \`FK_e0e27a9bee939c5aded099d9ade\``);
        await queryRunner.query(`ALTER TABLE \`donations\` DROP FOREIGN KEY \`FK_a58be6122a78437405b1d89524f\``);
        await queryRunner.query(`ALTER TABLE \`donations\` DROP FOREIGN KEY \`FK_fd5c923b2321e53bf4e0d6ac83c\``);
        await queryRunner.query(`ALTER TABLE \`donations\` DROP FOREIGN KEY \`FK_e0a522570e35074125c86d817ea\``);
        await queryRunner.query(`ALTER TABLE \`donations\` DROP FOREIGN KEY \`FK_86bfa353a3c46d5bb70655df413\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP FOREIGN KEY \`FK_e8fe12cc25d0796abbccc1380cf\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP FOREIGN KEY \`FK_12fd861c33c885f01b9a7da7d93\``);
        await queryRunner.query(`ALTER TABLE \`payment_methods\` DROP FOREIGN KEY \`FK_9137ed00d5cc6f1c1039de8847a\``);
        await queryRunner.query(`DROP INDEX \`IDX_155cdafb15c49efbe52d7a318c\` ON \`requests\``);
        await queryRunner.query(`DROP INDEX \`IDX_9e5e2eb56e3837b43e5a547be2\` ON \`requests\``);
        await queryRunner.query(`DROP INDEX \`IDX_5d16e2d5f41521d13184e125c6\` ON \`requests\``);
        await queryRunner.query(`DROP TABLE \`requests\``);
        await queryRunner.query(`DROP INDEX \`IDX_eff15b897c3104e92d16db4a8e\` ON \`schedules\``);
        await queryRunner.query(`DROP INDEX \`IDX_e0e27a9bee939c5aded099d9ad\` ON \`schedules\``);
        await queryRunner.query(`DROP TABLE \`schedules\``);
        await queryRunner.query(`DROP INDEX \`IDX_fd5c923b2321e53bf4e0d6ac83\` ON \`donations\``);
        await queryRunner.query(`DROP INDEX \`IDX_e0a522570e35074125c86d817e\` ON \`donations\``);
        await queryRunner.query(`DROP INDEX \`IDX_86bfa353a3c46d5bb70655df41\` ON \`donations\``);
        await queryRunner.query(`DROP TABLE \`donations\``);
        await queryRunner.query(`DROP INDEX \`IDX_12fd861c33c885f01b9a7da7d9\` ON \`payments\``);
        await queryRunner.query(`DROP TABLE \`payments\``);
        await queryRunner.query(`DROP INDEX \`IDX_9137ed00d5cc6f1c1039de8847\` ON \`payment_methods\``);
        await queryRunner.query(`DROP TABLE \`payment_methods\``);
    }

}
