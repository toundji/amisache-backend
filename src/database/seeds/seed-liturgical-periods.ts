// ============================================================
// seed-liturgical-periods.ts
// Référentiel du temps liturgique (content/LiturgicalPeriod) — dates de
// l'année en cours pour les saisons couvertes par LiturgicalSeason
// (ORDINARY/LENT/ADVENT ; PATRON_FEAST est propre à chaque paroisse, pas
// seedé ici). Voir EVOLUTION.md 2026-09-13 « temps liturgique ».
//
// Idempotent par `season` : une saison déjà présente n'est PAS réécrite
// (on ne veut pas perdre une date ajustée en prod). `--refresh` réécrit
// les dates aux valeurs de seed ci-dessous — à rejouer chaque année pour
// avancer les périodes (pas de calcul automatique des dates mobiles de
// Pâques, cf. LiturgicalPeriod.entity.ts).
// ============================================================
import { DataSource } from 'typeorm';
import { LiturgicalPeriod } from '../../content/entities/liturgical-period.entity';
import { LiturgicalSeason } from '../../liturgy/liturgy.enum';

interface SeedPeriod {
  name: string;
  season: LiturgicalSeason;
  startDate: string;
  endDate: string;
}

const PERIODS: SeedPeriod[] = [
  { name: 'Temps ordinaire', season: LiturgicalSeason.ORDINARY, startDate: '2026-06-01', endDate: '2026-11-28' },
  { name: 'Avent', season: LiturgicalSeason.ADVENT, startDate: '2026-11-29', endDate: '2026-12-24' },
  { name: 'Carême', season: LiturgicalSeason.LENT, startDate: '2027-02-17', endDate: '2027-04-01' },
];

export async function seedLiturgicalPeriods(dataSource: DataSource, refresh: boolean): Promise<void> {
  const repo = dataSource.getRepository(LiturgicalPeriod);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of PERIODS) {
    const existing = await repo.findOne({ where: { season: p.season } });

    if (existing) {
      if (refresh) {
        await repo.update(existing.id, { name: p.name, startDate: p.startDate, endDate: p.endDate });
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    await repo.save(repo.create(p));
    created += 1;
  }

  console.log(
    `Périodes liturgiques seedées : ${created} créée(s), ${updated} réécrite(s), ${skipped} déjà présente(s).`,
  );
}
