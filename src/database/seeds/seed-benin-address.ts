// ============================================================
// seed-benin-address.ts
// Découpage administratif du Bénin dans le module address/.
//
// Mapping (décidé avec le métier — le département n'a pas de table
// propre, il est porté par Region.parentSub) :
//   Country  = Bénin (isoCode BJ)
//   Region   = Commune            (77)  — parentSub = nom du département
//   Zone     = Arrondissement     (~547) — parentSub = null (aucun niveau sauté)
//   Village  = village / quartier  — NON seedé (pas de source fiable exhaustive)
//
// Source des arrondissements : fr.wikipedia.org/wiki/Liste_des_arrondissements_du_Bénin
// (relevé septembre 2026). Quelques libellés numérotés ont été normalisés
// (« 1er arrondissement de Cotonou » → « Cotonou 1 », idem Parakou / Porto-Novo).
//
// `code` (généré en @BeforeInsert = entityCode + Date.now()) n'a pas de
// contrainte d'unicité : des doublons entre lignes seedées dans la même
// milliseconde sont sans effet.
// ============================================================
import { DataSource } from 'typeorm';
import { Country } from '../../address/entities/country.entity';
import { Region } from '../../address/entities/region.entity';
import { Zone } from '../../address/entities/zone.entity';

/** Département → Commune → [Arrondissements]. */
const BENIN: Record<string, Record<string, string[]>> = {
  Alibori: {
    Banikoara: ['Banikoara', 'Founougo', 'Gomparou', 'Goumori', 'Kokey', 'Kokiborou', 'Ounet', 'Sompérékou', 'Soroko', 'Toura'],
    Gogounou: ['Bagou', 'Gogounou', 'Gounarou', 'Ouara', 'Sori', 'Zoungou-Pantrossi'],
    Kandi: ['Angaradébou', 'Bensékou', 'Donwari', 'Kandi I', 'Kandi II', 'Kandi III', 'Kassakou', 'Saah', 'Sam', 'Sonsoro'],
    Karimama: ['Birni Lafia', 'Bogo-Bogo', 'Karimama', 'Kompa', 'Monsey'],
    Malanville: ['Garou', 'Guéné', 'Malanville', 'Madécali', 'Toumboutou'],
    Ségbana: ['Libantè', 'Liboussou', 'Lougou', 'Ségbana', 'Sokotindji'],
  },
  Atacora: {
    Boukoumbé: ['Boukoumbé', 'Dipoli', 'Korontière', 'Kossoucoingou', 'Manta', 'Natta', 'Tabota'],
    Cobly: ['Cobly', 'Datori', 'Kountori', 'Tapoga'],
    Kérou: ['Brignamaro', 'Firou', 'Kérou', 'Koabagou'],
    Kouandé: ['Birni', 'Chabi-Couma', 'Fô-Tancé', 'Guilmaro', 'Kouandé', 'Oroukayo'],
    Matéri: ['Dassari', 'Gouandé', 'Matéri', 'Nodi', 'Tantéga', 'Tchianhoun-Cossi'],
    Natitingou: ['Kotopounga', 'Kouaba', 'Koundata', 'Natitingou I', 'Natitingou II', 'Natitingou III', 'Natitingou IV', 'Perma', 'Tchoumi-Tchoumi'],
    Péhunco: ['Gnémasson', 'Péhunco', 'Tobré'],
    Tanguiéta: ['Cotiakou', "N'Dahonta", 'Taiakou', 'Tanguiéta', 'Tanongou'],
    Toucountouna: ['Kouarfa', 'Tampégré', 'Toucountouna'],
  },
  Atlantique: {
    'Abomey-Calavi': ['Abomey-Calavi', 'Akassato', 'Godomey', 'Glo-Djigbé', 'Hêvié', 'Kpanroun', 'Ouèdo', 'Togba', 'Zinvié'],
    Allada: ['Agbanou', 'Ahouannonzoun', 'Allada', 'Attogon', 'Avakpa', 'Ayou', 'Hinvi', 'Lissègazoun', 'Lon-Agonmey', 'Sekou', 'Togoudo', 'Tokpa-Avagoudo'],
    Kpomassè: ['Aganmalomè', 'Agbanto', 'Agonkanmè', 'Dédomè', 'Dékanmè', 'Kpomassè', 'Sègbèya', 'Sègbohouè', 'Tokpa-Domè'],
    Ouidah: ['Avlékété', 'Djègbadji', 'Gakpé', 'Houakpè-Daho', 'Ouidah I', 'Ouidah II', 'Ouidah III', 'Ouidah IV', 'Pahou', 'Savi'],
    'Sô-Ava': ['Ahomey-Lokpo', 'Dékanmey', 'Ganvié I', 'Ganvié II', 'Houédo-Aguékon', 'Sô-Ava', 'Vekky'],
    Toffo: ['Agué', 'Colli-Agbamè', 'Coussi', 'Damè', 'Djanglanmè', 'Houègbo', 'Kpomè', 'Sè', 'Sèhouè', 'Toffo-Agué'],
    'Tori-Bossito': ['Avamè', 'Azohouè-Aliho', 'Azohouè-Cada', 'Tori-Bossito', 'Tori-Cada', 'Tori-Gare'],
    Zè: ['Adjan', 'Dawè', 'Djigbé', 'Dodji-Bata', 'Hèkanmé', 'Koundokpoé', 'Sèdjè-Dénou', 'Sèdjè-Houégoudo', 'Tangbo-Djevié', 'Yokpo', 'Zè'],
  },
  Borgou: {
    Bembèrèkè: ['Bembèrèkè', 'Béroubouay', 'Bouanri', 'Gamia', 'Ina'],
    Kalalé: ['Basso', 'Bouka', 'Dérassi', 'Dunkassa', 'Kalalé', 'Péonga'],
    "N'Dali": ['Bori', 'Gbégourou', "N'Dali", 'Ouénou', 'Sirarou'],
    Nikki: ['Biro', 'Gnonkourakali', 'Nikki', 'Ouénou', 'Sérékalé', 'Suya', 'Tasso'],
    Parakou: ['Parakou 1', 'Parakou 2', 'Parakou 3'],
    Pèrèrè: ['Gninsy', 'Guinagourou', 'Kpané', 'Pébié', 'Pèrèrè', 'Sontou'],
    Sinendé: ['Fô-Bourè', 'Sèkèrè', 'Sikki', 'Sinendé'],
    Tchaourou: ['Alafiarou', 'Bétérou', 'Goro', 'Kika', 'Sanson', 'Tchaourou', 'Tchatchou'],
  },
  Collines: {
    Bantè: ['Agoua', 'Akpassi', 'Atokoligbé', 'Bantè', 'Bobè', 'Gouka', 'Koko', 'Lougba', 'Pira'],
    'Dassa-Zoumè': ['Akofodjoulè', 'Dassa I', 'Dassa II', 'Gbaffo', 'Kèrè', 'Kpingni', 'Lèma', 'Paouignan', 'Soclogbo', 'Tré'],
    Glazoué: ['Aklankpa', 'Assanté', 'Glazoué', 'Gomè', 'Kpakpaza', 'Magoumi', 'Ouèdèmè', 'Sokponta', 'Thio', 'Zaffé'],
    Ouèssè: ['Challa-Ogoi', 'Djègbè', 'Gbanlin', 'Kémon', 'Kilibo', 'Laminou', 'Odougba', 'Ouèssè', 'Toui'],
    Savalou: ['Djaloukou', 'Doumè', 'Gobada', 'Kpataba', 'Lahotan', 'Lèma', 'Logozohè', 'Monkpa', 'Ottola', 'Ouèssè', 'Savalou-Aga', 'Savalou-Agbado', 'Savalou-Attakè', 'Tchetti'],
    Savè: ['Adido', 'Bèssè', 'Boni', 'Kaboua', 'Ofè', 'Okpara', 'Plateau', 'Sakin'],
  },
  Couffo: {
    Aplahoué: ['Aplahoué', 'Atomè', 'Azovè', 'Dekpo', 'Godohou', 'Kissamey', 'Lonkly'],
    Djakotomey: ['Adjintimey', 'Bètoumey', 'Djakotomey I', 'Djakotomey II', 'Gohomey', 'Houègamey', 'Kinkinhoué', 'Kokohoué', 'Kpoba', 'Sokouhoué'],
    Dogbo: ['Ayomi', 'Dèvè', 'Honton', 'Lokogohoué', 'Madjrè', 'Tota', 'Totchangni'],
    Klouékanmè: ['Adjanhonmè', 'Ahogbèya', 'Aya-Hohoué', 'Djotto', 'Hondji', 'Klouékanmè', 'Lanta', 'Tchikpé'],
    Lalo: ['Adoukandji', 'Ahondjinnako', 'Ahomadégbé', 'Banigbé', 'Gnizounmè', 'Hlassamè', 'Lalo', 'Lokogba', 'Tchito', 'Tohou', 'Zalli'],
    Toviklin: ['Adjido', 'Avédjin', 'Doko', 'Houédogli', 'Missinko', 'Tannou-Gola', 'Toviklin'],
  },
  Donga: {
    Bassila: ['Alédjo', 'Bassila', 'Manigri', 'Pénéssoulou'],
    Copargo: ['Anandana', 'Copargo', 'Pabégou', 'Singré'],
    Djougou: ['Barei', 'Bariénou', 'Bélléfoungou', 'Bougou', 'Djougou I', 'Djougou II', 'Djougou III', 'Kolokondé', 'Onklou', 'Patargo', 'Pélébina', 'Sérou'],
    Ouaké: ['Badjoudè', 'Kondé', 'Ouaké', 'Sèmèrè I', 'Sèmèrè II', 'Tchalinga'],
  },
  Littoral: {
    Cotonou: ['Cotonou 1', 'Cotonou 2', 'Cotonou 3', 'Cotonou 4', 'Cotonou 5', 'Cotonou 6', 'Cotonou 7', 'Cotonou 8', 'Cotonou 9', 'Cotonou 10', 'Cotonou 11', 'Cotonou 12', 'Cotonou 13'],
  },
  Mono: {
    Athiémè: ['Adohoun', 'Atchannou', 'Athiémè', 'Dédékpoé', 'Kpinnou'],
    Bopa: ['Agbodji', 'Badazoui', 'Bopa', 'Gbakpodji', 'Lobogo', 'Possotomè', 'Yégodoé'],
    Comè: ['Agatogbo', 'Akodéha', 'Comè', 'Ouèdèmè-Pédah', 'Oumako'],
    'Grand-Popo': ['Adjaha', 'Agoué', 'Avloh', 'Djanglanmey', 'Gbéhoué', 'Grand-Popo', 'Sazoué'],
    Houéyogbé: ['Dahé', 'Doutou', 'Honhoué', 'Houéyogbé', 'Sè', 'Zoungbonou'],
    Lokossa: ['Agamé', 'Houin', 'Koudo', 'Lokossa', 'Ouèdèmè'],
  },
  Ouémé: {
    Adjarra: ['Adjarra I', 'Adjarra II', 'Aglogbé', 'Honvié', 'Malanhoui', 'Médédjonou'],
    Adjohoun: ['Adjohoun', 'Akpadanou', 'Awonou', 'Azowlissè', 'Dèmè', 'Gangban', 'Kodè', 'Togbota'],
    Aguégués: ['Avagbodji', 'Houédomè', 'Zoungamè'],
    'Akpro-Missérété': ['Akpro-Missérété', 'Gomè-Sota', 'Katagon', 'Vakon', 'Zodogbomey'],
    Avrankou: ['Atchoukpa', 'Avrankou', 'Djomon', 'Gbozounmè', 'Kouty', 'Ouanho', 'Sado'],
    Bonou: ['Affamè', 'Atchonsa', 'Bonou', 'Damè-Wogon', 'Houinviguè'],
    Dangbo: ['Dangbo', 'Dèkin', 'Gbéko', 'Houédomey', 'Hozin', 'Késsounou', 'Zounguè'],
    'Porto-Novo': ['Porto-Novo 1', 'Porto-Novo 2', 'Porto-Novo 3', 'Porto-Novo 4', 'Porto-Novo 5'],
    'Sèmè-Kpodji': ['Agblangandan', 'Aholouyèmè', 'Djèrègbè', 'Ekpè', 'Sèmè-Kpodji', 'Tohouè'],
  },
  Plateau: {
    'Adja-Ouèrè': ['Adja-Ouèrè', 'Ikpinlè', 'Kpoulou', 'Massè', 'Oko-Akarè', 'Totonnoukon'],
    Ifangni: ['Banigbé', 'Daagbé', 'Ifangni', 'Ko-Koumolou', 'Lagbé', 'Tchaada'],
    Kétou: ['Adakplamé', 'Idigny', 'Kpankou', 'Kétou', 'Odometa', 'Okpometa'],
    Pobè: ['Ahoyéyé', 'Igana', 'Issaba', 'Pobè', 'Towé'],
    Sakété: ['Aguidi', 'Ita-Djèbou', 'Sakété I', 'Sakété II', 'Takon', 'Yoko'],
  },
  Zou: {
    Abomey: ['Agbokpa', 'Dètohou', 'Djègbè', 'Hounli', 'Sèhoun', 'Vidolè', 'Zounzounmè'],
    Agbangnizoun: ['Adahondjigon', 'Adingningon', 'Agbangnizoun', 'Kinta', 'Kpota', 'Lissazounmè', 'Sahé', 'Siwé', 'Tanvé', 'Zoungoudo'],
    Bohicon: ['Agongointo', 'Avogbanna', 'Bohicon I', 'Bohicon II', 'Gnidjazoun', 'Lissèzoun', 'Ouassaho', 'Passagon', 'Saclo', 'Sodohomè'],
    Covè: ['Adogbé', 'Gounli', 'Houéko', 'Houen-Hounso', 'Lainta-Cogbè', 'Naogon', 'Soli', 'Zogba'],
    Djidja: ['Agondji', 'Agouna', 'Dan', 'Djidja', 'Dohouimè', 'Gobaix', 'Monsourou', 'Mougnon', 'Oungbègamè', 'Outo', 'Setto', 'Zoukon'],
    Ouinhi: ['Dasso', 'Ouinhi', 'Sagon', 'Tohoué'],
    'Za-Kpota': ['Allahé', 'Assalin', 'Houngomey', 'Kpakpamè', 'Kpozoun', 'Za-Kpota', 'Za-Tanta', 'Zèko'],
    Zagnanado: ['Agonli-Houégbo', 'Banamè', 'Don-Tan', 'Dovi', 'Kpédékpo', 'Zagnanado'],
    Zogbodomey: ['Akiza', 'Avlamè', 'Cana I', 'Cana II', 'Domè', 'Koussoukpa', 'Kpokissa', 'Massi', 'Tanwé-Hessou', 'Zogbodomey', 'Zoukou'],
  },
};

export async function seedBeninAddress(dataSource: DataSource, refresh: boolean): Promise<void> {
  const countryRepo = dataSource.getRepository(Country);
  const regionRepo = dataSource.getRepository(Region);
  const zoneRepo = dataSource.getRepository(Zone);

  const existing = await countryRepo.findOne({ where: { isoCode: 'BJ' } });

  if (existing && !refresh) {
    console.log('Bénin déjà seedé (pays BJ présent) — seed ignoré. Utilisez --refresh pour recréer.');
    return;
  }

  if (existing && refresh) {
    // FK onDelete CASCADE : supprime en chaîne regions → zones → villages.
    await countryRepo.delete(existing.id);
    console.log('Bénin existant supprimé (cascade regions/zones/villages).');
  }

  const country = await countryRepo.save(
    countryRepo.create({
      isoCode: 'BJ',
      callingCode: '+229',
      subdivisions: ['Commune', 'Arrondissement', 'Village / Quartier de ville'],
      allSub: ['Département', 'Commune', 'Arrondissement', 'Village / Quartier de ville'],
    }),
  );

  let communes = 0;
  let arrondissements = 0;

  for (const [departement, byCommune] of Object.entries(BENIN)) {
    for (const [commune, arrs] of Object.entries(byCommune)) {
      const region = await regionRepo.save(
        regionRepo.create({
          name: commune,
          parentSub: departement,
          country: { id: country.id } as any,
        }),
      );
      communes += 1;

      await zoneRepo.save(
        arrs.map((name) => zoneRepo.create({ name, region: { id: region.id } as any })),
      );
      arrondissements += arrs.length;
    }
  }

  console.log(
    `Bénin seedé : 1 pays, ${communes} communes (regions), ${arrondissements} arrondissements (zones).`,
  );
}
