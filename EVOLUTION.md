# EVOLUTION.md

**Journal vivant d'Amisache** — décisions d'architecture, avancement, prochaines étapes.
Sa forme s'inspire de `src/auth/auth.md` (État actuel / Historique / Points d'attention),
mais son périmètre est **le projet Amisache**, pas un module.

> **Discipline (non négociable)** : ce fichier se **lit en début de session** et se
> **complète en fin de session**. Un journal négligé ment. Toute décision structurante,
> tout avancement notable, tout changement de cap y est consigné, daté, en une entrée.

---

## État actuel

**Phase : implémentation en cours — fondation posée.** Le socle `UNIFIED AUTH` est en place ;
les deux premiers modules Amisache (`AMISACHE.md` §9 étape 1) sont codés, migrés et vérifiés
en exécution réelle.

Acquis :
- **Modèle de données finalisé** → `diagramme-classe-paroisses.mermaid` / `.svg` (source de vérité).
- **Découpage en modules arrêté** → voir `AMISACHE.md` §2–§3 (6 modules Amisache + modules du
  socle gardés/adaptés).
- **Réconciliation avec le template cadrée** → `AMISACHE.md` §4–§7.
- **Les 6 modules Amisache du périmètre initial sont implémentés** : `type/`, `address/`,
  `church/`, `payment/`, `liturgy/`, `community/` — plus `User` étendu (`phone`,
  `homeChurchId`) et `Membership`. Entités, DTOs, services, controllers, migrations
  appliquées sur `amisache_db`, démarrage réel vérifié à chaque étape — voir les entrées
  du 2026-09-03 ci-dessous. Codes d'entité pris : `20` (Type) à `37` (GroupMember).
  `payment/` construit avant `liturgy/` malgré l'ordre §9 initial (dépendance réelle
  `Donation.paymentId` requis — voir l'entrée dédiée).
- **`UserRole`** = `user`/`admin`/`engineer`/`manager`/`clergy` (écart documenté au §5
  initial — `manager` conservé, `clergy` remplace `agent`/`investor` retirés).
- **Build backend débloqué** (npm install + npm run build fonctionnels) — voir entrée du
  2026-09-03 et `TEMPLATE-FIXES.md`.

Prochaines étapes ouvertes :
- **Adaptation des modules socle gardés** (`AMISACHE.md` §6) : `chat/` (enums d'acteurs
  `ParticipantRole` DRIVER/CLIENT → FAITHFUL/CLERGY, en gardant OWNER/MEMBER) et `content/`
  (déjà vérifié compatible avec `community/`, aucun changement requis identifié).
- **Dette : guard d'isolation multi-tenant** — l'autorisation par affectation `ClergyMember`
  passe par `ClergyMemberService.assertAuthorizedForChurch`, appelée à la main dans chaque
  service (routes d'écriture au clergé + désormais la paire de listes `admin`/`church/:churchId`
  sur les 10 ressources — entrée du 2026-09-08). Il manque encore un **guard générique** qui
  éviterait ces appels manuels et sécuriserait les futures routes par défaut. Invariant
  prioritaire n°1 de la stratégie de tests (§10) — aucun test d'isolation encore écrit.
- **Décisions sensibles en attente d'arbitrage ecclésial** (§8) : registres sacramentels,
  délivrance de certificats — ne pas implémenter sans décision explicite.
- **Fonction « découverte de proximité »** (§4.11) — églises/messes proches par
  géolocalisation (`ST_Distance` sur `Address.location`) : les données nécessaires
  existent déjà (`Church`/`Address`/`Schedule`), mais aucune route de calcul d'occurrences
  à la volée n'a encore été écrite. Prochain chantier fonctionnel naturel.

---

## Historique des décisions

> Format d'une entrée : `### AAAA-MM-JJ — Titre court` puis **Décision**, **Pourquoi**,
> et si utile **Conséquences** (fichiers touchés, invariantes à tenir).

### 2026-09-08 — Paire de listes complètes `admin` / `church/:churchId` sur les ressources rattachées à une église
- **Décision** : pour chaque ressource métier rattachée à une `Church`, deux endpoints de
  **liste complète non paginée** :
  - `GET /<res>/admin` — tout, toutes églises — `@Roles(admin, engineer)` ;
  - `GET /<res>/church/:churchId` — tout, **une seule** église — pas de `@Roles`,
    l'autorisation vit dans le service : `ClergyMemberService.assertAuthorizedForChurch`
    (bypass `admin`/`engineer`, sinon `ClergyMember` **actif** de *cette* église ; 403 sinon,
    404 si l'église est inconnue).
  Ressources couvertes (10) : `clergy-members`, `entrances`, `memberships`, `schedules`,
  `requests`, `donations`, `payment-methods`, `payments`, `groups`, `publications`.
  `payments` n'avait **aucune** liste avant — scoping église via `paymentMethod.churchId`
  (QueryBuilder). `churches/admin` inchangé (une `Church` n'est pas *rattachée* à une église,
  elle en **est** une ; liste paginée serveur, contrat différent).
- **Pourquoi** : besoin produit — un compte du clergé doit voir **exactement** le périmètre
  de sa paroisse, l'admin plateforme voit tout. Séparer en deux routes explicites (plutôt
  qu'un `?churchId` adaptatif) rend l'autorisation lisible par route et s'aligne sur la
  convention `/admin` déjà en place.
- **Rapport avec la dette §10 / "isolation multi-tenant"** : ces routes de **lecture** sont
  la première application concrète et systématique de `assertAuthorizedForChurch` comme
  garde d'isolation par affectation `ClergyMember`. Les routes d'**écriture** ouvertes au
  clergé (`Schedule`, `PaymentMethod`, `Group`, `Publication`…) l'utilisaient déjà dans leur
  service ; la nouveauté est de l'étendre aux listes et de le faire porter par une paire
  d'endpoints homogène sur tout le périmètre. Le guard générique dédié reste à faire (la
  logique est centralisée dans `ClergyMemberService`, prête à être extraite).
- **Conséquences** :
  - Services : `listAdmin()` + `listForChurch(user, churchId, query?)` ajoutés sur les 10
    services ; `ClergyMemberService` injecté là où il manquait (`EntranceService`,
    `MembershipService`, `RequestService`, `DonationService`), `ChurchService` ajouté à
    `PaymentService`. `MembershipService.listForChurch(churchId?)` (ancienne signature
    admin) scindé en `listAdmin()` + `listForChurch(user, churchId)`.
  - Contrôleurs : routes `church/:churchId` déclarées **avant** `:id`. Sur `requests`,
    `donations`, `publications`, le `?churchId` de `/admin` est **conservé mais marqué
    déprécié** (Swagger) pour ne pas casser le panel avant sa réécriture.
  - DTO : `ListPaymentQuery { status? }` créé ; `ListPaymentMethodQuery.churchId` passé
    optionnel (ignoré par `/admin` et `/church/:churchId`).
  - **Pas de migration** (aucune entité touchée). Build + boot réel vérifiés : les 20 routes
    (`Mapped {/<res>/admin|church/:churchId, GET}`) sont mappées.
- **À suivre** : réécrire le panel Angular pour consommer `/<res>/church/:churchId` quand un
  contexte église existe (et retirer le shim `?churchId` de `/admin`). Aucun test unitaire
  d'isolation encore écrit sur ces listes — candidat direct de la stratégie §10.

### 2026-09-03 — Module `community/` — dernier module du périmètre initial
- **Décision (frontière `content/`⇄`community/`)** : vérifiée par inspection directe —
  `content/` ne porte que `Faq`, `ContactMessage`, `Setting` (aucune notion de
  publication/article). La décision en suspens d'`AMISACHE.md` §6.2/§8 est donc résolue :
  aucun chevauchement, `community/Publication` implémenté sans réserve.
- **Entités** : `Group` (code `36`, rattaché à une église), `Publication` (code `34`,
  auteur `churchId` toujours + `groupId` optionnel — une chorale publie sur sa page comme
  sur le fil de l'église ; `typeId` doit être scope `PUBLICATION`), `Media` (code `35`,
  0..* par publication), `GroupMember` (code `37`, adhésion fidèle, index unique
  `(userId, groupId)`, symétrique de `Membership`).
- **Cycle de publication** : `PublicationService.updateStatus` pose `publishedAt`
  automatiquement au premier passage en `PUBLISHED` (jamais réécrit ensuite). Lecture
  publique (`listPublic`/`getPublicById`) filtrée sur `status=PUBLISHED` **et** la fenêtre
  `startDate`/`endDate` si définie (événements temporaires) — la lecture admin voit tout,
  sans fenêtre.
- **Cohérence groupe↔église** : `PublicationService.create` vérifie que `groupId` (si
  fourni) appartient bien à `churchId` — même logique anti cross-tenant que
  `PaymentService.submit(body, expectedChurchId)`.
- **Autorisation** : `Group`/`Publication`/`Media` en écriture limités à `admin`/
  `engineer`, cohérent avec la dette déjà notée (pas de scoping par affectation
  `ClergyMember` — voir §10). Self-service fidèle : `GroupMember` (rejoindre/quitter, même
  pattern que `Membership`).
- **Conséquences** : migration `AddCommunityModule` générée et appliquée (tables `groups`,
  `group_members`, `publications`, `media`). Démarrage réel vérifié, routes testées en
  HTTP live. Codes d'entité pris : `34` (Publication) à `37` (GroupMember) — **dernier
  module métier du périmètre `AMISACHE.md` §2/§9** ; il ne reste que l'adaptation de
  `chat/`/`content/` (§6.1/§6.2), non couverte par l'ordre §9.

### 2026-09-03 — Modules `payment/` et `liturgy/` (construits ensemble)
- **Décision (ordre)** : `payment/` implémenté **avant** `liturgy/`, à l'inverse de l'ordre
  suggéré en `AMISACHE.md` §9 (qui listait `liturgy/` en étape 4, `payment/` en étape 5) —
  parce que `Donation.paymentId` est **requis** (cardinalité "1" du diagramme) et
  qu'`AMISACHE.md` §3 documente déjà que « `liturgy/` importe `payment/` ». Créer
  `Donation` sans `Payment` existant aurait produit un flux non fonctionnel (impossible de
  satisfaire la FK). Les deux modules ont donc été livrés dans la même passe, dans le bon
  sens de dépendance.
- **`payment/`** : `PaymentMethod` (coordonnées d'encaissement par église, code `29`) et
  `Payment` (paiement déclaratif, code `30`, **sans** `churchId`/`userId` propres — fidèle
  au diagramme : la paroisse se déduit de `paymentMethod.churchId`, le payeur de l'entité
  hôte `Request`/`Donation`). `PaymentService.confirmOrReject` implémente la **règle dure
  la plus critique du projet** (§7.6, « test le plus important » per §10) :
  `ClergyMemberService.findActiveForUserAndChurch` (nouvelle méthode) résout l'affectation
  clergé ACTIVE de l'appelant pour LA paroisse du paiement — aucun `UserRole` (même
  `admin`) ne peut bypasser cette vérification. Route `PATCH /payments/:id/status`
  volontairement sans `@Roles` : l'autorisation fine vit entièrement dans le service.
  Upload de reçu via `POST /payments/receipt-image` (même pattern que `Church.bannerPhoto`).
- **`liturgy/`** : `Schedule` (horaire récurrent, code `31`, validation
  fréquence↔`dayOfWeek`/`weekOfMonth` dans `ScheduleService`), `Request` (demande unifiée
  intention/sacrement, code `32`, `typeId` doit être scope `INTENTION` **ou** `SACRAMENT` —
  `TypeService.assertScope` généralisé pour accepter un tableau de scopes), `Donation`
  (code `33`, paiement toujours créé à la soumission via `PaymentService.submit`). Règle
  « la date doit être une occurrence valide du Schedule » (§4.6) implémentée dans
  `liturgy/liturgy.util.ts` (`isValidScheduleOccurrence`) — limitation assumée et
  documentée sur `BIWEEKLY` (pas d'ancrage de semaine dans le modèle, validé comme WEEKLY).
  `PaymentService.submit(body, expectedChurchId)` vérifie que le moyen de paiement choisi
  appartient bien à l'église de la demande/don (anti cross-tenant).
- **Autorisation** : accès en lecture/écriture par église (`Schedule`, `PaymentMethod`)
  volontairement limité à `admin`/`engineer` — **pas** `UserRole.clergy`, qui est un
  marqueur plateforme grossier sans portée par église ; l'étendre à `clergy` sans scoping
  par affectation ClergyMember laisserait n'importe quel compte clergé modifier
  n'importe quelle paroisse (risque déjà noté au §10 « isolation multi-tenant », toujours
  en attente d'un système de guard dédié).
- **Conséquences** : migration `AddPaymentAndLiturgyModules` générée et appliquée
  (tables `payment_methods`, `payments`, `donations`, `schedules`, `requests`). Démarrage
  réel vérifié — toutes les routes mappées et testées en HTTP live. Codes d'entité pris :
  `29` (PaymentMethod) à `33` (Donation).

### 2026-09-03 — Extension de `User` + `Membership` + `UserRole.clergy`
- **Décision (User)** : `AMISACHE.md` §9 étape 3 — ajout de `User.phone` (Mobile Money) et
  `User.homeChurchId` (scalaire `uuid` **nu, sans relation** — `users/` n'importe jamais
  `church/`, §7.2). Ajout d'une relation navigable `User.country` (`@ManyToOne(() =>
  Country)`) sur l'`idCountry` déjà existant — exception ponctuelle documentée à la règle
  de dépendance socle→métier, `address/Country` étant aussi fondamental que `shared/`.
- **Décision (Membership)** : nouvelle entité `church/entities/membership.entity.ts` —
  jointure fidèle ↔ église (`since`, sans rôle), symétrique de `ClergyMember`, index
  unique `(userId, churchId)`. Self-service via `/memberships` (`me`, suivre, retirer,
  `PATCH /memberships/home-church`) ; `MembershipService.setHomeChurch` **est** la garde
  de l'invariante `homeChurchId ∈ Membership(user)` — refuse si la paroisse n'est pas
  suivie, puis délègue l'écriture à `UserService.updateHomeChurch` (nouvelle méthode,
  aucune validation métier côté `users/`). Code d'entité `28`.
- **Décision (UserRole)** — écart assumé avec le §5 initial : conserver `UserRole.manager`
  (utilisé par la logique socle générique `AuthService.assertClientAccess` pour le client
  API `manager`) et ajouter `UserRole.clergy` en remplacement de `UserRole.agent`/
  `investor` (retirés). `clergy` reste un **marqueur plateforme grossier** — jamais une
  autorisation par église ; le détail (fonction + affectation) continue de vivre
  exclusivement dans `ClergyMember.role`/`churchId`. `AMISACHE.md` §5 mis à jour en
  conséquence.
- **Conséquences** : migration `ExtendUserAndAddMembership` générée et appliquée
  (`users.phone`, `users.home_church_id`, FK `users.id_country → countries`, `roles` SET
  MySQL régénéré, table `memberships`). Démarrage réel vérifié — routes `/memberships/*`
  mappées, `/memberships/me` correctement protégée par JWT.

### 2026-09-03 — Module `church/` : racine multi-tenant
- **Décision** : implémentation d'`AMISACHE.md` §9 étape 2 — `Church` (auto-référente,
  embarque enfin `Address` via `@Column(() => Address, { prefix: false })`, **sans
  préfixe** sur les colonnes d'adresse — décision explicite : un seul embed sur `Church`,
  aucun risque de collision, colonnes `locality`/`landmark`/`location`/`zone_id`/
  `village_id` gardées courtes), `ClergyMember` (affectation clergé/personnel ↔ église,
  rôle + période) et `Entrance` (portes géolocalisées). Codes d'entité `25`-`27`.
  Validation de hiérarchie dans `ChurchService` : parent à un rang strictement
  supérieur (niveaux manquants nativement supportés, pas d'adjacence stricte requise),
  CHURCH/CHAPEL rattachées uniquement à PAROISSE/COMMUNAUTE. Emprise géographique
  (`perimeter`, 4-20 sommets) validée et ring fermé côté service, pas en contrainte
  de schéma. `Church.parentId` en FK `onDelete: RESTRICT` — la BDD bloque nativement
  la suppression d'une entité qui a des enfants.
- **Pourquoi** : racine du multi-tenant (AMISACHE.md §1) — tous les modules métier
  suivants (`liturgy/`, `payment/`, `community/`) et l'extension de `User` en dépendent.
- **Conséquences** : nouveau `address/address.mapper.ts` (conversion `AddressDto` →
  `Address`, réutilisable par tout futur hôte de l'objet-valeur). `ChurchModule` importe
  `AddressModule` (CountryService pour valider `countryId` au niveau CONFERENCE) et
  `UsersModule` (UserService pour valider `userId` de `ClergyMember`) — sens de
  dépendance respecté (§7.1). Migration `AddChurchModule` générée, régénérée une fois
  (correctif du nommage des colonnes embarquées), puis appliquée sur `amisache_db` ;
  démarrage réel vérifié (`node dist/main.js`) — toutes les routes `/churches`,
  `/entrances`, `/clergy-members` mappées et fonctionnelles.

### 2026-09-03 — Premier code métier : modules `type/` et `address/`
- **Décision** : implémentation du socle fondation d'`AMISACHE.md` §9 étape 1 —
  module `type/` (entité `Type` mutualisée, scope `TypeScope`, lecture publique par scope +
  CRUD admin) et module `address/` (`Country` → `Region` → `Zone` → `Village`, objet-valeur
  `Address` embarqué avec `location: Point` GeoJSON — voir `shared/geo.ts`, nouveau).
  Codes d'entité réservés : `Type=20`, `Country=21`, `Region=22`, `Zone=23`, `Village=24`
  (plage `20+` par `AMISACHE.md` §4). Les deux modules enregistrés dans `app.module.ts`.
- **Pourquoi** : ce sont les deux modules « fondation » sans dépendance métier — base pour
  `church/` (Address embarqué dans `Church`) et pour `liturgy/`/`payment/`/`community/`
  (référencent tous `Type`).
- **Conséquences** : migration `AddTypeAndAddressModules` générée et **appliquée** sur
  `amisache_db` (première migration du projet — a aussi créé les tables du socle, jusque-là
  jamais migrées). Démarrage réel de l'app vérifié (`node dist/main.js`) : tous les modules
  s'initialisent, toutes les routes (`/types`, `/countries`, `/regions`, `/zones`,
  `/villages`) sont mappées et protégées correctement (clé API + rôle admin/engineer sur les
  routes de mutation). `Address` n'est pas encore embarqué dans une entité hôte — ce sera fait
  à l'étape `church/` (prochaine, par `AMISACHE.md` §9).
- **Écart noté avec `cahier-des-charges-amisache.md`** : ce document suggère PostgreSQL/PostGIS
  et des enums `UserRole`/`UserStatus` plus courts — décisions antérieures, supplantées par la
  réconciliation avec le socle dans `AMISACHE.md` (MySQL 8 spatial, déjà en place via
  `base_orm_config.ts` + `mysql2` ; enums du socle conservés). `AMISACHE.md` fait foi.

### 2026-09-03 — Installation backend débloquée + build TS7→TS6 (voir `TEMPLATE-FIXES.md`)
- **Décision** : `npm install` et `npm run build` du template ne passaient plus en l'état —
  série de conflits en cascade (peer deps `@bull-board/nestjs`/`ioredis`/`nestjs-cls`,
  `typescript@7.0.2` rejeté par `@nestjs/cli@12`, ruptures d'API `firebase-admin@14`/`argon2`/
  `@nestjs-modules/mailer`, `tsconfig.json` avec options dépréciées TS6/7). Résolus un à un ;
  détail technique complet dans `TEMPLATE-FIXES.md` (FIX-002 à FIX-009, toutes génériques
  socle donc à remonter au template).
- **Pourquoi** : le template avait été mis à jour vers des versions tout juste sorties
  (NestJS 12.0.1, TypeORM 1.1.1, TypeScript 7.0.2, `@types/node` 26...) que l'écosystème
  n'a pas fini de rattraper.
- **Conséquences** : `typescript` fixé à `^6.0.3` (TS 7 reste incompatible avec `@nestjs/cli`
  tant que l'API programmatique du compilateur n'est pas revenue en 7.1 stable) ; `.npmrc`
  avec `legacy-peer-deps=true` ajouté pour contourner `nestjs-cls` (plafonné à Nest <12, mais
  activement utilisé pour le contexte d'audit — pas remplacé).

### 2026-09-03 — Stratégie de tests arrêtée + amorce Claude Code
- **Décision (tests)** : stratégie consignée en **section §10 d'`AMISACHE.md`**, pas de
  `TESTING.md` séparé — elle est soudée aux invariants du même fichier et n'a aucun cycle de vie
  propre (on extraira un `TESTING.md` seulement si la section déborde). Cibles : isolation
  multi-tenant, `Payment.confirmedBy → ClergyMember`, `homeChurchId ∈ Membership`, cohérence
  hiérarchie `Church`, `perimeter`. Niveaux : unitaire services / intégration DB pour le spatial /
  E2E Playwright sur les parcours critiques.
- **Décision (amorce)** : le `CLAUDE.md` **du fork** charge le contexte projet via `@import`
  (`@AMISACHE.md`, `@EVOLUTION.md`) au lieu d'un renvoi en prose → la chaîne de session n'est plus
  orpheline. Bloc **local au fork**, ne remonte jamais au template (donc pas dans
  `TEMPLATE-FIXES.md`). `auth.md` reste conditionnel → volontairement **non** importé.
- **Nettoyage** : deux reliquats `favoriteChurchId` → `homeChurchId` corrigés dans `AMISACHE.md`
  (§5 encadré, §9 étape 3), alignés sur le renommage du 2026-08-30.

### 2026-08-30 — Rattachement paroissial du fidèle : `homeChurch` + `Membership`
- **Décision** : un fidèle **suit plusieurs paroisses** (jointure `Membership` dans `church/`,
  `since: date`, sans rôle) et en a **une de référence** (`homeChurchId`, scalaire sur `User`).
  `favoriteChurch` renommé `homeChurch`.
- **Pourquoi** : deux cardinalités → deux mécanismes (cf. `CLAUDE.md` faible/forte cardinalité).
  `Membership` est le symétrique de `ClergyMember` (fidèle vs clergé).
- **Conséquences** : invariante `homeChurchId ∈ Membership(user)` validée côté service `church/`.
  « Paroisse la plus proche » = onboarding spatial (`ST_Distance`), pas le modèle. Diagramme +
  `AMISACHE.md` §3/§5/§7 mis à jour.

### 2026-08-30 — Emprise et accès de l'église : `perimeter` + `Entrance`
- **Décision** : `Church.perimeter: Polygon` (attribut, pas une table). `Entrance` = **classe à
  part** dans `church/` (`type: EntranceType`, `name`, `location: Point`) ; enum `EntranceType`
  (`VEHICLE`/`PEDESTRIAN`/`MIXED`/`SERVICE`).
- **Pourquoi** : un attribut géométrique unique reste dans l'entité ; une collection d'objets
  structurés (portes multiples, chacune géolocalisée, requêtables) sort en table.
- **Conséquences** : validation « 4 à 20 sommets » = règle métier (DTO), ring MySQL fermé.

### 2026-08-30 — Réconciliation avec le socle `UNIFIED AUTH`
- **Décisions** : `users/` **étendu** (pas réécrit) — ajout `phone`, `homeChurchId` ; `idCountry`
  existant mappé sur `address/Country`. `UserRole` = `user`/`admin`/`engineer` (rôles ecclésiaux
  hors de là → `ClergyMember.role`). `UserStatus` = celui du socle. Toutes les entités étendent
  `Audit`. Enums métier en MAJUSCULES **dans leur module** (`shared/` reste neutre). Erreurs `3xxx`.
- **Modules du socle** : `content/`, `chat/`, `notifications/` **gardés** (pas des démos jetables
  pour Amisache). `chat/` adapté (enums d'acteurs) **sans casser son polymorphisme**.
- **Conséquences** : `AMISACHE.md` créé pour porter tout ce delta.

### 2026-08-30 — Découpage en modules par force de liens
- **Décision** : 6 modules Amisache — `address/`, `type/`, `church/`, `liturgy/`, `payment/`,
  `community/`. `Donation` placé dans `liturgy/` (geste du fidèle). `Address` = value object
  embarqué, module renommé `Location` → `address/`.
- **Pourquoi** : composition forte → même module ; référence lâche → frontière. Dépendances
  toutes descendantes, aucun cycle.

---

## Points d'attention (dette / vigilance)

- **Frontière `content/`⇄`community/`** non fermée tant que le modèle de `content/` n'est pas connu.
- **Registres sacramentels & certificats** : features sensibles en attente d'arbitrage ecclésial.
- **Invariante `homeChurchId ∈ Membership`** : à garantir côté service `church/`, jamais `users/`.
