// ============================================================
// seed-faqs.ts
// FAQ de démonstration (content/Faq) — sans ça, GET /faq renvoie []
// et le bot de la bulle de chat (ChatBotService) n'a jamais de vraie
// réponse à donner, seulement son message de repli (voir EVOLUTION.md
// client/backend, session du 2026-09-20).
//
// Idempotent par `question` : une FAQ déjà présente n'est pas dupliquée
// ni réécrite. `--refresh` n'efface rien ici (une FAQ a pu être éditée
// depuis le panel — un refresh écraserait ce travail) : relancer sans
// argument suffit à compléter ce qui manque.
//
// Répondues dès la création (`answeredAt` posé, comme le fait
// FaqService.create) — sinon elles resteraient des brouillons invisibles
// sur la route publique et inutilisables pour tester le bot.
// ============================================================
import { DataSource } from 'typeorm';
import { Faq } from '../../content/entities/faq.entity';
import { FaqCategory } from '../../shared/common.enum';

interface SeedFaq {
  question: string;
  answer: string;
  category: FaqCategory;
}

const FAQS: SeedFaq[] = [
  {
    question: 'Comment faire une demande de messe ?',
    answer:
      "Rendez-vous sur la page « Demandes », choisissez l'intention (action de grâce, " +
      "défunt, malade...), la paroisse et la date souhaitée, puis envoyez votre demande. " +
      "Vous pouvez suivre son statut depuis « Mes demandes ».",
    category: FaqCategory.general,
  },
  {
    question: 'Comment suivre le statut de ma demande ?',
    answer:
      "Ouvrez « Mes demandes » depuis votre espace connecté : chaque demande affiche son " +
      "statut (envoyée, confirmée, célébrée...) et son détail complet.",
    category: FaqCategory.general,
  },
  {
    question: 'Comment trouver une paroisse près de chez moi ?',
    answer:
      "Utilisez l'annuaire des paroisses, accessible depuis le menu — vous pouvez chercher " +
      "par nom, ville ou quartier, et consulter les horaires de chaque paroisse.",
    category: FaqCategory.general,
  },
  {
    question: 'Comment payer une offrande ou une intention de messe ?',
    answer:
      "Lors de votre demande, choisissez un moyen de paiement publié par la paroisse (MTN " +
      "Mobile Money ou Moov Money), effectuez le paiement puis joignez votre reçu — un " +
      "membre du clergé confirmera la réception.",
    category: FaqCategory.billing,
  },
  {
    question: 'Le montant de mon offrande est-il obligatoire ?',
    answer:
      "Non, l'offrande reste facultative — vous pouvez envoyer votre demande sans paiement " +
      "et régler plus tard directement auprès de la paroisse.",
    category: FaqCategory.billing,
  },
  {
    question: 'Comment créer un compte sur Amisache ?',
    answer:
      "Cliquez sur « Se connecter » puis « Créer un compte », renseignez votre email et un " +
      "mot de passe — un code de vérification vous sera envoyé pour activer le compte.",
    category: FaqCategory.account,
  },
  {
    question: "J'ai oublié mon mot de passe, que faire ?",
    answer:
      "Sur l'écran de connexion, cliquez sur « Mot de passe oublié » et suivez les " +
      "instructions envoyées à votre adresse email pour le réinitialiser.",
    category: FaqCategory.account,
  },
  {
    question: 'Comment choisir ma paroisse de référence ?',
    answer:
      "Depuis votre profil, suivez une ou plusieurs paroisses puis choisissez celle qui " +
      "devient votre paroisse de référence — elle sera préremplie sur vos futures demandes.",
    category: FaqCategory.account,
  },
  {
    question: "Comment installer l'application sur mon téléphone ?",
    answer:
      "Ouvrez la page « Installer l'application » depuis le menu, ou utilisez le bouton " +
      "d'installation proposé par votre navigateur — Amisache s'ajoute alors à votre écran " +
      "d'accueil comme une application normale.",
    category: FaqCategory.technical,
  },
  {
    question: 'Amisache fonctionne-t-il avec une connexion internet faible ?',
    answer:
      "Oui, la plateforme est pensée pour une connexion limitée : les données déjà " +
      "consultées restent affichées pendant qu'elles se mettent à jour en arrière-plan.",
    category: FaqCategory.technical,
  },
  {
    question: 'Mes informations personnelles sont-elles protégées ?',
    answer:
      "Oui, vos données ne sont utilisées que pour le fonctionnement de la plateforme " +
      "(demandes, dons, profil) et ne sont jamais partagées avec des tiers.",
    category: FaqCategory.security,
  },
];

export async function seedFaqs(dataSource: DataSource): Promise<void> {
  const faqRepo = dataSource.getRepository(Faq);

  let created = 0;
  let skipped = 0;

  for (const [index, f] of FAQS.entries()) {
    const existing = await faqRepo.findOne({ where: { question: f.question } });
    if (existing) {
      skipped += 1;
      continue;
    }

    await faqRepo.save(
      faqRepo.create({
        question: f.question,
        answer: f.answer,
        category: f.category,
        sortOrder: index,
        answeredAt: new Date(),
      }),
    );
    created += 1;
  }

  console.log(`FAQ de démo seedées : ${created} créée(s), ${skipped} déjà présente(s).`);
}
