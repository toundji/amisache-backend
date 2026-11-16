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
  'nouvel-horaire',
  'nouvelle-annonce',
] as const;
/** Sections de la fiche (ancres de l'écran « fiche »). */
const SECTIONS = ['visuels', 'adresse', 'presentation'] as const;
const STATUTS = ['SUBMITTED', 'IN_PROGRESS', 'CONFIRMED', 'COMPLETED', 'REJECTED'] as const;

export type ActionVocale =
  | { nom: 'ouvrir_ecran'; ecran: (typeof ECRANS)[number]; section?: (typeof SECTIONS)[number] }
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
  /** « Vouliez-vous dire… ? » : commandes reformulées, à toucher (ou « oui » pour la première). */
  choix?: string[];
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
              "aujourdhui=accueil de l'espace (fiche à compléter, carte « Messe en direct ») ; demandes=demandes reçues ; programme=horaires des célébrations ; nouvel-horaire=formulaire d'ajout d'un horaire ; annonces ; nouvelle-annonce=formulaire d'annonce ; fiche=fiche de l'église ; numeros=Mobile Money ; equipe=membres du clergé ; messages=messages des fidèles ; plus=menu ; guide-direct=comment diffuser la messe en direct ; fiche-publique=la fiche telle que la voient les fidèles",
          },
          section: {
            type: 'string',
            enum: [...SECTIONS],
            description: "Seulement pour ecran=fiche : visuels (logo, photo de couverture, galerie), adresse (nom, commune, position GPS), presentation (texte, mot du curé, site web, YouTube/Facebook/WhatsApp/Telegram).",
          },
          dire: {
            type: 'string',
            description: "Une ou deux phrases courtes : ce qui est ouvert et, si on demande comment faire, quoi toucher.",
          },
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
      name: 'proposer',
      description:
        "Quand la phrase entendue est douteuse (mot mal transcrit) et que plusieurs sens sont possibles : demander « Vouliez-vous dire… ? » avec 2 ou 3 commandes reformulées, claires et complètes.",
      parameters: {
        type: 'object',
        properties: {
          dire: { type: 'string', description: 'La question, ex. « Vouliez-vous dire : les demandes à jour de ce mois ? »' },
          choix: {
            type: 'array',
            items: { type: 'string' },
            description: 'De 1 à 3 commandes complètes reformulées, la plus probable en premier.',
          },
        },
        required: ['dire', 'choix'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repondre',
      description:
        "Répondre sans action : seulement pour demander une précision, ou pour une question sans écran correspondant.",
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

  async interpreter(
    user: JwtUserInfo,
    churchId: string,
    texte: string,
    ecran?: string,
    historique: { role: 'user' | 'assistant'; texte: string }[] = [],
    alternatives: string[] = [],
  ): Promise<ReponseVocale> {
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
          // Contexte : les derniers échanges (« et celles de 9 h 30 ? » reprend les critères précédents).
          ...historique.slice(-5).map((m) => ({ role: m.role, content: m.texte.slice(0, 500) })),
          {
            role: 'user',
            content: alternatives.filter((a) => a && a.trim() !== phrase).length
              ? `${phrase}
(Autres transcriptions possibles : ${alternatives.filter((a) => a && a.trim() !== phrase).map((a) => `« ${a.trim().slice(0, 200)} »`).join(' ; ')})`
              : phrase,
          },
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
        if (!e) return { dire: 'Je ne connais pas cet écran.', action: null };
        const section = e === 'fiche' ? SECTIONS.find((x) => x === args.section) : undefined;
        return { dire, action: { nom: 'ouvrir_ecran', ecran: e, ...(section ? { section } : {}) } };
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
      case 'proposer': {
        const choix = Array.isArray(args.choix)
          ? args.choix.filter((c): c is string => typeof c === 'string' && !!c.trim()).map((c) => sansCodes(c).slice(0, 200)).filter(Boolean).slice(0, 3)
          : [];
        return choix.length ? { dire, action: null, choix } : { dire, action: null };
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
      "GUIDE — « comment… », « où… », « je veux… », ou toute demande d'ajout/modification : tu ne fais pas la modification toi-même (pas encore à la voix), tu OUVRES le bon écran avec ouvrir_ecran et tu dis quoi toucher. Plan de l'espace :",
      "- logo → fiche, section visuels : « Touchez le rond Logo et choisissez une image carrée. » ; photo de l'église / couverture → visuels, « Changer la couverture » ; photos de la galerie → visuels, « Photos ».",
      "- nom de l'église, adresse, commune, quartier, position sur la carte → fiche, section adresse (« Utiliser ma position » depuis le parvis, puis « Enregistrer l'adresse »).",
      "- présentation, mot du curé, site web, liens YouTube/Facebook/WhatsApp/Telegram → fiche, section presentation, puis « Enregistrer la présentation ».",
      '- ajouter une messe, un horaire, une confession, une adoration → nouvel-horaire (célébration, fréquence, jour, heure, puis « Enregistrer ») ; modifier ou supprimer un horaire → programme (toucher l’horaire).',
      '- publier une annonce, mettre une vidéo de la messe → nouvelle-annonce (titre, texte, lien dans « Vidéo », puis « Publier ») ; modifier une annonce → annonces.',
      "- numéro Mobile Money → numeros (« Ajouter un numéro ») ; ajouter un prêtre, un vicaire, une secrétaire → equipe (« Ajouter un membre » : e-mail de son compte Amisache, « Chercher », fonction, « Ajouter à l'équipe ») ; répondre à un fidèle → messages.",
      "- confirmer un paiement, traiter une demande → demandes (ouvrir la demande ; la confirmation d'un paiement se fait toujours en touchant le bouton) ; diffuser la messe en direct → aujourdhui (« Je suis en direct ») ou guide-direct pour apprendre.",
      "Ne cite que les boutons et champs nommés ci-dessus. Reprends exactement le jour et l'heure dits (18 h = 18:00), n'invente aucune valeur.",
      "DICTÉE IMPARFAITE : le texte vient d'une reconnaissance vocale, souvent sur un accent béninois ; des mots peuvent être mal transcrits (ex. « ours » pour « à jour », « jours » ; « sept heures » / « cette heure » ; noms propres déformés). Comprends le sens le plus probable dans le contexte de cette app. Si le sens est clair malgré une faute, agis directement. Si c'est douteux, utilise proposer (2 ou 3 commandes reformulées, la plus probable en premier) au lieu de deviner.",
      "Vocabulaire de l'app (un mot entendu qui ressemble à l'un d'eux est probablement celui-ci) : logo, couverture, photo, galerie, fiche, adresse, position, présentation, horaire, messe, confession, adoration, programme, annonce, vidéo, direct, intention, demande, sacrement, baptême, mariage, repos de l'âme, action de grâce, à traiter, à jour, en cours, confirmée, célébrée, refusée, Mobile Money, numéro, équipe, vicaire, curé, secrétaire, catéchiste, PDF. Ex. « loto » près de « fiche » = « logo » ; « lame » = « l'âme » ; « moi » après « ce » = « mois ».",
      "Propositions (choix) : en français simple, comme le prêtre les dirait, sans aucun code technique (jamais SUBMITTED, IN_PROGRESS…).",
      "Si le prêtre répond « oui », « c'est ça », « la première » après une proposition, exécute la commande correspondante (« la deuxième » = la 2e proposition).",
      "Les messages précédents sont le contexte : une suite (« et celles de 9 h 30 ? », « en PDF ») reprend les critères déjà donnés et ne change que ce qui est demandé. pdf=true seulement si le message ACTUEL demande un PDF / une impression.",
      'Phrase « dire » : une ou deux phrases courtes, vouvoiement, sans emoji.',
    ]
      .filter(Boolean)
      .join('\n');
  }
}

/** Retire les codes techniques qu'un modèle glisse parfois : « (statut SUBMITTED) », « IN_PROGRESS »… */
function sansCodes(s: string): string {
  return s
    .replace(/\s*\([^)]*\b[A-Z][A-Z_]{3,}\b[^)]*\)/g, '')
    .replace(/\b(SUBMITTED|IN_PROGRESS|CONFIRMED|COMPLETED|REJECTED)\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
