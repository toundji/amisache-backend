# TEMPLATE-FIXES.md

**Sas des corrections à remonter au template `UNIFIED AUTH`.**

Amisache **dérive** du socle. Quand on corrige un bug du socle en travaillant ici, la correction
est appliquée localement **et** notée ici, pour être **portée dans le repo template** — afin que
les autres projets dérivés (ambassade, atcrypto…) en bénéficient. Ce fichier est un **pense-bête
temporaire** : une entrée y vit tant qu'elle n'a pas été reportée upstream.

---

## Critère d'entrée (les deux conditions ensemble)

Une correction va ici **si et seulement si** :

1. **Elle touche le socle** — `shared/`, `database/`, `core/`, `utils/`, `mail/`, `auth/`, `users/`
   (pas les modules Amisache `address/`, `church/`, `liturgy/`, `payment/`, `community/`,
   ni `content/`/`chat/`/`notifications/` adaptés).
2. **Elle est générique** — aucune logique métier Amisache. Si le fix contient quoi que ce soit de
   paroissial, il **reste local** et ne remonte pas.

> Une fois la correction **reportée dans le template**, elle se consigne dans la mémoire **du
> template** (`CLAUDE.md` / `auth.md` du repo socle) — le socle a sa propre doc. Ici, on passe
> simplement l'entrée en `✅ Remontée` (ou on l'archive).

---

## À remonter

### FIX-010 — `.gitignore` excluait `src/database/migrations`
- **Statut** : 🔴 À remonter
- **Couche/fichier socle** : `.gitignore`, `database/`
- **Symptôme** : `git status`/`git ls-files` ne montrent jamais les migrations — un seul
  commit initial existait sur le repo, sans aucune migration versionnée, alors que
  plusieurs avaient déjà été générées et appliquées en local.
- **Cause** : `.gitignore` contenait la ligne `src/database/migrations`, excluant tout le
  dossier du suivi git. `synchronize: false` étant la règle du socle (`base_orm_config.ts`),
  les migrations sont la SEULE source de vérité du schéma — les ignorer revient à rendre le
  schéma de la base impossible à reconstruire pour quiconque clone le repo.
- **Correctif** : ligne retirée du `.gitignore`. Les migrations de la session (`AddType...`
  à `AddCommunityModule`) ajoutées au premier commit qui suit ce correctif.
- **Date** : 2026-09-03

### FIX-011 — `swagger.json` versionné alors que généré à chaque boot
- **Statut** : 🔴 À remonter
- **Couche/fichier socle** : `utils/swagger-config.ts`, `.gitignore`
- **Symptôme** : `swagger.json` apparaissait systématiquement modifié après le moindre
  démarrage local de l'app (`node dist/main.js`), sans rapport avec un changement de code
  volontaire — bruit dans les diffs, et le fichier commité était de toute façon obsolète
  (ne reflétait pas les routes réellement exposées, faute d'être régénéré à chaque commit).
- **Cause** : `swagger_config()` fait `writeFileSync('./swagger.json', ...)` sur CHAQUE
  bootstrap (voir `main.ts`), et ce fichier généré était pourtant suivi par git (comme
  `dist/`, qui lui est bien gitignoré).
- **Correctif** : `swagger.json` ajouté au `.gitignore` et retiré du suivi
  (`git rm --cached`). Chaque environnement régénère son propre `swagger.json` au
  démarrage — aucune perte fonctionnelle, `/docs` continue de fonctionner normalement.
- **Date** : 2026-09-03

### FIX-002 — firebase-admin v14 : API namespace retirée
- **Statut** : 🔴 À remonter
- **Couche/fichier socle** : `auth/services/notification.service.ts`, `auth/services/auth.service.ts`
- **Symptôme** : `npm run build` échouait — `admin.auth`, `admin.messaging`, `admin.apps`,
  `admin.credential` introuvables (`TS2694`/`TS2339`) sur `import * as admin from 'firebase-admin'`.
- **Cause** : `firebase-admin@14.x` a retiré l'ancienne API namespace (`admin.auth()`,
  `admin.messaging()`...) de son export racine au profit de l'API modulaire.
- **Correctif** : migration vers les imports modulaires — `getApps`/`initializeApp`/`cert`
  depuis `firebase-admin/app`, `getMessaging` depuis `firebase-admin/messaging`, `getAuth`
  depuis `firebase-admin/auth`.
- **Test** : `npm run build` sans erreur ; démarrage réel de l'app, route `/auth/google`
  mappée correctement.
- **Date** : 2026-09-03

### FIX-003 — argon2 : `Options` renommé `HashOptions`
- **Statut** : 🔴 À remonter
- **Couche/fichier socle** : `auth/services/password.service.ts`
- **Symptôme** : `TS2694` sur `argon2.Options` à la compilation.
- **Cause** : le type exporté par `argon2` (version courante `^0.45.x`) s'appelle
  `HashOptions`, pas `Options`.
- **Correctif** : `argon2.Options` → `argon2.HashOptions`.
- **Date** : 2026-09-03

### FIX-004 — `@nestjs-modules/mailer` : `imports` requis sur `forRootAsync`
- **Statut** : 🔴 À remonter
- **Couche/fichier socle** : `mail/mail.module.ts`
- **Symptôme** : `TS2345` — `Property 'imports' is missing in type ... MailerAsyncOptions`.
- **Cause** : la version courante de `@nestjs-modules/mailer` exige explicitement la clé
  `imports` sur `MailerModule.forRootAsync`, même vide (aucune dépendance injectée ici).
- **Correctif** : ajout de `imports: []` à l'appel `forRootAsync`.
- **Date** : 2026-09-03

### FIX-005 — `mail-failed.entity.ts` : import absolu cassé
- **Statut** : 🔴 À remonter
- **Couche/fichier socle** : `mail/entities/mail-failed.entity.ts`
- **Symptôme** : `TS2307` — `Cannot find module 'src/shared/audit'`, révélé après retrait de
  `baseUrl` du `tsconfig.json` (voir FIX-006).
- **Cause** : import écrit en absolu (`from 'src/shared/audit'`), qui ne fonctionnait que
  grâce à `baseUrl: "./"` — seul usage de ce style dans tout le repo, jamais documenté comme
  convention (toutes les autres entités importent en relatif).
- **Correctif** : `from 'src/shared/audit'` → `from '../../shared/audit'`.
- **Date** : 2026-09-03

### FIX-006 — `tsconfig.json` : options dépréciées par TypeScript 6/7
- **Statut** : 🔴 À remonter
- **Couche/fichier socle** : `tsconfig.json`
- **Symptôme** : `nest build` échouait avec TypeScript 6 — `TS5011` (rootDir non explicite)
  et `TS5101` (`baseUrl` déprécié, erreur bloquante à partir de TS 7.0).
- **Cause** : `tsconfig.json` du template n'avait pas `rootDir` explicite, et gardait
  `baseUrl: "./"` sans qu'aucune convention `paths` ne l'exploite (un seul import l'utilisait
  dans tout le repo — voir FIX-005).
- **Correctif** : ajout de `"rootDir": "./src"`, retrait de `baseUrl` (plus nécessaire une
  fois l'import de FIX-005 corrigé).
- **Date** : 2026-09-03

### FIX-007 — `@bull-board/nestjs` incompatible NestJS 12, non utilisé
- **Statut** : 🔴 À remonter
- **Couche/fichier socle** : `package.json` (dépendances)
- **Symptôme** : `npm install` échouait — `ERESOLVE`, `@nestjs/bull-shared` (peer dep de
  `@bull-board/nestjs`) plafonné à `@nestjs/common <12`.
- **Cause** : `@bull-board/nestjs@9.6.1` n'a pas encore de version compatible NestJS 12, et
  le package n'était de toute façon importé nulle part dans le code (le bloc
  `BullBoardModule` dans `app.module.ts` est resté commenté).
- **Correctif** : `@bull-board/express` et `@bull-board/nestjs` retirés de `package.json`.
  À réintroduire si l'UI Bull Board est un jour activée, une fois une version compatible
  disponible.
- **Date** : 2026-09-03

### FIX-008 — `ioredis` v6 incompatible avec le peer dep de `typeorm`
- **Statut** : 🔴 À remonter
- **Couche/fichier socle** : `package.json` (dépendances)
- **Symptôme** : `npm install` échouait — `ERESOLVE`, `typeorm@1.1.1` exige
  `ioredis@^5.0.4` en peer dep, alors que le template épinglait `^6.0.0`.
- **Cause** : `@nestjs-modules/ioredis` accepte `ioredis >=5.0.0` — rien n'imposait la v6.
- **Correctif** : `ioredis` `^6.0.0` → `^5.0.4`.
- **Date** : 2026-09-03

### FIX-009 — `typescript@7.0.x` incompatible avec `@nestjs/cli@12`
- **Statut** : 🔴 À remonter
- **Couche/fichier socle** : `package.json` (dépendances)
- **Symptôme** : `nest build`/`nest start` refusent de démarrer — erreur explicite du CLI :
  « The installed TypeScript version (7.0.2) does not expose the programmatic compiler API ».
- **Cause** : confirmé en lisant `@nestjs/cli/lib/compiler/typescript-loader.js` —
  `assertProgrammaticApiIsSupported` vérifie `typeof tsBinary.getParsedCommandLineOfConfigFile
  === 'function'`, absente de TypeScript 7.0 (l'API programmatique du compilateur revient en
  7.1, indisponible en stable à ce jour). Ce contrôle s'exécute AVANT tout choix de builder —
  testé avec `builder: "swc"` + `typeCheck: false` dans `nest-cli.json`, sans effet.
- **Correctif** : `typescript` repassé en `^6.0.3` (dernière version stable compatible).
  À remonter en 7.x quand TypeScript 7.1 stable sort, ou qu'une version de `@nestjs/cli`
  assouplit ce contrôle.
- **Date** : 2026-09-03

<!-- Format d'une entrée — copier-coller le squelette ci-dessous :

### [ID] — Titre court du correctif
- **Statut** : 🔴 À remonter
- **Couche/fichier socle** : ex. `core/guards/jwt-auth.guard.ts`
- **Symptôme** : ce qui cassait, observable.
- **Cause** : la vraie raison.
- **Correctif** : ce qui a été changé (générique, sans métier Amisache).
- **Test** : le test qui prouve le fix (à remonter avec, si possible).
- **Date** : AAAA-MM-JJ
-->

---

## Remontées (historique)

_(rien encore)_

<!-- Quand une entrée est portée dans le template, la déplacer ici :

### [ID] — Titre  ✅ Remontée le AAAA-MM-JJ
- Couche/fichier socle : …
- Reportée dans le template : commit / PR / note dans le CLAUDE.md du socle.
-->

---

### Exemple (illustratif — à supprimer au premier vrai correctif)

### FIX-001 — `UserSession` : index unique composite manquant
- **Statut** : ✅ Remontée le 2026-08-30
- **Couche/fichier socle** : `auth/entities/user-session.entity.ts`
- **Symptôme** : `POST /auth/refresh` renvoyait `Duplicate entry … refresh_token_hash`.
- **Cause** : `upsert(['deviceFingerprint','userId'])` sans index unique composite →
  l'upsert dégénérait en INSERT, sessions dupliquées par appareil.
- **Correctif** : `@Index(['userId','deviceFingerprint'], { unique: true })` + migration.
- **Test** : login deux fois même appareil → une seule ligne de session ; refresh OK.
- **Date** : 2026-08-30
- _(cet exemple est repris de `auth.md` uniquement pour montrer le format attendu)_
