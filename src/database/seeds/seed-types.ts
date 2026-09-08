// ============================================================
// seed-types.ts
// Table de types mutualisée (types/), discriminée par TypeScope.
// Données de référence indispensables : sans elles, impossible de
// créer un horaire, une demande, un don ou une publication.
//
// Clé unique (scope, name) → seed naturellement idempotent.
// Append-only : on n'efface JAMAIS un type (FK onDelete RESTRICT côté
// Schedule/Request/Donation/Publication). `--refresh` se contente de
// réactiver les types déjà présents.
// ============================================================
import { DataSource } from 'typeorm';
import { Type } from '../../type/entities/type.entity';
import { TypeScope } from '../../type/type.enum';

const TYPES: Record<TypeScope, string[]> = {
  [TypeScope.SCHEDULE]: [
    'Messe',
    'Messe dominicale',
    'Confession',
    'Adoration eucharistique',
    'Chapelet',
    'Laudes',
    'Vêpres',
    'Chemin de croix',
    'Neuvaine',
    'Veillée de prière',
  ],
  [TypeScope.INTENTION]: [
    'Action de grâce',
    "Repos de l'âme",
    'Guérison',
    'Protection',
    'Réussite (examen / projet)',
    'Anniversaire',
    'Demande de pardon',
    'Conversion',
    'Paix dans la famille',
  ],
  [TypeScope.SACRAMENT]: [
    'Baptême',
    'Première communion',
    'Confirmation',
    'Mariage',
    'Onction des malades',
    'Réconciliation',
    'Ordination',
  ],
  [TypeScope.DONATION]: [
    'Denier du culte',
    'Quête',
    'Casuel',
    'Construction / rénovation',
    'Œuvres missionnaires',
    'Aide aux démunis',
    "Fleurs de l'autel",
    'Offrande libre',
  ],
  [TypeScope.PUBLICATION]: [
    'Annonce paroissiale',
    'Événement',
    'Homélie',
    'Album photo',
    'Vidéo',
    'Nécrologie',
    'Communiqué diocésain',
    'Horaires spéciaux',
  ],
};

export async function seedTypes(dataSource: DataSource, refresh: boolean): Promise<void> {
  const repo = dataSource.getRepository(Type);

  let created = 0;
  let reactivated = 0;
  let skipped = 0;

  for (const [scope, names] of Object.entries(TYPES) as [TypeScope, string[]][]) {
    for (const name of names) {
      const existing = await repo.findOne({ where: { scope, name } });

      if (existing) {
        if (refresh && !existing.active) {
          await repo.update(existing.id, { active: true });
          reactivated += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      await repo.save(repo.create({ name, scope, active: true }));
      created += 1;
    }
  }

  console.log(
    `Types seedés : ${created} créé(s), ${reactivated} réactivé(s), ${skipped} déjà présent(s).`,
  );
}
