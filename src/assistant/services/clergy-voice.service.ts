// ============================================================
// AMISACHE — clergy-voice.service.ts
// Assistant vocal du clergé, étape 1 : consulter et naviguer. Le prêtre parle dans l'app, le texte dicté
// arrive ici ; le LLM (OpenRouter, mêmes modèles gratuits que le chat) choisit UNE action d'écran parmi
// une liste fermée. Le serveur la valide puis la renvoie : c'est l'app qui l'exécute (navigation, filtres),
// avec les droits habituels du compte. Aucune écriture ici — les actions qui modifient viendront avec une
// confirmation à l'écran (étape 2).
// ============================================================
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';

import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { RequestTypeService } from '../../liturgy/services/request-type.service';
import { ScheduleService } from '../../liturgy/services/schedule.service';
import { ApiError } from '../../utils/api-error';
import { DEFAULT_TIMEZONE, LLM_CLIENT, LlmClient } from '../assistant.constants';

export const ECRANS = [
  'aujourdhui',
  'demandes',
  'programme',
  'annonces',
  'fiche',
  'numeros',
  'equipe',
  'messages',
  'plus',
  'guide-direct',
  'fiche-publique',
] as const;
const STATUTS = ['SUBMITTED', 'IN_PROGRESS', 'CONFIRMED', 'COMPLETED', 'REJECTED'] as const;

export type ActionVocale =
  | { nom: 'ouvrir_ecran'; ecran: (typeof ECRANS)[number] }
  | {
      nom: 'filtrer_demandes';
      statut?: (typeof STATUTS)[number];
      typeId?: string;
      jour?: string;
      du?: string;
      au?: string;
      heures?: string[];
      recherche?: string;
      pdf?: boolean;
    };

export interface ReponseVocale {
  /** Phrase courte, lue à voix haute et affichée. */
  dire: string;
  action: ActionVocale | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const OUTILS = [
  {
    type: 'function',
    function: {
      name: 'ouvrir_ecran',
      description: "Ouvrir un écran de l'espace église.",
      parameters: {
        type: 'object',
        properties: {
          ecran: {
            type: 'string',
            enum: [...ECRANS],
            description:
              "aujourdhui=accueil de l'espace ; demandes=demandes reçues ; programme=horaires des célébrations ; annonces ; fiche=fiche de l'église (photos, adresse, présentation, réseaux) ; numeros=Mobile Money ; equipe=membres du clergé ; messages=messages des fidèles ; plus=menu ; guide-direct=comment diffuser la messe en direct ; fiche-publique=la fiche telle que la voient les fidèles",
          },
          dire: { type: 'string', description: 'Phrase très courte confirmant ce qui est ouvert.' },
        },
        required: ['ecran', 'dire'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'filtrer_demandes',
      description:
        'Afficher les demandes reçues (intentions de messe, sacrements) selon des critères ; pdf=true pour en plus exporter la liste en PDF.',
      parameters: {
        type: 'object',
        properties: {
          statut: { type: 'string', enum: [...STATUTS], description: 'SUBMITTED=à traiter/nouvelles, IN_PROGRESS=en cours, CONFIRMED=confirmées, COMPLETED=célébrées, REJECTED=refusées' },
          type: { type: 'string', description: 'Nom exact d’un type de demande de la liste fournie.' },
          jour: { type: 'string', description: 'Un seul jour, AAAA-MM-JJ.' },
          du: { type: 'string', description: 'Début de période, AAAA-MM-JJ.' },
          au: { type: 'string', description: 'Fin de période, AAAA-MM-JJ.' },
          heures: { type: 'array', items: { type: 'string' }, description: 'Heures de messe HH:MM parmi celles de la paroisse.' },
          recherche: { type: 'string', description: 'Nom ou téléphone d’un fidèle.' },
          pdf: { type: 'boolean' },
          dire: { type: 'string', description: 'Phrase très courte, ex. « Voici les intentions de dimanche à 9 h. »' },
        },
        required: ['dire'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repondre',
      description:
        "Répondre sans action : demander une précision si la demande est ambiguë, ou dire poliment que ce n'est pas encore possible (modifier, publier, supprimer, confirmer un paiement : pas encore à la voix).",
      parameters: {
        type: 'object',
        properties: { dire: { type: 'string' } },
        required: ['dire'],
      },
    },
  },
];

@Injectable()
export class ClergyVoiceService {
  private readonly logger = new Logger(ClergyVoiceService.name);

  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient | null,
    private readonly clergyMemberService: ClergyMemberService,
    private readonly requestTypeService: RequestTypeService,
    private readonly scheduleService: ScheduleService,
  ) {}

  async interpreter(user: JwtUserInfo, churchId: string, texte: string, ecran?: string): Promise<ReponseVocale> {
    await this.clergyMemberService.assertAuthorizedForChurch(user, churchId);
    const phrase = texte?.trim().slice(0, 500);
    if (!phrase) return { dire: "Je n'ai rien entendu. Réessayez.", action: null };
    if (!this.llm) {
      throw new ApiError("L'assistant vocal n'est pas disponible pour le moment.", { code: HttpStatus.SERVICE_UNAVAILABLE, displayable: true });
    }

    const [types, horaires] = await Promise.all([
      this.requestTypeService.listActive(),
      this.scheduleService.listMassesForChurch(churchId).catch(() => []),
    ]);
    const heures = [...new Set(horaires.map((h) => h.time.slice(0, 5)))].sort();

    const { message } = await this.llm.complete(
      {
        messages: [
          { role: 'system', content: this.prompt(types.map((t) => t.name), heures, ecran) },
          { role: 'user', content: phrase },
        ],
        tools: OUTILS,
      },
      25_000,
    );

    const appel = message.tool_calls?.[0];
    if (!appel) return { dire: message.content?.trim() || "Je n'ai pas compris. Pouvez-vous reformuler ?", action: null };
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(appel.function.arguments || '{}');
    } catch {
      this.logger.warn(`Arguments illisibles : ${appel.function.arguments}`);
    }
    const dire = typeof args.dire === 'string' && args.dire.trim() ? args.dire.trim() : 'C’est fait.';

    switch (appel.function.name) {
      case 'ouvrir_ecran': {
        const e = ECRANS.find((x) => x === args.ecran);
        return e ? { dire, action: { nom: 'ouvrir_ecran', ecran: e } } : { dire: "Je ne connais pas cet écran.", action: null };
      }
      case 'filtrer_demandes': {
        const nom = typeof args.type === 'string' ? normaliser(args.type) : null;
        const type = nom ? types.find((t) => normaliser(t.name) === nom) ?? types.find((t) => normaliser(t.name).includes(nom)) : undefined;
        const date = (v: unknown) => (typeof v === 'string' && DATE.test(v) ? v : undefined);
        const hs = Array.isArray(args.heures)
          ? args.heures.map((h) => String(h).padStart(5, '0').slice(0, 5)).filter((h) => /^\d{2}:\d{2}$/.test(h)).map((h) => `${h}:00`)
          : [];
        return {
          dire,
          action: {
            nom: 'filtrer_demandes',
            statut: STATUTS.find((s) => s === args.statut),
            typeId: type?.id,
            jour: date(args.jour),
            du: date(args.du),
            au: date(args.au),
            heures: hs.length ? hs : undefined,
            recherche: typeof args.recherche === 'string' && args.recherche.trim() ? args.recherche.trim() : undefined,
            pdf: args.pdf === true,
          },
        };
      }
      default:
        return { dire, action: null };
    }
  }

  private prompt(types: string[], heures: string[], ecran?: string): string {
    const tz = DEFAULT_TIMEZONE;
    const iso = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
    const jour = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: tz, weekday: 'long' }).format(d);
    const auj = new Date();
    const semaine = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(auj.getTime() + i * 86_400_000);
      return `${jour(d)} ${iso(d)}`;
    }).join(', ');
    return [
      "Tu es l'assistant vocal d'un prêtre dans l'espace église de l'app Amisache. Il te parle en français ; tu choisis UNE action en appelant UN outil. Tu ne fais que consulter et naviguer : rien n'est modifié.",
      `Aujourd'hui et les 7 jours suivants : ${semaine}. « Dimanche » sans précision = le prochain dimanche (aujourd'hui si on est dimanche).`,
      `Types de demande : ${types.join(' ; ') || 'aucun'}.`,
      `Heures des messes de la paroisse : ${heures.join(', ') || 'aucune publiée'}. « 7 h », « sept heures » = 07:00.`,
      ecran ? `Écran actuel : ${ecran}.` : '',
      "Intentions, messes demandées, demandes → filtrer_demandes. « À traiter », « nouvelles » → statut SUBMITTED. « Imprime », « PDF », « exporte » → pdf=true.",
      'Si on te demande de modifier, publier, supprimer, ajouter ou confirmer un paiement : outil repondre, en disant que ce sera bientôt possible à la voix et en proposant d’ouvrir le bon écran.',
      'Phrase « dire » : une seule, très courte, vouvoiement, sans emoji.',
    ]
      .filter(Boolean)
      .join('\n');
  }
}

function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
