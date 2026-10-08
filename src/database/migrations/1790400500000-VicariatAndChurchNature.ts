import { MigrationInterface, QueryRunner } from 'typeorm';

// Écrite à la main (2026-09-26) :
//   - le niveau DOYENNE devient VICARIAT (renommage de la valeur d'enum,
//     les lignes existantes sont converties) ;
//   - nouvel attribut `nature` (PHYSICAL / VIRTUAL), rempli d'après le type
//     — voir defaultNatureFor dans church/church.enum.ts.
export class VicariatAndChurchNature1790400500000 implements MigrationInterface {
  name = 'VicariatAndChurchNature1790400500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `churches` MODIFY `type` enum ('CONFERENCE', 'ARCHDIOCESE', 'DIOCESE', 'DOYENNE', 'VICARIAT', 'PAROISSE', 'COMMUNAUTE', 'CHURCH', 'CHAPEL') NOT NULL",
    );
    await queryRunner.query("UPDATE `churches` SET `type` = 'VICARIAT' WHERE `type` = 'DOYENNE'");
    await queryRunner.query(
      "ALTER TABLE `churches` MODIFY `type` enum ('CONFERENCE', 'ARCHDIOCESE', 'DIOCESE', 'VICARIAT', 'PAROISSE', 'COMMUNAUTE', 'CHURCH', 'CHAPEL') NOT NULL",
    );

    await queryRunner.query(
      "ALTER TABLE `churches` ADD `nature` enum ('PHYSICAL', 'VIRTUAL') NOT NULL DEFAULT 'VIRTUAL'",
    );
    await queryRunner.query(
      "UPDATE `churches` SET `nature` = 'PHYSICAL' WHERE `type` IN ('ARCHDIOCESE', 'PAROISSE', 'CHURCH', 'CHAPEL')",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `churches` DROP COLUMN `nature`');
    await queryRunner.query(
      "ALTER TABLE `churches` MODIFY `type` enum ('CONFERENCE', 'ARCHDIOCESE', 'DIOCESE', 'DOYENNE', 'VICARIAT', 'PAROISSE', 'COMMUNAUTE', 'CHURCH', 'CHAPEL') NOT NULL",
    );
    await queryRunner.query("UPDATE `churches` SET `type` = 'DOYENNE' WHERE `type` = 'VICARIAT'");
    await queryRunner.query(
      "ALTER TABLE `churches` MODIFY `type` enum ('CONFERENCE', 'ARCHDIOCESE', 'DIOCESE', 'DOYENNE', 'PAROISSE', 'COMMUNAUTE', 'CHURCH', 'CHAPEL') NOT NULL",
    );
  }
}
