// ============================================================
// seed-payment-methods.ts
// Moyens de paiement de démonstration (payment/PaymentMethod) — sans ça,
// l'étape « Paiement » de /demandes (portail client) affiche toujours son
// état « paroisse sans moyen de paiement publié » (voir EVOLUTION.md client,
// 2026-09-15, câblage de l'offrande).
//
// Numéros fictifs (préfixes MTN/Moov réels au Bénin — 96/97 pour MTN, 94/95
// pour Moov — mais suite de chiffres inventée, jamais un vrai numéro).
//
// Indépendant de seed-churches.ts : résout chaque église par son slug via
// une requête directe (churchRepo.findOneBy), comme seed-groups.ts — reste
// un no-op propre si une église cible est absente. Volontairement toutes
// les paroisses ne sont PAS couvertes (saint-joseph-akpakpa, saint-paul-
// ouidah restent sans moyen de paiement) : ça garde l'état vide du
// formulaire de paiement exerçable sans avoir à désactiver un seed exprès.
//
// Idempotent par (churchId, operator) : un moyen déjà présent n'est pas
// dupliqué. `--refresh` n'efface rien ici — un moyen de paiement réel
// publié par le clergé après le seed ne doit pas pouvoir être perdu par un
// relancement ; relancer sans argument suffit à compléter ce qui manque.
// ============================================================
import { DataSource } from 'typeorm';
import { Church } from '../../church/entities/church.entity';
import { PaymentMethod } from '../../payment/entities/payment-method.entity';
import { PaymentOperator } from '../../payment/payment.enum';

interface SeedPaymentMethod {
  churchSlug: string;
  operator: PaymentOperator;
  phone: string;
  accountName: string;
}

const PAYMENT_METHODS: SeedPaymentMethod[] = [
  { churchSlug: 'notre-dame-des-apotres', operator: PaymentOperator.MTN_MOMO, phone: '96000101', accountName: 'Paroisse Notre-Dame des Apôtres' },
  { churchSlug: 'sainte-rita', operator: PaymentOperator.MOOV_MONEY, phone: '95000102', accountName: 'Paroisse Sainte-Rita' },
  { churchSlug: 'saint-michel-ganhi', operator: PaymentOperator.MTN_MOMO, phone: '96000103', accountName: 'Paroisse Saint-Michel' },
  { churchSlug: 'cathedrale-notre-dame-cotonou', operator: PaymentOperator.MTN_MOMO, phone: '96000104', accountName: 'Cathédrale Notre-Dame de Cotonou' },
  { churchSlug: 'cathedrale-notre-dame-cotonou', operator: PaymentOperator.MOOV_MONEY, phone: '95000105', accountName: 'Cathédrale Notre-Dame de Cotonou' },
  { churchSlug: 'notre-dame-porto-novo', operator: PaymentOperator.MTN_MOMO, phone: '96000106', accountName: 'Paroisse Notre-Dame de Porto-Novo' },
  { churchSlug: 'sainte-anne-abomey-calavi', operator: PaymentOperator.MTN_MOMO, phone: '96000107', accountName: "Paroisse Sainte-Anne d'Abomey-Calavi" },
  { churchSlug: 'saint-pierre-parakou', operator: PaymentOperator.MOOV_MONEY, phone: '95000108', accountName: 'Paroisse Saint-Pierre de Parakou' },
  // saint-joseph-akpakpa et saint-paul-ouidah : volontairement aucun moyen de
  // paiement — garde l'état vide du formulaire de paiement exerçable.
];

export async function seedPaymentMethods(dataSource: DataSource): Promise<void> {
  const churchRepo = dataSource.getRepository(Church);
  const methodRepo = dataSource.getRepository(PaymentMethod);

  let created = 0;
  let skippedMissingChurch = 0;
  let skippedExisting = 0;

  for (const m of PAYMENT_METHODS) {
    const church = await churchRepo.findOneBy({ slug: m.churchSlug });
    if (!church) {
      skippedMissingChurch += 1;
      continue;
    }

    const existing = await methodRepo.findOne({ where: { churchId: church.id, operator: m.operator } });
    if (existing) {
      skippedExisting += 1;
      continue;
    }

    await methodRepo.save(
      methodRepo.create({ churchId: church.id, operator: m.operator, phone: m.phone, accountName: m.accountName }),
    );
    created += 1;
  }

  console.log(
    `Moyens de paiement de démo seedés : ${created} créé(s), ${skippedExisting} déjà présent(s), ${skippedMissingChurch} ignoré(s) (église cible absente — lancez seed:churches d'abord).`,
  );
}
