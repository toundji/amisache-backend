# Cahier des charges — Amisache

**Plateforme SaaS d'agrégation des paroisses catholiques**
*Version de travail — issue de la modélisation du domaine*

---

## 1. Présentation du projet

### 1.1 Contexte

L'Église catholique du Bénin ne dispose pas d'une plateforme numérique unifiée permettant aux fidèles de découvrir les paroisses, consulter les horaires de messe, demander des intentions et des sacrements, soutenir financièrement leur communauté et suivre sa vie (annonces, médias). Chaque paroisse qui souhaite une présence en ligne doit aujourd'hui la construire isolément, sans cohérence ni mutualisation.

**Amisache** (« mon église ») répond à ce besoin : une plateforme mutualisée qui agrège l'ensemble des entités de l'Église catholique, tout en donnant à chacune le sentiment d'un espace **qui lui appartient**.

### 1.2 Sens du nom

« Amisache » signifie « mon église ». Le possessif est central : l'adhésion des paroisses dépend de leur capacité à se sentir propriétaires de leur page (nom, photo, logo, couleurs, mot du responsable), même au sein d'une infrastructure partagée.

### 1.3 Objectifs

- Offrir un **annuaire** vivant des entités catholiques (du diocèse à la chapelle) et de leur vie liturgique.
- Permettre aux fidèles de **demander des intentions de messe et des sacrements** en ligne.
- Faciliter le **soutien financier** (dons, denier du culte) via Mobile Money.
- Donner à chaque entité un **espace de communication** (annonces, événements, médias).
- Concevoir dès l'origine une architecture **extensible à d'autres pays africains**.

### 1.4 Parties prenantes

| Partie prenante | Rôle |
|---|---|
| Conférence épiscopale du Bénin | Autorité institutionnelle nationale, caution du projet |
| Diocèses / archidiocèses | Administration diocésaine, communication, collectes |
| Paroisses | Utilisateur institutionnel principal (le « tenant ») |
| Communautés / chapelles | Sous-unités territoriales recevant demandes et vie locale |
| Clergé et personnel | Curés, vicaires, catéchistes, secrétariat — gestion du back-office |
| Fidèles | Utilisateurs finaux : découverte, demandes, dons, suivi |

---

## 2. Périmètre et principes directeurs

### 2.1 Principes de conception

1. **Multi-tenant** — chaque entité (paroisse notamment) est isolée logiquement mais partage l'infrastructure.
2. **Multi-pays par conception** — ajouter un pays = insérer un niveau au sommet, sans restructurer le reste.
3. **Mutualisation** — privilégier une table générique discriminée plutôt qu'une multiplication de classes spécialisées (types, hiérarchie, demandes, personnes).
4. **Identité par entité** — chaque niveau dispose de sa propre page personnalisable, facteur clé d'adoption.
5. **Personnalisation contrôlée** — gabarits fixes à emplacements limités, pour préserver la cohérence visuelle.
6. **Réalisme des paiements** — flux Mobile Money déclaratif et validé manuellement, reflétant l'infrastructure locale.
7. **Fondement théologique** — les choix de nommage et de structure suivent l'ecclésiologie catholique.

### 2.2 Périmètre fonctionnel

- Découpage administratif multi-pays (module Adresse).
- Hiérarchie ecclésiale unifiée (conférence → diocèse → doyenné → paroisse → communauté → église/chapelle).
- Pages et identité visuelle par entité.
- Comptes utilisateurs et habilitations par affectation.
- Vie liturgique : horaires récurrents (messes, confessions, adoration…).
- **Découverte et proximité** : trouver les églises proches et les messes en cours ou à venir, dans mon église comme alentour.
- Demandes : intentions de messe et sacrements (table unifiée).
- Dons et paiements Mobile Money déclaratifs.
- Publications et médias (fil d'actualité, vidéos, albums).
- Groupes et communautés (chorales, mouvements, associations).

### 2.3 Hors périmètre / à arbitrer

- **Registres sacramentels** officiels (baptêmes, mariages) — sensible, à cadrer avec l'autorité ecclésiale.
- **Délivrance de certificats** (extraits d'actes) — sensible, à arbitrer.
- Intégration **automatique** des API Mobile Money (prévue après le flux déclaratif).

---

## 3. Acteurs et habilitations

Le modèle distingue **deux axes de rôle**, indépendants :

**Rôle de compte (plateforme)** — porté par `User.role` (`UserRole`), issu du socle d'authentification :

| Valeur | Description |
|---|---|
| `USER` | Compte standard (fidèle par défaut) |
| `ADMIN` | Exploitant de la plateforme Amisache |

**Fonction ecclésiale (par entité)** — portée par l'affectation `ClergyMember.role` (`EcclesialRole`) :

| Valeur | Description |
|---|---|
| `ARCHBISHOP` / `BISHOP` | Ordinaire du lieu |
| `PRIEST` / `VICAR` / `DEACON` | Clergé paroissial |
| `CATECHIST` | Catéchiste (laïc) |
| `SECRETARY` | Secrétariat (laïc) |
| `ADMIN` | Administrateur laïc (ex. communication) |

**Principe d'habilitation** : les droits de back-office **se dérivent des affectations**. Un utilisateur peut gérer une entité s'il y possède une affectation (ou sur une entité parente). Un fidèle est un `User` sans affectation, relié à son église par le lien « favorite ».

---

## 4. Exigences fonctionnelles

### 4.1 Module Adresse (découpage administratif)

- Structure fixe à trois niveaux modélisés : `Region` → `Zone` → `Village`, sous `Country`.
- Les **libellés d'affichage** viennent de la configuration du pays (`Country.subdivisions`), pas du nom des tables.
- Prise en charge des **niveaux sautés** : la hiérarchie réelle complète est décrite par `Country.allSub` ; tout niveau non modélisé est déduit et sa valeur stockée dans `parentSub` du niveau modélisé en dessous.
- Le niveau `Village` n'est **pas exhaustif** ; une entité s'ancre toujours sur la `Zone` (obligatoire) et référence le `Village` si connu.
- Toute entité localisable embarque l'objet-valeur `Address` (localité, repère, GPS + ancrage `Zone`/`Village`).

> Ce module est documenté séparément et réutilisable (voir `module-adresse.md`).

### 4.2 Hiérarchie ecclésiale

- **Une seule table `Church`**, auto-référente : chaque entité porte `parentId` vers son parent, et un `type` (`EntityType`) : `CONFERENCE`, `ARCHDIOCESE`, `DIOCESE`, `DOYENNE`, `PAROISSE`, `COMMUNAUTE`, `CHURCH`, `CHAPEL`.
- L'auto-référence gère nativement les **niveaux manquants** (pays sans doyennés) et l'ajout de niveaux (communautés).
- Une chapelle ou église est un nœud feuille rattaché à sa paroisse **ou** à sa communauté (souplesse assumée).
- Le nom `Church` reflète l'ecclésiologie : chaque niveau est l'Église à son échelle (Église particulière = diocèse, etc.).
- Règle métier : le `type` du parent doit correspondre au niveau immédiatement supérieur (intégrité applicative).

### 4.3 Pages et identité

- Chaque `Church` porte : `name`, `slug` (lien partageable), `leaderMessage` (mot du responsable), `bannerPhoto`, `accentColor`.
- Un statut de validation (`ValidationStatus` : `PENDING` / `APPROVED` / `SUSPENDED`) encadre l'entrée d'une entité sur la plateforme.
- La personnalisation est **contrôlée** (palette et gabarits limités) pour préserver la cohérence.

### 4.4 Comptes utilisateurs

- Table `User` **unique** : toute personne (fidèle, clergé, administrateur) en dérive.
- Champs : identité, `email`, `phone`, `password`, `role` (`UserRole`), `status` (`UserStatus` : `ACTIVE` / `PENDING` / `BLOCKED`).
- Le rattachement fonctionnel à une entité passe par `ClergyMember` (affectation avec rôle et période), en **plusieurs-à-plusieurs** : un prêtre peut servir plusieurs entités, une entité a plusieurs membres. L'historique des affectations est conservé (`startDate` / `endDate`).

### 4.5 Vie liturgique — horaires

- `Schedule` décrit un horaire **récurrent** rattaché à une entité (église/chapelle).
- Récurrence exprimée par `frequency` (`DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `ONCE`), `dayOfWeek` et `weekOfMonth` (ex. « 2ᵉ dimanche du mois »).
- `season` (`ORDINARY`, `LENT`, `ADVENT`, `PATRON_FEAST`) et `startDate`/`endDate` gèrent les horaires temporaires.
- Le `type` d'horaire (messe, confession, adoration, permanence) provient de la table `Type`.
- `duration` (durée en minutes) permet de connaître la fin d'une célébration et de détecter une messe **en cours**.

### 4.6 Demandes — intentions et sacrements

- **Table unifiée `Request`** couvrant intentions de messe et demandes de sacrement, discriminées par le `scope` du `Type` lié (`INTENTION` / `SACRAMENT`).
- Champs : `date`, `text`, `offering`, `attachments`, `status` (`RequestStatus` : `SUBMITTED` → `IN_PROGRESS` → `CONFIRMED` → `COMPLETED`, ou `REJECTED`).
- Une demande est adressée à une entité (`Church` — paroisse, communauté ou chapelle) et soumise par un `User`.
- Pour une intention, le lien `Request → Schedule` précise **quelle messe** ; combiné à `date`, il identifie la célébration exacte.
- Une demande peut porter un `Payment` (offrande de messe, frais de dossier).
- Règle métier : la `date` doit être une occurrence valide du `Schedule`.

### 4.7 Dons et paiements

- **Flux déclaratif à validation manuelle** (pas d'intégration API au démarrage) :
  1. L'entité publie ses coordonnées d'encaissement (`PaymentMethod` : opérateur, numéro, titulaire).
  2. Le fidèle paie de son côté (MTN MoMo, Moov Money) et **joint son reçu** (`Payment` : `reference`, `receiptImage`, `paidAt`, statut `SUBMITTED`).
  3. Un **membre du clergé/personnel** confirme la réception (`confirmedBy` → `ClergyMember`, statut `CONFIRMED` / `REJECTED`).
- Contrainte : la confirmation est réservée à un `ClergyMember` (jamais un fidèle), et son entité doit correspondre à celle de la demande/du don (règle métier).
- Le `Payment` est mutualisé entre `Request` et `Donation`.

### 4.8 Publications et médias

- `Publication` est l'unité de contenu du **fil** d'une entité : annonce, événement, vidéo, album… (genre porté par le `Type`, `scope=PUBLICATION`).
- Auteur : une entité (`churchId`, toujours) et, optionnellement, un **groupe** (`groupId`) — une chorale peut publier sur sa page comme sur le fil de l'église.
- `Media` (0..*) rattaché à une publication : `kind` (`VIDEO` / `IMAGE` / `AUDIO`), `provider` (`YOUTUBE`, `UPLOAD`, `FACEBOOK`, `OTHER`), `url`. Gère les vidéos YouTube de messe, les vidéos de chants, les albums photos.
- Cycle de publication : `PublicationStatus` (`DRAFT` / `PUBLISHED` / `ARCHIVED`).

### 4.9 Groupes

- `Group` (`GroupType` : `CHOIR`, `MOVEMENT`, `ASSOCIATION`, `OTHER`) rattaché à une entité.
- Adhésion des fidèles via la table de jointure `GroupMember` (plusieurs-à-plusieurs).

### 4.10 Table de types mutualisée

- `Type` centralise toutes les listes évolutives, discriminées par `scope` (`INTENTION`, `SACRAMENT`, `DONATION`, `PUBLICATION`, `SCHEDULE`).
- Ajouter un type ne nécessite **aucun redéploiement**. Règle métier : chaque entité ne référence que des types de son propre scope.

### 4.11 Découverte et recherche de proximité

Fonction phare pour l'usage quotidien du fidèle : « où et quand est la prochaine messe autour de moi ». Elle s'appuie sur des données déjà présentes dans le modèle, sans nouvelle table.

- **Églises proches** : à partir de la position GPS du fidèle, lister et trier les entités par distance, via le point géographique `location` de l'`Address`.
- **Messes autour de moi** : agréger les prochaines occurrences de messe des églises proches, calculées à partir des `Schedule` (récurrence + `season` + `duration`), avec distinction **« en cours »** / **« à venir »**.
- **Mes messes** : accès rapide aux horaires de l'église favorite du fidèle (`User.favoriteChurch`) et des églises proches.
- **Filtres** : par distance, par créneau (aujourd'hui, ce week-end), par langue de célébration, par type (messe, confession…).
- Les occurrences sont **calculées à la volée** à partir des horaires récurrents ; aucune table d'occurrences au démarrage.

> Évolution possible : une gestion d'**exceptions** (messe annulée ou déplacée un jour donné) et/ou de célébrations exceptionnelles hors planning, pour une précision totale de l'affichage.

---

## 5. Architecture technique

### 5.1 Socle

- **Backend** : NestJS, sur base du template `amisache-backend` (authentification, comptes, notifications déjà fournis).
- **ORM** : TypeORM ; clés primaires en **`uuid`**, clés étrangères nommées `<parent>Id`.
- **Base de données** : relationnelle (PostgreSQL recommandé).
- **Recherche géospatiale** : indexation géographique (ex. PostGIS) pour la recherche de proximité église/messe.
- **Objets-valeurs** : `Address` embarqué dans les entités porteuses (pas de table dédiée).

### 5.2 Multi-tenant

- Le « tenant » est l'entité `Church`. L'isolation des données de back-office se fait par filtrage sur la hiérarchie (`churchId` et ses parents).
- Les données de référence (module Adresse, table `Type`) sont partagées.

### 5.3 Modèle de données

Le modèle complet est fourni en pièce jointe : `diagramme-classe-paroisses.svg` (rendu) et `.mermaid` (source). Entités principales :

| Entité | Rôle |
|---|---|
| `Country`, `Region`, `Zone`, `Village` | Découpage administratif (module Adresse) |
| `Address` | Localisation embarquée (objet-valeur) |
| `Church` | Nœud ecclésial unique, auto-référent (conférence → chapelle) |
| `User` | Compte unique de toute personne |
| `ClergyMember` | Affectation personne ↔ entité (rôle, période) |
| `Schedule` | Horaire liturgique récurrent |
| `Request` | Demande unifiée (intention + sacrement) |
| `Donation` | Don |
| `PaymentMethod` | Coordonnées d'encaissement Mobile Money |
| `Payment` | Paiement déclaratif (reçu + confirmation) |
| `Publication`, `Media` | Fil de contenu et médias |
| `Group`, `GroupMember` | Groupes d'affinité et adhésions |
| `Type` | Table de types mutualisée |

### 5.4 Conventions

- Noms de tables et d'attributs en **anglais** ; PK/FK en `uuid` ; FK suffixées `Id` avec l'objet navigable associé.
- Listes évolutives en table `Type` ; listes stables en énumérations.

---

## 6. Exigences non fonctionnelles

- **Sécurité** : confirmation des paiements restreinte au clergé ; habilitations dérivées des affectations ; mots de passe hachés (socle amisache-backend).
- **Multilinguisme** : interface prête pour plusieurs langues (français prioritaire), langue par défaut configurable par pays et par entité.
- **Extensibilité** : ajout d'un pays sans restructuration ; ajout de types sans redéploiement.
- **Cohérence visuelle** : charte graphique appliquée, personnalisation encadrée.
- **Performance** : lecture des adresses sans jointure (objet-valeur embarqué) ; requêtes de back-office indexées par entité.
- **Traçabilité** : historique des affectations et des confirmations de paiement.
- **Protection des données** : cadre à définir pour les données personnelles des fidèles.

---

## 7. Contraintes

- Infrastructure de paiement locale : **MTN Mobile Money** et **Moov Money** prioritaires, flux déclaratif manuel.
- Adressage local : orientation par **repère** plutôt que par numéro de rue ; niveau village non exhaustif.
- Validation institutionnelle requise de la Conférence épiscopale du Bénin.

---

## 8. Phasage proposé *(à valider par un arbitrage valeur/effort)*

**MVP** — annuaire et vie liturgique
- Hiérarchie, pages d'entités, module Adresse.
- Horaires de messe, comptes utilisateurs, affectations.
- Découverte de proximité : églises et messes autour de moi.
- Intentions de messe + flux de paiement déclaratif.

**V2** — élargissement
- Demandes de sacrement, dons/denier, publications et médias.
- Groupes et communautés.

**V3** — approfondissement
- Encaissement automatique (API Mobile Money).
- Fonctions sensibles arbitrées (registres, certificats).
- Ouverture multi-pays.

---

## 9. Décisions en suspens

- Modélisation des **registres sacramentels** et de la **délivrance de certificats** (sensibles).
- Rôle explicite de **responsable de groupe** (animateur) si nécessaire.
- Distinction fine de la valeur `CHURCH` du `EntityType` vis-à-vis du nom de classe `Church`.
- Passage éventuel des rôles/fonctions en table `Type` si la liste doit évoluer.

---

## 10. Livrables

- Diagramme de classes : `diagramme-classe-paroisses.svg` / `.mermaid`.
- Documentation du module Adresse réutilisable : `module-adresse.md` / `.svg`.
- Le présent cahier des charges.
