// ============================================================
// seed-request-types.ts
// Table dédiée aux types de demande (request_types/), sortie de la table
// mutualisée `types` le 2026-09-26 — voir liturgy/entities/request-type.entity.ts.
// Données de référence indispensables : sans elles, impossible de créer
// une demande (intention de messe / sacrement).
//
// Clé unique (scope, name) → seed naturellement idempotent.
// Append-only : on n'efface JAMAIS un type (FK Request/Tariff onDelete
// RESTRICT/CASCADE). `--refresh` se contente de réactiver les types déjà présents.
// ============================================================
import { DataSource } from 'typeorm';
import { RequestType } from '../../liturgy/entities/request-type.entity';
import { RequestTypeScope } from '../../liturgy/request-type.enum';

const REQUEST_TYPES: Record<RequestTypeScope, string[]> = {
  [RequestTypeScope.INTENTION]: [
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
  [RequestTypeScope.SACRAMENT]: [
    'Baptême',
    'Première communion',
    'Confirmation',
    'Mariage',
    'Onction des malades',
    'Réconciliation',
    'Ordination',
  ],
};

export async function seedRequestTypes(dataSource: DataSource, refresh: boolean): Promise<void> {
  const repo = dataSource.getRepository(RequestType);

  let created = 0;
  let reactivated = 0;
  let skipped = 0;

  for (const [scope, names] of Object.entries(REQUEST_TYPES) as [RequestTypeScope, string[]][]) {
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
    `Types de demande seedés : ${created} créé(s), ${reactivated} réactivé(s), ${skipped} déjà présent(s).`,
  );
}
