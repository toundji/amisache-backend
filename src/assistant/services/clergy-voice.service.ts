// ============================================================
// AMISACHE — clergy-voice.service.ts
// Assistant vocal du clergé. Le prêtre parle dans l'app, le texte dicté arrive ici ; le LLM (OpenRouter,
// mêmes modèles gratuits que le chat) choisit UNE action parmi une liste fermée. Le serveur la valide (et
// retrouve la demande visée) puis la renvoie : c'est l'app qui l'exécute, avec les droits habituels du compte.
// Étape 1 : consulter et naviguer. Étape 2 : modifier (horaire, statut d'une demande, direct, annonce) —
// toujours après une CONFIRMATION à l'écran ; rien n'est écrit ici. Jamais la confirmation d'un paiement.
// ============================================================
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';

import { JwtUserInfo } from '../../auth/dto/auth.type.dto';
import { ClergyMemberService } from '../../church/services/clergy-member.service';
import { RequestService } from '../../liturgy/services/request.service';
import { TypeService } from '../../type/services/type.service';
import { TypeScope } from '../../type/type.enum';
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
    }
  // ── Étape 2 : à confirmer à l'écran avant que l'app n'écrive ──
  | {
      nom: 'ajouter_horaire';
      resume: string;
      horaire: {
        typeId: string;
        frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONCE';
        dayOfWeek?: number;
        weekOfMonth?: number;
        startDate?: string;
        time: string;
        duration: number;
        language?: string;
      };
    }
  | { nom: 'changer_statut'; resume: string; requestId: string; statut: 'IN_PROGRESS' | 'CONFIRMED' | 'COMPLETED' | 'REJECTED' }
  | { nom: 'direct'; resume: string; mode: 'demarrer' | 'arreter' | 'prolonger'; minutes?: number; lien?: string }
  // Ouvre le formulaire d'annonce prérempli : le prêtre relit puis touche « Publier ».
  | { nom: 'rediger_annonce'; titre: string; texte: string; typeId?: string; lienVideo?: string };

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
      name: 'ajouter_horaire',
      description: 'Ajouter un horaire au programme (messe, confession, adoration…). Sera confirmé à l’écran.',
      parameters: {
        type: 'object',
        properties: {
          celebration: { type: 'string', description: 'Nom exact d’une célébration de la liste fournie.' },
          frequence: {
            type: 'string',
            enum: ['WEEKLY', 'DAILY', 'MONTHLY', 'ONCE'],
            description: 'WEEKLY=chaque semaine (défaut), DAILY=tous les jours, MONTHLY=une fois par mois, ONCE=une seule date',
          },
          jour: { type: 'string', enum: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] },
          semaine_du_mois: { type: 'number', description: 'MONTHLY : 1 à 5 (1 = premier).' },
          date: { type: 'string', description: 'ONCE : AAAA-MM-JJ.' },
          heure: { type: 'string', description: 'HH:MM, exactement l’heure dite.' },
          duree_minutes: { type: 'number', description: '60 si non précisé.' },
          langue: { type: 'string', description: 'Ex. Français, Fon, Yoruba, Goun, Latin — seulement si dite.' },
          dire: { type: 'string' },
        },
        required: ['celebration', 'heure', 'dire'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'changer_statut_demande',
      description:
        "Changer le statut d'UNE demande reçue (prise en charge, confirmée, célébrée, refusée), retrouvée par le nom du fidèle et/ou le jour, l'heure, le type. Sera confirmé à l'écran. Ne confirme JAMAIS un paiement (offrande) : cela se fait toujours en touchant le bouton dans la demande.",
      parameters: {
        type: 'object',
        properties: {
          statut: {
            type: 'string',
            enum: ['IN_PROGRESS', 'CONFIRMED', 'COMPLETED', 'REJECTED'],
            description: 'IN_PROGRESS=prendre en charge, CONFIRMED=confirmer, COMPLETED=célébrée, REJECTED=refuser',
          },
          fidele: { type: 'string', description: 'Nom ou prénom du fidèle, tel que dit.' },
          jour: { type: 'string', description: 'AAAA-MM-JJ de la messe demandée.' },
          heure: { type: 'string', description: 'HH:MM.' },
          type: { type: 'string', description: 'Type de demande (liste fournie).' },
          dire: { type: 'string' },
        },
        required: ['statut', 'dire'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'direct',
      description: 'Signaler la messe en direct : démarrer (durée), arrêter, ou prolonger de 30 min. Sera confirmé à l’écran.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['demarrer', 'arreter', 'prolonger'] },
          minutes: { type: 'number', description: 'demarrer : 30 à 240 (90 si non précisé).' },
          lien: { type: 'string', description: 'Lien https du direct, seulement s’il est dicté.' },
          dire: { type: 'string' },
        },
        required: ['mode', 'dire'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rediger_annonce',
      description:
        "Rédiger une annonce dictée : titre court et texte mis au propre (ponctuation, majuscules, sans rien inventer). L'app ouvre le formulaire prérempli ; le prêtre relit et publie.",
      parameters: {
        type: 'object',
        properties: {
          titre: { type: 'string' },
          texte: { type: 'string' },
          categorie: { type: 'string', description: 'Catégorie d’annonce de la liste fournie, si évidente.' },
          lien_video: { type: 'string' },
          dire: { type: 'string' },
        },
        required: ['titre', 'texte', 'dire'],
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
    private readonly requestService: RequestService,
    private readonly typeService: TypeService,
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

    const [types, horaires, celebrations, categories] = await Promise.all([
      this.requestTypeService.listActive(),
      this.scheduleService.listMassesForChurch(churchId).catch(() => []),
      this.typeService.listActive({ scope: TypeScope.SCHEDULE }).catch(() => []),
      this.typeService.listActive({ scope: TypeScope.PUBLICATION }).catch(() => []),
    ]);
    const heures = [...new Set(horaires.map((h) => h.time.slice(0, 5)))].sort();

    const { message } = await this.llm.complete(
      {
        messages: [
          {
            role: 'system',
            content: this.prompt(types.map((t) => t.name), heures, ecran, celebrations.map((c) => c.name), categories.map((c) => c.name)),
          },
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
      case 'ajouter_horaire': {
        const nom = typeof args.celebration === 'string' ? normaliser(args.celebration) : '';
        const cel =
          celebrations.find((c) => normaliser(c.name) === nom) ?? celebrations.find((c) => !!nom && normaliser(c.name).includes(nom));
        if (!cel) return { dire: 'Quelle célébration voulez-vous ajouter ?', action: null };
        const heure = heureHHMM(args.heure);
        if (!heure) return { dire: 'À quelle heure ?', action: null };
        const date = typeof args.date === 'string' && DATE.test(args.date) ? args.date : undefined;
        const frequency = (['WEEKLY', 'DAILY', 'MONTHLY', 'ONCE'] as const).find((f) => f === args.frequence) ?? (date ? 'ONCE' : 'WEEKLY');
        const dayOfWeek = JOURS.indexOf(String(args.jour ?? '').toLowerCase());
        if ((frequency === 'WEEKLY' || frequency === 'MONTHLY') && dayOfWeek < 0) return { dire: 'Quel jour de la semaine ?', action: null };
        if (frequency === 'ONCE' && !date) return { dire: 'Pour quelle date ?', action: null };
        const weekOfMonth = frequency === 'MONTHLY' ? Math.min(5, Math.max(1, Number(args.semaine_du_mois) || 1)) : undefined;
        const duration = Math.min(600, Math.max(10, Math.round(Number(args.duree_minutes) || 60)));
        const langue = typeof args.langue === 'string' && args.langue.trim() ? args.langue.trim().slice(0, 40) : undefined;
        const rangs = ['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième'];
        const quand =
          frequency === 'DAILY'
            ? 'tous les jours'
            : frequency === 'ONCE'
              ? `le ${dateFr(date!)}`
              : frequency === 'MONTHLY'
                ? `le ${rangs[weekOfMonth! - 1]} ${JOURS[dayOfWeek]} du mois`
                : `chaque ${JOURS[dayOfWeek]}`;
        return {
          dire,
          action: {
            nom: 'ajouter_horaire',
            resume: `${cel.name} ${quand} à ${heureFr(heure)}${langue ? ` (${langue})` : ''} · ${duration} min`,
            horaire: {
              typeId: cel.id,
              frequency,
              ...(frequency === 'WEEKLY' || frequency === 'MONTHLY' ? { dayOfWeek } : {}),
              ...(weekOfMonth ? { weekOfMonth } : {}),
              ...(date && frequency === 'ONCE' ? { startDate: date } : {}),
              time: `${heure}:00`,
              duration,
              ...(langue ? { language: langue } : {}),
            },
          },
        };
      }
      case 'changer_statut_demande': {
        const statut = (['IN_PROGRESS', 'CONFIRMED', 'COMPLETED', 'REJECTED'] as const).find((x) => x === args.statut);
        if (!statut) return { dire: 'Que voulez-vous faire de la demande ?', action: null };
        const fidele = typeof args.fidele === 'string' ? normaliser(args.fidele) : '';
        const jourD = typeof args.jour === 'string' && DATE.test(args.jour) ? args.jour : '';
        const heureD = heureHHMM(args.heure);
        const typeN = typeof args.type === 'string' ? normaliser(args.type) : '';
        if (!fidele && !jourD && !heureD && !typeN) {
          return { dire: 'De quelle demande s’agit-il ? Donnez le nom du fidèle ou la date.', action: null };
        }
        const demandes = await this.requestService.listForChurch(user, churchId);
        const candidats = demandes.filter((d) => {
          // Une demande déjà dans ce statut, célébrée ou refusée n'est plus à traiter.
          if (d.status === statut || d.status === 'COMPLETED' || d.status === 'REJECTED') return false;
          const nomComplet = normaliser(`${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`);
          if (fidele && !fidele.split(/\s+/).every((m) => nomComplet.includes(m))) return false;
          if (jourD && String(d.date).slice(0, 10) !== jourD) return false;
          if (heureD && d.schedule?.time?.slice(0, 5) !== heureD) return false;
          if (typeN && !normaliser(d.type?.name ?? '').includes(typeN)) return false;
          return true;
        });
        if (!candidats.length) return { dire: 'Je n’ai trouvé aucune demande à traiter qui correspond.', action: null };
        const verbe = { IN_PROGRESS: 'Prends en charge', CONFIRMED: 'Confirme', COMPLETED: 'Marque célébrée', REJECTED: 'Refuse' }[statut];
        if (candidats.length > 1) {
          return {
            dire: `J’ai trouvé ${candidats.length} demandes. Laquelle ?`,
            action: null,
            choix: candidats.slice(0, 3).map((d) => `${verbe} la demande de ${descriptionDemande(d)}`),
          };
        }
        const d = candidats[0];
        const libelle = { IN_PROGRESS: 'Prendre en charge', CONFIRMED: 'Confirmer', COMPLETED: 'Marquer célébrée', REJECTED: 'Refuser' }[statut];
        return { dire, action: { nom: 'changer_statut', requestId: d.id, statut, resume: `${libelle} : ${descriptionDemande(d)}` } };
      }
      case 'direct': {
        const mode = (['demarrer', 'arreter', 'prolonger'] as const).find((m) => m === args.mode) ?? 'demarrer';
        const minutes = mode === 'demarrer' ? Math.min(240, Math.max(30, Math.round(Number(args.minutes) || 90))) : undefined;
        const lien = typeof args.lien === 'string' && /^https?:\/\//i.test(args.lien) ? args.lien.slice(0, 500) : undefined;
        const duree = minutes ? (minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60}` : ''}` : `${minutes} min`) : '';
        const resume = mode === 'demarrer' ? `Signaler la messe en direct pour ${duree}` : mode === 'prolonger' ? 'Prolonger le direct de 30 min' : 'Arrêter le direct';
        return { dire, action: { nom: 'direct', mode, resume, ...(minutes ? { minutes } : {}), ...(lien ? { lien } : {}) } };
      }
      case 'rediger_annonce': {
        const titre = typeof args.titre === 'string' ? args.titre.trim().slice(0, 160) : '';
        const texte = typeof args.texte === 'string' ? args.texte.trim().slice(0, 4000) : '';
        if (!titre || !texte) return { dire: 'Dictez le titre et le texte de l’annonce.', action: null };
        const cat = typeof args.categorie === 'string' ? normaliser(args.categorie) : '';
        const typeAnnonce = cat ? (categories.find((c) => normaliser(c.name) === cat) ?? categories.find((c) => normaliser(c.name).includes(cat))) : undefined;
        const lienVideo = typeof args.lien_video === 'string' && /^https?:\/\//i.test(args.lien_video) ? args.lien_video : undefined;
        return { dire, action: { nom: 'rediger_annonce', titre, texte, ...(typeAnnonce ? { typeId: typeAnnonce.id } : {}), ...(lienVideo ? { lienVideo } : {}) } };
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

  private prompt(types: string[], heures: string[], ecran?: string, celebrations: string[] = [], categories: string[] = []): string {
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
      `Célébrations du programme (pour ajouter_horaire) : ${celebrations.join(' ; ') || 'aucune'}.`,
      `Catégories d'annonce : ${categories.join(' ; ') || 'aucune'}.`,
      "MODIFIER À LA VOIX (l'app demandera confirmation à l'écran) : ajouter un horaire → ajouter_horaire ; prendre en charge / confirmer / marquer célébrée / refuser une demande → changer_statut_demande ; « je suis en direct », « arrête le direct », « prolonge » → direct ; « rédige / écris / publie une annonce » avec son contenu dicté → rediger_annonce. S'il manque le jour ou l'heure d'un horaire, demande-le avec repondre.",
      "Statut d'une demande : appelle TOUJOURS changer_statut_demande avec ce qui est dit, même un simple prénom — tu ne vois pas les demandes, c'est le serveur qui les retrouve et propose s'il y en a plusieurs. Ne demande jamais de précision toi-même pour ça.",
      "Paiement / offrande / reçu : ne JAMAIS les confirmer à la voix — ouvre l'écran demandes et dis de toucher « Confirmer la réception » dans la demande.",
      "Intentions, messes demandées, demandes → filtrer_demandes. « À traiter », « nouvelles » → statut SUBMITTED. « Imprime », « PDF », « exporte » → pdf=true.",
      "GUIDE — « comment… », « où… », ou une modification sans outil ci-dessus (logo, photos, adresse, présentation, numéros, équipe…) : tu OUVRES le bon écran avec ouvrir_ecran et tu dis quoi toucher. Plan de l'espace :",
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
      "Pour une modification (ajouter_horaire, changer_statut_demande, direct), « dire » est une QUESTION de confirmation au futur, jamais au passé : « Je confirme la demande de Marie Houndé ? », « J'ajoute la messe du mercredi à 18 h ? ». Rien n'est fait avant que le prêtre confirme.",
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

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** « 7:00 », « 7h », « 07:30 » → « 07:00 » / « 07:30 » ; '' si illisible. */
function heureHHMM(v: unknown): string {
  const m = String(v ?? '').match(/^(\d{1,2})\s*[:hH]\s*(\d{2})?/);
  if (!m) return '';
  const h = Number(m[1]);
  const mi = Number(m[2] ?? 0);
  return h < 24 && mi < 60 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : '';
}

/** « 07:00 » → « 7 h », « 18:30 » → « 18 h 30 ». */
function heureFr(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return `${Number(h)} h${m !== '00' ? ` ${m}` : ''}`;
}

function dateFr(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
}

/** « Jean Dossou, intention du 22 novembre à 7 h ». */
function descriptionDemande(d: {
  user?: { firstName?: string; lastName?: string } | null;
  type?: { name?: string } | null;
  date: string;
  schedule?: { time?: string } | null;
}): string {
  const nom = `${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`.trim() || 'un fidèle';
  const h = d.schedule?.time ? ` à ${heureFr(d.schedule.time.slice(0, 5))}` : '';
  return `${nom}, ${(d.type?.name ?? 'demande').toLowerCase()} du ${dateFr(String(d.date).slice(0, 10))}${h}`;
}

function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
