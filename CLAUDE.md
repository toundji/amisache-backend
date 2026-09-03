# CLAUDE.md

> **⚠️ Ce dépôt est le fork applicatif « Amisache » du template UNIFIED AUTH.**
> Le contexte projet et l'état vivant sont chargés automatiquement ci-dessous ;
> `AMISACHE.md` porte le **rituel de session** complet (ordre de lecture, clôture).
> En cas de conflit, les **règles du socle** (plus bas dans ce fichier) priment —
> le métier ne fait que s'ajouter par-dessus, jamais contredire le socle.

@AMISACHE.md
@EVOLUTION.md

> *Bloc propre au fork Amisache : ne **jamais** le remonter au repo template
> (le socle doit rester agnostique du métier), et donc pas dans `TEMPLATE-FIXES.md`.*
> *`src/auth/auth.md` reste en lecture **conditionnelle** — voir le rituel dans `AMISACHE.md` —*
> *donc volontairement **non** importé ici, pour ne pas le charger à chaque session.*

---

Contexte pour les assistants IA travaillant sur **UNIFIED AUTH** — template NestJS
universel d'authentification/utilisateurs (JWT double-token, sessions multi-équipements,
PIN Argon2id, OTP, Google Firebase Auth, notifications FCM, mail asynchrone BullMQ avec
relance). Ce repo n'a pas de domaine métier propre — c'est le socle que chaque projet
étend. Historique détaillé du module `auth/` : `src/auth/auth.md`.

## Commandes

```bash
npm run start:dev        # dev, watch
npm run build            # nest build
npm run start:prod       # node dist/main
npm run lint             # eslint --fix
npm test                 # jest
npm run migration:run    # applique les migrations en attente
npm run migration:generate -- src/database/migrations/Nom  # génère une migration depuis le diff des entités
npm run seed              # seed idempotent (admin principal pour l'instant)
npm run seed:refresh      # supprime puis recrée l'admin principal
```

### Seed

`src/seeder.ts` est l'entrypoint CLI — lifecycle uniquement (connexion `DataSource`
TypeORM des migrations, flag `--refresh`, pas de boot Nest complet, pas besoin de
Redis/BullMQ). La logique de chaque seed vit dans `database/seeds/` (un fichier par
concern, ex. `seed-admin.ts`) pour rester ajoutable sans toucher l'entrypoint. Nécessite
les migrations déjà appliquées. Variables `.env` requises : `SEED_ADMIN_EMAIL`,
`SEED_ADMIN_PASSWORD` (validées — email au format valide, mot de passe ≥ 8 caractères —
**avant** toute connexion DB, pour échouer vite) ; `SEED_ADMIN_FIRST_NAME`/
`SEED_ADMIN_LAST_NAME` optionnels, défaut `Admin`/`Système`. Mot de passe haché via
`apiHashPassword` (bcrypt, même fonction que `AuthService.register()`) — pas Argon2id, pour
rester compatible avec `apiComparePasswords` au login. `npm run seed` est idempotent
(ignore si l'email existe déjà) ; `--refresh` fait un hard delete puis recrée (nécessaire
pour libérer la contrainte unique sur l'email, un soft-delete ne suffirait pas).

**`seed-test-user.ts`** — seed **optionnel** d'un compte de test E2E (Playwright…),
même gabarit que `seed-admin.ts`. Ignoré si `SEED_TEST_USER_EMAIL` est vide (opt-in
par projet dérivé) ; si renseigné mais invalide → throw avant connexion DB, comme
l'admin. Créé avec `status: active` (déjà vérifié → login direct, pas de flux OTP) ;
rôles via `SEED_TEST_USER_ROLES` (CSV, défaut `user`). **Refuse de s'exécuter en
production** (`NODE_ENV=production`) sauf `SEED_TEST_USER_ALLOW_PROD=true` — un compte
à mot de passe connu n'a rien à faire en prod. Voir `.env.example` pour toutes les clés.

## Architecture

Découpage par responsabilité, avec une **règle de dépendance à sens unique** :

```
shared/  ←  database/  ←  core/  ←  mail/  ←  auth/  ←  users/
```

| Dossier      | Rôle                                                                 | Dépend de        |
|--------------|------------------------------------------------------------------------|------------------|
| `shared/`    | Primitives **pures** — aucune DI, aucun `@Module` (`audit.ts`, `common.enum.ts`, `media.dto.ts`) | rien             |
| `database/`  | Config ORM (`base_orm_config.ts`, `synchronize: false`), `data-source.ts` (CLI migrations), `migrations/`, `seeds/` | shared           |
| `core/`      | Infra Nest : guards, middleware, interceptors, filters, decorators   | shared, database |
| `utils/`     | Helpers sans état : `api-util`, `api-error`, `api-fs` (stockage fichiers), `redis.config`, `swagger-config` | shared |
| `auth/`      | **Flux** d'authentification + sécurité compte : `AuthService`, `AuthController`, `NotificationService` (FCM), `SessionService`, `PasswordService`, `OtpService`, entités `UserDevice`/`UserSession` | shared, core, utils, mail (+ l'entité `User` de `users/`, importée pour son propre `TypeOrmModule.forFeature`) |
| `users/`     | Agrégat utilisateur : `User`, `UserService`, `UserController`        | shared, core, utils, auth (`SessionService`/`PasswordService`) |
| `mail/`      | Mail asynchrone BullMQ + relance                                     | shared, utils    |

### Règles non négociables

- **Rien n'importe depuis `auth/`** sauf via son API publique.
- **`users → auth` uniquement, jamais l'inverse.** Pas de `forwardRef()`. `AuthModule`
  s'enregistre lui-même dans `TypeOrmModule.forFeature([User, UserDevice, UserSession])`
  en import**ant l'entité** `User` de `users/` (import de classe, pas du module).
  `AuthService.findOrCreateGoogleUser` est une méthode privée avec son propre
  `Repository<User>` — la seule chose que `auth/` aurait pu emprunter à `users/`.
- **`mail/` et `utils/` ne dépendent d'aucune entité métier.** Typer sur une interface
  structurelle locale (`MailRecipient` dans `mail.types.ts`, `JwtPayloadUser` dans
  `api-util.ts`) plutôt que d'importer `User`.
- **Un seul système de hash** : Argon2id via `PasswordService`. Ne jamais réintroduire de
  `bcrypt` / `hashSync` libre dans les utils.
- `shared/` reste **pur** : classes/enums/DTOs sans injection, jamais de `@Module` ni de provider.

## Conventions

### Entités

Toute entité étend `Audit` (`shared/audit.ts`) → id `uuid` — timestamps d'audit. Chaque
entité déclare `static entityName` et `static entityCode`. Un `code` lisible est généré en
`@BeforeInsert` : `entityCode + Date.now()`. Chaque projet **étend** `User` avec ses propres
colonnes — il ne le réécrit pas depuis `auth/`.

### Gestion des relations

Chaque relation `@ManyToOne` est doublée d'une colonne scalaire `***Id` mappée sur la
**même colonne physique**. Le scalaire sert au select rapide (listes, sans jointure) ; la
relation sert au chargement complet (détail).

**Règles entité**

1. Le scalaire et le `@JoinColumn` doivent partager le même `name`.
2. Le scalaire est en LECTURE SEULE. Ne jamais l'assigner directement : modifier via
   `entity.relation = { id } as any`.
3. `eager: false` par défaut, sans exception. Le chargement se décide par requête via
   `relations: [...]`.

```ts
// ─── Relation : Service ─────────────────────────────────────
// ⚠️ serviceId est en LECTURE SEULE — modifier via service: { id } as any

@Column({ name: "service_id", nullable: true })
serviceId?: string;

@ManyToOne(() => Service, { nullable: true, eager: false })
@JoinColumn({ name: "service_id", referencedColumnName: "id" })
service?: Service;
```

**Règles service (backend)**

- Endpoints de liste : ne chargent pas la relation, le `***Id` suffit.
- Endpoints de détail : incluent la relation via `relations: [...]` quand le libellé
  complet est nécessaire.

**Règles frontend (Angular, si applicable au projet)**

Deux cas, selon la cardinalité de la relation.

- **Faible cardinalité — tables de référence** (country, service, profession…) : la liste
  ne renvoie que `***Id`. La liste de référence est récupérée au besoin et conservée dans
  le service Angular dédié ; les composants résolvent le libellé à partir de l'id sans
  rappel réseau tant qu'elle est en mémoire. Le détail peut inclure directement la relation.
- **Forte cardinalité — relations entité** (user→user, order→user…) : on ne peut pas
  conserver toute la liste côté client. La réponse doit embarquer le libellé nécessaire,
  ou prévoir un lookup ciblé par id.

### Tokens

Double JWT. Payload access : `{ sub, email, status, roles, type: 'access', jti, dfp }`.
`dfp` = device fingerprint `SHA-256(userId + deviceName + os + deviceType)`, déterministe
→ logout ciblé par équipement.

### Guards & middleware (ordre)

```
Requête → ApiDeserializationMiddleware  (vérifie JWT sans DB → req.user + dfp,
                                          valide clé API → req.apikey.{valid,type}, parse UA → req.userDevice, IP)
   → ApiKeyGuard              (req.apikey.valid)
   → RequireClientTypeGuard   (req.apikey.type ∈ @RequireClientType(...) si présent sur la route)
   → RequireAuthGuard         (req.user + jti non blacklisté dans Redis)
   → RequireUserStatusGuard   (req.user.status)
   → RequireRoleGuard         (req.user.roles)
```

### Erreurs

Format de réponse uniforme :

```json
{ "statusCode": 401, "msg": "...", "customCode": 1005, "url": "...", "timestamp": "..." }
```

Validation → champ `validations: { field: [msg] }`. 500 → `errorId` pour retrouver le log.
Convention `customCode` : `1xxx` = Auth, `2xxx` = User, `3xxx` = Métier (défini par projet).

### Swagger

`/docs` est affiché dans tous les environnements, y compris en production — protégé par
Basic Auth (`DOC_USER_NAME`/`DOC_PASSWORD`), pas de gate `NODE_ENV`.

### Upload de fichiers

`multipart/form-data` via `nestjs-form-data` (`NestjsFormDataModule.config({ storage:
FileSystemStoredFile, fileSystemStoragePath: './tmp/storage', isGlobal: true })` dans
`AppModule`). DTOs réutilisables dans `shared/media.dto.ts` (`ImageDto`, `DocDto`...) —
combiner `@Body() body: ImageDto` avec `@FormDataRequest()` sur la route. `ApiFsUtils`
(`utils/api-fs.ts`) gère le stockage définitif : `createDir(dir)` crée
`public/storage/<dir>/<YY>`, `saveFile(from, destination)` déplace le fichier temporaire,
`pathToUrl(path)` préfixe avec `API_ADDRESS`. Les fichiers sous `public/` sont servis par
`app.use('/public', expressStatic(...))` dans `main.ts` — sans ça, les URLs générées ne
sont jamais accessibles en HTTP. `public/storage` et `tmp/` sont gitignorés (contenu
généré au runtime, pas versionné). Exemple d'implémentation :
`UserService.updateImageProfile` (`POST /users/profile/image`).

### `public/` — deux natures de contenu, pas le même sort git

`public/assets/` : fichiers statiques du service lui-même (logo, favicon, images
utilisées par les templates mail...) — **versionnés**, fournis avec le code. `public/storage/` :
fichiers produits par l'utilisation du service (uploads, avatars — voir § Upload de
fichiers) — **jamais versionnés**, gitignorés, générés au runtime et propres à chaque
déploiement.

## Identité visuelle — obligatoire pour tout projet dérivé

Ce template part avec une identité neutre, volontairement placeholder. Tout projet qui
en dérive DOIT la remplacer avant d'être considéré comme fini :

- **`public/assets/`** : remplacer les logos/images placeholder par ceux du projet réel.
- **Templates mail** (`src/mail/templates/*.hbs`, notamment `layouts/main.hbs`) :
  mettre à jour la charte graphique (couleurs, dégradés codés en dur dans le `<style>`
  du layout) pour qu'elle corresponde à celle du projet — `APP_NAME`/`APP_TAGLINE`
  (`.env`) alimentent déjà dynamiquement le nom affiché, mais les couleurs, elles, sont
  en dur dans le HTML et ne suivent aucune variable d'environnement.
