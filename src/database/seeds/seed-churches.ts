// ============================================================
// seed-churches.ts
// Jeu de données de démonstration pour la hiérarchie ecclésiale
// (church/) + quelques ClergyMember/Schedule/Publication — sert à
// visualiser la carte, l'annuaire et le fil d'actualités du portail
// avec des données réalistes plutôt que des tables vides.
//
// Prérequis : `npm run seed:benin` (Country/Region/Zone du Bénin) ET
// `npm run seed` (Type — scope SCHEDULE/PUBLICATION, Admin) déjà joués.
// Sans le découpage Bénin, aucun zoneId valide n'existe pour l'Address
// embarquée de Church — le seed s'arrête avec un message explicite.
//
// Idempotent via le slug fixe de la Conférence ; `--refresh` supprime
// tout l'arbre seedé (feuilles → racine, la FK Church.parentId est en
// onDelete RESTRICT) puis le recrée. ClergyMember/Schedule/Publication
// sont en onDelete CASCADE depuis Church — supprimés automatiquement.
// ============================================================
import { DataSource } from 'typeorm';
import { Country } from '../../address/entities/country.entity';
import { Zone } from '../../address/entities/zone.entity';
import { Church } from '../../church/entities/church.entity';
import { ClergyMember } from '../../church/entities/clergy-member.entity';
import { EntityType, EcclesialRole, ValidationStatus } from '../../church/church.enum';
import { Schedule } from '../../liturgy/entities/schedule.entity';
import { ScheduleFrequency, LiturgicalSeason } from '../../liturgy/liturgy.enum';
import { Publication } from '../../community/entities/publication.entity';
import { Media } from '../../community/entities/media.entity';
import { PublicationStatus, MediaKind, MediaProvider } from '../../community/community.enum';
import { Type } from '../../type/entities/type.entity';
import { TypeScope } from '../../type/type.enum';
import { User } from '../../users/entities/user.entity';
import { readSeedAdminConfig } from './seed-admin';
import type { Point } from '../../shared/geo';

const CONFERENCE_SLUG = 'conference-episcopale-du-benin';

function point(lng: number, lat: number): Point {
  return { type: 'Point', coordinates: [lng, lat] };
}

// Fichiers réels de Wikimedia Commons (licence CC — cathédrales/basiliques du Bénin,
// catégorie "Roman Catholic cathedrals in Benin"). Special:FilePath redirige vers le
// fichier haute résolution sans avoir à connaître son chemin de hash — mécanisme
// documenté de Commons, pas une URL devinée.
function commonsFile(filename: string, width?: number): string {
  const base = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`;
  return width ? `${base}?width=${width}` : base;
}

const PHOTO_COTONOU_CATHEDRAL = [
  commonsFile('Cathédrale Notre-Dame-de-Miséricorde de Cotonou, Bénin 06.jpg', 1200),
  commonsFile('Cathédrale Notre-Dame-de-Miséricorde de Cotonou, Bénin 05.jpg', 1200),
];
const PHOTO_PORTO_NOVO_CATHEDRAL = [commonsFile("Cathédrale Notre Dame de l'Immaculée Conception de Porto-Novo (Benin).jpg", 1200)];
const PHOTO_OUIDAH_BASILICA = [commonsFile("La chapelle de la Basilique de l'Immaculée-Conception de Ouidah au Bénin.jpg", 1200)];
const PHOTO_PARAKOU_CATHEDRAL = [commonsFile('Cathédrale Saints-Pierre-et-Paul de Parakou (VDL).jpg', 1200)];

// Pas de photo dédiée disponible sur Commons pour les petites paroisses fictives de
// démo — on fait tourner les photos de cathédrales réelles ci-dessus entre elles.
const GENERIC_CHURCH_PHOTOS = [
  ...PHOTO_COTONOU_CATHEDRAL,
  ...PHOTO_PORTO_NOVO_CATHEDRAL,
  ...PHOTO_OUIDAH_BASILICA,
  ...PHOTO_PARAKOU_CATHEDRAL,
];

// Logo générique (croix latine) — aucune paroisse fictive de démo n'a de vrai logo.
const GENERIC_LOGO = commonsFile('Christian Cross icon.svg');

interface ParoisseSeed {
  slug: string;
  name: string;
  parentSlug: string; // doyenné ou, niveau sauté volontairement, diocèse/archidiocèse
  zoneName: string;
  locality: string;
  coords: [number, number]; // [lng, lat]
  photos?: string[]; // par défaut : rotation de GENERIC_CHURCH_PHOTOS
}

const PAROISSES: ParoisseSeed[] = [
  { slug: 'notre-dame-des-apotres', name: 'Paroisse Notre-Dame des Apôtres', parentSlug: 'doyenne-cotonou-1', zoneName: 'Cotonou 1', locality: 'Zogbo, Cotonou', coords: [2.418, 6.3667] },
  { slug: 'sainte-rita', name: 'Paroisse Sainte-Rita', parentSlug: 'doyenne-cotonou-1', zoneName: 'Cotonou 4', locality: 'Gbedjromédé, Cotonou', coords: [2.436, 6.373] },
  { slug: 'saint-michel-ganhi', name: 'Paroisse Saint-Michel', parentSlug: 'doyenne-cotonou-1', zoneName: 'Cotonou 1', locality: 'Ganhi, Cotonou', coords: [2.426, 6.358] },
  { slug: 'cathedrale-notre-dame-cotonou', name: 'Cathédrale Notre-Dame de Cotonou', parentSlug: 'doyenne-cotonou-1', zoneName: 'Cotonou 1', locality: 'Centre, Cotonou', coords: [2.431, 6.36], photos: PHOTO_COTONOU_CATHEDRAL },
  { slug: 'saint-joseph-akpakpa', name: "Paroisse Saint-Joseph d'Akpakpa", parentSlug: 'doyenne-cotonou-1', zoneName: 'Cotonou 3', locality: 'Akpakpa, Cotonou', coords: [2.452, 6.36] },
  { slug: 'notre-dame-porto-novo', name: 'Paroisse Notre-Dame de Porto-Novo', parentSlug: 'doyenne-porto-novo', zoneName: 'Porto-Novo 1', locality: 'Centre, Porto-Novo', coords: [2.6136, 6.4969], photos: PHOTO_PORTO_NOVO_CATHEDRAL },
  { slug: 'saint-paul-ouidah', name: "Paroisse Saint-Paul d'Ouidah", parentSlug: 'diocese-porto-novo', zoneName: 'Ouidah I', locality: 'Centre, Ouidah', coords: [2.085, 6.3609], photos: PHOTO_OUIDAH_BASILICA },
  { slug: 'sainte-anne-abomey-calavi', name: "Paroisse Sainte-Anne d'Abomey-Calavi", parentSlug: 'archidiocese-cotonou', zoneName: 'Abomey-Calavi', locality: 'Abomey-Calavi', coords: [2.3556, 6.4489] },
  { slug: 'saint-pierre-parakou', name: 'Paroisse Saint-Pierre de Parakou', parentSlug: 'diocese-porto-novo', zoneName: 'Parakou 1', locality: 'Parakou', coords: [2.6289, 9.3372], photos: PHOTO_PARAKOU_CATHEDRAL },
];

// Slugs des paroisses recevant quelques horaires/publications de démo.
const SCHEDULE_TARGETS = ['notre-dame-des-apotres', 'sainte-rita', 'saint-michel-ganhi', 'cathedrale-notre-dame-cotonou'];
const PUBLICATION_TARGETS = [
  { slug: 'cathedrale-notre-dame-cotonou', title: 'Ordinations diaconales à la cathédrale', content: "Sept séminaristes ont été ordonnés diacres samedi, en présence des familles et des délégations de leurs paroisses d'origine.", typeName: 'Événement', daysAgo: 1 },
  { slug: 'sainte-rita', title: 'Inscriptions au catéchisme jusqu\'au 30 septembre', content: 'Les inscriptions pour la nouvelle année de catéchisme sont ouvertes au secrétariat paroissial.', typeName: 'Annonce paroissiale', daysAgo: 3 },
  { slug: 'notre-dame-porto-novo', title: 'Pèlerinage diocésain à Dassa-Zoumè', content: 'Le diocèse organise un pèlerinage le 12 octobre — inscriptions auprès de votre paroisse.', typeName: 'Communiqué diocésain', daysAgo: 5 },
  { slug: 'notre-dame-des-apotres', title: 'Neuvaine préparatoire à la fête patronale', content: 'La neuvaine débute lundi prochain à 18h30, tous les jours à la même heure.', typeName: 'Annonce paroissiale', daysAgo: 2 },
  { slug: 'saint-joseph-akpakpa', title: 'Album photo — Confirmations 2026', content: '48 photos de la célébration des confirmations du mois dernier.', typeName: 'Album photo', daysAgo: 10 },
  { slug: 'saint-paul-ouidah', title: 'Nouveaux horaires de messe pour la saison sèche', content: "La messe du dimanche matin avance à 6h30 jusqu'à nouvel ordre.", typeName: 'Horaires spéciaux', daysAgo: 7 }
];

export async function seedChurches(dataSource: DataSource, refresh: boolean): Promise<void> {
  const zoneRepo = dataSource.getRepository(Zone);
  const countryRepo = dataSource.getRepository(Country);
  const churchRepo = dataSource.getRepository(Church);
  const clergyRepo = dataSource.getRepository(ClergyMember);
  const scheduleRepo = dataSource.getRepository(Schedule);
  const publicationRepo = dataSource.getRepository(Publication);
  const mediaRepo = dataSource.getRepository(Media);
  const typeRepo = dataSource.getRepository(Type);
  const userRepo = dataSource.getRepository(User);

  if ((await zoneRepo.count()) === 0) {
    console.log("Aucune Zone trouvée — lancez d'abord `npm run seed:benin`. Seed churches ignoré.");
    return;
  }

  const country = await countryRepo.findOneBy({ isoCode: 'BJ' });
  if (!country) {
    console.log("Pays BJ introuvable — lancez d'abord `npm run seed:benin`. Seed churches ignoré.");
    return;
  }

  const existing = await churchRepo.findOne({ where: { slug: CONFERENCE_SLUG } });

  if (existing && !refresh) {
    console.log('Hiérarchie ecclésiale de démo déjà présente — seed ignoré. Utilisez --refresh pour recréer.');
    return;
  }

  if (existing) {
    // Feuilles → racine : Church.parentId est en onDelete RESTRICT.
    // ClergyMember/Schedule/Publication sont en CASCADE depuis Church.
    const allSlugs = [
      ...PAROISSES.map((p) => p.slug),
      'doyenne-cotonou-1',
      'doyenne-porto-novo',
      'archidiocese-cotonou',
      'diocese-porto-novo',
      CONFERENCE_SLUG,
    ];
    for (const slug of allSlugs) {
      await churchRepo.delete({ slug });
    }
    console.log('Hiérarchie ecclésiale de démo existante supprimée.');
  }

  const zoneIdByName = new Map<string, string>();
  const resolveZoneId = async (name: string): Promise<string> => {
    if (zoneIdByName.has(name)) return zoneIdByName.get(name)!;
    const zone = await zoneRepo.findOneByOrFail({ name });
    zoneIdByName.set(name, zone.id);
    return zone.id;
  };

  const churchBySlug = new Map<string, Church>();
  const createChurch = async (data: {
    slug: string;
    name: string;
    type: EntityType;
    parentId?: string;
    countryId?: string;
    zoneName: string;
    locality?: string;
    coords?: [number, number];
    photos?: string[];
  }): Promise<Church> => {
    const church = await churchRepo.save(
      churchRepo.create({
        slug: data.slug,
        name: data.name,
        type: data.type,
        parentId: data.parentId,
        countryId: data.countryId,
        status: ValidationStatus.APPROVED,
        logo: GENERIC_LOGO,
        photos: data.photos,
        address: {
          zoneId: await resolveZoneId(data.zoneName),
          locality: data.locality,
          location: data.coords ? point(data.coords[0], data.coords[1]) : undefined,
        } as Church['address'],
      }),
    );
    churchBySlug.set(data.slug, church);
    return church;
  };

  const conference = await createChurch({
    slug: CONFERENCE_SLUG,
    name: 'Conférence Épiscopale du Bénin',
    type: EntityType.CONFERENCE,
    countryId: country.id,
    zoneName: 'Cotonou 1',
  });

  const archdiocese = await createChurch({
    slug: 'archidiocese-cotonou',
    name: 'Archidiocèse de Cotonou',
    type: EntityType.ARCHDIOCESE,
    parentId: conference.id,
    zoneName: 'Cotonou 1',
  });

  const diocese = await createChurch({
    slug: 'diocese-porto-novo',
    name: 'Diocèse de Porto-Novo',
    type: EntityType.DIOCESE,
    parentId: conference.id,
    zoneName: 'Porto-Novo 1',
  });

  await createChurch({
    slug: 'doyenne-cotonou-1',
    name: 'Doyenné de Cotonou I',
    type: EntityType.DOYENNE,
    parentId: archdiocese.id,
    zoneName: 'Cotonou 1',
  });

  await createChurch({
    slug: 'doyenne-porto-novo',
    name: 'Doyenné de Porto-Novo',
    type: EntityType.DOYENNE,
    parentId: diocese.id,
    zoneName: 'Porto-Novo 1',
  });

  for (let index = 0; index < PAROISSES.length; index++) {
    const p = PAROISSES[index];
    const parent = churchBySlug.get(p.parentSlug);
    if (!parent) throw new Error(`Parent "${p.parentSlug}" introuvable pour "${p.slug}" — vérifier l'ordre de création.`);
    await createChurch({
      slug: p.slug,
      name: p.name,
      type: EntityType.PAROISSE,
      parentId: parent.id,
      zoneName: p.zoneName,
      locality: p.locality,
      coords: p.coords,
      photos: p.photos ?? [GENERIC_CHURCH_PHOTOS[index % GENERIC_CHURCH_PHOTOS.length]],
    });
  }

  // ── ClergyMember de démo — rattache l'admin principal à une paroisse ──
  // Par email plutôt que par rôle : `roles` est une colonne MySQL SET, non
  // requêtable via `where` TypeORM standard (voir UserService.list, FIND_IN_SET).
  const admin = await userRepo.findOneBy({ email: readSeedAdminConfig().email });
  let clergyCreated = 0;
  if (admin) {
    const parish = churchBySlug.get('notre-dame-des-apotres')!;
    await clergyRepo.save(
      clergyRepo.create({
        role: EcclesialRole.PRIEST,
        startDate: new Date().toISOString().slice(0, 10),
        churchId: parish.id,
        userId: admin.id,
      }),
    );
    clergyCreated = 1;
  }

  // ── Schedule de démo — une messe dominicale + une messe quotidienne par paroisse ciblée ──
  const scheduleType = await typeRepo.findOneBy({ scope: TypeScope.SCHEDULE, name: 'Messe dominicale' });
  const dailyType = await typeRepo.findOneBy({ scope: TypeScope.SCHEDULE, name: 'Messe' });
  let schedulesCreated = 0;
  if (scheduleType && dailyType) {
    for (const slug of SCHEDULE_TARGETS) {
      const church = churchBySlug.get(slug)!;
      await scheduleRepo.save([
        scheduleRepo.create({
          frequency: ScheduleFrequency.WEEKLY,
          dayOfWeek: 0,
          time: '08:00:00',
          duration: 90,
          language: 'fr',
          season: LiturgicalSeason.ORDINARY,
          churchId: church.id,
          typeId: scheduleType.id,
        }),
        scheduleRepo.create({
          frequency: ScheduleFrequency.DAILY,
          time: '18:30:00',
          duration: 60,
          language: 'fr',
          season: LiturgicalSeason.ORDINARY,
          churchId: church.id,
          typeId: dailyType.id,
        }),
      ]);
      schedulesCreated += 2;
    }
  } else {
    console.log("Types SCHEDULE introuvables — lancez `npm run seed` (seedTypes) avant seed:churches pour les horaires.");
  }

  // ── Publication de démo (+ 1 média IMAGE chacune — vignette de la carte
  // actualités, format aligné sur presidence.bj/actualites) ──
  let publicationsCreated = 0;
  for (let index = 0; index < PUBLICATION_TARGETS.length; index++) {
    const pub = PUBLICATION_TARGETS[index];
    const church = churchBySlug.get(pub.slug);
    const type = await typeRepo.findOneBy({ scope: TypeScope.PUBLICATION, name: pub.typeName });
    if (!church || !type) continue;
    const publishedAt = new Date();
    publishedAt.setDate(publishedAt.getDate() - pub.daysAgo);
    const publication = await publicationRepo.save(
      publicationRepo.create({
        title: pub.title,
        content: pub.content,
        status: PublicationStatus.PUBLISHED,
        publishedAt,
        churchId: church.id,
        typeId: type.id,
      }),
    );
    await mediaRepo.save(
      mediaRepo.create({
        kind: MediaKind.IMAGE,
        provider: MediaProvider.OTHER,
        url: GENERIC_CHURCH_PHOTOS[index % GENERIC_CHURCH_PHOTOS.length],
        publicationId: publication.id,
      }),
    );
    publicationsCreated += 1;
  }

  console.log(
    `Hiérarchie ecclésiale de démo seedée : ${churchBySlug.size} entités (Church), ${clergyCreated} affectation(s) clergé, ${schedulesCreated} horaire(s), ${publicationsCreated} publication(s).`,
  );
}
