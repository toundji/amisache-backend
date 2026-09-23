// ============================================================
// seed-groups.ts
// Groupes de démonstration (community/Group) — sans ça, le bloc
// « Rejoindre un groupe » du portail public affiche systématiquement
// son état vide (voir EVOLUTION.md client, 2026-09-13, GroupService.stats).
//
// Indépendant de seed-churches.ts : résout chaque église par son slug
// via une requête directe (churchRepo.findOneBy), plutôt que de dépendre
// de son état interne — reste utilisable même si seed-churches.ts a été
// sauté (no-op silencieux si une église cible est absente).
//
// Idempotent par (churchId, name) : un groupe déjà présent n'est pas
// dupliqué. `--refresh` n'efface rien ici (pas de risque de perte d'une
// inscription réelle de fidèle à un groupe existant) — relancer sans
// argument suffit à compléter ce qui manque.
// ============================================================
import { DataSource } from 'typeorm';
import { Church } from '../../church/entities/church.entity';
import { Group } from '../../community/entities/group.entity';
import { GroupType } from '../../community/community.enum';

interface SeedGroup {
  name: string;
  type: GroupType;
  churchSlug: string;
}

const GROUPS: SeedGroup[] = [
  { name: 'Chorale Sainte-Cécile', type: GroupType.CHOIR, churchSlug: 'cathedrale-notre-dame-cotonou' },
  { name: 'Chorale des Jeunes', type: GroupType.CHOIR, churchSlug: 'notre-dame-des-apotres' },
  { name: 'Chorale Saint-Michel', type: GroupType.CHOIR, churchSlug: 'saint-michel-ganhi' },
  { name: 'Légion de Marie', type: GroupType.MOVEMENT, churchSlug: 'sainte-rita' },
  { name: 'Communauté de Vie Chrétienne', type: GroupType.MOVEMENT, churchSlug: 'notre-dame-des-apotres' },
  { name: 'Jeunesse Étudiante Chrétienne', type: GroupType.MOVEMENT, churchSlug: 'cathedrale-notre-dame-cotonou' },
  { name: "Servants d'autel", type: GroupType.ASSOCIATION, churchSlug: 'saint-michel-ganhi' },
  { name: 'Catéchistes', type: GroupType.ASSOCIATION, churchSlug: 'sainte-rita' },
  { name: 'Équipe liturgique', type: GroupType.ASSOCIATION, churchSlug: 'saint-joseph-akpakpa' },
  { name: 'Fraternité Saint-Vincent-de-Paul', type: GroupType.OTHER, churchSlug: 'notre-dame-porto-novo' },
  { name: 'Comité des fêtes', type: GroupType.OTHER, churchSlug: 'saint-paul-ouidah' },
];

export async function seedGroups(dataSource: DataSource): Promise<void> {
  const churchRepo = dataSource.getRepository(Church);
  const groupRepo = dataSource.getRepository(Group);

  let created = 0;
  let skippedMissingChurch = 0;
  let skippedExisting = 0;

  for (const g of GROUPS) {
    const church = await churchRepo.findOneBy({ slug: g.churchSlug });
    if (!church) {
      skippedMissingChurch += 1;
      continue;
    }

    const existing = await groupRepo.findOne({ where: { name: g.name, churchId: church.id } });
    if (existing) {
      skippedExisting += 1;
      continue;
    }

    await groupRepo.save(groupRepo.create({ name: g.name, type: g.type, churchId: church.id }));
    created += 1;
  }

  console.log(
    `Groupes de démo seedés : ${created} créé(s), ${skippedExisting} déjà présent(s), ${skippedMissingChurch} ignoré(s) (église cible absente — lancez seed:churches d'abord).`,
  );
}
