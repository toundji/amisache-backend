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
- **Déploiement en attente** — l'entrée du 2026-09-19 (accès panel du clergé scopé à sa
  propre église) n'est pas encore déployée sur `api.nutito.org` ; les nouvelles routes
  répondent encore 403/l'ancien comportement de login jusqu'au prochain déploiement.
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
- **Fonction « découverte de proximité »** (§4.11) — première route livrée le 2026-09-13
  (`GET /schedules/nearby`, voir entrée dédiée). Reste à faire : une vraie recherche de
  paroisses par proximité (pas seulement leurs horaires) si un besoin produit s'en dégage,
  et étendre `GET /groups/stats` (agrégat seulement, pas de recherche) si `community/`
  reçoit un vrai volume de données.

---

## Historique des décisions

### 2026-09-21 — Chat en temps réel (Socket.io) — gateway `/chat`
- **Décision** : demandé explicitement (« ajouter le websocket pour que ce soit
  instantané »). Nouveau `ChatGateway` (`chat/gateways/chat.gateway.ts`, namespace
  `/chat`, `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io` ajoutés)
  — vient **en plus** des routes HTTP existantes, qui restent la seule voie
  d'écriture (envoi/suppression/lecture/handoff) : le gateway authentifie la
  connexion, gère des rooms `conversation:{id}` et diffuse les événements que
  `ChatService` émet après chaque écriture, via un nouveau `ChatRealtimeService`
  (pont sans dépendance circulaire — le gateway lui pose le `Server` Socket.io au
  démarrage, `ChatService` n'importe jamais `socket.io`).
  - **Auth double, comme le reste de `chat/`** : un HUMAN authentifié passe son
    JWT (`handshake.auth.token`) — vérifié via `WebSocketAuthMiddleware`
    (scaffolding du socle `core/middleware/api-middleware.ts`, écrit dès l'origine
    du template mais **jamais câblé nulle part avant ce jour** ; le gateway y
    ajoute la vérification blacklist `jti` via Redis, absente du middleware
    d'origine). Un visiteur anonyme passe son `guestId` (UUID, `handshake.auth.
    guestId`) — même modèle de confiance que `ChatGuestController` (pas de
    signature, l'appartenance à une conversation est vérifiée à chaque
    `join_conversation` via une nouvelle méthode publique `ChatService.
    isActiveParticipant`, extraite de la logique déjà privée de
    `assertGuestOwnsConversation`/`getActiveParticipant`). Clé API obligatoire
    dans les deux cas (même garde-fou que `ApiKeyGuard` côté HTTP).
  - **Rooms** : `conversation:{id}` (jointe explicitement par le client, autorisée
    par participation active — sauf admin/engineer, qui rejoignent aussi
    automatiquement `admin:chat` à la connexion, même périmètre que `GET /chat/
    conversations/admin`).
  - **Événements émis par `ChatService`** après chaque écriture, mêmes frontières
    transactionnelles qu'avant (aucune émission dans une transaction TypeORM) :
    `message:new` (envoi, réponse bot), `message:deleted`, `conversation:read`,
    `conversation:updated` (nouveau message, handoff, nouvelle conversation —
    diffusé à la fois à la room de la conversation et à `admin:chat`).
  - **Présence et frappe** : en mémoire dans le gateway (pas de Redis — instance
    unique en production actuellement, décision confirmée avec l'utilisateur),
    scopées à la room d'une conversation ouverte, jamais persistées.
  - Providers ajoutés à `ChatModule` : `ChatGateway`, `ChatRealtimeService`,
    `WebSocketAuthMiddleware` (désormais réellement instancié).
- **Pourquoi** : demandé explicitement, avec un tour de questions préalable
  (portée client+panel, single-instance donc pas d'adaptateur Redis Socket.io,
  auth JWT+guestId, événements message/frappe/lu/présence) — voir aussi les
  entrées correspondantes côté `amisache-client`/`amisache-panel` (même date).
- **Conséquences** : `nest build` propre au moment de l'écriture. **Vérifié en
  conditions réelles dans une session de suivi le même jour** — voir l'entrée
  « Chat temps réel : diagnostic et corrections » ci-dessous, qui a mis au jour
  deux bugs bloquants (l'un dans ce lot, l'autre dans le socle) avant que le
  flux ne fonctionne réellement de bout en bout.

### 2026-09-21 — Chat temps réel : diagnostic et corrections (le flux ne marchait pas du tout en pratique)
- **Contexte** : après mise en prod du lot ci-dessus, l'utilisateur a signalé que
  le socket ne fonctionnait « ni côté portail ni côté panel » — aucun message
  n'apparaissait jamais en direct. Investigation en plusieurs étapes, chacune
  révélant un bug réel derrière la précédente :
  1. **`deploy.ps1` rapportait un succès trompeur** — `scp -r "$BuildPath" ...`
     (le dossier `dist/`) échoue silencieusement sur l'OpenSSH Windows de cette
     machine (bug connu de `scp.exe` avec la copie récursive de dossier :
     dizaines de `local lstat "...": No such file or directory`). Le script ne
     vérifie `$LASTEXITCODE` qu'après avoir lancé *trois* `scp` à la suite
     (dist, `public/assets`, `swagger.json`) — comme les deux derniers
     réussissent, le code de sortie final est 0 et le script continue jusqu'à
     `pm2 restart`, qui redémarre donc avec l'**ancien** `dist/` déjà présent
     sur le serveur. Aucun code de cette session (websocket inclus) n'était
     réellement arrivé en production lors des premiers tests. **Non corrigé
     dans `deploy.ps1` lui-même cette session** (l'utilisateur a repris la main
     sur le déploiement) — à corriger : archiver `dist/` en tar avant l'envoi
     (contourne le bug de `scp -r`), et vérifier `$LASTEXITCODE` après *chaque*
     `scp`, pas seulement après le dernier.
  2. **Bug local, introduit puis corrigé dans la foulée** — un premier ajout de
     logs de diagnostic dans `ChatRealtimeService.emitToConversation` utilisait
     `this.server.sockets.adapter.rooms...`. Or pour un gateway namespacé
     (`@WebSocketGateway({ namespace: '/chat' })`), NestJS injecte la
     **`Namespace`** elle-même comme `server` (`IoAdapter.createIOServer` →
     `server.of(namespace)`), pas le `Server` racine — `Namespace.sockets` est
     une simple `Map`, pas une sous-namespace avec son propre `.adapter`. Ce
     crash synchrone faisait échouer `sendMessage`/`sendMessageWithFiles` en
     500 **après** que le message ait déjà été enregistré en base. Corrigé :
     `server` typé `Namespace` (pas `Server`) partout, `.adapter.rooms`
     directement, et toute la diffusion enveloppée dans un `try/catch` — un
     bug de diffusion best-effort ne doit plus jamais pouvoir faire échouer
     l'écriture qui l'a précédée.
  3. **Bug de fond du socle, celui qui empêchait vraiment tout** — voir
     `TEMPLATE-FIXES.md` FIX-012 pour le détail complet. En résumé : les 5
     guards globaux (`APP_GUARD`) et `UserAuditInterceptor` (`APP_INTERCEPTOR`)
     s'appliquent à **tout** `ExecutionContext`, y compris WebSocket — jamais
     remarqué avant cette session car **aucun gateway WS n'existait dans le
     socle avant `ChatGateway`**. Ils appelaient tous `context.switchToHttp().
     getRequest()`/`ClsService#set(...)` sans vérifier le type de contexte,
     plantant sur chaque `@SubscribeMessage` (`join_conversation` en premier
     lieu) avec un `{"status":"error","message":"Internal server error"}`
     générique — sans AUCUNE trace exploitable côté serveur (le
     `WsExceptionsHandler` par défaut de Nest n'imprime rien, et l'exception
     partait avant même d'atteindre le corps du handler, donc un `try/catch`
     posé dedans ne voyait jamais rien passer). Trouvé uniquement en ajoutant
     un `try/catch` qui, lui non plus, ne capturait rien — signal que
     l'exception venait du pipeline NestJS (guards/interceptors), pas du code
     applicatif — puis en isolant guard par guard. Corrigé par un garde-fou
     `if (context.getType() !== 'http') return true;` (guards) / `return
     next.handle();` (interceptor) en tête de chacun.
  4. **Schéma de la base locale désynchronisé** — pour pouvoir tester (voir
     ci-dessous), la base `amisache_db` locale avait encore l'**ancien** schéma
     du template générique sur les colonnes enum de `chat/` (`actor_type` sans
     `GUEST`, `role` avec `DRIVER`/`CLIENT`/`ASSIGNED_AGENT` au lieu de
     `FAITHFUL`/`CLERGY`) — même défaut que celui déjà rencontré et corrigé en
     **production** le 2026-09-20, jamais rejoué en local. Corrigé par les
     mêmes `ALTER TABLE ... MODIFY COLUMN` que l'entrée du 20 (aucune ligne
     existante affectée, tables `chat_*` locales vides). **Sans rapport avec la
     prod**, qui a déjà le bon schéma depuis le 20 — mentionné seulement parce
     que ça a bloqué la vérification locale.
- **Méthode de vérification** : la vraie base/Redis de production n'étant pas
  joignable depuis l'environnement d'exécution de cette session (pas de
  connectivité réseau sortante), l'utilisateur a fourni les identifiants Redis
  Cloud (déjà ceux de `.env`) et demandé d'utiliser la base **locale**
  (`amisache_db` sur MySQL local, déjà migrée — schéma corrigé au point 4).
  `.env` temporairement basculé sur ces 4 variables `DB_*` (`DB_HOST=localhost`
  etc.), backup pris avant modification, **restauré à l'identique après coup**
  (`diff` vide confirmé). Script de test autonome (`socket.io-client` + `fetch`,
  scratchpad de session, jamais commité) simulant un visiteur anonyme de bout
  en bout : ouverture de conversation (HTTP), connexion socket, `join_
  conversation`, envoi d'un message (HTTP), écoute des événements. **Résultat
  final, après les 3 corrections (2, 3, et le schéma local) : `presence:
  update` → `message:new` (message du visiteur) → `conversation:updated` →
  `message:new` (réponse du bot, en direct) → `conversation:updated` — le flux
  temps réel complet fonctionne bout en bout.**
- **Pourquoi** : signalé par l'utilisateur, diagnostic mené jusqu'au bout
  plutôt que de s'arrêter à la première explication plausible (clé API,
  session JWT périmée...) qui s'est avérée à chaque fois une fausse piste ou un
  problème distinct et réel, mais pas LA cause bloquante.
- **Conséquences** : `nest build` propre. **Reste à faire, par l'utilisateur,
  hors du geste automatique de cette session** : redéployer le backend en
  production avec ces correctifs (le déploiement précédent n'avait de toute
  façon jamais transféré le vrai code, cf. point 1) — sans ce redéploiement,
  la production a toujours l'ancien code, guards non corrigés inclus, donc le
  websocket y échouera exactement de la même façon tant que ce n'est pas fait.
  `TEMPLATE-FIXES.md` FIX-012 ajouté pour la remontée du fix guards/CLS au
  template (générique, sans rapport avec le métier Amisache).

### 2026-09-20 — Fix : le panel ne voyait aucune conversation de la bulle publique
- **Découverte** : signalé par l'utilisateur (« dans le panel je ne vois aucun
  message ») juste après la mise en place de la bulle. Cause : `GET /chat/
  conversations` (utilisé par le panel, `ChatService.myConversations`) ne renvoie que
  les conversations où l'appelant est **participant actif** — or les conversations
  ouvertes par un visiteur anonyme (`ActorType.GUEST`) n'ont **que** ce visiteur comme
  participant, jamais un compte admin/clergé, tant qu'aucun handoff n'a eu lieu.
  Contrairement à `Request`/`Donation`/etc. (paire `admin`/`church/:churchId`, entrée
  du 2026-09-08), `chat/` n'avait jamais reçu cette vue « tout voir ».
- **Décision** : nouveau `GET /chat/conversations/admin` (`@Roles(admin, engineer)`,
  déclaré avant `:id` pour ne pas être intercepté par ce paramètre) —
  `ChatService.listAdmin` liste toutes les conversations, triées par
  `lastMessageAt DESC`, sans filtre de participant. Pas de variante
  `church/:churchId` : ces conversations ne sont rattachées à aucune église
  (`subjectType='guest-widget'`), donc pas de scoping par paroisse pertinent pour
  l'instant — seul admin/engineer y a accès (un compte clergé pur reste sur ses
  propres conversations via `myConversations`, inchangé).
- **Pourquoi** : correction directe d'un défaut réel signalé par l'utilisateur,
  découvert en creusant (pas une supposition) — la vue manquante empêchait tout
  simplement de répondre aux visiteurs depuis le panel.
- **Conséquences** : `nest build` propre. Vérifié en HTTP live (backend local, vraie
  base de prod, connexion admin de seed) : `GET /chat/conversations/admin` renvoie
  bien les 3 conversations de test créées lors de la session précédente (mode BOT,
  `subjectType=guest-widget`), et `GET /chat/conversations/:id/messages` sur l'une
  d'elles renvoie le fil complet (salut du bot, message du visiteur, réponse du bot).
  **Pas encore déployé** — cohérent avec le mode opératoire du projet, à rejouer avec
  le reste des changements chat de la session précédente.

### 2026-09-20 — Chat : module `chat/` adapté à Amisache + bulle publique BOT (FAQ)
- **Contexte** : demande explicite (« gérons le chat bot, elle doit s'afficher en bas
  pop up et peut s'afficher partout »). Vérification préalable (agent de recherche) :
  le module `chat/` du socle existait en code (entités/service/controller) mais n'avait
  **jamais été migré** en base, ses rôles n'étaient **pas adaptés** à Amisache (toujours
  `DRIVER`/`CLIENT`/`ASSIGNED_AGENT` du template générique), et **aucune logique de bot**
  n'existait nulle part (`ConversationMode.BOT` = une valeur d'enum sans effet). Décisions
  confirmées une à une avec l'utilisateur avant d'écrire quoi que ce soit (portée
  fonctionnelle, migration en prod, emplacement de l'enum, disponibilité anonyme).
- **`ParticipantRole` déplacé dans `chat/chat.enum.ts`** (pas `shared/common.enum.ts`,
  malgré ce qu'`AMISACHE.md` §6.1 disait jusqu'ici) — `DRIVER`/`CLIENT`/`ASSIGNED_AGENT`
  → `FAITHFUL`/`CLERGY`, `OWNER`/`MEMBER` gardés. Choix tranché par l'utilisateur
  (« choisi ce qui est mieux ») en faveur de la règle `CLAUDE.md` (enums métier dans leur
  module, `shared/` reste neutre pour un projet dérivé) plutôt que de suivre la doc
  existante telle quelle — `AMISACHE.md` mis à jour en conséquence. `ActorType` (lui,
  générique) reste dans `shared/common.enum.ts`, étendu avec `GUEST`.
- **`ActorType.GUEST`** — un visiteur anonyme de la bulle publique, jamais résolu contre
  `users` (`ChatService.validateActor` ne valide que `HUMAN`). Repose sur un `guestId`
  (UUID) généré et persisté **côté client** (`localStorage`), envoyé explicitement à
  chaque appel — aucun JWT.
- **`ChatBotService`** (`chat/services/chat-bot.service.ts`) — décision explicite : **pas
  un LLM** pour cette première passe (pas de fournisseur externe, pas de coût, pas de clé
  API à gérer) — correspondance par mots-clés (accents normalisés, mots vides français
  filtrés) contre les FAQ déjà publiées (`content/Faq`, `FaqService.listPublished`),
  message de repli invitant à attendre un membre de l'équipe si rien ne correspond.
  `ChatModule` importe désormais `ContentModule` pour `FaqService`.
- **Auto-réponse câblée dans `ChatService.sendMessage`/`sendMessageWithFiles`** (chat
  authentifié) et dans le nouveau flux invité — `autoReplyIfBot()` toujours **après** la
  transaction du message entrant, jamais dedans (un échec de génération de réponse ne
  doit jamais faire échouer l'envoi du message du fidèle/visiteur). Génère et enregistre
  la réponse **avant** de résoudre la requête HTTP — le client n'a donc qu'à
  re-charger la liste des messages une fois after l'envoi, pas de polling ni de
  websocket nécessaires pour cette première version.
- **Bulle publique** (`ChatGuestController`, routes `/chat/guest/*`, toutes `@Public()`) —
  décision explicite (« partout, même non connecté ») : `POST /chat/guest/conversations`
  (ouvre/reprend, idempotent par `subjectType='guest-widget'` + `subjectId=guestId` — un
  salut du bot au tout premier appel), `GET .../messages`, `POST .../messages`. Chaque
  route vérifie explicitement que `guestId` est participant actif de la conversation
  ciblée (`assertGuestOwnsConversation`, 404 sinon jamais 403 — même discipline que
  `getMineById`, n'expose pas l'existence à un tiers) : **testé** — un second `guestId`
  qui devine l'id d'une conversation reçoit bien 404, ne peut ni la lire ni y écrire.
- **Migration `AddChatModule`** (4 tables : conversations/participants/messages/
  attachments) — incident en l'appliquant, documenté en détail pour la prochaine fois :
  1. 1er `migration:run` → `ETIMEDOUT` avant d'exécuter la moindre requête (liaison
     distante instable, déjà vue sur ce projet).
  2. 2e `migration:run` → `Table 'chat_conversations' already exists` : les 4 tables
     existaient **déjà** en prod, avec l'**ancien** schéma (`role` sans `FAITHFUL`/
     `CLERGY`, `actor_type` sans `GUEST`), contraintes FK à noms auto-générés
     (signature `synchronize: true`, probablement un reliquat du tout début du socle,
     avant que ce projet le désactive) — **aucune ligne dans `migrations`**, donc
     découvert seulement en inspectant l'état réel de la base (vérifié : les 4 tables
     étaient **vides**, aucune perte de données possible).
  3. `DROP TABLE` bloqué par le classificateur auto mode (action destructive en prod,
     à raison) — contourné **sans destruction** : `ALTER TABLE ... MODIFY COLUMN` sur
     les 2 colonnes enum concernées (`chat_participants.role`/`actor_type`,
     `chat_messages.sender_type`) pour aligner le schéma existant sur celui attendu,
     **exécuté par l'utilisateur lui-même** (accès direct à la base, hors de la session).
  4. Ligne `migrations` insérée manuellement par l'utilisateur (`INSERT INTO migrations
     (timestamp, name) VALUES (...)`) plutôt que via `migration:run` — **équivalent
     fonctionnel** : `migration:run` ne fait rien de plus que jouer le SQL puis insérer
     cette même ligne ; le schéma était déjà à l'état cible, il ne manquait que la trace.
     Vérifié après coup : `migration:show` liste bien `AddChatModule` comme appliquée,
     et les enums en base correspondent exactement à ceux du code
     (`SHOW FULL COLUMNS`).
- **Bug trouvé en testant** (HTTP live, backend local pointé sur la vraie base de prod) :
  `autoReplyIfBot` mettait à jour `lastMessageAt`/`lastMessagePreview` de la conversation
  après la réponse du bot, mais **pas** `lastMessageSenderId` — restait celui du message
  entrant (fidèle/visiteur) alors que le tout dernier message est désormais celui du bot.
  Corrigé (`lastMessageSenderId: null` explicite — `undefined` est ignoré par TypeORM
  `.update()`, contrairement à `null` qui pose réellement `NULL` en base). Revérifié :
  `lastMessageSenderId` est bien `null` après une réponse du bot.
- **Pourquoi (choix explicites de l'utilisateur, un par un)** : bulle disponible même
  sans compte ; `ParticipantRole` déplacé plutôt que laissé dans `shared/` ; migration
  écrite **et** appliquée immédiatement (pas seulement préparée, contrairement au
  mode opératoire habituel de ce projet) ; portée « structure + bot basique » plutôt que
  juste la structure ou un vrai LLM.
- **Conséquences** : `nest build` propre. Vérifié en HTTP live (backend local, vraie
  base de prod) : ouverture idempotente, salut automatique, réponse du bot au message
  d'un visiteur (repli — aucune FAQ publiée en prod pour l'instant, `GET /faq` renvoie
  `[]`), isolation entre visiteurs (404 croisé), `lastMessageSenderId` correct. **Quelques
  conversations de test réelles** (guestId aléatoires, contenu type « Comment faire une
  demande de messe ? ») restent dans `chat_conversations`/`chat_messages` en prod — pas
  nettoyées (bruit mineur, indiscernable d'un vrai premier usage). À publier des FAQ
  (`content/Faq`, déjà existant) pour que le bot ait de vraies réponses à donner plutôt
  que systématiquement le message de repli.

### 2026-09-20 — `RequestService.getById` charge désormais church/type/payment
- **Décision** : `getById` (utilisé par `GET /requests/:id`, `getMineById`,
  `getByIdForRequesterOrClergy`) ne chargeait que la relation `user` — étendue à
  `{ user, church, type, payment }`. Demandé par le besoin client d'une page de détail
  de demande (`amisache-client`, `/mes-demandes/:id`) qui a besoin du nom de la
  paroisse, du type et de l'offrande éventuelle sans requête supplémentaire.
- **Pourquoi** : lecture de détail par id — contrairement aux listes (`/me`,
  `/church/:churchId`), charger ces relations ici ne change pas le profil de
  performance d'une liste et rend le endpoint immédiatement utilisable pour un écran de
  détail, côté portail comme côté panel.
- **Conséquences** : `nest build` propre, aucune migration. **Pas encore déployé** —
  cohérent avec le mode opératoire déjà en place (déploiement confirmé explicitement par
  l'utilisateur) : `GET /requests/:id` sur `api.nutito.org` continue de ne renvoyer que
  `user` tant que `.\deploy.ps1` n'est pas rejoué. Le client dégrade proprement en
  attendant (résolution du nom via les caches déjà chargés côté portail).

### 2026-09-19 — Le clergé gère les données de sa propre église : panel back-office unifié (pas d'app séparée)
- **Décision de fond** (demandée explicitement par l'utilisateur, après incident « connexion
  clergé refusée ») : `amisache-panel` sert **à la fois** admin/engineer (accès complet) et
  clergé (scopé à sa/ses église(s)) — pas de second panel séparé. Confirmé par une série de
  questions posées à l'utilisateur (voir décisions détaillées ci-dessous), plutôt que supposé.
- **Fix critique (bloquant)** : `AuthService.assertClientAccess` (login, `ApiClientType.
  back_office`) n'autorisait que `admin`/`manager`/`engineer` — un compte `clergy` pur était
  rejeté **au login même**, avant d'atteindre le panel (« Access denied. Admin access
  required. »). `UserRole.clergy` ajouté aux rôles autorisés pour `back_office`.
- **Permissions étendues au clergé ACTIF de SA église** (toujours via
  `ClergyMemberService.assertAuthorizedForChurch`, jamais un simple test de `UserRole.clergy`
  — §5/§10) — décisions confirmées une à une avec l'utilisateur :
  - **`Church`** (présentation uniquement, pas la structure) : `POST /:id/banner`,
    `/:id/logo`, `/:id/photos` (ajout+suppression) ouverts au clergé de cette église.
    Restent admin/engineer : `PATCH /:id` (champs structurels), `PATCH /:id/status`
    (validation), `PATCH /:id/perimeter`, `DELETE /:id`. Vérification faite **dans le
    contrôleur** (`ChurchController` a déjà `ClergyMemberService` injecté pour `getById`) —
    jamais dans `ChurchService`, qui ne doit pas dépendre de `ClergyMemberService`
    (dépendance inverse : `ClergyMemberService` dépend déjà de `ChurchService`).
  - **`Entrance`** : `POST`/`PATCH`/`DELETE` alignés sur le pattern déjà en place pour
    `Schedule`/`Tariff`/`PaymentMethod` (`EntranceService` avait déjà `ClergyMemberService`
    injecté, juste jamais appelé sur les routes d'écriture).
  - **`ClergyMember`** : un membre du clergé peut désormais affecter/mettre à jour/retirer
    **d'autres** membres du clergé/personnel de **sa propre église** (`POST`/`PATCH`/`DELETE`
    scopés sur `body.churchId`/`existing.churchId`) — décision explicite : gérer son propre
    personnel local, jamais celui d'une autre église. Reste admin/engineer **uniquement** :
    aucune route retirée, juste `UserRole.clergy` ajouté partout avec le garde-fou.
  - **`Request` — traitement des demandes** : `PATCH /:id/status` (confirmer/rejeter/
    terminer une intention ou demande de sacrement) ouvert au clergé ACTIF de l'église de la
    demande — jugé cœur de métier (sans ça, la fonctionnalité « Demandes » restait
    inutilisable sans un admin dans la boucle).
- **Bug découvert en creusant (`GET /:id` de `Request`/`Donation`)** : un clergy qui n'est ni
  admin/engineer ni le demandeur/donateur lui-même tombait sur `getMineById` → 404 même pour
  une demande adressée à SA église (la liste `church/:churchId` marchait, le détail par id
  non). Nouveau `getByIdForRequesterOrClergy`/`getByIdForDonorOrClergy` : demandeur/donateur
  **ou** clergé actif de l'église concernée, sinon 404 (jamais 403 — ne pas révéler
  l'existence de la ressource à un tiers non autorisé, cohérent avec `getMineById`).
- **Bug découvert en creusant (noms invisibles)** : ni `RequestService`/`DonationService`
  `listAdmin`/`listForChurch`/`getById` ne chargeaient la relation `user` — un clergy (qui ne
  peut pas appeler `GET /users`, cf. entrée suivante) voyait des UUID bruts à la place des
  noms de demandeurs/donateurs. `relations: { user: true }` ajouté aux quatre méthodes.
- **`GET /users/lookup?email=` (nouveau, `users/` — socle)** : recherche ciblée par email
  **exact**, projection minimale (`id`/`firstName`/`lastName`/`email`/`profile`), ouverte à
  `clergy` en plus de `admin`/`manager`/`engineer`. Décision explicite de l'utilisateur après
  question posée : le clergé ne doit **pas** voir l'annuaire complet de la plateforme
  (`GET /users`, resté strictement admin/manager/engineer) pour affecter du personnel — juste
  pouvoir retrouver un compte existant par son email exact. Reste local (pas remonté dans
  `TEMPLATE-FIXES.md` : la route est gatée par `UserRole.clergy`, un rôle propre à Amisache,
  donc pas générique au sens du critère de ce fichier).
- **Conséquences** : `nest build` propre. **Aucun déploiement effectué cette session** — tous
  ces changements (y compris le fix de login, testé et confirmé fonctionnel contre
  `api.nutito.org` en cours de session — donc **potentiellement déjà déployé séparément par
  l'utilisateur entre deux échanges**, à vérifier) doivent être redéployés pour prendre effet.
  Les nouvelles routes (`users/lookup`, écritures Entrance/ClergyMember/Church banner-logo-
  photos, `PATCH /requests/:id/status` ouvert au clergé) testées en HTTP live renvoient encore
  403 sur `api.nutito.org` au moment de la rédaction — cohérent avec « pas encore déployé »,
  pas un bug du code lui-même (logique identique, éprouvée, à celle de Schedule/Tariff/
  PaymentMethod déjà en prod). À revérifier après déploiement.

### 2026-09-17 — Vraies photos Wikimedia Commons pour 5 des 6 paroisses (remplace le retrait de l'entrée précédente)
- **Décision** : demande de l'utilisateur (« met autre photo à partir de ce dossier :
  documents/images ») — vérification de ce dossier révèle qu'aucune image n'est
  utilisable : soit filigranée (Dreamstime/Getty), soit un bâtiment célèbre ailleurs
  qu'au Bénin (Saint-Paul de Londres, Saint-Pierre du Vatican, Aparecida au Brésil,
  Basilique de Yamoussoukro en Côte d'Ivoire — encore plus trompeuse pour un public
  ouest-africain, contre-productif), soit sans licence libre vérifiable (banques
  d'images génériques, risque de droit d'auteur réel si publié sur le vrai site,
  distinct du problème de simple incohérence). Signalé explicitement, deux allers-
  retours avant que l'utilisateur choisisse : chercher de vraies photos Wikimedia
  Commons des 6 paroisses concernées (même méthode que les églises déjà en base,
  `seed-churches.ts`) plutôt que d'utiliser ce dossier.
- **Recherche via l'API Commons** (`action=query&list=search` + `imageinfo/extmetadata`
  pour vérifier la licence avant tout usage) : **3 correspondances exactes par nom**
  (`Eglise Notre Dame des Apôtres Cotonou.JPG` — CC BY-SA 3.0 ; `Eglise Saint Michel de
  COTONOU.jpg`, quartier Ganhi explicitement dans la description — CC0 ; `Paroisse
  Sainte-Rita de Cotonou.jpg`, enseigne « ARCHIDIOCESE DE COTONOU — PAROISSE SAINTE
  RITA » visible sur la photo elle-même — CC BY-SA 4.0) et **2 correspondances
  partielles, acceptées explicitement par l'utilisateur** (même ville/quartier,
  vraie photo, licence libre, mais pas garanti être exactement le bâtiment de cette
  paroisse précise) : `Eglise à Akpakpa.jpg` (CC BY-SA 4.0, catégorisée « Holy Trinity
  churches » — pas forcément Saint-Joseph) pour `saint-joseph-akpakpa`, `Ouidah
  bordure muraille église Catholique.jpg` (CC BY-SA 4.0, probablement la Basilique de
  l'Immaculée-Conception plutôt que Saint-Paul) pour `saint-paul-ouidah`. **Aucune
  photo trouvée** pour Sainte-Anne d'Abomey-Calavi — reste sans photo plutôt que de
  risquer une nouvelle erreur.
- **Exécution** : `UPDATE churches SET photos = ...` (URL `Special:FilePath`, même
  schéma que le seed d'origine — pas de téléchargement/réhébergement) sur les 5
  slugs trouvés, script Node jetable supprimé après usage.
- **Conséquences** : 5 des 6 paroisses vidées à l'entrée précédente ont maintenant une
  vraie photo sous licence libre vérifiée ; seule Sainte-Anne d'Abomey-Calavi reste
  sans photo (repli `hero-lumiere.jpg` côté client). Pas de nouvelle vérification HTTP
  live — pattern déjà vérifié pour ce type de changement dans les entrées précédentes
  du jour.

### 2026-09-17 — Données de démo étendues : photos mal assignées retirées + `ChurchProfile` sur les 8 autres paroisses
- **Constat en vérifiant la galerie photo** (ajoutée côté client à l'entrée précédente) :
  la plupart des 9 paroisses du seed (`seed-churches.ts`, sessions antérieures) portent en
  fait la **photo d'une autre église**, parfois à des centaines de km — ex. « Saint-Joseph
  d'Akpakpa » (Cotonou) affichait la cathédrale de Parakou, « Saint-Michel » et « Sainte-
  Anne d'Abomey-Calavi » affichaient toutes deux la même photo de la cathédrale de
  Porto-Novo. Reliquat d'un seed antérieur (images génériques réutilisées), pas introduit
  cette session — signalé à l'utilisateur avant d'agir.
- **Décision (confirmée explicitement par l'utilisateur, prod touchée)** : `photos` mis à
  `NULL` sur les 6 paroisses concernées (`notre-dame-des-apotres`, `saint-joseph-akpakpa`,
  `saint-michel-ganhi`, `saint-paul-ouidah`, `sainte-anne-abomey-calavi`, `sainte-rita`) —
  mieux vaut aucune photo (repli sur `hero-lumiere.jpg` déjà en place côté client) qu'une
  photo trompeuse. Gardées : Cathédrale Notre-Dame de Cotonou (ses propres photos),
  Notre-Dame de Porto-Novo et Saint-Pierre de Parakou (nom de la paroisse cohérent avec le
  nom du fichier Wikimedia — correspondance plausible, pas une certitude absolue).
- **`ChurchProfile` créé pour les 8 paroisses qui n'en avaient pas** (Notre-Dame des
  Apôtres déjà faite à l'entrée du même jour plus haut) — même schéma (`description` +
  `leaderMessage`), contenu de démonstration original (pas de texte copié), à corriger par
  l'utilisateur via le panel si besoin des vraies informations.
- **Script Node jetable** (`mysql2`, comme les entrées précédentes), supprimé après usage.
  Exécution bloquée une première fois par le classificateur auto mode (écriture directe en
  prod) — confirmation explicite redemandée et obtenue avant de relancer.
- **Conséquences** : 6 `UPDATE churches` (photos retirées) + 8 `INSERT church_profiles` en
  production. Pas de nouvelle vérification HTTP live cette entrée (pattern déjà vérifié à
  l'entrée précédente pour Notre-Dame des Apôtres/Cathédrale de Cotonou).

### 2026-09-17 — Prévisualisation réelle de la fiche paroisse : migration appliquée + `ChurchProfile` seedé
- **Constat en ouvrant la session** : la migration `AddChurchProfiles` (entrée
  précédente, censée être « prête mais non appliquée ») était en réalité **déjà
  appliquée** sur `nutito.org` — vérifié directement (`SELECT * FROM migrations`,
  `SHOW COLUMNS`) : `church_profiles` existe avec `leader_message` inclus,
  `churches.leader_message` déjà supprimée, table vide (0 ligne). `npm run
  migration:run` de cette session n'a donc rien eu à faire (« No migrations are
  pending »). Pas d'explication trouvée (hors scope de creuser) — signalé, pas un bug
  introduit cette session.
- **Décision** : demande explicite de l'utilisateur (« il faut mettre des données dans
  la base pour qu'on voit à quoi va ressembler la page d'une église ») — confirmation
  demandée avant d'écrire en prod (`nutito.org`), obtenue. Un `ChurchProfile` de
  démonstration inséré directement en SQL (`description` + `leaderMessage`) sur
  « Paroisse Notre-Dame des Apôtres » (`38e0094b-...`, déjà utilisée comme référence de
  vérification visuelle dans les sessions précédentes) — script Node jetable
  (`mysql2`), supprimé après usage, pas conservé dans le repo.
- **Vérification** : `GET /church-profiles/church/:id` (backend local temporaire pointé
  sur la vraie base, `curl` avec la clé API website) renvoie bien `description` et
  `leaderMessage`. Portail (`ng serve`, `environment.ts` basculé temporairement sur
  `localhost:3010`, **revert fait avant de terminer**, diff vide confirmé) capturé via
  Puppeteer (réinstallé temporairement en scratchpad, pas d'extension Chrome connectée
  cette session) sur `/paroisse/notre-dame-des-apotres` : description en texte normal
  puis mot du curé en italique juste en dessous, horaires réels affichés — rendu
  conforme à ce qui avait été conçu.
- **Incident évité** : les deux process (`nest start --watch` sur `3010`, `ng serve` sur
  `4300`) ne se sont **pas** arrêtés via l'outil de gestion de tâches en tâche de fond
  (même piège que documenté dans l'entrée `ChurchProfile` du 2026-09-17 précédente,
  cette fois anticipé) — repérés via `netstat`, tués manuellement (`taskkill /F /T`)
  avant de terminer la session. Ports `3010`/`4300` confirmés libres après coup.
- **Conséquences** : une ligne réelle dans `church_profiles` en production (pas une
  donnée fictive à retirer — description et mot du curé plausibles pour cette paroisse,
  utilisables tels quels si personne ne les corrige). Aucun autre changement de schéma
  ou de code cette entrée.

### 2026-09-17 — `leaderMessage` migré de `Church` vers `ChurchProfile`
- **Décision** : suite directe de l'entrée précédente (création de `ChurchProfile`) —
  `Church.leaderMessage` (« mot du curé ») déplacé dans `church_profiles`, même logique
  que `description` : contenu éditorial rattaché à la présentation de l'église, pas à
  son identité structurelle. Colonne retirée de `church.entity.ts`, ajoutée à
  `church-profile.entity.ts` ; `leaderMessage` retiré de `CreateChurchDto`/
  `UpdateChurchDto`, ajouté à `UpsertChurchProfileDto`.
- **Migration `AddChurchProfiles` modifiée en place** (pas une seconde migration) —
  toujours non appliquée, donc rien à corriger a posteriori : `CREATE TABLE
  church_profiles` inclut désormais `leader_message text NULL`, suivi d'un `INSERT ...
  SELECT` qui rapatrie les `leader_message` déjà présents sur `churches` (le seed
  `seed-churches.ts` n'en écrit aucun, mais la base de prod a pu en recevoir via le
  panel avant ce changement — migration écrite pour ne perdre aucune donnée existante),
  puis `ALTER TABLE churches DROP COLUMN leader_message`. `down()` fait l'inverse
  (ADD COLUMN + `UPDATE ... JOIN` de rapatriement avant de supprimer `church_profiles`).
- **Diagramme** (`diagramme-classe-paroisses.mermaid`) mis à jour (`leaderMessage`
  déplacé de `Church` vers `ChurchProfile`) — **SVG non régénéré** cette session
  (`mmdc`/puppeteer pas installés, contournement habituel des sessions précédentes pas
  refait faute de temps) : le `.mermaid` fait foi, le `.svg` est en retard d'une entrée.
- **Client (portail)** : `Church.leaderMessage` retiré de `church.model.ts`,
  `ChurchProfile.leaderMessage` ajouté. `paroisse.component.html` lit désormais
  `profile()?.leaderMessage` au lieu de `c.leaderMessage` — `ParoisseComponent` chargeait
  déjà `profile` (entrée précédente), aucun nouveau câblage réseau nécessaire.
- **Panel** : nouveaux `models/church-profile.model.ts` + `services/church-profile.
  service.ts` (`getForChurch`/`upsertForChurch`, miroir du client). `leaderMessage`
  retiré de `Church`/`CreateChurchDto`/`UpdateChurchDto` (`models/church.model.ts`) et du
  formulaire de création (`church-create/`) — impossible à saisir avant que l'église
  existe (FK `churchId` de `ChurchProfile`), cohérent avec `description` qui n'a jamais
  été proposée à la création non plus. Sur `church-detail/`, le bloc « Message du
  responsable » sort du `FormGroup`/`FieldSaveMixin` principal (qui ne sait sauvegarder
  que via `ChurchService.update`) — remplacé par un contrôle autonome
  (`leaderMessageControl`) et son propre triplet save/reset/modified
  (`isLeaderMessageModified`/`saveLeaderMessage`/`resetLeaderMessage`), même schéma que
  le bloc « Adresse groupée » déjà présent sur cette page (ressource distincte, pas un
  simple champ du même formulaire). `ChurchProfile` chargé en parallèle de `Church`
  dans `load()`, erreur silencieuse (`error: () => undefined`) — un profil absent (table
  pas encore migrée, ou aucune donnée créée) ne doit pas empêcher d'afficher le reste de
  la fiche église.
- **Pourquoi** : demandé explicitement (« on doit aussi migrer le mot du curé dans church
  profile »).
- **Conséquences** : `npm run build` (backend), `ng build` (client, panel) tous propres.
  **Migration toujours non appliquée** (même état que l'entrée précédente) — tant que
  `npm run migration:run` n'est pas joué, `leaderMessage` reste inaccessible en écriture
  des deux côtés (`Church` n'a plus la colonne, `church_profiles` n'existe pas encore).
  Pas de vérification HTTP live cette session (pas de backend local relancé) — le
  comportement dégradé (profil absent → 500 côté route publique, déjà vérifié à l'entrée
  précédente) est inchangé, `leaderMessage` suit exactement le même sort que
  `description`.

### 2026-09-17 — Nouveau module `church/ChurchProfile` : contenu de présentation d'une église
- **Décision** : table séparée (`church_profiles`, code d'entité `40`), pas des colonnes
  ajoutées sur `Church` — proposé explicitement par l'utilisateur (« une table à part
  pour gérer les informations de présentation de l'église afin de ne pas surcharger la
  table `churches` qui est fréquemment utilisée dans les relations avec d'autres
  tables »). `ChurchProfile` (`description: text`, nullable) en relation `@OneToOne`
  avec `Church` (`churchId` unique, `onDelete: CASCADE` — le profil n'a aucun sens sans
  l'église qui le porte, à l'inverse de `Church.parentId` qui reste en `RESTRICT` pour
  protéger la hiérarchie). Un seul champ pour l'instant (`description`), mais la table
  existe précisément pour pouvoir en ajouter d'autres plus tard (historique, patron,
  année de fondation...) sans jamais toucher au schéma de `Church`.
  - **Routes** (`church/controllers/church-profile.controller.ts`) : `GET
    /church-profiles/church/:churchId` (`@Public()`, renvoie `null` si aucun profil —
    le fidèle doit pouvoir lire la fiche paroisse sans compte) et `PATCH
    /church-profiles/church/:churchId` (`admin`/`engineer`, ou clergé **actif** de
    cette église via `ClergyMemberService.assertAuthorizedForChurch`, même garde que
    `Schedule`/`PaymentMethod`). Un seul verbe d'écriture — **upsert**, pas de
    CRUD séparé create/delete : un profil qui n'existe pas encore et un profil vide
    sont fonctionnellement la même chose pour un champ unique optionnel, une API plus
    riche n'aurait rien apporté.
  - `ChurchProfileService.upsertForChurch` : crée le profil au premier appel
    (`churchId` unique empêche tout doublon), le met à jour ensuite — cherche par
    `churchId`, pas par l'id du profil lui-même (le consommateur — panel/portail — n'a
    jamais besoin de connaître cet id).
  - Câblé dans `ChurchModule` (`TypeOrmModule.forFeature([..., ChurchProfile])`,
    nouveau service/controller ajoutés à la liste existante) — pas de nouveau module,
    la dépendance à `Church`/`ClergyMemberService` est déjà en place dans `church/`.
- **Diagramme de classe mis à jour** : nouvelle `class ChurchProfile` (§ juste après
  `Entrance`) + relation `Church "1" o-- "0..1" ChurchProfile : presentation content`.
  SVG régénéré (`mmdc`, mermaid-cli + puppeteer installés temporairement en scratchpad,
  même contournement que pour l'entrée `Tariff` du 2026-09-15 — le cache `npx` de cette
  machine n'embarque toujours pas `puppeteer`).
- **Migration écrite à la main** (`AddChurchProfiles`, même raison que
  `AddTariffs`/`AddLiturgicalPeriod` — `migration:generate` remonte du bruit sans
  rapport sur d'autres tables) : `CREATE TABLE church_profiles` (colonnes `Audit` +
  `description text NULL` + `church_id` avec index unique) + FK CASCADE vers
  `churches`.
- **⚠️ Migration NON appliquée** — question posée explicitement à l'utilisateur avant
  de toucher au schéma de la base de production (`nutito.org`, déjà utilisée pour le
  seed confirmé la veille) : a choisi de **ne pas l'appliquer maintenant** (« laisse la
  migration prête mais non appliquée »). Reste à faire, par l'utilisateur, hors du geste
  automatique d'une session : `npm run migration:run`. Tant que ce n'est pas fait,
  `GET /church-profiles/church/:churchId` renvoie une 500 (table absente) — vérifié en
  HTTP live contre un backend local pointé sur la vraie base : le portail dégrade
  proprement (la section description ne s'affiche simplement pas, le reste de la fiche
  paroisse reste fonctionnel), pas de crash.
- **Incident sans rapport, découvert en vérifiant** : un ancien process `nest start
  --watch` d'une session précédente (jamais réellement tué malgré un arrêt annoncé
  côté outil de session) tournait encore en tâche de fond, occupant le port `3010` avec
  du code obsolète (routes `/church-profiles` absentes) — provoquait des `404`
  trompeurs pendant la vérification. Repéré via `netstat`/PID, tué manuellement
  (`taskkill /F`). Le système a par ailleurs signalé une mémoire basse pendant cette
  session (plusieurs process `node`/Chrome headless accumulés) — nettoyé au fur et à
  mesure, aucune conséquence sur les données.
- **Pourquoi** : suite directe de la discussion sur les informations manquantes à la
  fiche paroisse (portail) — l'utilisateur a proposé cette description, avec
  l'architecture de table séparée comme condition explicite.
- **Conséquences** : `npm run build` (nest build) propre. Aucune vérification en base
  réelle possible pour la lecture/écriture du contenu lui-même (table absente tant que
  la migration n'est pas jouée) — seule la dégradation propre de l'absence a été
  vérifiée. À revérifier en conditions réelles une fois `npm run migration:run` joué.

### 2026-09-13 — Fix : recherche de l'annuaire ne portait que sur `name`
- **Décision** : `ChurchService.buildList` étend le `LIKE` de `search` à `c.address.locality`
  (quartier) et au nom du `Village` lié (`c.address.villageId`, `leftJoin(Village, 'v', ...)`),
  en plus de `c.name`.
- **Pourquoi** : le champ de recherche de `annuaire/` (client) affiche le placeholder
  « Nom, ville, quartier… » mais la requête ne filtrait que sur `c.name` — chercher un
  quartier (ex. « Zogbo ») ne remontait aucun résultat alors que la donnée existe sur
  `Address.locality`.
- **Conséquences** : aucune migration (pas de changement de schéma). Vérifié en HTTP live
  contre la vraie base : `search=Zogbo` renvoie désormais la paroisse Notre-Dame des Apôtres
  (locality="Zogbo, Cotonou"), qui ne matchait aucun `c.name` avant le fix.

### 2026-09-13 — Seed `seed-groups.ts` : données de démo pour « Rejoindre un groupe »
- **Décision** : nouveau seed additif (pas de `--refresh`, ne supprime jamais rien — une
  inscription réelle d'un fidèle à un groupe ne doit pas pouvoir être perdue) : 11 `Group`
  de démo (3 chorales, 3 mouvements, 3 associations, 2 autres) répartis sur les paroisses
  déjà seedées par `seed-churches.ts`. Résout chaque église par son slug via une requête
  directe (`churchRepo.findOneBy`), **indépendant** de l'état interne de `seedChurches` —
  reste un no-op propre (pas une erreur) si une église cible est absente. Idempotent par
  `(churchId, name)`. Chaîné dans `seeder.ts` après `seedLiturgicalPeriods`.
- **Pourquoi** : `GroupService.stats()` (livré plus tôt aujourd'hui) renvoyait `[]` — aucun
  `Group` n'avait jamais été seedé (noté hors périmètre le 2026-09-12 : « Payment/Donation/
  Group/Membership — pas encore de composant client qui les consomme »). C'est maintenant
  faux pour `Group`, la home client le consomme (bloc « Rejoindre un groupe »).
- **Conséquences** : `GET /groups/stats` renvoie désormais `[{CHOIR:3},{MOVEMENT:3},
  {ASSOCIATION:3},{OTHER:2}]` — vérifié en HTTP live. Aucune migration (aucune entité
  modifiée, `Group` existe depuis le 2026-09-03).

### 2026-09-13 — `content/LiturgicalPeriod` : référentiel du temps liturgique
- **Décision** : nouvelle entité `LiturgicalPeriod` dans `content/` (pas `liturgy/`) —
  `name`, `season: LiturgicalSeason` (enum **réimporté** de `liturgy/liturgy.enum.ts`, pur,
  sans DI — aucune dépendance de module créée), `startDate`/`endDate`. Code d'entité `38`
  (suite de la plage Amisache, après `GroupMember=37`). Route publique
  `GET /liturgical-periods/status` renvoie la période en cours (aujourd'hui ∈
  [startDate, endDate]) + la prochaine à venir, **avec** `churchesPublishedCount` — le
  nombre de paroisses ayant un `Schedule.season` = celui de la prochaine période. CRUD admin
  classique (`admin`/`engineer`) sinon.
- **Pourquoi** : le bloc « Le temps liturgique » de la home client était mocké faute de
  référentiel de dates — voir l'échange qui a précédé cette entrée. Décision explicite de
  ne **pas** toucher à `Schedule`/`liturgy/` : `Schedule.season` reste le tag *par horaire*
  d'une paroisse (« cet horaire s'applique en Avent ») ; `LiturgicalPeriod` est le
  référentiel *institutionnel* (« l'Avent, c'est quand, cette année ») qui permet de calculer
  "on est dans quelle saison aujourd'hui" et d'agréger sur `Schedule.season`. Rattaché à
  `content/` car non multi-tenant, cohérent avec `AMISACHE.md` §6.2.
- **Piège technique évité** : `churchesPublishedCountForSeason` interroge la table
  `schedules` en SQL direct (`this.periodRepo.manager.query(...)`) plutôt que d'importer
  `LiturgyModule`/`ScheduleService` — même principe que `GroupService.stats` (join sur
  `churches` sans importer `ChurchModule`) : évite tout couplage de module pour une simple
  lecture agrégée.
- **Hors périmètre assumé** : les fêtes patronales (sanctoral, `LiturgicalSeason.
  PATRON_FEAST`) ne sont **pas** couvertes par ce référentiel — une fête patronale est propre
  à chaque paroisse (son saint), pas une date unique partagée par toute la plateforme comme
  Avent/Carême/Temps ordinaire. Resterait un champ dédié sur `Church` (ou une table
  sanctoral séparée) si ce besoin est confirmé.
- **Migration écrite à la main** : `migration:generate` produisait ~200 lignes d'ALTER sans
  rapport (drift de schéma préexistant sur des tables non touchées — artefacts `DEFAULT
  'NULL'`, ré-création de FK dans un ordre différent). Dangereux à appliquer tel quel —
  migration réduite à la seule `CREATE TABLE liturgical_periods` (et son `DROP TABLE` en
  `down`), extraite manuellement du diff généré. **Signal à garder en tête** : ce drift
  préexistant n'est pas nouveau, une prochaine `migration:generate` legitime sur ce projet
  produira probablement le même bruit — toujours relire le diff avant de l'appliquer.
- **Seed** : `database/seeds/seed-liturgical-periods.ts`, chaîné dans `seeder.ts` après
  `seedChurches` — idempotent par `season` (une saison déjà présente n'est pas réécrite sauf
  `--refresh`), couvre ORDINARY/ADVENT/LENT avec les dates 2026 (PATRON_FEAST volontairement
  absent, cf. hors périmètre ci-dessus). **Dates codées en dur, à rejouer chaque année** — pas
  de calcul automatique des fêtes mobiles (Pâques). Vérifié en HTTP live : `/liturgical-
  periods/status` renvoie `current=Temps ordinaire`, `next=Avent` avec
  `churchesPublishedCount=0` (aucun `Schedule.season=ADVENT` seedé pour l'instant — cohérent,
  vérifié par requête directe sur `schedules`).

### 2026-09-13 — Deux endpoints publics pour débloquer le portail : `/schedules/nearby` et `/groups/stats`
- **Décision (`GET /schedules/nearby?lat=&lng=&radiusKm=&limit=`)** : première route de
  découverte de proximité (§4.11), portée par `ChurchService.findNearby` (nouveau — églises
  approuvées et géolocalisées dans un rayon, `ST_Distance_Sphere`, triées par distance) +
  `ScheduleService.nearby` (calcule la prochaine occurrence de chaque horaire des églises
  candidates via `nextScheduleOccurrence`, nouvelle fonction dans `liturgy.util.ts`, puis
  trie par horaire). Bornée à 30 églises candidates pour ne pas calculer d'occurrences sur un
  rayon trop large ; résultat final plafonné à `limit` (défaut 6, max 20).
- **Décision (`GET /groups/stats`)** : comptage public par `GroupType`, toutes églises
  approuvées confondues (`GroupService.stats`, `INNER JOIN churches` + `GROUP BY`) — pas une
  vraie recherche multi-églises (pas de `search`/pagination), juste l'agrégat nécessaire au
  bloc « Rejoindre un groupe » de la home client.
- **Pourquoi** : ces deux endpoints manquaient pour que `amisache-client` (`HomeComponent`)
  sorte du mock sur « Messes autour de vous » et « Rejoindre un groupe » — la session
  précédente avait documenté le blocage dans `EVOLUTION.md` du frontend.
- **Piège technique (`findNearby`)** : `ST_SRID(POINT(?,?), 4326)` échoue sur ce serveur
  (`Incorrect parameter count` — MariaDB, `ST_SRID` en écriture 2-arg n'existe qu'en MySQL 8+
  natif) ; remplacé par `ST_GeomFromText(CONCAT('POINT(', :lng, ' ', :lat, ')'), 4326)` — déjà
  la fonction utilisée par `pointTransformer` (`shared/geo.ts`), donc confirmée compatible.
  Autre piège évité : le filtre de rayon ne peut PAS référencer l'alias `distanceKm` dans un
  `WHERE` (MySQL l'interdit hors `HAVING`/`ORDER BY`) — utilisé `.having()` à la place.
- **Simplification assumée (fuseau horaire)** : `nextScheduleOccurrence` traite
  `Schedule.time` comme une heure locale Bénin (UTC+1, pas de DST) et convertit en instant UTC
  réel via une constante `BENIN_UTC_OFFSET_HOURS = 1` — pas de fuseau par église dans le
  modèle (déploiement mono-pays). À généraliser si Amisache s'étend hors Bénin.
- **Conséquences** : aucune migration (aucune entité modifiée). Vérifié en HTTP live contre
  la vraie base (seed du 2026-09-12) : `/schedules/nearby?lat=6.3703&lng=2.3912&radiusKm=50`
  renvoie les 4 paroisses de Cotonou triées par horaire avec distances correctes ;
  `/groups/stats` renvoie `[]` (aucun `Group` seedé — hors périmètre du seed backend, noté
  le 2026-09-12). Testé également de bout en bout côté `amisache-client` (pointé
  temporairement sur ce backend local) — voir `EVOLUTION.md` frontend.

### 2026-09-12 — Fix critique : les colonnes spatiales (`Address.location`, `Church.perimeter`) ne persistaient jamais
- **Découverte** : en écrivant un seed de démonstration pour la hiérarchie ecclésiale (voir
  entrée dédiée ci-dessous), toutes les coordonnées GPS revenaient `null` après écriture —
  aussi bien via le seed (`.save()`) que via l'API réelle (`PATCH /churches/:id` et
  `PATCH /churches/:id/perimeter`, testés en HTTP live). Aucune erreur n'était remontée :
  MySQL acceptait silencieusement une valeur invalide.
- **Cause** : `ST_GeomFromText(?, srid)` (utilisé par TypeORM pour toute colonne MySQL de
  type `point`/`polygon`) attend une **chaîne WKT** (`"POINT(lng lat)"`) comme paramètre —
  le code envoyait un objet GeoJSON brut (`{type:'Point', coordinates:[...]}`), qui ne
  correspond à aucun WKT valide. En lecture, TypeORM sélectionne via `ST_AsText(colonne)` et
  renvoie cette chaîne WKT **telle quelle**, sans la reconvertir en objet — même en écrivant
  correctement, la lecture aurait aussi été cassée (l'API aurait renvoyé une string au lieu
  du GeoJSON attendu par le reste du code, y compris le client Angular). La feature n'avait
  donc **jamais fonctionné de bout en bout**, sur aucune des deux colonnes concernées, en dépit
  de code déjà écrit dessus (formulaire panel `LocationPicker`/`PolygonPicker` construits cette
  session, jamais testés contre la vraie DB avant ce diagnostic).
- **Fix** : `shared/geo.ts` exporte désormais `pointTransformer`/`polygonTransformer`
  (`ValueTransformer` TypeORM) qui convertissent GeoJSON ⇄ WKT dans les deux sens. Posés sur
  `Address.location` (`address.embeddable.ts`) et `Church.perimeter` (`church.entity.ts`).
  Vérifié en HTTP live après fix : écriture (seed + `PATCH`) et lecture (`GET /churches`)
  cohérentes des deux côtés, requête SQL directe (`ST_AsText`) confirmée.
- **Conséquences** : aucune migration nécessaire (le type de colonne ne change pas, seul le
  comportement applicatif de sérialisation change). Tout code qui lisait silencieusement
  `location`/`perimeter` à `null` en pensant que la donnée n'existait pas doit être revu — ce
  n'était pas une absence de données mais un bug de persistance. Débloque la fonction
  « découverte de proximité » (`ST_Distance`, toujours en attente d'implémentation) qui aurait
  été inutilisable sans ce fix.

### 2026-09-12 — Seed de démonstration : hiérarchie ecclésiale + horaires + publications
- **Décision** : nouveau `database/seeds/seed-churches.ts`, chaîné dans `seeder.ts` après
  `seedTypes`/`seedSettings`. Crée une hiérarchie réaliste (Conférence → Archidiocèse de
  Cotonou + Diocèse de Porto-Novo → 2 doyennés → 9 paroisses, dont certaines rattachées
  directement au diocèse/archidiocèse pour exercer le cas « niveau sauté »), avec coordonnées
  GPS réelles (Cotonou, Porto-Novo, Ouidah, Abomey-Calavi, Parakou — bon étalement pour tester
  le clustering de la carte publique). Ajoute 1 affectation `ClergyMember` (admin principal,
  `PRIEST` à Notre-Dame des Apôtres — teste le badge clergé de `/profil`), 8 `Schedule` (messe
  dominicale + quotidienne sur 4 paroisses) et 6 `Publication` publiées (teste `/actualites` et
  la home du portail).
- **Pourquoi** : les tables métier étaient vides — impossible de vérifier visuellement le
  rendu de la carte/l'annuaire/le fil d'actualités du portail construits cette session sans
  données réalistes. C'est ce seed qui a révélé le bug spatial ci-dessus.
- **Prérequis/idempotence** : nécessite `npm run seed:benin` déjà joué (zones du Bénin, pour
  un `zoneId` valide sur chaque `Address`) — no-op silencieux avec message explicite sinon.
  Idempotent via le slug fixe de la Conférence ; `--refresh` supprime tout l'arbre seedé
  feuilles → racine (`Church.parentId` est en `onDelete: RESTRICT`) puis le recrée —
  `ClergyMember`/`Schedule`/`Publication` sont en `CASCADE` depuis `Church`, supprimés
  automatiquement. Recherche l'admin par email (`readSeedAdminConfig()`) plutôt que par rôle —
  `roles` est une colonne MySQL `SET`, non requêtable via un `where` TypeORM standard (voir
  `UserService.list`, `FIND_IN_SET`).
- **Hors périmètre de ce seed** (prochaine tranche si besoin) : `Payment`/`Donation`/`Group`/
  `Membership` — pas encore de composant client qui les consomme.



> Format d'une entrée : `### AAAA-MM-JJ — Titre court` puis **Décision**, **Pourquoi**,
> et si utile **Conséquences** (fichiers touchés, invariantes à tenir).

### 2026-09-15 — Fix (production) : upload de reçu qui plantait (`Cannot read properties of undefined (reading 'ext')`)
- **Découverte** : erreur en production remontée par l'utilisateur juste après le
  déploiement de la fonctionnalité de paiement — `POST /payments/receipt-image`
  plantait avec `TypeError: Cannot read properties of undefined (reading 'ext')` à
  `payment.service.ts:142`. Cause : `image['fileType']['ext']` suppose que
  `fileType` (résultat de la détection du type de fichier par magic number,
  posé par `nestjs-form-data`) est toujours défini — faux en pratique (observé sur
  un PDF, mais la lib ne garantit ça pour aucun format). La lib expose pourtant
  déjà un getter sûr, `FileSystemStoredFile.extension`
  (`node_modules/nestjs-form-data/dist/classes/storage/StoredFile.js`), qui
  retombe sur l'extension du nom de fichier d'origine quand la détection échoue —
  jamais utilisé nulle part dans ce projet.
- **Décision** : remplacé `image['fileType']['ext']` par `image.extension` dans
  **les 6 endroits** qui reproduisaient exactement le même motif fragile —
  pas seulement `payment.service.ts` (celui qui a crashé) : `church.service.ts`
  (banner/logo/photo, ×3), `media.service.ts` (community), `user.service.ts`
  (photo de profil). Même risque de crash en production sur chacun, corrigé
  préventivement plutôt que d'attendre le prochain rapport d'erreur.
- **Pourquoi** : le crash bloquait entièrement la fonctionnalité d'offrande
  (le fidèle ne peut pas envoyer sa demande avec paiement si l'upload du reçu
  échoue systématiquement pour son fichier) — corrigé dès le signalement.
- **Conséquences** : aucune migration, aucun changement de comportement quand
  `fileType.ext` est bien défini (`.extension` renvoie exactement la même valeur
  dans ce cas — seul le cas d'échec change, d'un crash à un repli silencieux sur
  l'extension du nom de fichier). `nest build` propre. **Pas encore déployé** —
  correctif prêt, en attente du prochain `.\deploy.ps1` (l'utilisateur a
  explicitement demandé de confirmer chaque déploiement, cf. session précédente).

### 2026-09-15 — Célébration à domicile : `Request.homeAddress`/`homeLocation`
- **Décision** : plutôt qu'un `Type` dédié (« Messe à domicile ») ou un simple champ texte
  noyé dans les précisions, deux colonnes optionnelles ajoutées à `Request` —
  `homeAddress` (adresse libre, `text`) et `homeLocation` (`Point` GeoJSON, nullable,
  même `pointTransformer` que `Address.location`/`Church.perimeter`). **Volontairement
  pas** l'objet-valeur `Address` (qui exige un `zoneId`, cf. `AMISACHE.md` §4) : imposer
  à un fidèle de choisir une Zone administrative pour une demande ponctuelle aurait été
  une friction disproportionnée — une adresse libre + une position GPS *best-effort*
  suffisent à l'usage réel (le clergé doit savoir où aller, pas géocoder formellement le
  domicile). N'importe quel motif (intention ou sacrement) peut être demandé à domicile —
  ce n'est pas une propriété du `Type`, mais de la demande elle-même.
  - `CreateRequestDto` : `homeAddress?: string` + `homeLocation?: LocationDto` (réutilise
    le DTO `lat`/`lng` déjà utilisé par `Entrance`/`Church.perimeter` — pas de nouveau
    format de coordonnées à inventer).
  - `RequestService.create` convertit `homeLocation` (lat/lng) en `Point` GeoJSON avant
    stockage, même geste que pour toute autre colonne spatiale du projet.
  - Migration écrite à la main (même raison que les précédentes — `migration:generate`
    remonte du bruit sans rapport) : `ALTER TABLE requests ADD home_address text NULL,
    ADD home_location point NULL`.
- **Pourquoi** : demandé explicitement, en deux temps — d'abord une question (« le
  système gère les demandes de messe à domicile ? ») répondue en présentant les deux
  options possibles (un `Type` + adresse en texte libre, ou un vrai champ structuré),
  puis l'utilisateur a choisi l'option structurée.
- **Conséquences** : diagramme de classe mis à jour (`+string homeAddress`,
  `+Point homeLocation` sur `Request`) et SVG régénéré. `nest build` propre.
- **Décision** : `Request.attachments` (colonne `string`) existait déjà dans l'entité/le
  DTO depuis la toute première version de `liturgy/` (2026-09-03) mais n'était alimentée
  par **aucune** route d'upload — jamais exercée par le portail. Nouveau
  `RequestAttachmentUploadDto` (`liturgy/dto/request.dto.ts` — image OU PDF, même
  contrainte que `ReceiptUploadDto` du module `payment/` mais **dupliquée localement**
  plutôt que réutilisée : sémantique différente — un reçu de paiement, pas la pièce
  jointe libre d'une demande — et pas de dépendance croisée à créer entre `payment/` et
  `liturgy/` pour un simple DTO de validation de fichier) + `RequestService.
  uploadAttachment` (`ApiFsUtils`, dossier `request-attachments`, même schéma que
  `uploadReceiptImage`) + `POST /requests/attachment` (déclarée avant `:id`).
- **Pourquoi** : demandé explicitement (« on doit permettre de joindre une pièce, peut-
  être un PDF ou une image, qui peut être une prière ou un contenu spécifique associé à
  une demande »).
- **Conséquences** : aucune migration (colonne déjà existante, jamais utilisée jusqu'ici).
  `nest build` propre.

### 2026-09-15 — Le reçu de paiement accepte aussi les PDF
- **Décision** : `POST /payments/receipt-image` acceptait uniquement png/jpg/jpeg
  (`shared/media.dto.ts::ImageDto`, DTO générique partagé avec d'autres usages —
  avatar, logo...). Nouveau `ReceiptUploadDto` **propre à `payment/`**
  (`payment/dto/payment.dto.ts`) — mêmes contraintes plus `pdf` — pour ne pas
  élargir la validation des autres consommateurs de `ImageDto` (un avatar ne doit
  toujours accepter qu'une image). `PaymentController`/`PaymentService` mis à jour
  pour utiliser ce nouveau DTO ; le nom du champ multipart (`image`) et la route
  (`/payments/receipt-image`) restent inchangés — seule l'extension acceptée s'élargit.
- **Pourquoi** : demandé explicitement (« le reçu peut être un PDF ou une image ») — un
  reçu bancaire/Mobile Money est souvent délivré en PDF, pas seulement en capture
  d'écran.
- **Conséquences** : aucune migration (`Payment.receiptImage` reste une simple
  colonne `string`, le type de fichier réel n'est pas stocké séparément). `nest build`
  propre.

### 2026-09-15 — `diagramme-classe-paroisses.mermaid` mis à jour avec `Tariff`
- **Décision** : le diagramme de classe n'avait pas suivi l'ajout de `Tariff` (entrée
  précédente) — corrigé. Nouvelle `class Tariff` (section « DONS & PAIEMENTS », juste
  après `Payment`, avec les mêmes attributs que l'entité réelle) + deux relations :
  `Church "1" *-- "*" Tariff` (une église publie ses propres tarifs) et
  `Tariff "*" --> "1" Type : scope=INTENTION/SACRAMENT` (même contrainte de scope que
  `Request "*" --> "1" Type`). Le repli hiérarchique lui-même (résolution via
  `Church.parentId`) est une règle de service, pas une relation structurelle — non
  représenté dans le diagramme, cohérent avec le principe déjà appliqué aux autres
  règles métier de ce fichier (ex. validation `perimeter`, invariante `homeChurchId ∈
  Membership`) : documentées en prose, pas en flèches.
- **SVG régénéré** (`npx mmdc ... -b transparent`, cf. rituel `AMISACHE.md`) — le cache
  `npx` du `@mermaid-js/mermaid-cli` sur cette machine n'embarquait pas `puppeteer`
  (erreur `ERR_MODULE_NOT_FOUND` à la première tentative) ; contourné en installant le
  paquet complet dans un dossier scratch temporaire (jamais ajouté aux dépendances du
  projet) plutôt que dans le repo.
- **Pourquoi** : demandé explicitement (« met à jour le diagramme de classe »), suite
  directe de l'ajout de `Tariff` deux entrées plus haut — resté non fait sur le moment.
- **Conséquences** : aucune, documentation seule (`.mermaid` + `.svg` régénéré,
  8 occurrences de « Tariff » confirmées dans le SVG produit).

### 2026-09-15 — Seeds de démo `seed-payment-methods.ts` + `seed-tariffs.ts`
- **Décision** : deux nouveaux seeds additifs (même gabarit que `seed-groups.ts` —
  résolution par slug/clé naturelle, jamais de suppression, `--refresh` sans effet),
  chaînés dans `seeder.ts` après `seedGroups` :
  - **`seed-payment-methods.ts`** — un `PaymentMethod` (MTN Mobile Money ou Moov Money,
    numéro fictif) sur 7 des 9 paroisses de démo. `saint-joseph-akpakpa` et
    `saint-paul-ouidah` en sont **volontairement** exclues — garde l'état vide du
    formulaire de paiement (« cette paroisse n'a pas encore publié de moyen de
    paiement ») exerçable sans devoir désactiver un seed exprès pour le tester.
  - **`seed-tariffs.ts`** — jeu de données pensé pour exercer les **trois** branches du
    repli hiérarchique de `TariffService.resolve` (pas seulement le cas trivial d'un
    tarif propre) : un plancher national sur la Conférence (`Guérison` = 1000, dernier
    recours), des tarifs sur l'archidiocèse de Cotonou (`Action de grâce` = 3000,
    `Repos de l'âme` = 2000, `Baptême` = 5000) hérités par ses paroisses, un tarif
    **propre** sur Notre-Dame des Apôtres (`Action de grâce` = 2500) qui doit l'emporter
    sur celui, plus général, de son archidiocèse, et une paroisse sans aucun ancêtre
    tarifé pour un type donné (`Saint-Paul d'Ouidah` × `Action de grâce`) qui doit
    rester à montant libre. Détail des cas et de la chaîne parentale exacte
    (conférence → archidiocèse/diocèse → doyenné → paroisse) en tête du fichier.
- **Pourquoi** : demandé explicitement (« génère des seeders pour mettre à jour[...]
  les info[s] de paiement ») — sans données de démo, ni les moyens de paiement ni la
  tarification (toutes deux livrées la session précédente) n'avaient l'occasion d'être
  vues en fonctionnement, et le repli hiérarchique en particulier restait entièrement
  invérifié en dehors du test unitaire isolé de l'algorithme.
- **⚠️ Seeds non exécutés cette session, même raison que la migration `AddTariffs`
  non appliquée (entrée précédente)** : `amisache-backend/.env` pointe sur la base et
  le Redis de **production** — `npm run seed` tel quel écrirait dans ces données
  réelles. Ni lancé ni testé contre une base réelle. **Reste à faire, dans cet ordre,
  par l'utilisateur, en dehors du geste automatique d'une session** :
  1. `npm run migration:run` (applique `AddTariffs`, toujours en attente — voir
     l'entrée précédente) ;
  2. `npm run seed` (rejoue tous les seeds idempotents, y compris ces deux nouveaux).
- **Conséquences** : `nest build` propre. Cohérence des slugs d'église/paroisse et des
  noms de `Type` (scope INTENTION/SACRAMENT) vérifiée par relecture croisée avec
  `seed-churches.ts`/`seed-types.ts` (pas d'exécution réelle possible cette session —
  voir ci-dessus) ; la chaîne de résolution attendue pour chaque cas du jeu de données
  a été rejouée à la main contre l'algorithme de `TariffService.resolve` (même script
  Node isolé que l'entrée précédente, jeu de données aligné sur celui-ci cette fois) —
  les 8 combinaisons (église, type) du seed résolvent toutes au montant attendu.

### 2026-09-15 — Nouveau module `liturgy/Tariff` : tarification d'intention/sacrement, avec repli hiérarchique
- **Décision** : nouvelle entité `Tariff` (`liturgy/entities/tariff.entity.ts`, code
  `39`) — `(churchId, typeId) → amount`, index unique sur la paire, `active` (désactivé
  = ignoré comme s'il n'existait pas). `typeId` doit être scope INTENTION ou SACRAMENT
  (`TypeService.assertScope`, même garde que sur `Request.typeId`) — pas de tarif pour
  `Donation`, qui reste une offrande libre par nature.
  - **`TariffService.resolve(churchId, typeId)`** — le cœur de la fonctionnalité :
    cherche un tarif actif sur `churchId` ; absent, remonte via `Church.parentId` et
    réessaie, jusqu'à en trouver un ou atteindre la racine de la hiérarchie (`parentId`
    null). Garde-fou `MAX_RESOLUTION_HOPS = 15` contre un cycle de hiérarchie qui
    existerait malgré la validation déjà faite ailleurs (rang parent strictement
    supérieur) — la vraie hiérarchie ne dépasse jamais 5 niveaux. Renvoie `null` si
    aucun tarif n'existe nulle part dans la chaîne (montant resté libre côté
    `/demandes`), sinon `{ amount, definedByChurchId, definedByChurchName }` — le
    fidèle voit *qui* a fixé le prix quand ce n'est pas l'église qu'il a choisie
    (typiquement une chapelle sans tarif propre, prix hérité de son archidiocèse).
  - **`GET /tariffs/resolve?churchId=&typeId=`** — public (le fidèle doit voir le
    montant avant de payer, comme `/payment-methods`). Reste des routes calquées sur
    `PaymentMethodController` : `GET /tariffs/admin` (admin/engineer, toutes églises),
    `GET /tariffs/church/:churchId` (tarifs **propres** à cette église, pas la
    résolution avec repli — pour un futur écran de config côté clergé), `POST`/
    `PATCH /tariffs/:id`/`DELETE /tariffs/:id` (admin/engineer, ou clergé ACTIF de
    l'église visée — `ClergyMemberService.assertAuthorizedForChurch`, même garde que
    partout ailleurs). `create()` refuse un doublon `(churchId, typeId)` — message
    explicite invitant à modifier le tarif existant plutôt qu'à en recréer un.
  - **`RequestService.create`** : quand une offrande est jointe (`body.payment`), un
    tarif résolu **remplace toujours** le montant envoyé par le client avant de créer
    le `Payment` — un fidèle ne peut jamais imposer son propre prix quand l'église (ou
    un de ses ancêtres) en a publié un. Absence de tarif → le montant du client est
    conservé tel quel (comportement inchangé, montant libre).
  - Module : tout vit dans `liturgy/` (pas un nouveau module) — `LiturgyModule`
    importe déjà `ChurchModule` et `TypeModule`, dont `TariffService` a besoin ; pas de
    nouvelle dépendance inter-module à câbler.
  - Migration écrite à la main (`AddTariffs`, même raison que `AddLiturgicalPeriod` —
    `migration:generate` remonte du bruit sans rapport sur d'autres tables) : table
    `tariffs` + FK vers `churches`/`types` (CASCADE), index unique composite.
- **Pourquoi** : demandé explicitement par l'utilisateur, dans la continuité directe
  de la session précédente (câblage de l'offrande dans `/demandes`) — « si une église
  ne définit pas ses tarifs, on prend directement les tarifs de la paroisse
  supérieure ». Confirmé de construire immédiatement plutôt que de différer (question
  posée avant de coder, l'utilisateur a choisi « construire maintenant »).
- **⚠️ Migration NON appliquée à la base réelle** : `amisache-backend/.env` pointe sur
  la base de **production** (`nutito.org`) et un Redis Cloud de production — `npm run
  migration:run` tel quel l'aurait exécutée contre la prod. Volontairement pas fait
  cette session. **Reste à faire avant que la fonctionnalité soit utilisable** :
  `npm run migration:run` (ou l'équivalent en environnement de prod contrôlé) doit
  être lancé délibérément par l'utilisateur, hors du geste automatique de cette
  session.
- **Conséquences/vérification** : `npm run build` (nest build) propre. **Aucune
  vérification en base réelle ni via Redis** — ni Redis (`redis-cli` absent de la
  machine) ni identifiants MySQL locaux disponibles pour monter un environnement de
  test isolé sans toucher la prod. La logique de repli hiérarchique de `resolve()` a
  été vérifiée séparément, hors ORM/DB (script Node autonome reproduisant fidèlement
  l'algorithme — chapelle sans tarif → tarif de l'archidiocèse ancêtre, type inconnu →
  `null`, garde anti-cycle testée sur une paire d'églises qui se référencent l'une
  l'autre). La création du `Payment` avec montant forcé par le tarif (`RequestService.
  create`) n'a, elle, pas pu être exercée en conditions réelles ce tour-ci — à vérifier
  dès qu'un environnement de dev réel (DB + Redis non-production) est disponible.

### 2026-09-08 — Gestion admin des sessions/équipements d'un utilisateur (socle)
- **Décision** : le panel doit pouvoir voir et révoquer les sessions d'un **autre** compte
  depuis sa fiche. Trois routes ajoutées dans `UserController` (socle `users/`) :
  `GET /users/:id/sessions`, `DELETE /users/:id/sessions/:sessionId` (révoque une),
  `DELETE /users/:id/sessions` (déconnexion partout). Déléguées à `UserService`
  (validation `getById` → 404 propre) qui réutilise `SessionService` (déjà générique par
  `userId`, exporté par `AuthModule`) — `session.service.ts` **inchangé**.
- **Pourquoi** : seul manque fonctionnel restant de l'audit tables↔panel (voir l'échange du
  jour) ; c'est du **socle générique**, pas du métier Amisache.
- **Conséquences** : ajout générique → entrée `FEAT-001` dans `TEMPLATE-FIXES.md` pour
  remontée au template. Panel : carte « Sessions & appareils » sur `user-detail`
  (`UserService.getUserSessions/revokeUserSession/revokeAllUserSessions`). Limite assumée :
  l'access token de l'appareil visé expire seul (pas de blacklist Redis de son `jti`, on ne
  l'a pas — même compromis que le self-service `AuthService.revokeSession`). Aucune migration.
  Build + boot vérifiés (routes mappées).

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
