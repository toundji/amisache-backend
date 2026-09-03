# AMISACHE.md

Complément **projet** au socle **UNIFIED AUTH**. Ce fichier porte le contexte métier
d'Amisache et les décisions d'architecture propres au projet — il **ne redit pas** le socle.

À lire **avec**, et non à la place de :
- `CLAUDE.md` — conventions du template (couches, `Audit`, relations `***Id`/objet, tokens, guards, erreurs, upload…). **Priment toujours.**
- `src/auth/auth.md` — mémoire du module `auth/` et de l'architecture générale.
- `diagramme-classe-paroisses.mermaid` / `.svg` — **source de vérité du modèle de données** Amisache.

> Règle d'or : en cas de doute, `CLAUDE.md` gagne. Ce fichier ne fait qu'**ajouter** le métier
> par-dessus le socle, jamais contredire ses règles non négociables.

---

## Rituel de session (à respecter à chaque nouvelle session)

Chaque session (humain ou IA) redémarre **sans mémoire** de la précédente. Ce rituel garantit
qu'on reprend là où on s'est arrêté.

**À l'ouverture — lire dans cet ordre** (du socle immuable à l'état chaud) :
1. `CLAUDE.md` — architecture et règles du socle.
2. `AMISACHE.md` — le présent fichier (contexte métier + décisions structurantes).
3. `EVOLUTION.md` — où on en est, dernières décisions, prochaines étapes.
4. `TEMPLATE-FIXES.md` — corrections du socle en attente de remontée.
5. `diagramme-classe-paroisses.mermaid` — modèle de données.
6. `src/auth/auth.md` — **seulement si la session touche à l'authentification** (`auth/`).
   C'est la doc d'un module précis, pas un passage obligé.

**À la clôture — consigner** :
- Décisions et avancement → **entrée datée dans `EVOLUTION.md`**.
- Toute correction du socle générique → **entrée dans `TEMPLATE-FIXES.md`** (§ critère).
- `AMISACHE.md` mis à jour **uniquement** si une règle structurante change (pas pour le courant).
- Si le `.mermaid` a bougé → **régénérer le `.svg`**
  (`npx mmdc -i diagramme-classe-paroisses.mermaid -o diagramme-classe-paroisses.svg -p puppeteer-config.json -b transparent`).

---

## 1. Le projet en deux minutes

Amisache (« mon église ») est un **SaaS multi-tenant** qui fédère les paroisses catholiques
du Bénin sous une même infrastructure, **conçu dès le départ pour s'étendre à d'autres pays**.

- **Hiérarchie ecclésiale auto-référente** : Conférence épiscopale → Archidiocèse/Diocèse →
  Doyenné → Paroisse → Église/Chapelle, dans **une seule table** (`Church` + enum `EntityType`).
  Ajouter un pays = insérer **un niveau au sommet**, sans rien restructurer en dessous.
- **Usages** : découverte de paroisse, vie liturgique (horaires de messe), intentions de messe,
  demandes de sacrement, dons, vie communautaire (annonces, médias, groupes).
- **Identité de paroisse = moteur d'adoption** : chaque paroisse a sa page (nom, photo, logo,
  couleur d'accent) dans une infra partagée. La plateforme doit sembler « la sienne ».
- **Paiement = flux manuel déclaratif** (réalité locale) : la paroisse publie un numéro
  Mobile Money, le fidèle soumet un reçu, **seul un membre du clergé confirme**. MTN MoMo et
  Moov Money en priorité.

---

## 2. Ce qui s'ajoute au socle

Les modules métier Amisache se branchent **en bout de chaîne**, après `users/`. Le sens de
dépendance du socle est inchangé : le métier dépend du socle, **jamais l'inverse**.

| Statut | Modules |
|--------|---------|
| **Infra du socle** (dossiers, pas des `@Module` métier) | `shared/`, `database/`, `core/`, `utils/` — **inchangés** |
| **Modules du socle gardés tels quels** | `auth/`, `mail/` |
| **Module du socle étendu** | `users/` (voir §5) |
| **Modules du socle gardés et adaptés** | `chat/` (voir §6.1), `content/` (§6.2), `notifications/` (§6.3) |
| **Nouveaux modules Amisache** | `address/`, `church/`, `type/`, `liturgy/`, `payment/`, `community/` |

**Aucune suppression.** `content/`, `chat/`, `notifications/` sont conservés (ce ne sont pas
des démos jetables dans le cas d'Amisache — voir §6).

---

## 3. Modèle de données → mapping entité ⇄ module

Le modèle complet (attributs, cardinalités, enums) vit dans `diagramme-classe-paroisses.mermaid`.
Répartition des entités par module :

- **`address/`** — `Country`, `Region`, `Zone`, `Village` (tables) + **`Address`** (value object
  **embarqué**, pas une table — voir §4). Fondation géo, ne dépend d'aucun module métier.
- **`type/`** — `Type` (table de lookup mutualisée, discriminée par `TypeScope`). Importée par
  `liturgy/`, `payment/`, `community/`.
- **`church/`** — `Church` (racine multi-tenant auto-référente), `ClergyMember` (jointure
  `User`⇄`Church` du **clergé** : rôle + période), `Membership` (jointure `User`⇄`Church` du
  **fidèle** : paroisses suivies, sans rôle), `Entrance` (portes, position GPS).
- **`liturgy/`** — `Schedule`, `Request` (intention de messe **et** demande de sacrement,
  discriminées par `Type`), `Donation`.
- **`payment/`** — `Payment`, `PaymentMethod`.
- **`community/`** — `Publication`, `Media`, `Group`, `GroupMember`.

**Dépendances entre modules métier** (toutes descendantes, aucun cycle) :
`address/` et `type/` ne dépendent de rien de métier → `church/` dépend de `address/` →
`liturgy/`, `payment/`, `community/` dépendent de `church/` (+ `type/`, + `users/`).
`liturgy/` importe `payment/` (offrande de `Request`, `Donation` → `Payment`).

---

## 4. Conventions du socle appliquées au métier Amisache

Rien de nouveau ici : ce sont les règles de `CLAUDE.md`, juste rappelées là où elles touchent
les entités Amisache.

- **Toute entité étend `Audit`.** Donc **ne pas** redéclarer `id`, `createdAt`, `updatedAt`,
  `deletedAt`, `createdBy`, `updatedBy` — ils viennent de `Audit`. Toutes les entités Amisache
  héritent du soft-delete et de l'audit sans effort. (Le diagramme montre `id` par lisibilité ;
  à l'implémentation il disparaît des entités.)
- **`static entityName` + `static entityCode` sur chaque entité**, `code` généré en
  `@BeforeInsert`. `User = "01"`. **Vérifier les codes déjà pris par le socle**
  (`UserDevice`, `UserSession`, `MailFailedJob`) puis **réserver une plage `20`+ pour Amisache**
  afin d'éviter toute collision avec le template.
- **Relations = scalaire `***Id` (lecture seule, même colonne physique) + objet `@ManyToOne`
  (`eager: false`).** C'est déjà la convention du diagramme (`xId` + `x`). Ne jamais assigner le
  scalaire directement : `entity.relation = { id } as any`.
- **Enums métier en `MAJUSCULES`, dans leur module** (`church/…`, `liturgy/…`), **pas** dans
  `shared/common.enum.ts` — `shared/` doit rester neutre et réutilisable par les autres projets
  dérivés. Les enums `User*` du socle gardent leur casse d'origine (minuscules). Les deux
  conventions cohabitent, aucun recasage du template.
- **Codes d'erreur : tranche `3xxx`** (le socle réserve `1xxx` Auth, `2xxx` User).
- **Spatial MySQL 8** : `location: Point` (déjà utilisé), `Church.perimeter: Polygon`.
  Voir §7 pour les règles de validation.

### `Address` — value object embarqué, pas une table

`Address` **n'est pas une entité** : c'est une classe *embeddable*, embarquée dans l'entité
hôte (aujourd'hui `Church`) via composition `1--1`. Ses colonnes vivent dans la table de l'hôte.
Conséquence TypeORM : **un embedded ne porte pas de relation `@ManyToOne`**. Donc dans `Address`,
`zoneId`/`villageId` restent de **simples colonnes `uuid`** ; les relations navigables vers
`Zone`/`Village`, si nécessaires, se déclarent **sur l'entité hôte** (`Church`), pas dans le VO.

---

## 5. Réconciliation de `User`

**On étend l'entité `users/` existante, on ne la réécrit pas** (règle `CLAUDE.md` :
« chaque projet étend `User` avec ses propres colonnes »).

- **Ajouts** : `phone` (indispensable au Bénin, lié au flux MoMo) ;
  `homeChurchId` (**paroisse de référence** — celle où le fidèle va au quotidien).
- **Réutilisé** : `idCountry` **existe déjà** sur `User` → le mapper sur le `Country` du module
  `address/`, **ne pas** introduire un nouveau `countryId`.

**Rattachement paroissial du fidèle — deux mécanismes complémentaires** (cf. `CLAUDE.md`,
§ « faible vs forte cardinalité ») :
- **Une paroisse de référence → scalaire sur `User`.** `homeChurchId` (colonne `uuid` +
  `@ManyToOne(() => Church)`), lu à chaque requête (accueil, fil par défaut) sans jointure.
- **Plusieurs paroisses suivies → table de jointure `Membership`** (dans `church/`, **pas**
  `users/`). C'est le **symétrique de `ClergyMember`**, mais pour un fidèle : `churchId`,
  `userId`, `since: date`, **sans rôle**. Index unique `(userId, churchId)`.
- **Articulation** : la référence est **toujours** une des paroisses suivies →
  règle métier `homeChurchId` ∈ `Membership` du même user. Redondance **assumée** (vitesse de
  lecture du scalaire contre une invariante à tenir côté service).
- **« La plus proche » relève de l'onboarding, pas du modèle** : à l'inscription, proposer par
  défaut la paroisse la plus proche (requête spatiale MySQL `ST_Distance` sur `Church.location`),
  que le fidèle confirme ou change. Le modèle ne stocke que le choix final.
- **`UserRole` = `user` / `admin` / `engineer` (bypass technique) / `manager` (conservé du
  socle) / `clergy`.** Les valeurs `agent`/`investor` héritées d'un autre projet sont
  retirées ; `manager` est gardé (utilisé par la logique socle générique d'accès au client
  API `manager` — `AuthService.assertClientAccess`). `clergy` est un **marqueur plateforme
  grossier** — « ce compte appartient au clergé/personnel » — ajouté en remplacement de
  `agent` pour ce même contrôle d'accès (`ApiClientType.manager` exige désormais
  `UserRole.clergy`, plus `UserRole.agent`). **Il ne porte aucun détail de fonction ni
  d'affectation par église : les rôles ecclésiaux précis (et l'historique par église) ne
  passent PAS par `UserRole`** — ils vivent dans `ClergyMember.role` (`EcclesialRole`) +
  `ClergyMember.churchId`. Ne jamais dériver une autorisation *par église* de
  `UserRole.clergy` seul (risque de fuite cross-tenant — voir §10 « isolation multi-tenant »).
- **`UserStatus` = celui du socle** (`active` / `unverified` / `disabled` / `blocked` /
  `deleted`). Le `PENDING` de l'esquisse Amisache correspond à `unverified`.

> ⚠️ **`users/` ne connaît pas `church/`.** `homeChurchId` reste une **colonne `uuid` scalaire** ;
> **ne pas importer `ChurchModule` dans `UsersModule`** (ce serait inverser la dépendance socle→métier).
> La relation navigable se gère côté `church/`.

---

## 6. Modules du socle à adapter

### 6.1 `chat/` — messagerie avec le clergé

Réutilisé pour le chat fidèle ⇄ membre du clergé. Le modèle générique (`chat-model.mermaid`)
convient tel quel ; les adaptations sont **légères et ciblées**.

- **À adapter — uniquement les enums d'acteurs** : `ParticipantRole` (`DRIVER`/`CLIENT`/
  `ASSIGNED_AGENT` → `FAITHFUL`/`CLERGY`, en gardant `OWNER`/`MEMBER`).
- **Inchangés** : `ActorType` (`HUMAN`/`AI`/`SYSTEM`), `ConversationMode` (`BOT`/`AGENT`).
  L'**assistant** (rangé dans `content/`) devient le mode `BOT` de ce chat, avec handoff
  `BOT → AGENT` vers un `ClergyMember`.

> ⚠️ **RÈGLE DURE — ne pas casser le polymorphisme.** `chat/` reste **agnostique du métier** :
> il référence ses sujets par `subjectType` + `subjectId` et ses acteurs par `senderType`/
> `actorType` + `senderId`/`actorId` — **colonnes plates, aucune FK dure**. Il n'importe **ni
> `church/` ni `liturgy/`**. Les liens vers `Request`/`Church`/`ClergyMember` se font **par id,
> sans contrainte FK** : c'est l'application qui résout la cible selon `subjectType`.
> **Ne jamais** « améliorer » `subjectId` en un `@ManyToOne(() => Request)` — cela re-souderait
> le chat au métier et lui ferait perdre sa réutilisabilité. Prix assumé du pattern : pas
> d'intégrité référentielle garantie par la base → validation et nettoyage à la charge du code.

- **Ordre d'implémentation (MVP)** : `Conversation` + `Participant` + `Message` d'abord ;
  différer `MessageReceipt` (accusés multi-participants), `Attachment`, et `CallEvent` (appels).

### 6.2 `content/` — contenu de la plateforme

Porte l'**assistant**, la **FAQ**, la page **contact**, les **paramètres** : contenu
**institutionnel et transverse**, maîtrisé par la plateforme — **non multi-tenant**.

- **Frontière avec `community/`** (à respecter pour éviter tout doublon) :
  `content/` = contenu **de la plateforme** ; `community/` = contenu **produit par les paroisses**
  (annonces, médias, groupes), rattaché à un `Church`.
- ⚠️ **TODO** : le modèle de données de `content/` n'a pas encore été fourni. À caler avant de
  générer `community/`, pour vérifier qu'une éventuelle notion de « publication/article » de
  `content/` ne recoupe pas le `Publication` de `community/`.

### 6.3 `notifications/` — feed in-app (dormant)

Gardé **en dormance** pour une version ultérieure (feed persistant : rappel de messe demandée,
confirmation de paiement, réponse du clergé). Coût quasi nul tant qu'il n'est pas activé.

> Distinct du `NotificationService` **FCM** de `auth/` (push à la connexion). Garder ou activer
> l'un n'affecte pas l'autre.

---

## 7. Règles dures spécifiques Amisache (à ne pas franchir)

1. **Sens de dépendance** : rien ne dépend des modules métier ; eux dépendent du socle. Entre
   modules métier, tout descend (§3), aucun cycle, aucun `forwardRef()`.
2. **`users/` n'importe pas `church/`** — `homeChurchId` reste un scalaire `uuid` sur `User` ;
   la logique de rattachement paroissial (jointure `Membership`) vit dans `church/`, jamais dans
   `users/` (§5).
3. **`address/` et `type/` = fondation** — ne dépendent d'aucun module métier.
4. **`chat/` reste polymorphe** — aucune FK dure vers le métier (§6.1).
5. **`Church.perimeter`** : la contrainte « 4 à 20 sommets » est une **validation métier**
   (DTO/service), pas une contrainte de schéma. Le ring MySQL doit être **fermé** (dernier
   sommet = premier).
6. **Confirmation de paiement** : `Payment.confirmedBy` pointe vers **`ClergyMember`**, jamais
   un `User` quelconque — seul le clergé/personnel confirme l'argent.

---

## 8. Décisions ouvertes

- **Modèle de `content/`** à fournir → verrouiller la frontière `content/`⇄`community/` (§6.2).
- **Registres sacramentels & délivrance de certificats** : features sensibles, en attente
  d'arbitrage ecclésial. Ne pas implémenter sans décision explicite.

---

## 9. Ordre d'implémentation suggéré (MVP)

Suit les dépendances, du plus fondamental au plus dérivé :

1. `type/` puis `address/` — fondation, aucune dépendance métier.
2. `church/` (avec `ClergyMember` et `Entrance`) — racine multi-tenant.
3. **Extension de `User`** (`phone`, `homeChurchId`, mapping `idCountry`) + `UserRole`/`UserStatus`.
4. `liturgy/` (`Schedule`, `Request`, `Donation`).
5. `payment/` (`Payment`, `PaymentMethod`) + flux MoMo déclaratif.
6. `community/` (une fois la frontière avec `content/` calée).
7. Adaptation de `chat/` (enums d'acteurs) et `content/`.

---

## 10. Stratégie de tests

Principe : **ne pas tout tester, tester ce qui fait mal si ça casse.** Le socle
(`auth/`, sessions, tokens) est déjà éprouvé en production sur les autres projets dérivés du
template — le re-tester serait du gaspillage. L'effort porte sur le **métier Amisache** et ses
invariants : ceux qui corrompent les données ou la sécurité s'ils lâchent.

**Invariants prioritaires** (déjà posés ailleurs dans ce fichier — les tests les gardent) :

- **Isolation multi-tenant** — un `ClergyMember` de la paroisse A ne peut ni lire ni modifier
  les `Request` / `Payment` / `Publication` de la paroisse B. C'est **le** risque structurel
  d'un SaaS multi-tenant : à tester explicitement, pas à supposer.
- **Autorisation de confirmation de paiement** (§7.6) — `Payment.confirmedBy` doit être un
  `ClergyMember` de *cette* paroisse, jamais un `User` quelconque. **Test le plus important du
  projet** (sécurité financière).
- **`homeChurchId ∈ Membership`** (§5) — impossible de désigner comme paroisse de référence une
  paroisse non suivie. Vérifié côté service `church/`.
- **Cohérence de la hiérarchie `Church`** (§1) — aucun cycle parent ; un `EntityType` enfant
  cohérent avec son parent (une `PAROISSE` sous un `DOYENNE`, jamais l'inverse).
- **`Church.perimeter`** (§7.5) — validation « 4 à 20 sommets » et ring fermé.

**Trois niveaux, par ordre de rentabilité :**

1. **Unitaire sur les services** — le gros de la valeur, rapide, mockable : toutes les
   validations et invariants ci-dessus.
2. **Intégration avec vraie DB** — tout ce qui est **spatial** (`ST_Distance` pour la paroisse
   la plus proche, `perimeter`). Le spatial MySQL ne se teste pas en mock, il faut une vraie base.
3. **E2E** (Playwright, déjà amorcé via `seed-test-user.ts`) — peu nombreux, sur les parcours
   bout-en-bout critiques : onboarding avec choix de paroisse proche, et le flux complet
   demande de messe → paiement MoMo → confirmation par le clergé.

**Discipline (pour Claude Code) :**

- Écrire le test de la règle métier **en même temps** que le service, pas après.
- Quand un test révèle un bug du **socle**, le test qui le prouve **remonte avec le fix** dans
  `TEMPLATE-FIXES.md` (§ critère de ce fichier).
