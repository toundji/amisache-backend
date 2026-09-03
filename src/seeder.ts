// ============================================================
// seeder.ts
// Point d'entrée CLI du seeding — lifecycle uniquement (connexion
// DB via le DataSource des migrations, flag --refresh). La logique
// de chaque seed vit dans database/seeds/ (un fichier par concern,
// ex: seed-admin.ts) pour rester ajoutable sans toucher cet entrypoint.
//
// Nécessite les migrations déjà appliquées (npm run migration:run).
//
// Usage :
//   npm run seed          — idempotent, ne duplique pas les données existantes
//   npm run seed:refresh  — supprime puis recrée (admin + compte de test si configuré)
// ============================================================
import 'dotenv/config';
import dataSource from './database/data-source';
import { readSeedAdminConfig, seedAdmin } from './database/seeds/seed-admin';
import { readSeedTestUserConfig, seedTestUser } from './database/seeds/seed-test-user';

async function run(): Promise<void> {
    const refresh = process.argv.includes('--refresh');

    // Valide la config .env avant d'ouvrir une connexion DB — échoue vite.
    readSeedAdminConfig();
    readSeedTestUserConfig(); // no-op si non configuré ; throw si configuré mais invalide

    await dataSource.initialize();
    try {
        await seedAdmin(dataSource, refresh);
        await seedTestUser(dataSource, refresh);
    } finally {
        await dataSource.destroy();
    }
}

run().catch((err) => {
    console.error('Échec du seed :', err);
    process.exit(1);
});
