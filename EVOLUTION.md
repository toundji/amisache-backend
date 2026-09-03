# EVOLUTION.md

**Journal vivant d'Amisache** — décisions d'architecture, avancement, prochaines étapes.
Sa forme s'inspire de `src/auth/auth.md` (État actuel / Historique / Points d'attention),
mais son périmètre est **le projet Amisache**, pas un module.

> **Discipline (non négociable)** : ce fichier se **lit en début de session** et se
> **complète en fin de session**. Un journal négligé ment. Toute décision structurante,
> tout avancement notable, tout changement de cap y est consigné, daté, en une entrée.

---

## État actuel

**Phase : conception terminée, pré-implémentation.** Aucun code métier écrit à ce jour ;
le socle `UNIFIED AUTH` est en place et sert de base.

Acquis :
- **Modèle de données finalisé** → `diagramme-classe-paroisses.mermaid` / `.svg` (source de vérité).
- **Découpage en modules arrêté** → voir `AMISACHE.md` §2–§3 (6 modules Amisache + modules du
  socle gardés/adaptés).
- **Réconciliation avec le template cadrée** → `AMISACHE.md` §4–§7.

Prochaines étapes ouvertes :
- Modèle de `content/` à obtenir → fermer la frontière `content/`⇄`community/` (`AMISACHE.md` §6.2).
- Génération de l'arborescence NestJS via Claude Code, dans l'ordre `AMISACHE.md` §9.

---

## Historique des décisions

> Format d'une entrée : `### AAAA-MM-JJ — Titre court` puis **Décision**, **Pourquoi**,
> et si utile **Conséquences** (fichiers touchés, invariantes à tenir).

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
