# Mémoire — module `auth/`

Journal des décisions et changements concernant `auth/` et l'architecture générale du template
« UNIFIED AUTH ». Toute modification touchant ce module (structure, placement de services,
wiring de module, comportement du template) doit être consignée ici.

## État actuel

### Contenu de `auth/`

- `controllers/auth.controller.ts` — routes `/auth/*` (register, login, refresh, logout,
  sessions, reset password OTP/lien, PIN, Google).
- `services/auth.service.ts` — orchestrateur : register/login/refresh/logout, Google Firebase
  Auth (`findOrCreateGoogleUser` **privé**, avec son propre `Repository<User>` — n'appelle pas
  `UserService`), délègue à `SessionService`/`OtpService`/`PasswordService`/`NotificationService`.
- `services/otp.service.ts` — génération/envoi/vérification OTP (CSPRNG) + rate limiting Redis.
- `services/session.service.ts` — sessions multi-équipements (modèle Telegram :
  `UserDevice` = équipement physique, `UserSession` = session active).
- `services/password.service.ts` — reset password (OTP + lien email AES-256-GCM), PIN Argon2id
  (`pinCode` est une colonne typée sur `User`, pas de casts `as any`).
- `services/notification.service.ts` — FCM (Firebase Admin SDK), désactivé proprement si
  `FIREBASE_SDK` absent (`initialized = false`, pas de crash).
- `entities/user-device.entity.ts`, `entities/user-session.entity.ts` — entités DB.
- `dto/auth.dto.ts` — DTOs des routes `/auth/*` (register, login, reset, PIN, Google...).
- `dto/auth.type.dto.ts` — `JwtUserInfo`/`AuthApiRequest`, consommés par `core/middleware` et
  `users/controllers/user.controller.ts`.

### Ce qui n'est PAS dans `auth/`

- L'entité `User` (source de vérité unique : `users/entities/user.entity.ts`).
- `UserService`, `UserController` (dans `users/`).

### Wiring du module (`auth.module.ts`)

```ts
@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserDevice, UserSession]), // import de la CLASSE User
    MailModule,                                                 // (users/entities), pas du module
  ],
  controllers: [AuthController],
  providers: [AuthService, NotificationService, OtpService, SessionService, PasswordService],
  exports: [SessionService, PasswordService],
})
```

**Règle de dépendance : `users → auth`, jamais l'inverse.** `AuthModule` n'importe jamais
`UsersModule` — il importe uniquement la **classe** `User` (type + décorateur d'entité) pour
son propre `TypeOrmModule.forFeature`. `UsersModule` importe `AuthModule` pour que
`UserService` consomme `SessionService`/`PasswordService` (`softDeleteMe`, `updateStatus`,
`adminResetPassword`, `hardDelete`). Aucun cycle de modules, aucun `forwardRef()`.

`AuthService.findOrCreateGoogleUser` (Google Firebase Auth) est une méthode **privée** de
`AuthService`, avec son propre `Repository<User>` injecté — elle n'appelle pas `UserService`.
C'est la seule logique de type « recherche/création d'utilisateur » dont `auth/` a besoin ;
plutôt que d'exposer une méthode `UserService` dédiée à ce seul appelant, elle est réécrite
localement dans `AuthService`.

## Historique

### 1. État initial — template monolithique (`documentation.docx`/`documentation1.docx`, v3.0 → v4.0)

Avant tout découpage, l'intégralité du socle vivait dans `src/common/` :

```
common/
├── entities/   audit.ts, common.enum.ts, user.entity.ts, user-device.entity.ts, user-session.entity.ts
├── guards/     jwt-auth.guard.ts, api.decorator.ts
├── middleware/ api-middleware.ts
├── controllers/auth.controller.ts, user.controller.ts   (ajoutés en v4.0)
├── dto/        auth.dto.ts, auth.type.dto.ts, user.dto.ts
└── services/   auth, session, otp, password, user, notification
```

`UserService` vivait dans `common/services/` et `AuthService` l'injectait directement pour
`findOrCreateGoogleUser` — couplage bidirectionnel implicite entre « auth » et « user » puisque
les deux étaient dans le même module sans frontière imposée. `utils/` contenait déjà des
primitives sans DI (`api-util.ts`, `api-error.ts`, `redis.config.ts`, `swagger-config.ts`,
`api-audit.ts`, `api-error-filter.ts`) mais `api-util.ts` importait directement l'entité `User`
pour typer `apiGeneratePayLoad`.

La v4.0 (`documentation.docx`) a ajouté par rapport à la v3.0 (`documentation1.docx`) : le module
`mail/` (BullMQ + relance des emails échoués), la connexion Google Firebase Auth
(find-or-create), les codes d'erreur custom structurés (`ApiErrorCustomCode`), et le champ
`dfp` (device fingerprint) dans le payload JWT pour le logout ciblé par équipement.

### 2. Découpage `common/` → `shared/` + `core/` + `auth/` + `users/`

Réorganisation en couches à dépendance à sens unique
(`shared/ ← core/ ← auth/ ← users/`), reproduisant le modèle déjà stabilisé dans les projets qui
dérivent de ce template :

- **`shared/`** — `audit.ts`, `common.enum.ts` : primitives pures, aucune DI, aucun `@Module`.
- **`core/`** — infra Nest générique : `guards/jwt-auth.guard.ts`, `middleware/api-middleware.ts`,
  `decorators/api.decorator.ts`, `filters/api-error-filter.ts`, `interceptors/api-audit.ts`
  (déplacés depuis `common/guards`, `common/middleware` et `utils/`).
- **`auth/`** — contenu décrit plus haut, déplacé depuis `common/services`/`common/controllers`.
- **`users/`** — `User`, `UserService`, `UserController`, déplacés depuis `common/`.

`findOrCreateGoogleUser` a été sorti de `UserService` vers une méthode **privée** de
`AuthService` avec son propre `Repository<User>` — ça supprime la dépendance implicite
`auth → users` qui existait quand les deux vivaient dans le même module `common/`. Décision
finale : `users → auth` uniquement (`UsersModule` importe `AuthModule` pour
`SessionService`/`PasswordService` ; `AuthModule` importe la classe `User` depuis
`users/entities/`, jamais le module `UsersModule`).

## Changements annexes (hors découpage `common/`)

Fixes ponctuels touchant le socle auth/sécurité, faits en même temps que le découpage
puisqu'ils étaient nécessaires pour que la nouvelle frontière `shared/`↔`core/`↔`utils/` tienne.

### `utils/` et `mail/` ne dépendent plus d'aucune entité métier

- `utils/api-util.ts` important directement `User` pour `apiGeneratePayLoad` violait la règle
  « `utils/` ne dépend que de `shared/` ». Remplacé par une interface structurelle locale
  `JwtPayloadUser` (`{ id, email?, status?, roles? }`).
- `mail/mail.service.ts` important `User` de la même façon — remplacé par `MailRecipient`
  (`{ email?, firstName? }`) dans `mail.types.ts`.

### Validation silencieusement ignorée sur plusieurs routes

- `RegisterDto` était importé avec `import type` dans `auth.controller.ts` — NestJS lit le
  type émis en JS pour décider s'il valide un `@Body()` ; `import type` efface la classe, le
  paramètre retombe sur `Object`, et `ValidationPipe` saute la validation en silence. Même
  piège sur `AdminUpdateStatusDto`/`AdminUpdateRolesDto`/`AdminResetPasswordDto`/
  `UpdateProfileDto` dans `users/controllers/user.controller.ts`. Corrigé (imports de valeur).
- `/auth/register` et `/auth/login` n'avaient pas `@Public()` — sans ça, `RequireAuthGuard`
  rejetait ces routes puisqu'aucun JWT n'est présent avant la première connexion.

### Statut utilisateur absent du JWT

- Le payload JWT (`apiGeneratePayLoad`) ne sérialisait pas `status` → `req.user.status`
  restait `undefined` côté middleware, alors même que `RequireUserStatusGuard` en dépendait
  déjà. Corrigé : `JwtUserInfo`/`JwtPayload` portent désormais `status`, peuplé par
  `ApiDeserializationMiddleware`.

### `RequireClientTypeGuard` — distinguer QUI appelle de DEPUIS OÙ

- Ajout du guard/décorateur `@RequireClientType(...)` (`core/guards/jwt-auth.guard.ts`,
  `core/decorators/api.decorator.ts`) : restreint une route à un type de client (clé API —
  mobile, web, back-office...), indépendamment du rôle JWT de l'utilisateur connecté. Appliqué
  sur `MailController` (`@RequireClientType(ApiClientType.back_office)`).

### `pinCode` promu en colonne réelle sur `User`

- `PasswordService` référençait déjà `user.pinCode` (via des casts `as any`) alors que la
  colonne n'existait pas sur l'entité de base — le PIN Argon2id fait partie du socle universel
  du template (v3.0/v4.0 le documentent déjà), le champ a donc été ajouté à `User` et les
  casts `as any` retirés.

### `main.ts` — Swagger en production, taille des payloads

- Swagger (`/docs`) est désormais **affiché en production**, protégé uniquement par
  `express-basic-auth` (`DOC_USER_NAME`/`DOC_PASSWORD`) — plus de gate `NODE_ENV`.
- `NestFactory.create(AppModule, { bodyParser: false })` + `express.json`/`urlencoded`
  réappliqués manuellement avec `limit: '1gb'` (imports en masse). Le `bodyParser` interne de
  Nest doit être désactivé explicitement, sinon sa propre limite par défaut s'applique avant
  que nos options aient la moindre chance d'être lues.

### `swagger-config.ts` — bouton "Authorize" inopérant

- Nom du header de clé API en dur (`'api-key'`) alors que
  `core/middleware/api-middleware.ts` le lit depuis `process.env.API_KEY_HEADER_NAME`.
  Dès que l'env diffère, Swagger UI envoie la clé sous le mauvais nom → 401
  « API key missing » malgré une clé renseignée. Corrigé : `swagger-config.ts` lit
  la même variable (`import 'dotenv/config'` ajouté pour la disponibilité hors Nest).
- Aucune exigence de sécurité globale déclarée → Swagger UI n'envoyait **aucun**
  header (ni `apiKey` ni `token`) sur **aucune** route, faute de `security` par
  opération. Ajout de `.addSecurityRequirements({ apiKey: [], token: [] })` — un
  seul objet (AND) car la quasi-totalité des routes exigent `ApiKeyGuard` +
  `RequireAuthGuard` ensemble ; les routes `@Public()` reçoivent le bearer en trop
  sans effet (guard bypassé).

### `UserSession` — index unique composite manquant → refresh token en échec

- Symptôme : après expiration de l'access token, `POST /auth/refresh` renvoyait une
  erreur d'unicité `Duplicate entry '<hash>' for key 'user_sessions.refresh_token_hash'`.
- Cause : `SessionService.createSession` fait un `sessionRepo.upsert(..., ['deviceFingerprint',
  'userId'])` → `INSERT ... ON DUPLICATE KEY UPDATE`. La table n'avait **aucun index unique
  composite sur `(user_id, device_fingerprint)`**, donc MySQL n'avait pas de « duplicate » à
  détecter : l'upsert dégénérait en simple INSERT à chaque login et plusieurs lignes de
  session s'accumulaient pour le même appareil. Au `/auth/refresh` suivant, `rotateSession`
  fait `UPDATE ... WHERE user_id = ? AND device_fingerprint = ?` qui touche toutes ces lignes
  dupliquées et tente d'y poser le même nouveau `refresh_token_hash` → violation de l'index
  unique sur `refresh_token_hash`.
- Correctif : `@Index(['userId', 'deviceFingerprint'], { unique: true })` sur l'entité
  `UserSession`. `migration:generate` produit alors l'`ADD UNIQUE INDEX` correspondant.
- **Projet déjà en production** : avant d'appliquer l'index, dédupliquer les lignes
  existantes (garder la plus récemment active par appareil), sinon la création de l'index
  échoue :

  ```sql
  DELETE s1 FROM `user_sessions` s1
  INNER JOIN `user_sessions` s2
    ON s1.`user_id` = s2.`user_id`
    AND s1.`device_fingerprint` = s2.`device_fingerprint`
    AND (
      s1.`last_active_at` < s2.`last_active_at`
      OR (s1.`last_active_at` = s2.`last_active_at` AND s1.`id` < s2.`id`)
    );
  ```

## Points d'attention pour la suite

- **Ne pas réintroduire de dépendance `auth → users`.** Si `auth/` a besoin d'une opération
  déjà présente sur `UserService`, ne pas importer `UsersModule` dans `AuthModule` — réécrire
  la logique localement (comme `findOrCreateGoogleUser`) ou remonter le besoin commun dans
  `shared/`/`utils/`.
- `pinCode` est une colonne typée sur `User` (`string | null`) — ne pas réintroduire de casts
  `as any` dans `PasswordService`.
- `mail/` et `utils/` ne doivent dépendre d'aucune entité métier (`User` inclus) — passer par
  des interfaces structurelles locales (`MailRecipient`, `JwtPayloadUser`) plutôt que par un
  import direct de `User`.
- Les deux fichiers `documentation.docx`/`documentation1.docx` à la racine décrivent l'ancienne
  structure `common/` (pré-découpage) — utiles comme référence historique sur les routes/
  entités/tokens, mais les chemins de fichiers qu'ils citent sont obsolètes depuis le
  découpage en `shared/`/`core/`/`auth/`/`users/`.
