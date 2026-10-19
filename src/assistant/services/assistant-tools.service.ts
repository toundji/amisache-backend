// ============================================================
// AMISACHE — assistant-tools.service.ts
// Tools exposés au LLM (chatbot-llm-spec.md § Tools) : définitions
// (function calling, format OpenAI) + exécution. Chaque tool renvoie un objet
// sérialisable ; une erreur est rattrapée par l'appelant et renvoyée au
// LLM sous forme `{ error }`, jamais propagée.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ChatBotService } from '../../chat/services/chat-bot.service';
import { ChatService } from '../../chat/services/chat.service';
import { BotClientContextDto } from '../../chat/dto/message.dto';
import { ParticipantRole } from '../../chat/chat.enum';
import { MessageOption } from '../../chat/entities/message.entity';
import { ActorType } from '../../shared/common.enum';
import { ChurchService } from '../../church/services/church.service';
import { MembershipService } from '../../church/services/membership.service';
import { Church } from '../../church/entities/church.entity';
import { User } from '../../users/entities/user.entity';
import { Schedule } from '../../liturgy/entities/schedule.entity';
import { ScheduleFrequency } from '../../liturgy/liturgy.enum';
import {
  earliestRequestLocal,
  formatLeadTime,
  isMassTypeName,
  isValidScheduleOccurrence,
  respectsLeadTime,
} from '../../liturgy/liturgy.util';
import { RequestService } from '../../liturgy/services/request.service';
import { TariffService } from '../../liturgy/services/tariff.service';
import { RequestTypeService } from '../../liturgy/services/request-type.service';
import { RequestTypeScope } from '../../liturgy/request-type.enum';
import { AssistantNotifierService } from './assistant-notifier.service';

export interface ToolContext {
  conversationId: string;
  userId: string;
  clientContext?: BotClientContextDto;
}

/** État partagé d'un tour de réponse — lu par LlmChatBotService après la boucle. */
export interface ToolRunState {
  /** Une escalade a eu lieu alors que la conversation l'était déjà → bot silencieux */
  reEscalated: boolean;
  /**
   * Lien vers le formulaire de demande prérempli (`prepare_request`) —
   * ajouté par LlmChatBotService sous la réponse finale, jamais recopié
   * par le LLM (qui pourrait l'altérer).
   */
  requestFormUrl?: string;
  /**
   * Choix cliquables tirés des résultats du dernier tool qui en propose
   * (paroisses, types, messes) — construits ici, jamais par le LLM.
   */
  options?: MessageOption[];
}

const NEARBY_RADIUS_KM = 20;
const SEARCH_LIMIT = 5;

/** Fenêtre par défaut / maximale de get_upcoming_masses, en jours */
const UPCOMING_DEFAULT_DAYS = 14;
const UPCOMING_MAX_DAYS = 31;
/** Longueur max du texte d'intention (même limite que le formulaire client) */
const REQUEST_TEXT_MAX = 150;

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
/** Messes proposées en boutons (les suivantes via « Autres dates ») */
const MASS_OPTIONS_LIMIT = 5;

export const ASSISTANT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_faq',
      description:
        'Cherche une réponse dans la FAQ Amisache (sacrements, pratique religieuse, fonctionnement de la plateforme).',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'La question, reformulée en mots-clés' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_mass_schedule',
      description: "Récupère les horaires de messe habituels d'une paroisse.",
      parameters: {
        type: 'object',
        properties: { churchSlug: { type: 'string' } },
        required: ['churchSlug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_church',
      description:
        "Cherche une paroisse par nom, par ville, ou les plus proches de l'utilisateur.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Nom (ou partie du nom) de la paroisse' },
          city: { type: 'string', description: 'Ville ou quartier' },
          nearMe: { type: 'boolean', description: "Paroisses proches de la position de l'utilisateur" },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_churches',
      description:
        "Paroisses dont l'utilisateur est membre. À appeler s'il dit 'mon église'/'ma paroisse' sans préciser.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_clergy_contact',
      description:
        "Contacts du clergé d'une paroisse. À appeler quand aucune information n'est disponible sur une question précise.",
      parameters: {
        type: 'object',
        properties: { churchSlug: { type: 'string' } },
        required: ['churchSlug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_request_types',
      description:
        "Types de demande possibles (intentions de messe, sacrements) pour une paroisse, avec délai minimum et offrande indicative. À appeler avant prepare_request.",
      parameters: {
        type: 'object',
        properties: { churchSlug: { type: 'string' } },
        required: ['churchSlug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_masses',
      description:
        "Messes datées à venir d'une paroisse (date, heure) sur une période. À utiliser pour proposer une date/heure réelle à une demande — avec `type`, le délai minimum de ce type est déjà appliqué.",
      parameters: {
        type: 'object',
        properties: {
          churchSlug: { type: 'string' },
          type: { type: 'string', description: 'Nom du type de demande (issu de list_request_types), pour appliquer son délai minimum' },
          from: { type: 'string', description: "Date de début YYYY-MM-DD (défaut : aujourd'hui)" },
          to: { type: 'string', description: `Date de fin YYYY-MM-DD (max ${UPCOMING_MAX_DAYS} jours après from)` },
        },
        required: ['churchSlug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_request',
      description:
        "Vérifie une demande (intention de messe ou sacrement) et prépare le formulaire prérempli que le fidèle validera lui-même. N'enregistre rien. N'appeler qu'une fois paroisse, type et date confirmés par le fidèle.",
      parameters: {
        type: 'object',
        properties: {
          churchSlug: { type: 'string' },
          type: { type: 'string', description: 'Nom du type de demande, tel que retourné par list_request_types' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          time: { type: 'string', description: 'Heure HH:MM de la messe choisie (issue de get_upcoming_masses)' },
          text: { type: 'string', description: `Texte de l'intention (${REQUEST_TEXT_MAX} caractères max)` },
        },
        required: ['churchSlug', 'type', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_agent',
      description:
        'Transmet la question à une personne. Question liturgique/pastorale liée à une paroisse → clergé de cette paroisse (churchSlug). Toute autre question → équipe Amisache (sans churchSlug). Ne jamais inventer une réponse religieuse.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'La question et le contexte utile à la personne qui répondra' },
          churchSlug: { type: 'string' },
        },
        required: ['reason'],
      },
    },
  },
];

@Injectable()
export class AssistantToolsService {
  constructor(
    private readonly chatBotService: ChatBotService,
    private readonly chatService: ChatService,
    private readonly churchService: ChurchService,
    private readonly membershipService: MembershipService,
    private readonly notifier: AssistantNotifierService,
    private readonly requestService: RequestService,
    private readonly tariffService: TariffService,
    private readonly requestTypeService: RequestTypeService,
    @InjectRepository(Schedule) private readonly scheduleRepo: Repository<Schedule>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async execute(
    name: string,
    args: Record<string, any>,
    ctx: ToolContext,
    run: ToolRunState,
  ): Promise<unknown> {
    switch (name) {
      case 'search_faq':
        return this.searchFaq(String(args.query ?? ''));
      case 'get_mass_schedule':
        return this.getMassSchedule(String(args.churchSlug ?? ''));
      case 'search_church':
        return this.searchChurch(args, ctx, run);
      case 'get_user_churches':
        return this.getUserChurches(ctx.userId, run);
      case 'get_clergy_contact':
        return this.getClergyContact(String(args.churchSlug ?? ''));
      case 'list_request_types':
        return this.listRequestTypes(String(args.churchSlug ?? ''), run);
      case 'get_upcoming_masses':
        return this.getUpcomingMasses(String(args.churchSlug ?? ''), run, args.from, args.to, args.type);
      case 'prepare_request':
        return this.prepareRequest(args, run);
      case 'escalate_to_agent':
        return this.escalate(ctx, run, String(args.reason ?? ''), args.churchSlug);
      default:
        return { error: `Tool inconnu : ${name}` };
    }
  }

  // ── search_faq ─────────────────────────────────────────────

  private async searchFaq(query: string) {
    const faq = await this.chatBotService.findFaq(query);
    return faq ? { question: faq.question, answer: faq.answer } : { result: null };
  }

  // ── get_mass_schedule ──────────────────────────────────────

  private async getMassSchedule(churchSlug: string) {
    const church = await this.findChurch(churchSlug);
    if (!church) return { error: `Paroisse introuvable : ${churchSlug}` };

    const today = new Date().toISOString().slice(0, 10);
    const schedules = await this.scheduleRepo.find({
      where: { churchId: church.id },
      relations: { type: true },
      order: { dayOfWeek: 'ASC', time: 'ASC' },
    });

    // Horaires récurrents uniquement — les événements ponctuels (ONCE) sont hors périmètre.
    const recurring = schedules.filter(
      (s) => s.frequency !== ScheduleFrequency.ONCE && (!s.endDate || s.endDate >= today),
    );

    return {
      church: church.name,
      schedules: recurring.map((s) => ({
        celebration: s.type?.name,
        when: this.describeRecurrence(s),
        time: s.time?.slice(0, 5),
        durationMinutes: s.duration,
        language: s.language,
        season: s.season,
        validFrom: s.startDate,
        validUntil: s.endDate,
      })),
    };
  }

  private describeRecurrence(s: Schedule): string {
    const day = s.dayOfWeek != null ? DAY_NAMES[s.dayOfWeek] : undefined;
    switch (s.frequency) {
      case ScheduleFrequency.DAILY:
        return 'tous les jours';
      case ScheduleFrequency.WEEKLY:
        return `chaque ${day}`;
      case ScheduleFrequency.BIWEEKLY:
        return `un ${day} sur deux`;
      case ScheduleFrequency.MONTHLY:
        return `le ${s.weekOfMonth === 1 ? '1er' : `${s.weekOfMonth}e`} ${day} du mois`;
      default:
        return s.frequency;
    }
  }

  // ── search_church ──────────────────────────────────────────

  private async searchChurch(args: Record<string, any>, ctx: ToolContext, run: ToolRunState) {
    const result = await this.findChurches(args, ctx);
    if ('churches' in result) this.offerChurches(run, result.churches ?? []);
    return result;
  }

  /** Plusieurs paroisses possibles → une par bouton ; une seule → le LLM la confirme. */
  private offerChurches(run: ToolRunState, churches: { name: string }[]) {
    if (churches.length > 1) run.options = churches.map((c) => ({ label: c.name }));
  }

  private async findChurches(args: Record<string, any>, ctx: ToolContext) {
    if (args.nearMe) {
      const location = ctx.clientContext?.location;
      if (!location) {
        return {
          error:
            "Position de l'utilisateur indisponible (non partagée) : demande-lui sa ville ou le nom de la paroisse.",
        };
      }
      const nearby = await this.churchService.findNearby(
        location.lat,
        location.lng,
        NEARBY_RADIUS_KM,
        SEARCH_LIMIT,
      );
      return {
        churches: nearby.map(({ church, distanceKm }) => ({
          ...this.churchSummary(church),
          distanceKm: Math.round(distanceKm * 10) / 10,
        })),
      };
    }

    const search = [args.query, args.city].filter((v) => typeof v === 'string' && v.trim());
    if (search.length === 0) return { error: 'Précise un nom, une ville ou nearMe.' };

    // Nom et ville sont cherchés séparément (la recherche couvre nom, quartier et village).
    const seen = new Map<string, ReturnType<AssistantToolsService['churchSummary']>>();
    for (const term of search) {
      const { data } = await this.churchService.listPublic({ search: term.trim(), limit: SEARCH_LIMIT });
      for (const church of data) seen.set(church.id, this.churchSummary(church));
    }
    return { churches: Array.from(seen.values()).slice(0, SEARCH_LIMIT) };
  }

  private churchSummary(church: Church) {
    return {
      name: church.name,
      slug: church.slug,
      type: church.type,
      locality: church.address?.locality,
    };
  }

  // ── get_user_churches ──────────────────────────────────────

  private async getUserChurches(userId: string, run: ToolRunState) {
    const [memberships, user] = await Promise.all([
      this.membershipService.listMine(userId),
      this.userRepo.findOne({ where: { id: userId }, select: { id: true, homeChurchId: true } }),
    ]);
    const churches = memberships
      .filter((m) => m.church)
      .map((m) => ({
        ...this.churchSummary(m.church!),
        isHomeChurch: m.churchId === user?.homeChurchId,
      }));
    this.offerChurches(run, churches);
    return { churches };
  }

  // ── get_clergy_contact ─────────────────────────────────────

  private async getClergyContact(churchSlug: string) {
    const church = await this.findChurch(churchSlug);
    if (!church) return { error: `Paroisse introuvable : ${churchSlug}` };

    const clergy = await this.notifier.activeClergy(church.id);
    return {
      church: church.name,
      contacts: clergy
        .filter((m) => m.user)
        .map((m) => ({
          name: [m.user!.firstName, m.user!.lastName].filter(Boolean).join(' '),
          role: m.role,
          email: m.user!.email,
          phone: m.user!.phone,
        })),
    };
  }

  // ── list_request_types ─────────────────────────────────────

  private async listRequestTypes(churchSlug: string, run: ToolRunState) {
    const church = await this.findChurch(churchSlug);
    if (!church) return { error: `Paroisse introuvable : ${churchSlug}` };

    const types = await this.requestTypeService.listActive();
    const [tariffs, leadTimes] = await Promise.all([
      Promise.all(types.map((t) => this.tariffService.resolve(church.id, t.id))),
      Promise.all(types.map((t) => this.tariffService.resolveMinLeadHours(church.id, t))),
    ]);

    run.options = types.map((t, i) => ({
      label: tariffs[i] ? `${t.name} · ${this.formatAmount(tariffs[i].amount)}` : t.name,
      value: t.name,
    }));

    return {
      church: church.name,
      types: types.map((t, i) => ({
        name: t.name,
        category: t.scope === RequestTypeScope.INTENTION ? 'intention de messe' : 'sacrement',
        minLeadTime: formatLeadTime(leadTimes[i].minLeadHours),
        mustMatchMassSchedule: t.requiresScheduleMatch,
        offering: tariffs[i]?.amount ?? null,
      })),
    };
  }

  // ── get_upcoming_masses ────────────────────────────────────

  private async getUpcomingMasses(
    churchSlug: string,
    run: ToolRunState,
    from?: unknown,
    to?: unknown,
    typeName?: unknown,
  ) {
    const church = await this.findChurch(churchSlug);
    if (!church) return { error: `Paroisse introuvable : ${churchSlug}` };

    const type = typeof typeName === 'string' ? await this.findRequestType(typeName) : null;
    const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    // Premier jour possible : maintenant + délai minimum (paroisse, sinon type), si le type est connu.
    const leadHours = type ? (await this.tariffService.resolveMinLeadHours(church.id, type)).minLeadHours : 0;
    const today = earliestRequestLocal(leadHours).slice(0, 10);
    const start = isDay(from) && from > today ? from : today;
    const maxEnd = this.addDays(start, UPCOMING_MAX_DAYS);
    const end = isDay(to) && to >= start ? (to < maxEnd ? to : maxEnd) : this.addDays(start, UPCOMING_DEFAULT_DAYS);

    const schedules = await this.scheduleRepo.find({
      where: { churchId: church.id },
      relations: { type: true },
      order: { time: 'ASC' },
    });

    // Une intention de messe ne se demande que sur une messe (pas une confession).
    const mustBeMass = !!type && (type.scope === RequestTypeScope.INTENTION || type.requiresScheduleMatch);
    const masses: { date: string; day: string; time: string; celebration?: string }[] = [];
    for (let day = start; day <= end; day = this.addDays(day, 1)) {
      for (const s of schedules) {
        if (mustBeMass && !isMassTypeName(s.type?.name)) continue;
        if (!isValidScheduleOccurrence(s, day)) continue;
        if (!respectsLeadTime(day, s.time, leadHours)) continue;
        masses.push({
          date: day,
          day: DAY_NAMES[new Date(`${day}T00:00:00Z`).getUTCDay()],
          time: s.time?.slice(0, 5),
          celebration: s.type?.name,
        });
      }
    }
    run.options = masses.slice(0, MASS_OPTIONS_LIMIT).map((m) => ({
      label: `${this.formatDay(m.date, 'short')} · ${m.time}`,
      value: `Le ${this.formatDay(m.date, 'long')} à ${m.time}`,
    }));
    if (masses.length > MASS_OPTIONS_LIMIT) {
      run.options.push({ label: 'Autres dates', value: "D'autres dates, s'il vous plaît" });
    }
    return { church: church.name, from: start, to: end, masses };
  }

  /** « dim. 27 sept. » (short) ou « dimanche 27 septembre » (long) */
  private formatDay(day: string, style: 'short' | 'long'): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: style,
      day: 'numeric',
      month: style,
      timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00Z`));
  }

  private formatAmount(amount: number): string {
    return `${new Intl.NumberFormat('fr-FR').format(amount)} FCFA`;
  }

  private addDays(day: string, days: number): string {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // ── prepare_request ────────────────────────────────────────

  private async prepareRequest(args: Record<string, any>, run: ToolRunState) {
    const church = await this.findChurch(String(args.churchSlug ?? ''));
    if (!church) return { error: `Paroisse introuvable : ${args.churchSlug}` };

    const found = await this.findRequestType(String(args.type ?? ''));
    if (!found) {
      return { error: `Type de demande inconnu : ${args.type}. Utilise un nom retourné par list_request_types.` };
    }
    const typeId = found.id;
    const date = String(args.date ?? '');
    const text = typeof args.text === 'string' ? args.text.trim().slice(0, REQUEST_TEXT_MAX) : '';

    // La messe est retrouvée par date + heure : le fidèle ne manipule jamais d'identifiant.
    const time = typeof args.time === 'string' ? args.time.trim().slice(0, 5) : '';
    let schedule: Schedule | undefined;
    if (time) {
      const schedules = await this.scheduleRepo.find({ where: { churchId: church.id }, relations: { type: true } });
      const mustBeMass = found.scope === RequestTypeScope.INTENTION || found.requiresScheduleMatch;
      schedule = schedules.find(
        (s) =>
          s.time?.slice(0, 5) === time &&
          isValidScheduleOccurrence(s, date) &&
          (!mustBeMass || isMassTypeName(s.type?.name)),
      );
      if (!schedule) {
        return { error: `Aucune messe le ${date} à ${time} dans cette paroisse : propose une messe retournée par get_upcoming_masses.` };
      }
    }
    const scheduleId = schedule?.id;

    // Mêmes règles que POST /requests — une ApiError est renvoyée au LLM par l'appelant.
    const type = await this.requestService.validate({ churchId: church.id, typeId, date, scheduleId });
    const tariff = await this.tariffService.resolve(church.id, typeId);

    const params = new URLSearchParams({ churchId: church.id, typeId, date });
    if (scheduleId) params.set('scheduleId', scheduleId);
    if (schedule?.time) params.set('time', schedule.time.slice(0, 5));
    if (text) params.set('text', text);
    run.requestFormUrl = `/demandes?${params.toString()}`;
    run.options = undefined;

    return {
      ready: true,
      church: church.name,
      type: type.name,
      date,
      time: schedule?.time?.slice(0, 5),
      text: text || undefined,
      offering: tariff?.amount ?? null,
      next:
        "Un bouton « Finaliser ma demande » s'affiche automatiquement sous ta réponse : le fidèle y vérifie et envoie sa demande (et son offrande éventuelle). Ne donne aucun lien toi-même.",
    };
  }

  // ── escalate_to_agent ──────────────────────────────────────

  async escalate(
    ctx: ToolContext,
    run: ToolRunState,
    reason: string,
    churchSlug?: unknown,
  ) {
    const church =
      typeof churchSlug === 'string' && churchSlug.trim()
        ? await this.findChurch(churchSlug)
        : null;

    const { conversation, alreadyEscalated } = await this.chatService.escalate(
      ctx.conversationId,
      reason || 'Question transmise par l’assistant',
      church?.id ?? null,
    );
    if (alreadyEscalated) run.reEscalated = true;
    run.options = undefined;

    // Clergé actif de la paroisse — ajouté comme participant pour voir et
    // suivre le fil depuis le panel. Aucun clergé actif → équipe Amisache.
    const clergyUserIds = church
      ? (await this.notifier.activeClergy(church.id)).map((m) => m.userId)
      : [];
    for (const userId of clergyUserIds) {
      await this.chatService.addParticipant(
        ctx.conversationId,
        { actorId: userId, actorType: ActorType.HUMAN },
        ParticipantRole.CLERGY,
      );
    }
    const recipients = clergyUserIds.length ? clergyUserIds : await this.notifier.adminUserIds();

    await this.chatService.emitConversationUpdated(ctx.conversationId, clergyUserIds);
    await this.notifier.notifyEscalation({
      userIds: recipients,
      conversationId: ctx.conversationId,
      reason: conversation.escalationReason ?? reason,
      churchId: church?.id ?? null,
      churchName: church?.name,
      escalatedAt: conversation.escalatedAt ?? new Date(),
    });

    return {
      escalated: true,
      recipient: clergyUserIds.length ? `clergé de ${church!.name}` : 'équipe Amisache',
    };
  }

  private async findChurch(slug: string): Promise<Church | null> {
    if (!slug.trim()) return null;
    const church = await this.churchService.getPublicBySlug(slug.trim()).catch(() => null);
    if (church) return church;
    // Les résultats de tools ne sont pas gardés d'un message à l'autre : le LLM passe parfois le nom au lieu du slug.
    const { data } = await this.churchService.listPublic({ search: slug.trim(), limit: 2 });
    return data.length === 1 ? data[0] : null;
  }

  /** Type actif (intention ou sacrement) par nom, sans tenir compte de la casse ni des accents. */
  private async findRequestType(name: string) {
    const normalize = (v: string) =>
      v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/’/g, "'").toLowerCase().trim();
    const wanted = normalize(name);
    if (!wanted) return null;
    const types = await this.requestTypeService.listActive();
    return (
      types.find((t) => normalize(t.name) === wanted) ??
      types.find((t) => normalize(t.name).includes(wanted)) ??
      null
    );
  }
}
