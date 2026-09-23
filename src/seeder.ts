// ============================================================
// seeder.ts
// Point d'entrée CLI du seeding — lifecycle uniquement (connexion
// DB via le DataSource des migrations, flag --refresh). La logique
// de chaque seed vit dans database/seeds/ (un fichier par concern,
// ex: seed-admin.ts) pour rester ajoutable sans toucher cet entrypoint.
//
// Nécessite les migrations déjà appliquées (npm run migration:run).
//
// Seeds enchaînés : admin, compte de test (opt-in), types (référence
// liturgy/community), settings (config app), hiérarchie ecclésiale de
// démo (churches/clergy/schedules/publications — seed-churches.ts),
// référentiel du temps liturgique (seed-liturgical-periods.ts), groupes
// de démo (seed-groups.ts), moyens de paiement de démo
// (seed-payment-methods.ts), tarifs de démo avec repli hiérarchique
// (seed-tariffs.ts), FAQ de démo pour le bot de chat (seed-faqs.ts). Le
// découpage administratif du Bénin a son propre entrypoint
// (npm run seed:benin) — trop volumineux pour être rejoué à chaque
// `npm run seed`, mais requis en amont pour seed-churches (zones).
//
// Usage :
//   npm run seed:benin    — à jouer une fois avant le premier `npm run seed`
//   npm run seed          — idempotent, ne duplique pas les données existantes
//   npm run seed:refresh  — recrée admin/compte de test/hiérarchie de démo,
//                           réécrit settings, réactive les types (jamais
//                           de suppression de type)
// ============================================================
import 'dotenv/config';
import dataSource from './database/data-source';
import { readSeedAdminConfig, seedAdmin } from './database/seeds/seed-admin';
import { readSeedTestUserConfig, seedTestUser } from './database/seeds/seed-test-user';
import { seedTypes } from './database/seeds/seed-types';
import { seedSettings } from './database/seeds/seed-settings';
import { seedChurches } from './database/seeds/seed-churches';
import { seedLiturgicalPeriods } from './database/seeds/seed-liturgical-periods';
import { seedGroups } from './database/seeds/seed-groups';
import { seedPaymentMethods } from './database/seeds/seed-payment-methods';
import { seedTariffs } from './database/seeds/seed-tariffs';
import { seedFaqs } from './database/seeds/seed-faqs';

async function run(): Promise<void> {
    const refresh = process.argv.includes('--refresh');

    // Valide la config .env avant d'ouvrir une connexion DB — échoue vite.
    readSeedAdminConfig();
    readSeedTestUserConfig(); // no-op si non configuré ; throw si configuré mais invalide

    await dataSource.initialize();
    try {
        await seedAdmin(dataSource, refresh);
        await seedTestUser(dataSource, refresh);
        await seedTypes(dataSource, refresh);
        await seedSettings(dataSource, refresh);
        // Nécessite `npm run seed:benin` déjà joué (zones du Bénin) — no-op sinon.
        await seedChurches(dataSource, refresh);
        await seedLiturgicalPeriods(dataSource, refresh);
        // Toujours additif (pas de refresh) — voir seed-groups.ts.
        await seedGroups(dataSource);
        // Idem — voir l'en-tête de chaque fichier.
        await seedPaymentMethods(dataSource);
        await seedTariffs(dataSource);
        await seedFaqs(dataSource);
    } finally {
        await dataSource.destroy();
    }
}

run().catch((err) => {
    console.error('Échec du seed :', err);
    process.exit(1);
});
