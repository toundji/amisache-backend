// ============================================================
// seed-tariffs.ts
// Tarifs de démonstration (liturgy/Tariff) — sans ça, le repli
// hiérarchique de TariffService.resolve (EVOLUTION.md, 2026-09-15) n'a
// jamais l'occasion de s'exercer : aucune église de démo n'a de tarif,
// le montant reste toujours libre côté /demandes.
//
// Jeu de données choisi pour exercer les trois cas du repli, pas
// seulement le cas trivial (tarif propre) :
//   - conference-episcopale-du-benin  : tarif national, dernier recours
//     (« Guérison » — plancher pour toute paroisse dont AUCUN ancêtre
//     plus proche n'a rien défini).
//   - archidiocese-cotonou            : tarifs propres à l'archidiocèse,
//     hérités par ses paroisses qui n'ont rien défini elles-mêmes.
//   - notre-dame-des-apotres          : tarif PROPRE qui doit l'emporter
//     sur celui, plus général, de son archidiocèse (même type) —
//     démontre que le plus spécifique gagne, pas seulement le plus proche
//     dans l'ordre de résolution.
//   - sainte-anne-abomey-calavi       : AUCUN tarif propre, rattachée
//     directement à l'archidiocèse (pas de doyenné intermédiaire) — hérite
//     tel quel de l'archidiocèse pour « Action de grâce »/« Repos de
//     l'âme », et remonte jusqu'à la conférence pour « Guérison »
//     (l'archidiocèse n'a rien défini pour ce type précis).
//   - saint-paul-ouidah               : sous diocese-porto-novo, qui n'a
//     lui-même AUCUN tarif — hérite du plancher national pour
//     « Guérison », mais reste à montant libre pour « Action de grâce »
//     (aucun ancêtre n'a rien défini pour ce type-là).
//
// Indépendant de seed-churches.ts/seed-types.ts : résout chaque église par
// son slug et chaque type par (scope, name), comme les autres seeds
// additifs de ce projet — no-op silencieux si une cible est absente.
//
// Idempotent par (churchId, typeId) : un tarif déjà présent n'est pas
// dupliqué/écrasé (un clergé a pu l'ajuster depuis). `--refresh` n'efface
// rien ici, même logique que seed-payment-methods.ts.
// ============================================================
import { DataSource } from 'typeorm';
import { Church } from '../../church/entities/church.entity';
import { Type } from '../../type/entities/type.entity';
import { TypeScope } from '../../type/type.enum';
import { Tariff } from '../../liturgy/entities/tariff.entity';

interface SeedTariff {
  churchSlug: string;
  typeScope: TypeScope;
  typeName: string;
  amount: number;
}

const CONFERENCE_SLUG = 'conference-episcopale-du-benin';

const TARIFFS: SeedTariff[] = [
  // Plancher national — dernier recours de la résolution.
  { churchSlug: CONFERENCE_SLUG, typeScope: TypeScope.INTENTION, typeName: 'Guérison', amount: 1000 },

  // Tarifs de l'archidiocèse de Cotonou — hérités par ses paroisses.
  { churchSlug: 'archidiocese-cotonou', typeScope: TypeScope.INTENTION, typeName: 'Action de grâce', amount: 3000 },
  { churchSlug: 'archidiocese-cotonou', typeScope: TypeScope.INTENTION, typeName: "Repos de l'âme", amount: 2000 },
  { churchSlug: 'archidiocese-cotonou', typeScope: TypeScope.SACRAMENT, typeName: 'Baptême', amount: 5000 },

  // Tarif propre — doit l'emporter sur celui de l'archidiocèse (même type).
  { churchSlug: 'notre-dame-des-apotres', typeScope: TypeScope.INTENTION, typeName: 'Action de grâce', amount: 2500 },
];

export async function seedTariffs(dataSource: DataSource): Promise<void> {
  const churchRepo = dataSource.getRepository(Church);
  const typeRepo = dataSource.getRepository(Type);
  const tariffRepo = dataSource.getRepository(Tariff);

  let created = 0;
  let skippedMissingChurch = 0;
  let skippedMissingType = 0;
  let skippedExisting = 0;

  for (const t of TARIFFS) {
    const church = await churchRepo.findOneBy({ slug: t.churchSlug });
    if (!church) {
      skippedMissingChurch += 1;
      continue;
    }

    const type = await typeRepo.findOneBy({ scope: t.typeScope, name: t.typeName });
    if (!type) {
      skippedMissingType += 1;
      continue;
    }

    const existing = await tariffRepo.findOne({ where: { churchId: church.id, typeId: type.id } });
    if (existing) {
      skippedExisting += 1;
      continue;
    }

    await tariffRepo.save(
      tariffRepo.create({ churchId: church.id, typeId: type.id, amount: t.amount.toFixed(2) }),
    );
    created += 1;
  }

  console.log(
    `Tarifs de démo seedés : ${created} créé(s), ${skippedExisting} déjà présent(s), ${skippedMissingChurch} ignoré(s) (église absente), ${skippedMissingType} ignoré(s) (type absent) — lancez seed:churches/seed:types d'abord au besoin.`,
  );
}
