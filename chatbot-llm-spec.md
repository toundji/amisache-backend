# Spec — Migration chatbot Amisache vers LLM (function calling)

> Version 2 — adaptée au modèle `chat/` existant (Conversation / Participant / Message,
> mode BOT/AGENT, socket `/chat`). Remplace la v1 qui proposait un endpoint et des entités
> dédiés. Les décisions ci-dessous ont été arbitrées le 2026-09-23.

## Contexte

`ChatBotService.reply()` fait aujourd'hui une recherche mot-clé dans la FAQ et renvoie un
fallback générique si rien ne matche — y compris pour « Bonjour » ou « Ave Maria ! ».

Objectif : remplacer ce moteur par un LLM (Mistral) avec function calling, qui décide quand
chercher dans la FAQ, consulter les horaires d'une paroisse, demander une clarification, ou
escalader vers la bonne personne (clergé ou équipe Amisache).

**Contrainte non négociable** : le LLM n'invente jamais de réponse théologique, pastorale ou
pratique. Il répond uniquement à partir des résultats de tools, ou escalade. Seules exceptions :
salutations et formules de politesse (« Bonjour », « Merci ») sans appel de tool.

EVOLUTION.md indiquait « PAS un LLM (décision explicite) » : cette décision est révisée — à
consigner dans EVOLUTION.md.

---

## Décisions

| Sujet | Décision |
|---|---|
| Intégration | Pas de nouvel endpoint : on remplace `ChatBotService.reply()`. Le flux reste `POST /chat/:id/messages` → `autoReplyIfBot` → réponse poussée par socket (`message:new`) |
| Modèle de données | On réutilise `Conversation` / `Participant` / `Message`. Pas de `ChatConversation`/`ChatMessage` |
| Auth | **Chat réservé aux utilisateurs connectés.** Pas d'auth différée, pas d'`AUTH_REQUIRED` / `requiresAuth` / `sessionStorage` |
| Mode invité | `ChatGuestController`, `/chat/guest/*`, handshake `guestId` : **conservés mais plus utilisés** par le widget. Conversations invité existantes laissées en base |
| Conversation bot | Une seule par utilisateur, reprise à chaque ouverture : `createOrOpen` authentifié, `subjectType: 'bot-widget'`, `subjectId: userId`, `mode: BOT` |
| Langue | Français uniquement pour l'instant |
| Contexte paroisse | Le widget transmet le `churchSlug` de la page courante s'il y en a une |
| Fuseau horaire | Celui de l'utilisateur (envoyé par le widget), sert à donner la date du jour au LLM |
| Géolocalisation | Demandée au navigateur (avec consentement) pour la recherche de paroisses proches |
| Historique envoyé au LLM | Les 10 derniers messages texte (≈ 5 échanges) |
| Persistance | Seuls le message user et la réponse finale deviennent des `Message`. Trace des tools dans une colonne JSON `meta` du message bot (jamais affichée) |
| Limites | 5 tours de tool_calls max par message ; 15 s par appel Mistral, 30 s au total |
| Panne Mistral | Fallback sur la recherche mot-clé actuelle + alerte admin (max 1 toutes les 15 min) |
| Rate limiting utilisateur | Non |
| Indicateur de frappe | Oui, le bot émet `typing` pendant la génération |
| Périmètre | Backend + client + panel |
| Hors scope | `get_program` (événements ponctuels à une date) — à rediscuter |

---

## Flux

```
Widget (client, utilisateur connecté)
  → POST /chat/:id/messages { body, context: { churchSlug?, timezone, location? } }
       ↓
ChatService.sendMessage  (inchangé : persiste le message, émet message:new)
       ↓
autoReplyIfBot  (seulement si mode BOT)
  1. émet typing (bot) sur la conversation
  2. LlmChatBotService.reply(conversation, userId, body, context)
       - system prompt (date du jour dans le fuseau user, paroisse de la page)
       - 10 derniers messages texte de la conversation
       - boucle tool_calls (max 5 tours, timeouts)
       - en cas d'échec Mistral → ancien moteur mot-clé + alerte admin
  3. si réponse non vide → persiste le Message AI (avec meta), met à jour le cache liste,
     émet message:new ; sinon (bot silencieux, voir Escalade) → rien
  4. émet typing: false
```

Un tool qui plante ne fait jamais échouer la boucle : il renvoie `{ error: '...' }` au LLM, qui
formule sa réponse avec. Dépasser 5 tours → réponse « je transmets votre question » + escalade.

---

## Modèle Mistral

- `mistral-small-latest` pour commencer ; `mistral-medium` si la compréhension est insuffisante.
- SDK `@mistralai/mistralai`, client injecté comme provider NestJS, `MISTRAL_API_KEY` en env.
- `tool_choice: 'auto'`.

---

## Tools

### 1. `search_faq`
FAQ globale à la plateforme (pas de lien paroisse). Réutilise le scoring mot-clé actuel,
renvoie **le meilleur résultat seulement** (ou rien).
```json
{ "name": "search_faq",
  "description": "Cherche une réponse dans la FAQ Amisache (sacrements, pratique religieuse, fonctionnement de la plateforme).",
  "parameters": { "query": "string (required)" } }
```

### 2. `get_mass_schedule`
Horaires récurrents (`liturgy/Schedule`) d'une paroisse.
```json
{ "name": "get_mass_schedule",
  "description": "Récupère les horaires de messe habituels d'une paroisse.",
  "parameters": { "churchSlug": "string (required)" } }
```

### 3. `search_church`
Par nom, ville, ou proximité (position `Address` de la paroisse vs position du navigateur
transmise dans le contexte — le LLM ne manipule pas de coordonnées).
```json
{ "name": "search_church",
  "description": "Cherche une paroisse par nom, par ville, ou les plus proches de l'utilisateur.",
  "parameters": { "query": "string (optional)", "city": "string (optional)", "nearMe": "boolean (optional)" } }
```

### 4. `get_user_churches`
Toutes les `Membership` de l'utilisateur (l'entité n'a ni statut ni date de fin).
```json
{ "name": "get_user_churches",
  "description": "Paroisses dont l'utilisateur est membre. À appeler s'il dit 'mon église'/'ma paroisse' sans préciser.",
  "parameters": {} }
```

### 5. `get_clergy_contact`
Contacts (email/téléphone du `User`) des `ClergyMember` actifs de la paroisse. Exposition
acceptée pour l'instant (utilisateurs connectés uniquement).
```json
{ "name": "get_clergy_contact",
  "description": "Contacts du clergé d'une paroisse. À appeler quand aucune information n'est disponible sur une question précise.",
  "parameters": { "churchSlug": "string (required)" } }
```

### 6. `escalate_to_agent`
```json
{ "name": "escalate_to_agent",
  "description": "Transmet la question à une personne. Question liturgique/pastorale liée à une paroisse → clergé de cette paroisse (churchSlug). Toute autre question → équipe Amisache (sans churchSlug). Ne jamais inventer une réponse religieuse.",
  "parameters": { "reason": "string (required)", "churchSlug": "string (optional)" } }
```

---

## Escalade

**Destinataire** : la personne compétente.
- Question liturgique/pastorale liée à une paroisse → **clergé de cette paroisse**.
- Sinon → **admins Amisache**.

**Persistance** — nouvelles colonnes sur `Conversation` :
- `escalated_at` (datetime, nullable)
- `escalation_reason` (text, nullable)
- `escalated_church_id` (nullable — null = équipe Amisache)

L'escalade passe `status` à `PENDING`, **ne change pas le mode** (reste `BOT`), et notifie les
destinataires (socket `conversation:updated` + `NotificationService`).

**Comportement du bot après escalade** :
- Il ne revient pas sur la question transmise et ne répond rien aux questions qu'il ne maîtrise
  pas (s'il ré-escalade, la raison est mise à jour et **aucun message** n'est posté).
- Il continue de répondre aux nouvelles questions qu'il maîtrise.
- Il se tait définitivement quand un humain prend la main (`handoff` existant → mode `AGENT`).

**Panel** : badge « À traiter » + raison + paroisse dans la liste et le détail des
conversations. Un clergé ne voit que les escalades des paroisses où il est `ClergyMember` ;
les admins voient tout.

---

## Persistance

- Message user : inchangé (`HUMAN`).
- Réponse bot : `Message` `senderType: AI` + nouvelle colonne `meta` (JSON longtext, convention
  du template) contenant la trace : tools appelés, arguments, résumé des résultats, durée,
  modèle, et `fallback: true` si l'ancien moteur a répondu. Jamais affichée.
- Les résultats de tools ne sont **pas** réinjectés dans l'historique des tours suivants : le
  LLM rappelle un tool si besoin (ex. `search_church` pour retrouver un slug).

---

## System prompt (base)

```
Tu es l'assistant de la plateforme Amisache, qui regroupe plusieurs paroisses. Tu réponds
en français uniquement.
Date du jour : {date} ({timezone}). {Si page paroisse : L'utilisateur consulte la page de la
paroisse "{churchName}" (slug: {churchSlug}) ; c'est la paroisse par défaut s'il n'en précise
pas d'autre.}

Réponds uniquement à partir des résultats des tools. N'invente jamais de contenu théologique,
pastoral ou pratique. Tu peux répondre sans tool aux salutations et remerciements.

Si search_faq ne retourne rien de pertinent pour une question sur une paroisse, appelle
get_clergy_contact et propose ce contact plutôt que de dire "rien trouvé".

Si la question touche au spirituel/pastoral, ou si tu n'es pas certain de la réponse, appelle
escalate_to_agent : avec le churchSlug si c'est liturgique et lié à une paroisse, sans sinon.
Indique alors à l'utilisateur que sa question a été transmise.

Si l'utilisateur dit "mon église"/"ma paroisse" sans nom, appelle get_user_churches :
- vide → demande de préciser la paroisse ;
- plusieurs → liste-les et demande laquelle ;
- une seule → utilise-la.
```

---

## Frontend

### Client (`amisache-client`, widget)
- Bulle toujours visible ; à l'ouverture, si non connecté → invitation à se connecter (Google)
  au lieu du chat.
- Connecté : conversation via `POST /chat` (`subjectType: 'bot-widget'`, `subjectId: userId`,
  `mode: BOT`) et routes authentifiées ; socket avec JWT.
- Chaque envoi transmet `context` : `churchSlug` de la page courante, `timezone`
  (`Intl.DateTimeFormat().resolvedOptions().timeZone`), `location` si la géolocalisation a été
  accordée.
- Affiche l'indicateur de frappe du bot.

### Panel (`amisache-panel`)
- Badge « À traiter » + raison + paroisse sur la liste et le détail des conversations.
- Filtrage des escalades par paroisse pour le clergé.
- Réception de l'alerte « Mistral indisponible ».

---

## Squelette de service

```ts
@Injectable()
export class LlmChatBotService {
  private static readonly MAX_TOOL_ROUNDS = 5;
  private static readonly HISTORY_LIMIT = 10;

  async reply(ctx: BotReplyContext): Promise<BotReply | null> {
    const history = await this.loadHistory(ctx.conversationId, LlmChatBotService.HISTORY_LIMIT);
    const messages = [{ role: 'system', content: buildSystemPrompt(ctx) }, ...history];
    const trace: ToolTrace[] = [];

    try {
      for (let round = 0; round < LlmChatBotService.MAX_TOOL_ROUNDS; round++) {
        const choice = (await this.complete(messages)).choices[0].message;
        if (!choice.toolCalls?.length) return { body: choice.content, meta: { trace } };

        messages.push(choice);
        for (const call of choice.toolCalls) {
          const result = await this.executeTool(call, ctx).catch((e) => ({ error: e.message }));
          trace.push({ name: call.function.name, args: call.function.arguments, result });
          messages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify(result) });
        }
      }
      return this.escalateOnLoopLimit(ctx, trace);
    } catch (e) {
      await this.alertAdminsThrottled(e);
      return { body: await this.keywordBot.reply(ctx.body), meta: { trace, fallback: true } };
    }
  }
}
```

`reply()` retourne `null` quand le bot doit rester silencieux (ré-escalade d'une conversation
déjà escaladée).

---

## À vérifier pendant l'implémentation

- [ ] `SendMessageDto` : ajout du champ `context` optionnel (non persisté)
- [ ] Recherche par proximité : requête spatiale sur la position de `Address` (MySQL `ST_Distance_Sphere`)
- [ ] Destinataires clergé : users `clergy` liés via `ClergyMember` actif à `escalated_church_id`
- [ ] Payload `NotificationService.notify` pour l'escalade et l'alerte Mistral
- [ ] Migration : colonnes `Conversation.escalated_*` et `Message.meta`
- [ ] EVOLUTION.md : révision de la décision « PAS un LLM »
